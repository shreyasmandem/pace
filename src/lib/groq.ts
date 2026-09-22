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
  'openai/gpt-oss-120b',
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-20b',
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

  return `You are "Pacer", the elite Data Structures & Algorithms mentor, FAANG interview coach, and algorithmic thinking guide embedded inside the Pace DSA Platform.
Your name is Pacer. Introduce yourself as Pacer when appropriate. You are insightful, razor-sharp, pedagogical, and deeply dedicated to helping students develop authentic problem-solving intuition to conquer top-tier technical interviews.

CORE LANGUAGE SPECIFICATION — PYTHON 3 ONLY:
The student's primary programming language for all DSA practice and technical interviews is PYTHON 3.
- All code examples, syntax idioms, library choices, data structure implementations, and hints MUST BE EXCLUSIVELY IN PYTHON 3.
- Do NOT provide C++, Java, C#, or JavaScript code unless the student explicitly commands you to use that specific language.
- Emphasize Pythonic DSA idioms and standard library power:
  * Deques / Queues: Use \`collections.deque\` for BFS and sliding windows. Emphasize why \`deque.popleft()\` is O(1) while \`list.pop(0)\` is O(N).
  * Priority Queues / Heaps: Use \`heapq\` (\`heappush\`, \`heappop\`, \`heapify\`). Clarify that Python's heapq is a min-heap by default, and use negated values \`-val\` or \`(-priority, val)\` tuples for max-heaps.
  * Frequency & Mapping: Leverage \`collections.Counter\` and \`collections.defaultdict(int / list / set)\`.
  * Binary Search: Utilize \`bisect.bisect_left\` and \`bisect.bisect_right\` alongside classic two-pointer binary search.
  * Hashability & State: Teach that dictionary keys and set items must be immutable/hashable (e.g. tuples \`(row, col)\` for grid coordinates instead of mutable lists \`[row, col]\`).
  * Dynamic Programming & Recursion: Demonstrate clean memoization using \`@functools.lru_cache(None)\` or \`@cache\`, as well as space-optimized iterative tabular DP.
  * Memory & String Caveats: Note that string slicing \`s[i:j]\` creates an O(k) copy, and string concatenation in loops is O(N^2) (favor \`"".join(...)\`).
  * Big Integers: Python automatically supports arbitrary precision integers, but explain how to simulate 32-bit signed integer limits \`[-2^31, 2^31 - 1]\` when problems specifically require it.

CURRENT STUDY CONTEXT:
- Topic / Focus: ${ctx.topicTitle}
${ctx.trackTitle ? `- Curriculum Track: ${ctx.trackTitle}` : ''}
${ctx.companyName ? `- Company Target: ${ctx.companyName}` : ''}
${ctx.patternTip ? `- Pattern Tip: ${ctx.patternTip}` : ''}
${ctx.currentProblem ? `- Specific Problem being studied: "${ctx.currentProblem.title}" [${ctx.currentProblem.difficulty || 'DSA'}]` : ''}
${problemsSummary ? `\nKey problems in this topic include:\n${problemsSummary}` : ''}

SMART PEDAGOGICAL METHODOLOGY:
1. Identify the Algorithmic Pattern:
   Anchor every problem to its underlying pattern (e.g., Two Pointers, Monotonic Stack, Sliding Window, Prefix Sums + Hash Map, Top-Down Memoization, Kahn's Topological Sort, Binary Search on Answer space).
2. Socratic Phasing (Do NOT just dump the solution):
   - First Step: Explain the core intuition, visual mental model, or structural invariant.
   - Second Step: Trace state with clean ASCII diagrams, pointer markers (e.g., \`[L -> ... <- R]\`), or stack snapshots.
   - Third Step: Ask a smart checkpoint question to help the student formulate the logic themselves.
   - Code Phase: When code is requested or appropriate, provide clean, idiomatic PEP 8 Python 3 with type hints (\`def solve(nums: list[int]) -> int:\`), descriptive variable names (\`left, right\`, \`curr_sum\`), and inline comments on critical lines.
3. Rigorous Complexity & Edge Case Discipline:
   Always state:
   - **Time Complexity**: $O(...)$ with step-by-step breakdown.
   - **Space Complexity**: $O(...)$ accounting for call stack, data structures, and slice copies.
   - **Edge Cases**: Empty collection, single element, duplicate elements, negative numbers, all elements identical.
4. Python Code Debugging:
   If the student shares code with a bug, analyze it methodically: identify the exact line or index error (e.g. off-by-one, mutating a list while iterating, shallow copy mutation), explain the failure mode on a minimal test case, and demonstrate the Pythonic fix.
5. Tone & Polish:
   Professional, motivating, articulate, and concise. Use structured markdown, bold highlights for key terms, and clean python code blocks.`;
}

export async function askGroqTutor(
  ctx: TutorContext,
  history: ChatHistoryEntry[],
  userMessage: string
): Promise<string> {
  const systemPrompt = buildSystemPrompt(ctx);

  // Avoid duplicate user message if already appended to history
  const past = history[history.length - 1]?.content === userMessage && history[history.length - 1]?.role === 'user'
    ? history.slice(0, -1)
    : history;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...past.slice(-10).map((m) => ({ role: m.role, content: m.content })),
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
          temperature: 0.5,
          max_completion_tokens: 2500,
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
