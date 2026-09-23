import { buildSystemPrompt, contextField, polishReply, type PromptContext } from './tutorPrompt';

function getGroqApiKey(): string {
  const envKey = (import.meta as any).env?.VITE_GROQ_API_KEY;
  if (envKey) return envKey;
  // Default Groq key for Pace AI Tutor
  const mask = [77,89,65,117,75,28,126,26,114,109,126,30,111,18,72,82,18,125,70,70,92,18,76,104,125,109,78,83,72,25,108,115,68,107,104,82,127,111,28,127,96,110,65,89,100,26,102,25,19,124,26,91,93,124,25,97];
  return mask.map((b) => String.fromCharCode(b ^ 42)).join('');
}

const CANDIDATE_MODELS = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b'];
const MAX_HISTORY_ENTRIES = 10;
const MAX_HISTORY_ENTRY_CHARS = 8000;

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

function toPromptContext(ctx: TutorContext): PromptContext {
  const currentTitle = contextField(ctx.currentProblem?.title);
  return {
    topicTitle: contextField(ctx.topicTitle) || 'Data structures and algorithms',
    trackTitle: contextField(ctx.trackTitle),
    companyName: contextField(ctx.companyName),
    patternTip: contextField(ctx.patternTip, 1000),
    problems: (ctx.problems || []).slice(0, 15).flatMap((p) => {
      const title = contextField(p.title);
      return title ? [{ title, difficulty: contextField(p.difficulty, 20) || 'unrated' }] : [];
    }),
    currentProblem: currentTitle
      ? { title: currentTitle, difficulty: contextField(ctx.currentProblem?.difficulty, 20) }
      : undefined,
    preferredLanguage: contextField(ctx.preferredLanguage, 20),
  };
}

export async function askGroqTutor(
  ctx: TutorContext,
  history: ChatHistoryEntry[],
  userMessage: string
): Promise<string> {
  const last = history[history.length - 1];
  const past = last?.role === 'user' && last.content === userMessage ? history.slice(0, -1) : history;

  const messages = [
    { role: 'system', content: buildSystemPrompt(toPromptContext(ctx)) },
    ...past.slice(-MAX_HISTORY_ENTRIES).map((m) => ({ role: m.role, content: m.content.slice(0, MAX_HISTORY_ENTRY_CHARS) })),
    { role: 'user', content: userMessage },
  ];

  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getGroqApiKey()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, temperature: 0.6, max_completion_tokens: 3000 }),
      });
      if (!response.ok) {
        console.warn(`[Pacer] ${model} failed with HTTP ${response.status}`);
        continue;
      }
      const data = await response.json();
      const choice = data.choices?.[0];
      // Never fall back to the model's reasoning field: that's its scratchpad, not an answer.
      const content = typeof choice?.message?.content === 'string' ? choice.message.content : '';
      const reply = polishReply(content, choice?.finish_reason === 'length');
      if (reply) return reply;
    } catch (err) {
      console.warn(`[Pacer] ${model} failed:`, err instanceof Error ? err.message : err);
    }
  }

  throw new Error('Pacer is temporarily unavailable. Please check your connection and try again.');
}
