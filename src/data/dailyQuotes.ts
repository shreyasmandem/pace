export interface DailyQuote {
  quote: string;
  author: string;
  tag: string;
}

export const DAILY_QUOTES: DailyQuote[] = [
  {
    quote: "The art of programming is the art of organizing complexity, of mastering multitude and avoiding its bastard chaos.",
    author: "Edsger W. Dijkstra",
    tag: "Mastery",
  },
  {
    quote: "First, solve the problem. Then, write the code.",
    author: "John Johnson",
    tag: "Mindset",
  },
  {
    quote: "Premature optimization is the root of all evil. Write clean, correct code first; optimize the bottleneck with data.",
    author: "Donald Knuth",
    tag: "Optimization",
  },
  {
    quote: "Talk is cheap. Show me the code.",
    author: "Linus Torvalds",
    tag: "Action",
  },
  {
    quote: "Any fool can write code that a computer can understand. Good programmers write code that humans can understand.",
    author: "Martin Fowler",
    tag: "Clean Code",
  },
  {
    quote: "Consistency compounds exponentially. One well-understood algorithm every day yields 365 mental models a year.",
    author: "Pace Core Philosophy",
    tag: "Consistency",
  },
  {
    quote: "When stuck on an algorithm, stop typing. Step back, draw the state on paper, and trace the invariant.",
    author: "Problem Solving Principle",
    tag: "Strategy",
  },
  {
    quote: "Before you can master dynamic programming, you must master the recursion tree and subproblem overlap.",
    author: "Algorithmic Mindset",
    tag: "Algorithms",
  },
  {
    quote: "Make it work, make it right, make it fast — in that exact order.",
    author: "Kent Beck",
    tag: "Execution",
  },
  {
    quote: "If you cannot explain your approach with a pen and paper, you do not understand it well enough to code it.",
    author: "Richard Feynman Principle",
    tag: "First Principles",
  },
  {
    quote: "The most effective debugging tool is still careful thought, coupled with judiciously placed print statements.",
    author: "Brian Kernighan",
    tag: "Debugging",
  },
  {
    quote: "Data dominates. If you've chosen the right data structures and organized things well, the algorithms will almost always be self-evident.",
    author: "Rob Pike",
    tag: "Data Structures",
  },
  {
    quote: "An algorithm must be seen to be believed, and the best way to see what an algorithm does is to step through it with small examples.",
    author: "Donald Knuth",
    tag: "Visualization",
  },
  {
    quote: "Mastering DSA is not about memorizing 500 solutions. It is about recognizing the 15 underlying patterns.",
    author: "Pattern Mastery",
    tag: "Patterns",
  },
  {
    quote: "What you do every day matters more than what you do once in a while.",
    author: "Gretchen Rubin",
    tag: "Discipline",
  },
  {
    quote: "Great developers aren't born knowing graph traversals — they build intuition one edge and one node at a time.",
    author: "Engineering Wisdom",
    tag: "Growth",
  },
  {
    quote: "In mathematics and programming, the way to learn is to do. You cannot learn to swim by watching others from the pool deck.",
    author: "Paul Halmos",
    tag: "Practice",
  },
  {
    quote: "Don't measure your progress by how fast you solve a hard problem. Measure it by how deeply you understand why your first attempt failed.",
    author: "Engineering Mindset",
    tag: "Reflection",
  },
  {
    quote: "A problem clearly stated is a problem half-solved.",
    author: "Charles Kettering",
    tag: "Clarification",
  },
  {
    quote: "The only way to go fast, is to go well.",
    author: "Robert C. Martin",
    tag: "Quality",
  },
  {
    quote: "Two pointers, sliding window, prefix sums, binary search: simple primitives create powerful algorithms.",
    author: "Pattern Wisdom",
    tag: "Patterns",
  },
  {
    quote: "Patience is a key element of success. Give yourself the space to sit with an algorithm until the fog lifts.",
    author: "Engineering Mindset",
    tag: "Patience",
  },
  {
    quote: "Every expert was once a beginner who refused to quit when the recursion base case felt confusing.",
    author: "Daily Motivation",
    tag: "Resilience",
  },
  {
    quote: "You don't need endless motivation; you just need a repeatable system that you sit down with every day.",
    author: "James Clear Principle",
    tag: "System",
  },
  {
    quote: "Space complexity is often the price we pay to tame time complexity. Know your trade-offs.",
    author: "Systems Wisdom",
    tag: "Complexity",
  },
  {
    quote: "The standard of excellence is built in the quiet hours when no one is watching your commits.",
    author: "Daily Discipline",
    tag: "Focus",
  },
  {
    quote: "Treat every edge case not as an annoying glitch, but as a boundary condition that proves your invariant.",
    author: "Algorithmic Rigor",
    tag: "Rigor",
  },
  {
    quote: "Small daily improvements over time lead to stunning results. Solve today's challenge.",
    author: "Compounding Growth",
    tag: "Compounding",
  },
  {
    quote: "Simplicity is prerequisite for reliability.",
    author: "Edsger W. Dijkstra",
    tag: "Simplicity",
  },
  {
    quote: "Optimism is an occupational hazard of programming: feedback is the treatment.",
    author: "Kent Beck",
    tag: "Feedback",
  },
  {
    quote: "The secret to doing good work is finding a problem that actually bothers you and systematically dismantling it.",
    author: "Paul Graham",
    tag: "Curiosity",
  },
  {
    quote: "The best programs are written so that computing machines can perform them quickly and so that human beings can understand them clearly.",
    author: "Donald Knuth",
    tag: "Clarity",
  },
  {
    quote: "An algorithm is like a recipe: precision in every ingredient, or the whole soufflé collapses.",
    author: "CS Insight",
    tag: "Precision",
  },
  {
    quote: "Depth before breadth. Fully mastering BFS and DFS unlocks 70% of tree and graph problems on LeetCode.",
    author: "Curriculum Insight",
    tag: "Mastery",
  },
  {
    quote: "Trust the process. Your brain builds synapses while you sleep; the problem you struggled with today will make sense tomorrow.",
    author: "Neuroscience of Coding",
    tag: "Recovery",
  },
];

/**
 * Returns the day of year (1-366) for deterministic daily rotation
 */
export function getDayOfYear(date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime() + (start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000;
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

/**
 * Gets the deterministic quote for today
 */
export function getDailyQuote(date = new Date()): DailyQuote {
  const day = getDayOfYear(date);
  return DAILY_QUOTES[day % DAILY_QUOTES.length];
}
