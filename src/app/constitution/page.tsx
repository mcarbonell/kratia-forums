import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText } from "lucide-react";

export default function ConstitutionPage() {
  // Placeholder constitution text. In a real app, this would come from Admin settings.
  const constitutionText = `
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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center">
          <FileText className="mr-3 h-8 w-8 text-primary" />
          Normas y Condiciones (Constitución)
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Constitución de Kratia Forums</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[60vh] p-4 border rounded-md">
            <div className="prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: constitutionText.replace(/\n/g, '<br />').replace(/## (.*?)(<br \/>|$)/g, '<h2>$1</h2>').replace(/\*\*(.*?)\*\*(<br \/>|$)/g, '<strong>$1</strong>$2') }} />
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}