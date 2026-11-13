/**
 * The single source of truth for the API contract.
 *
 * Both the Hono backend and the React app import these schemas, so a change
 * here is a compile error on both sides instead of a runtime surprise.
 */
import { z } from "zod";

/* ─────────────────────────────── primitives ─────────────────────────────── */

export const levelSchema = z.enum(["A2", "B1", "B2", "C1"]);
export const reviewQualitySchema = z.enum(["again", "hard", "good", "easy"]);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email("Enter a valid email address"));
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128, "That password is too long");

/* ─────────────────────────────── requests ───────────────────────────────── */

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(60),
  email: emailSchema,
  password: passwordSchema
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required")
});

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  level: levelSchema.optional(),
  dailyGoal: z.number().int().min(5).max(100).optional()
});

export const reviewCardSchema = z.object({
  wordId: z.uuid(),
  quality: reviewQualitySchema
});

export const lessonAttemptSchema = z
  .object({
    score: z.number().int().min(0),
    total: z.number().int().min(1).max(50)
  })
  .refine((v) => v.score <= v.total, {
    message: "score cannot be greater than total",
    path: ["score"]
  });

export const speakingAttemptSchema = z.object({
  phraseId: z.uuid(),
  transcript: z.string().trim().min(1, "Say or type the phrase first").max(600)
});

/**
 * Multipart form fields for a recorded attempt. `transcript` is optional
 * because the API can transcribe the clip when an OpenAI-compatible key is
 * configured (the only way Firefox/Safari can do microphone drills).
 */
export const speakingAudioAttemptSchema = z.object({
  phraseId: z.uuid(),
  transcript: z.string().trim().max(600).optional(),
  saveAudio: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((value) => value === "true")
});

/* ─────────────────────────────── responses ──────────────────────────────── */

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
    details: z.unknown().optional()
  })
});

export const authUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable()
});

export const profileSchema = z.object({
  userId: z.string(),
  displayName: z.string().nullable(),
  level: levelSchema,
  dailyGoal: z.number(),
  xp: z.number(),
  streak: z.number(),
  lastStudyOn: z.string().nullable()
});

export const meResponseSchema = z.object({
  user: authUserSchema,
  profile: profileSchema
});

export const cardProgressSchema = z.object({
  ease: z.number(),
  intervalDays: z.number(),
  reps: z.number(),
  lapses: z.number(),
  dueAt: z.string(),
  lastReviewedAt: z.string().nullable()
});

export const vocabularyCardSchema = z.object({
  id: z.uuid(),
  term: z.string(),
  pos: z.string(),
  ipa: z.string().nullable(),
  meaning: z.string(),
  example: z.string(),
  synonyms: z.string(),
  level: levelSchema,
  progress: cardProgressSchema.nullable(),
  due: z.boolean()
});

export const vocabularyResponseSchema = z.object({
  cards: z.array(vocabularyCardSchema),
  dueCount: z.number(),
  newCount: z.number()
});

export const reviewResponseSchema = z.object({
  card: vocabularyCardSchema,
  xpGained: z.number(),
  totalXp: z.number(),
  streak: z.number()
});

export const statsResponseSchema = z.object({
  xp: z.number(),
  streak: z.number(),
  dailyGoal: z.number(),
  cardsToday: z.number(),
  dueCount: z.number(),
  newCount: z.number(),
  matureCount: z.number(),
  totalWords: z.number(),
  lessonsCompleted: z.number(),
  totalLessons: z.number()
});

export const lessonSummarySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  level: levelSchema,
  summary: z.string(),
  questionCount: z.number(),
  bestScore: z.number().nullable(),
  attempts: z.number()
});

export const lessonsResponseSchema = z.object({
  lessons: z.array(lessonSummarySchema)
});

export const lessonContentSchema = z.object({
  sections: z.array(z.object({ heading: z.string(), body: z.array(z.string()) })),
  examples: z.array(z.string()),
  mistakes: z.array(z.object({ wrong: z.string(), right: z.string(), note: z.string() })),
  quiz: z.array(
    z.discriminatedUnion("type", [
      z.object({
        type: z.literal("mcq"),
        prompt: z.string(),
        options: z.array(z.string()).min(2),
        answer: z.number().int().min(0),
        explanation: z.string()
      }),
      z.object({
        type: z.literal("fill"),
        prompt: z.string(),
        answers: z.array(z.string()).min(1),
        explanation: z.string()
      })
    ])
  )
});

export const lessonDetailSchema = lessonSummarySchema.extend({
  content: lessonContentSchema
});

export const speakingPhraseSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  text: z.string(),
  focus: z.string(),
  tip: z.string(),
  level: levelSchema,
  attempts: z.number(),
  bestScore: z.number().nullable()
});

export const speakingCapabilitiesSchema = z.object({
  /** An OpenAI-compatible key is configured, so audio can be transcribed. */
  transcription: z.boolean(),
  /** Azure Speech is configured, so phoneme-level scores are available. */
  phonemes: z.boolean(),
  /** Server-side clip storage is enabled. */
  storage: z.boolean()
});

export const speakingResponseSchema = z.object({
  phrases: z.array(speakingPhraseSchema),
  capabilities: speakingCapabilitiesSchema
});

export const pronunciationWordSchema = z.object({
  word: z.string(),
  /** Phoneme accuracy 0–100, or null when the provider did not score it. */
  accuracy: z.number().nullable(),
  errorType: z.string().nullable()
});

