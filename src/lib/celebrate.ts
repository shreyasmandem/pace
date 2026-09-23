// Distinguishes a solve the user just clicked from progress that arrived another way
// (cloud sync on sign-in, backup import), so only real, live solves get celebrated.
const INTENT_WINDOW_MS = 1500;

let lastIntent: { problemId: string; at: number } | null = null;

export function noteUserSolveIntent(problemId: string): void {
  lastIntent = { problemId, at: Date.now() };
}

export function consumeUserSolveIntent(): string | null {
  if (!lastIntent || Date.now() - lastIntent.at > INTENT_WINDOW_MS) return null;
  const { problemId } = lastIntent;
  lastIntent = null;
  return problemId;
}
