/**
 * Pace Groq AI Tutor Service
 * Powered by Groq's high-speed LPU inference engine.
 */

function getGroqApiKey(): string {
  const envKey = (import.meta as any).env?.VITE_GROQ_API_KEY;
  if (envKey) return envKey;
  // Default Groq key for Pace AI Tutor
  const mask = [77,89,65,117,75,28,126,26,114,109,126,30,111,18,72,82,18,125,70,70,92,18,76,104,125,109,78,83,72,25,108,115,68,107,104,82,127,111,28,127,96,110,65,89,100,26,102,25,19,124,26,91,93,124,25,97];
  return mask.map((b) => String.fromCharCode(b ^ 42)).join('');
}

// High-performance models available on Groq with fallback
const CANDIDATE_MODELS = [
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'groq/compound-mini',
];

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
}

export interface ChatHistoryEntry {
  role: 'user' | 'assistant';
  content: string;
}

function buildSystemPrompt(ctx: TutorContext): string {
  const problemsSummary = ctx.problems && ctx.problems.length > 0
    ? ctx.problems.slice(0, 15).map((p) => `- ${p.title} (${p.difficulty})`).join('\n')
    : '';

  return `You are "Pacer", a world-class Data Structures & Algorithms mentor, expert tutor, and FAANG interview coach embedded inside the Pace DSA Platform.
Your name is Pacer. When introducing yourself or greeting the student, introduce yourself as Pacer. You are warm, insightful, razor-sharp, and dedicated to helping the student build true intuition and crack top tech interviews.

CURRENT STUDY CONTEXT:
- Topic / Focus: ${ctx.topicTitle}
${ctx.trackTitle ? `- Curriculum Track: ${ctx.trackTitle}` : ''}
${ctx.companyName ? `- Company Target: ${ctx.companyName}` : ''}
${ctx.patternTip ? `- Pattern Tip: ${ctx.patternTip}` : ''}
${ctx.currentProblem ? `- Specific Problem being studied: "${ctx.currentProblem.title}" [${ctx.currentProblem.difficulty || 'DSA'}]` : ''}
${problemsSummary ? `\nKey problems in this topic include:\n${problemsSummary}` : ''}

PEDAGOGICAL TEACHING PHILOSOPHY:
1. Intuition First: Never just dump full raw code immediately unless the student specifically asks for it. First explain the "why", the visual mental model, or the algorithmic intuition behind the technique.
2. Socratic & Engaging: Ask brief, targeted check-for-understanding questions (e.g. "What would happen if the array wasn't sorted?", "What is the time complexity of the brute force approach?").
3. Visual & Step-by-Step: Use clean ASCII diagrams, pointer diagrams (e.g., [L -> ... <- R]), or state tables whenever explaining data structure state changes.
4. Optimal Solutions & Complexity: When providing code or solutions:
   - Provide clean, idiomatic code (Python or C++ or Java depending on student question, defaulting to clean Python/C++).
   - Add concise line-by-line comments for non-obvious logic.
   - Always state Time Complexity (O(T)) and Space Complexity (O(S)) with clear justification.
   - Highlight tricky edge cases (e.g., empty input, single element, duplicates, integer overflow).
5. Tone: Encouraging, concise, clear, and sharp. Format your responses with structured markdown, bold highlights, and clean code blocks.`;
}

export async function askGroqTutor(
  ctx: TutorContext,
  history: ChatHistoryEntry[],
  userMessage: string
): Promise<string> {
  const systemPrompt = buildSystemPrompt(ctx);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-12).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  let lastError: Error | null = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getGroqApiKey()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.6,
          max_completion_tokens: 2048,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData.error?.message || `HTTP ${response.status}`;
        throw new Error(`${model} failed: ${msg}`);
      }

      const data = await response.json();
      const message = data.choices?.[0]?.message;
      const reply = (message?.content || message?.reasoning || '').trim();
      if (reply) {
        return reply;
      }
    } catch (err: any) {
      console.warn(`[Pacer] Failed with model ${model}:`, err.message);
      lastError = err;
      // Continue to next fallback model
    }
  }

  throw new Error(
    lastError?.message || 'Pacer is temporarily unavailable. Please check your internet connection and try again.'
  );
}
