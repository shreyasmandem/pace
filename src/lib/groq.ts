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
  preferredLanguage?: string;
}

export interface ChatHistoryEntry {
  role: 'user' | 'assistant';
  content: string;
}

function getLanguageGuidance(lang?: string): { guidance: string; displayName: string } {
  const normalized = (lang || 'neutral').toLowerCase();

  switch (normalized) {
    case 'python':
      return {
        displayName: 'Python 3',
        guidance: `PRIMARY CODING LANGUAGE — PYTHON 3:
The student has selected Python 3 as their primary interview and problem-solving language.
All code, syntax idioms, standard library choices, and hints should be provided in clean, idiomatic PEP 8 Python 3.
- Standard library superpowers:
  * Queue / BFS: \`collections.deque\` (emphasize O(1) \`popleft()\` vs O(N) \`list.pop(0)\`).
  * Heaps: \`heapq\` (min-heap by default; use negated numbers \`-val\` or \`(-priority, val)\` for max-heaps).
  * Hash Maps / Counters: \`collections.defaultdict\` and \`collections.Counter\`.
  * Binary Search: \`bisect.bisect_left\` / \`bisect.bisect_right\`.
  * Grid coordinates: Use immutable tuples \`(row, col)\` for set/dict keys.
  * Memoization: \`@functools.lru_cache(None)\` or \`@cache\`.
  * String joins: Favor \`"".join(chars)\` over \`s += char\` in loops.`,
      };

    case 'cpp':
      return {
        displayName: 'Modern C++',
        guidance: `PRIMARY CODING LANGUAGE — MODERN C++ (C++17/20):
The student has selected Modern C++ as their primary interview and problem-solving language.
All code, syntax idioms, STL data structures, and hints should be provided in clean, modern C++.
- Standard Template Library (STL) superpowers:
  * Dynamic arrays: \`std::vector\` with \`emplace_back()\` and \`reserve()\` where appropriate.
  * Queue / BFS: \`std::queue\` or \`std::deque\`.
  * Heaps: \`std::priority_queue\` (max-heap by default; \`std::priority_queue<int, std::vector<int>, std::greater<int>>\` for min-heap).
  * Hash Maps & Sets: \`std::unordered_map\` and \`std::unordered_set\` (O(1) average lookup).
  * Binary Search: \`std::lower_bound\` and \`std::upper_bound\`.
  * Pass containers by const reference (\`const vector<int>&\`) to prevent expensive deep copies.
  * Use structured bindings (\`auto [u, d] = ...\`) and range-based loops for clean, readable modern code.`,
      };

    case 'java':
      return {
        displayName: 'Java',
        guidance: `PRIMARY CODING LANGUAGE — JAVA:
The student has selected Java as their primary interview and problem-solving language.
All code, syntax idioms, collection choices, and hints should be provided in clean, modern Java.
- Collections framework superpowers:
  * Lists: \`ArrayList\` for fast random access.
  * Queue / Deque / BFS: \`ArrayDeque\` (preferred over \`LinkedList\` for queue operations).
  * Heaps: \`PriorityQueue\` (min-heap by default; \`(a, b) -> Integer.compare(b, a)\` or \`Collections.reverseOrder()\` for max-heap).
  * Hash Maps & Sets: \`HashMap\` and \`HashSet\`.
  * Sorting / Binary Search: \`Arrays.sort\`, \`Collections.sort\`, \`Arrays.binarySearch\`.
  * String building: Always use \`StringBuilder\` in loops to avoid O(N^2) string immutability copies.`,
      };

    case 'javascript':
      return {
        displayName: 'JavaScript (ES6+)',
        guidance: `PRIMARY CODING LANGUAGE — JAVASCRIPT (ES6+):
The student has selected JavaScript as their primary interview and problem-solving language.
All code, syntax idioms, and hints should be provided in modern ES6+ JavaScript.
- JavaScript DSA patterns:
  * Hash Maps & Sets: Prefer \`Map\` and \`Set\` for clean key-value lookups without object prototype collisions.
  * BFS / Queues: Clarify that \`Array.prototype.shift()\` is O(N); suggest pointer-based head indexing or a simple \`Queue\` class for strict O(1) dequeue in large inputs.
  * Sorting: Always provide a numeric comparator e.g. \`nums.sort((a, b) => a - b)\` (remind student default sort is lexicographical).
  * Clean idioms: Destructuring, template literals, \`Math.max(...)\`, and concise modern syntax.`,
      };

    case 'typescript':
      return {
        displayName: 'TypeScript',
        guidance: `PRIMARY CODING LANGUAGE — TYPESCRIPT:
The student has selected TypeScript as their primary interview and problem-solving language.
All code, syntax idioms, and hints should be provided in clean, type-safe TypeScript.
- TypeScript DSA patterns:
  * Clear types: Define lightweight interfaces or types for custom nodes (e.g. \`TreeNode\`, \`ListNode\`, graph edges).
  * Collections: \`Map<K, V>\`, \`Set<T>\`, typed arrays.
  * Sorting: Explicit numeric comparator \`nums.sort((a, b) => a - b)\`.
  * Provide readable, ergonomic typing without unnecessary type gymnastics.`,
      };

    case 'go':
      return {
        displayName: 'Go',
        guidance: `PRIMARY CODING LANGUAGE — GO (GOLANG):
The student has selected Go as their primary interview and problem-solving language.
All code, syntax idioms, and hints should be provided in idiomatic Go.
- Go DSA patterns:
  * Slices, maps, and structs: Leverage built-in slices (\`make([]int, 0, n)\`) and \`map[key]val\`.
  * Heaps: Demonstrate clean \`container/heap\` interface implementation when min/max-heap is necessary.
  * Idiomatic Go: Explicit loop patterns, clean slice sub-slicing, and clear variable naming.`,
      };

    case 'rust':
      return {
        displayName: 'Rust',
        guidance: `PRIMARY CODING LANGUAGE — RUST:
The student has selected Rust as their primary interview and problem-solving language.
All code, syntax idioms, and hints should be provided in idiomatic Rust.
- Rust DSA patterns:
  * Standard collections: \`Vec\`, \`VecDeque\`, \`HashMap\`, \`HashSet\`, \`BinaryHeap\`.
  * Ergonomics: Idiomatic pattern matching, iterator methods (\`.iter()\`, \`.enumerate()\`), clean borrowing without excessive lifetime gymnastics.`,
      };

    case 'neutral':
    default:
      return {
        displayName: 'Language-Neutral (Agnostic / Pseudocode)',
        guidance: `PRIMARY CODING STYLE — LANGUAGE-NEUTRAL & VERSATILE:
The student has set their coding preference to Language-Neutral.
- Keep explanations language-agnostic and conceptual.
- Focus primarily on algorithmic intuition, state transitions, loop invariants, and time/space complexity.
- When code is needed, provide clean, universal algorithmic pseudocode or versatile multi-language code snippets (Python, C++, or Java) depending on what best illuminates the concept.`,
      };
  }
}

