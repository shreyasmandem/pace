import { auth } from './firebase';

export interface TutorContext {
  topicTitle: string;
  trackTitle?: string;
  companyName?: string;
  patternTip?: string;
  problems?: Array<{ title: string; difficulty: string }>;
  currentProblem?: {
    id: string;
    title: string;
    difficulty?: string;
    acceptance?: string;
    topics?: string[];
  } | null;
  preferredLanguage?: string;
}

export interface ChatHistoryEntry {
  role: 'user' | 'assistant';
  content: string;
}

export async function askGroqTutor(
  ctx: TutorContext,
  history: ChatHistoryEntry[],
  userMessage: string
): Promise<string> {
  const user = auth?.currentUser;
  if (!user) throw new Error('Sign in to chat with Pacer.');

  const last = history[history.length - 1];
  const past = last?.role === 'user' && last.content === userMessage ? history.slice(0, -1) : history;

  let response: Response;
  try {
    response = await fetch('/api/tutor', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await user.getIdToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ctx, history: past.slice(-10), userMessage }),
    });
  } catch {
    throw new Error('Pacer is temporarily unavailable. Please check your internet connection and try again.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok || typeof data.reply !== 'string') {
    throw new Error(data.error || 'Pacer is temporarily unavailable. Please try again in a moment.');
  }
  return data.reply;
}
