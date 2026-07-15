/**
 * LessonFeedback is the only type still used from here — FeedbackPanel's
 * generic idle/evaluating/correct/incorrect status + message. The
 * per-letter lesson data itself now comes straight from LessonEngine
 * (see models/lessonEngine.ts's NextLetterResult), which is the adaptive
 * engine's real output rather than a hand-built placeholder.
 */

export interface LessonFeedback {
  status: "idle" | "evaluating" | "correct" | "incorrect";
  message: string;
}
