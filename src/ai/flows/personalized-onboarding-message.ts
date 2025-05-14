'use server';

/**
 * @fileOverview A personalized onboarding message AI agent.
 *
 * - generatePersonalizedOnboardingMessage - A function that generates a personalized onboarding message.
 * - PersonalizedOnboardingMessageInput - The input type for the generatePersonalizedOnboardingMessage function.
 * - PersonalizedOnboardingMessageOutput - The return type for the generatePersonalizedOnboardingMessage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PersonalizedOnboardingMessageInputSchema = z.object({
  username: z.string().describe('The username of the new user.'),
  forumName: z.string().describe('The name of the forum.'),
  daysToKarma: z.number().describe('The number of days a user must be registered to earn karma.'),
  karmaThreshold: z.number().describe('The amount of karma a user must have to gain voting rights.'),
});
export type PersonalizedOnboardingMessageInput = z.infer<typeof PersonalizedOnboardingMessageInputSchema>;

const PersonalizedOnboardingMessageOutputSchema = z.object({
  message: z.string().describe('The personalized onboarding message for the new user.'),
});
export type PersonalizedOnboardingMessageOutput = z.infer<typeof PersonalizedOnboardingMessageOutputSchema>;

export async function generatePersonalizedOnboardingMessage(
  input: PersonalizedOnboardingMessageInput
): Promise<PersonalizedOnboardingMessageOutput> {
  return personalizedOnboardingMessageFlow(input);
}

const prompt = ai.definePrompt({
  name: 'personalizedOnboardingMessagePrompt',
  input: {schema: PersonalizedOnboardingMessageInputSchema},
  output: {schema: PersonalizedOnboardingMessageOutputSchema},
  prompt: `Welcome to the {{{forumName}}}, {{{username}}}! We're excited to have you as part of our community.

To become a full-fledged member and gain voting rights, you'll need to achieve a karma score of {{{karmaThreshold}}} and be registered for {{{daysToKarma}}} days.

Here are some tips to get started and earn karma:

*   Introduce yourself in the introductions forum.
*   Participate in discussions and share your thoughts.
*   React to posts with emojis to show your appreciation.
*   Create your own threads and share your knowledge.

We hope you enjoy your time here and look forward to your contributions!`,
});

const personalizedOnboardingMessageFlow = ai.defineFlow(
  {
    name: 'personalizedOnboardingMessageFlow',
    inputSchema: PersonalizedOnboardingMessageInputSchema,
    outputSchema: PersonalizedOnboardingMessageOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
