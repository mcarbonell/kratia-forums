
'use server';

import { db } from '@/lib/firebase';
import type { ForumCategory, Forum, Thread, Post, User as KratiaUser, Poll, Votation, SiteSettings, UserNotificationPreferences, UserNotificationSetting } from '@/lib/types';
import { 
    mockUsers as MOCK_USERS_ARRAY,
    mockCategoriesData,
    mockForumsData,
    mockThreadsData as rawMockThreadsDataWithAuthorId,
    mockPostsData as rawMockPostsDataWithAuthorId,
    mockVotationsData
} from '@/lib/mockData';
import { collection, doc, writeBatch, increment, Timestamp } from 'firebase/firestore';

const findUserByIdForSeed = (userId: string): KratiaUser => {
    const user = MOCK_USERS_ARRAY.find(u => u.id === userId);
    if (!user) {
        console.error(`Seed Error: User with ID ${userId} not found in mockData.ts MOCK_USERS_ARRAY.`);
        throw new Error(`Mock user with ID ${userId} not found. Seed data may be inconsistent.`);
    }
    return user;
};

const getAuthorPick = (user: KratiaUser): Pick<KratiaUser, 'id' | 'username' | 'avatarUrl'> => {
  if (!user || !user.id || !user.username) {
    console.error('Seed Error: Invalid user object passed to getAuthorPick:', user);
    return { id: 'unknown', username: 'Unknown User', avatarUrl: '' };
  }
  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl || `https://placehold.co/100x100.png?text=${user.username?.[0]?.toUpperCase() || 'U'}`,
  };
};

const initialConstitutionText = `
## Kratia Forums - Normas y Condiciones (Constitución)

**Preámbulo:**
Esta comunidad se rige por los principios de la democracia directa, el respeto mutuo y la participación constructiva. Las siguientes normas y condiciones establecen el marco para nuestra convivencia digital. Al registrarte y participar en Kratia Forums, aceptas cumplir con esta Constitución.

**Artículo 1: Registro y Tipos de Usuario**
1.1. **Visitante:** Puede leer contenido público.
1.2. **Usuario (en cuarentena):** Puede registrarse, crear perfil, crear hilos/respuestas (fuera del Ágora), reaccionar, enviar MPs. No puede votar ni proponer votaciones.
1.3. **Usuario Normal (con derechos de voto):** Asciende tras X días de registro y Y puntos de karma. Puede proponer y participar en votaciones vinculantes.
1.4. **Administrador:** Usuario Normal con herramientas de gestión y moderación. No puede actuar unilateralmente contra decisiones comunitarias.
1.5. **Fundador:** El primer Administrador, con rol inamovible por otros Admins.

**Artículo 2: Sistema de Karma**
2.1. El karma se calcula basado en: mensajes publicados, reacciones recibidas y respuestas a hilos creados.
2.2. El karma es un indicador de participación y contribución positiva a la comunidad.

**Artículo 3: Sistema de Votaciones Vinculantes (Ágora)**
3.1. El foro "Ágora" es el espacio para propuestas y debates de votaciones vinculantes.
3.2. Solo Usuarios Normales y Administradores pueden proponer y votar.
3.3. Las propuestas deben seguir el proceso establecido: iniciación, debate, votación secreta, publicación de resultados.
3.4. Criterios de aprobación: Quorum mínimo y mayoría simple (50% + 1).
3.5. Acciones votables incluyen: chinchetas, creación/eliminación de subforos, privacidad de subforos, sanciones temporales, y modificación de esta Constitución.

**Artículo 4: Conducta del Usuario**
4.1. **Respeto:** Trata a todos los miembros con cortesía y respeto, incluso en desacuerdo. No se tolerará el acoso, la discriminación, el discurso de odio, ni los ataques personales.
4.2. **Contenido:** Publica contenido relevante y constructivo. Evita el spam, la publicidad no solicitada (excepto en áreas designadas si existen), y el contenido ilegal o inapropiado (pornografía, violencia gráfica excesiva, etc.).
4.3. **Identidad:** No suplantes la identidad de otros usuarios o personas.
4.4. **Privacidad:** Respeta la privacidad de otros. No compartas información personal de terceros sin su consentimiento explícito.
4.5. **Propiedad Intelectual:** Respeta los derechos de autor. Cita tus fuentes y no publiques material protegido sin permiso.

**Artículo 5: Moderación**
5.1. La moderación principal es comunitaria a través de votaciones de sanción.
5.2. Los Administradores pueden realizar acciones de moderación de contenido (mover/cerrar/fijar hilos, editar/eliminar mensajes con rastro) para mantener el orden y el cumplimiento de las normas. Estas acciones no pueden anular una decisión comunitaria, aunque pueden revertir sus efectos directos, sujeto a nueva votación.
5.3. Los Administradores pueden proponer sanciones, que serán sometidas a votación.

**Artículo 6: Sanciones**
6.1. Las sanciones por incumplimiento de normas se deciden por votación comunitaria.
6.2. Las sanciones pueden incluir la suspensión temporal del acceso al foro.
6.3. El usuario propuesto para sanción tendrá derecho a defenderse en el hilo de votación de su sanción.

**Artículo 7: Modificación de la Constitución**
7.1. Esta Constitución puede ser modificada o ampliada mediante una votación vinculante aprobada por la comunidad en el Ágora.

**Artículo 8: Descargo de Responsabilidad**
8.1. Las opiniones expresadas en los foros son responsabilidad de sus autores y no necesariamente reflejan la opinión de los administradores de Kratia Forums.
8.2. Kratia Forums no se hace responsable por el contenido publicado por los usuarios.

**Aceptación de las Normas:**
Al completar el proceso de registro, declaras haber leído, entendido y aceptado estas Normas y Condiciones. El incumplimiento de esta Constitución puede resultar en sanciones decididas por la comunidad.

*(Versión 1.0 - Fecha de Creación)*
`;

