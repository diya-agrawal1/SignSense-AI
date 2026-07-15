/**
 * A small, hand-picked list of short, common English words for spelling
 * exercises. Deliberately embedded as a static array rather than fetched
 * from a dictionary API — LessonEngine must work fully offline, and this
 * list is small enough that bundling it costs nothing meaningful.
 *
 * Kept short (2-4 letters) so a learner who's only mastered a handful of
 * letters still has a realistic chance of a fully-spellable word — see
 * LessonEngine.pickSpellingWord, which filters this list down to words
 * using only currently "ready" letters.
 */
export const SPELLING_WORD_LIST: readonly string[] = [
  "AT", "BE", "GO", "IT", "UP", "ME", "NO", "SO", "WE",
  "CAB", "CAT", "DOG", "EAR", "BAT", "FAN", "HAT", "JAM", "KID",
  "LEG", "MAP", "NET", "OWL", "PEN", "RUN", "SUN", "TOP", "VAN",
  "WEB", "BOX", "YES", "ZOO", "ADD", "BAD", "CUP", "DIP", "AGE",
  "BIG", "CAN", "DAY", "EGG", "FUN", "GAP", "HOT", "ICE", "JOG",
  "KIT", "LOG", "MUD", "NUT", "OIL", "PIG", "RAT", "SIT", "TEA",
];
