/**
 * An exam on a day the school sets ("AP Chem final", "bio quiz", "SAT"), not
 * work the student fits in. With no day said, the day the spacing brain picks
 * is a placeholder, and the reply has to say so (overnight 2, Maya sim: "AP
 * Chem final" silently became "tomorrow at 3:30 PM"). A practice test, a
 * study session or a review is work, not the exam. Its own module so Today's
 * re-plan (lib/today-steps.ts) can use it without the router.
 */
export function isDatedExam(title: string): boolean {
  const s = title.toLowerCase();
  if (/\b(practice|study|studying|review|prep|preparing|flashcards?|notes|drill|drills|mock)\b/.test(s)) return false;
  return /\b(finals?|exams?|midterms?|tests?|quiz(?:zes)?|sat|act|psat|ap exam)\b/.test(s);
}