const defaultNotificationPreferences: UserNotificationPreferences = {
  newReplyToMyThread: { web: true },
  votationConcludedProposer: { web: true },
  postReaction: { web: true },
  votationConcludedParticipant: { web: true },
  newPrivateMessage: { web: true }, // New
};

export async function seedDatabase() {
  const batch = writeBatch(db);
  console.log("Starting database seed...");

  const usersToSeed = MOCK_USERS_ARRAY.filter(u => u.id !== 'visitor0' && u.id !== 'guest1');
  
  const threadsStartedCounts: Record<string, number> = {};
  rawMockThreadsDataWithAuthorId.forEach(thread => {
    threadsStartedCounts[thread.authorId] = (threadsStartedCounts[thread.authorId] || 0) + 1;
  });

  console.log(`Processing ${usersToSeed.length} users...`);
  usersToSeed.forEach(user => {
    const userRef = doc(db, "users", user.id);
    const userData: KratiaUser = {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl || `https://placehold.co/100x100.png?text=${user.username?.[0]?.toUpperCase() || 'U'}`,
        registrationDate: user.registrationDate || new Date().toISOString(),
        karma: 0, 
        location: user.location || null,
        aboutMe: user.aboutMe || null,
        presentation: user.presentation || null,
        canVote: user.canVote === undefined ? false : user.canVote,
        isQuarantined: user.isQuarantined === undefined ? (user.role === 'user' && user.status === 'pending_admission') : user.isQuarantined,
        totalPostsByUser: 0,
        totalReactionsReceived: 0,
        totalPostsInThreadsStartedByUser: 0,
        totalThreadsStartedByUser: threadsStartedCounts[user.id] || 0,
        status: user.status || 'active',
        role: user.role || 'user',
        sanctionEndDate: user.sanctionEndDate || null,
        onboardingAccepted: user.onboardingAccepted || false,
        notificationPreferences: user.notificationPreferences 
          ? { ...defaultNotificationPreferences, ...user.notificationPreferences } 
          : defaultNotificationPreferences,
    };
    batch.set(userRef, userData);
  });
  console.log("Users prepared.");

  console.log(`Processing ${mockCategoriesData.length} categories...`);
  mockCategoriesData.forEach(category => {
    const catRef = doc(db, "categories", category.id);
    batch.set(catRef, category);
  });
  console.log("Categories prepared.");

  console.log(`Processing ${mockForumsData.length} forums...`);
  mockForumsData.forEach(forum => {
    const forumRef = doc(db, "forums", forum.id);
    batch.set(forumRef, { ...forum, threadCount: 0, postCount: 0 });
  });
  console.log("Forums prepared.");

  const processedMockThreadsData = rawMockThreadsDataWithAuthorId.map(t => {
    const authorUser = findUserByIdForSeed(t.authorId);
    return { ...t, author: getAuthorPick(authorUser) };
  });

  console.log(`Processing ${processedMockThreadsData.length} threads...`);
  processedMockThreadsData.forEach(thread => {
    const threadRef = doc(db, "threads", thread.id);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { authorId, ...threadDataToSave } = thread; 
    const pollData = thread.id === 'thread1_welcome' ? rawMockThreadsDataWithAuthorId.find(t => t.id === 'thread1_welcome')?.poll : undefined;
    
    batch.set(threadRef, { 
        ...threadDataToSave, 
        postCount: 0, 
        isSticky: threadDataToSave.isSticky || false,
        isLocked: threadDataToSave.isLocked || false,
        isPublic: threadDataToSave.isPublic === undefined ? true : threadDataToSave.isPublic,
        relatedVotationId: threadDataToSave.relatedVotationId || null,
        poll: pollData || null,
    });
  });
  console.log("Threads prepared.");
  
  if (mockVotationsData.length > 0) {
    console.log(`Processing ${mockVotationsData.length} votations...`);
    mockVotationsData.forEach(votation => {
        const votationRef = doc(db, "votations", votation.id);
        batch.set(votationRef, votation);
    });
    console.log("Votations prepared.");
  }

  console.log("Processing constitution setting...");
  const constitutionRef = doc(db, "site_settings", "constitution");
  const constitutionData: SiteSettings = {
    constitutionText: initialConstitutionText,
    lastUpdated: new Date().toISOString(),
  };
  batch.set(constitutionRef, constitutionData);
  console.log("Constitution setting prepared.");

  const processedMockPostsData = rawMockPostsDataWithAuthorId.map(p => {
      const authorUser = findUserByIdForSeed(p.authorId);
      return { ...p, author: getAuthorPick(authorUser) };
  });

  console.log(`Processing ${processedMockPostsData.length} posts and updating counts/karma...`);
  const threadPostCounts: Record<string, number> = {};
  const forumPostCounts: Record<string, number> = {};
  const userKarmaUpdates: Record<string, { posts: number; reactions: number; threadPosts: number }> = {};

  usersToSeed.forEach(u => {
    userKarmaUpdates[u.id] = { posts: 0, reactions: 0, threadPosts: 0 };
  });

  processedMockPostsData.forEach(post => {
    const postRef = doc(db, "posts", post.id);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { authorId, ...postDataToSave } = post; 
    batch.set(postRef, { 
        ...postDataToSave, 
        isEdited: post.isEdited || false, 
        updatedAt: post.updatedAt || null,
        lastEditedBy: post.lastEditedBy || null,
    });

    threadPostCounts[post.threadId] = (threadPostCounts[post.threadId] || 0) + 1;
    const parentThread = processedMockThreadsData.find(t => t.id === post.threadId);
    if (parentThread) {
      forumPostCounts[parentThread.forumId] = (forumPostCounts[parentThread.forumId] || 0) + 1;
      if (parentThread.author.id !== post.author.id) {
        if (userKarmaUpdates[parentThread.author.id]) {
            userKarmaUpdates[parentThread.author.id].threadPosts += 1;
        } else {
            console.warn(`Seed Warning: Author ID ${parentThread.author.id} for parent thread of post ${post.id} not found in userKarmaUpdates.`);
        }
      }
    } else {
      console.warn(`Seed Warning: Post ${post.id} has threadId ${post.threadId} but parent thread not found in mockThreadsData.`);
    }

    if (userKarmaUpdates[post.author.id]) {
      userKarmaUpdates[post.author.id].posts += 1;
      if (post.reactions) {
        Object.values(post.reactions).forEach(reaction => {
          if (reaction && reaction.userIds) {
            userKarmaUpdates[post.author.id]!.reactions += reaction.userIds.length;
          }
        });
      }
    } else {
        console.warn(`Seed Warning: Author ID ${post.author.id} for post ${post.id} not found in userKarmaUpdates.`);
    }
  });
  console.log("Posts prepared, count/karma aggregation started.");

  for (const threadId in threadPostCounts) {
    const threadRef = doc(db, "threads", threadId);
    const lastPostInThread = processedMockPostsData
        .filter(p => p.threadId === threadId)
        .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    
    batch.update(threadRef, { 
        postCount: threadPostCounts[threadId],
        lastReplyAt: lastPostInThread ? lastPostInThread.createdAt : processedMockThreadsData.find(t=>t.id === threadId)?.createdAt 
    });
  }
  console.log("Thread post counts updated.");

  const forumThreadCountsAgg: Record<string, number> = {};
  processedMockThreadsData.forEach(thread => {
    forumThreadCountsAgg[thread.forumId] = (forumThreadCountsAgg[thread.forumId] || 0) + 1;
  });
  for (const forumId in forumThreadCountsAgg) {
    const forumRef = doc(db, "forums", forumId);
    batch.update(forumRef, { 
      threadCount: forumThreadCountsAgg[forumId],
      postCount: forumPostCounts[forumId] || 0 
    });
  }
  console.log("Forum counts updated.");

  for (const userId in userKarmaUpdates) {
    if (!userKarmaUpdates[userId] || !usersToSeed.find(u => u.id === userId)) continue;
    const userRef = doc(db, "users", userId);
    const updates = userKarmaUpdates[userId];
    const totalKarmaDelta = (updates.posts || 0) + (updates.reactions || 0) + (updates.threadPosts || 0);
    
    batch.update(userRef, {
        totalPostsByUser: increment(updates.posts || 0),
        totalReactionsReceived: increment(updates.reactions || 0),
        totalPostsInThreadsStartedByUser: increment(updates.threadPosts || 0),
        karma: increment(totalKarmaDelta)
    });
  }
  console.log("User karma updated.");

  try {
    await batch.commit();
    console.log("Database seeded successfully with mock data, including constitution!");
  } catch (error) {
    console.error("Error committing seed batch to Firestore:", error);
    throw error;
  }
}

    