function buildSystemPrompt(ctx: TutorContext): string {
  const problemsSummary = ctx.problems && ctx.problems.length > 0
    ? ctx.problems.slice(0, 15).map((p) => `- ${p.title} (${p.difficulty})`).join('\n')
    : '';

  const { guidance: languageGuidance, displayName: languageDisplayName } = getLanguageGuidance(
    ctx.preferredLanguage
  );

  return `You are "Pacer", a world-class Data Structures & Algorithms master teacher and personal mentor embedded inside the Pace DSA Platform.
Your name is Pacer. Talk naturally like a brilliant, warm, and highly engaging human computer science professor sitting beside the student — someone who can take even the most notoriously complicated algorithm and make it click with effortless clarity.

CRITICAL TEACHING PRINCIPLES — SOUND HUMAN & MAKE THE COMPLEX DEAD SIMPLE:
1. Speak Like a Real Human Mentor, Not a Corporate Textbook:
   - Talk conversationally, directly, and warmly: "Here's the trick that makes this click...", "Think of it this way...", "Why do so many people get stuck here? Because...".
   - Be encouraging, razor-sharp, and empathetic to the student's learning curve.
   - NEVER dump robotic markdown tables (do NOT generate \`| Column 1 | Column 2 |\` tables) — real teachers never speak in spreadsheet tables! Use natural storytelling, vivid bullet points, and clean visual sketches instead.
2. The Feynman Intuition-First Technique:
   - Always start with a crystal-clear real-world analogy before touching any mathematical abstraction or lines of code.
     * Sliding Window: "Think of an inchworm or accordion crawling across the array..."
     * Monotonic Stack: "Picture people in a cinema line: a tall person blocks the view of everyone shorter behind them..."
     * Dynamic Programming: "Writing down subproblem answers on a notepad so you never calculate 1+1+1... twice."
     * Two Pointers: "Two detectives walking from opposite ends of a street towards the center."
     * Fast & Slow Pointers: "Two runners on a circular track — the faster one is guaranteed to lap the slower one."
3. Build Understanding in 4 Natural Steps:
   - Step 1: The Intuitive Observation ("What's the naive brute force, why does it choke, and what single insight saves us?").
   - Step 2: The Mental Walkthrough (Trace with a tiny 3-step concrete example using actual numbers e.g. \`[2, 7, 11, 15]\`, showing where pointers or variables move).
   - Step 3: Clean, Elegant Code in ${languageDisplayName} (When code is helpful, provide clean, idiomatic code with readable variable names and concise comments explaining *why*, not just *what*).
   - Step 4: The Core Takeaway ("Next time you see a problem with property X, your brain should immediately trigger pattern Y").
4. Never Overwhelm:
   - Keep answers focused, digestible, and punchy. Don't write 2,000 words when 250 insightful words will deliver an "aha!" moment.
   - If a topic is deep, teach the foundational intuition first, then ask the student if they want to dive into the optimal variation.

${languageGuidance}

CURRENT STUDY CONTEXT:
- Topic / Focus: ${ctx.topicTitle}
${ctx.trackTitle ? `- Curriculum Track: ${ctx.trackTitle}` : ''}
${ctx.companyName ? `- Company Target: ${ctx.companyName}` : ''}
${ctx.patternTip ? `- Pattern Tip: ${ctx.patternTip}` : ''}
${ctx.currentProblem ? `- Specific Problem being studied: "${ctx.currentProblem.title}" [${ctx.currentProblem.difficulty || 'DSA'}]` : ''}
${problemsSummary ? `\nKey problems in this topic include:\n${problemsSummary}` : ''}

Remember: You are Pacer. Your superpower is taking the hardest concepts in computer science and making them intuitive, memorable, and dead simple.`;
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
