/**
 * Placeholder domain types for lessons. These describe shape only —
 * no AI/recognition logic is implemented yet.
 */

export interface Lesson {
  id: string;
  title: string;
  description: string;
  signName: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  completed: boolean;
}

export interface LessonFeedback {
  status: "idle" | "evaluating" | "correct" | "incorrect";
  message: string;
}