export const speechAssessmentSchema = z.object({
  provider: z.enum(["azure", "word-accuracy"]),
  accuracy: z.number().nullable(),
  fluency: z.number().nullable(),
  completeness: z.number().nullable(),
  pronunciation: z.number().nullable(),
  phonemes: z.array(pronunciationWordSchema)
});

export const speakingWordSchema = z.object({
  word: z.string(),
  matched: z.boolean()
});

export const speakingAttemptResponseSchema = z.object({
  attemptId: z.uuid(),
  score: z.number(),
  words: z.array(speakingWordSchema),
  feedback: z.string(),
  assessment: speechAssessmentSchema,
  /** Authenticated path to the stored clip, or null when nothing was kept. */
  audioUrl: z.string().nullable(),
  xpGained: z.number(),
  totalXp: z.number(),
  streak: z.number()
});

/* ────────────────────────────── listening ──────────────────────────────── */

export const dictationClipSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  text: z.string(),
  hint: z.string(),
  level: levelSchema,
  attempts: z.number(),
  bestScore: z.number().nullable()
});

export const dictationResponseSchema = z.object({
  clips: z.array(dictationClipSchema)
});

export const dictationAttemptSchema = z.object({
  clipId: z.uuid(),
  transcript: z.string().trim().min(1, "Type what you heard first").max(600)
});

export const dictationAttemptResponseSchema = z.object({
  score: z.number(),
  words: z.array(speakingWordSchema),
  feedback: z.string(),
  xpGained: z.number(),
  totalXp: z.number(),
  streak: z.number()
});

/* ──────────────────────────────── tutor ────────────────────────────────── */

export const tutorScenarioSchema = z.enum([
  "cafe",
  "interview",
  "small-talk",
  "travel",
  "landlord"
]);

export const tutorChatSchema = z.object({
  scenario: tutorScenarioSchema,
  message: z.string().trim().min(1, "Type a message first").max(500)
});

export const tutorMessageSchema = z.object({
  id: z.uuid(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  createdAt: z.string()
});

export const tutorHistoryResponseSchema = z.object({
  scenario: tutorScenarioSchema,
  opener: z.string(),
  messages: z.array(tutorMessageSchema)
});

export const tutorChatResponseSchema = z.object({
  conversationId: z.uuid(),
  reply: z.string(),
  correction: z.string().nullable(),
  provider: z.enum(["openai", "local"])
});

/** Server-sent events from `POST /api/tutor/chat/stream`. */
export const tutorStreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("meta"),
    conversationId: z.uuid(),
    provider: z.enum(["openai", "local"])
  }),
  z.object({ type: z.literal("delta"), text: z.string() }),
  z.object({
    type: z.literal("done"),
    reply: z.string(),
    correction: z.string().nullable()
  }),
  z.object({ type: z.literal("error"), message: z.string() })
]);

/* ───────────────────────────────── types ────────────────────────────────── */

export type Level = z.infer<typeof levelSchema>;
export type ReviewQuality = z.infer<typeof reviewQualitySchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ReviewCardInput = z.infer<typeof reviewCardSchema>;
export type LessonAttemptInput = z.infer<typeof lessonAttemptSchema>;
export type SpeakingAttemptInput = z.infer<typeof speakingAttemptSchema>;
export type SpeakingAudioAttemptInput = z.infer<typeof speakingAudioAttemptSchema>;
export type SpeakingCapabilities = z.infer<typeof speakingCapabilitiesSchema>;
export type PronunciationWord = z.infer<typeof pronunciationWordSchema>;
export type SpeechAssessment = z.infer<typeof speechAssessmentSchema>;

export type ApiError = z.infer<typeof apiErrorSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
export type CardProgress = z.infer<typeof cardProgressSchema>;
export type VocabularyCard = z.infer<typeof vocabularyCardSchema>;
export type VocabularyResponse = z.infer<typeof vocabularyResponseSchema>;
export type ReviewResponse = z.infer<typeof reviewResponseSchema>;
export type StatsResponse = z.infer<typeof statsResponseSchema>;
export type LessonSummary = z.infer<typeof lessonSummarySchema>;
export type LessonsResponse = z.infer<typeof lessonsResponseSchema>;
export type LessonContent = z.infer<typeof lessonContentSchema>;
export type LessonDetail = z.infer<typeof lessonDetailSchema>;
export type SpeakingPhrase = z.infer<typeof speakingPhraseSchema>;
export type SpeakingResponse = z.infer<typeof speakingResponseSchema>;
export type SpeakingWord = z.infer<typeof speakingWordSchema>;
export type SpeakingAttemptResponse = z.infer<typeof speakingAttemptResponseSchema>;
export type DictationClip = z.infer<typeof dictationClipSchema>;
export type DictationResponse = z.infer<typeof dictationResponseSchema>;
export type DictationAttemptInput = z.infer<typeof dictationAttemptSchema>;
export type DictationAttemptResponse = z.infer<typeof dictationAttemptResponseSchema>;
export type TutorScenario = z.infer<typeof tutorScenarioSchema>;
export type TutorChatInput = z.infer<typeof tutorChatSchema>;
export type TutorMessage = z.infer<typeof tutorMessageSchema>;
export type TutorHistoryResponse = z.infer<typeof tutorHistoryResponseSchema>;
export type TutorChatResponse = z.infer<typeof tutorChatResponseSchema>;
export type TutorStreamEvent = z.infer<typeof tutorStreamEventSchema>;
