import { queryOptions } from "@tanstack/react-query";
import {
  dictationResponseSchema,
  lessonsResponseSchema,
  lessonDetailSchema,
  meResponseSchema,
  speakingResponseSchema,
  statsResponseSchema,
  tutorHistoryResponseSchema,
  tutorStreamEventSchema,
  vocabularyResponseSchema,
  type DictationAttemptInput,
  type DictationAttemptResponse,
  type LessonAttemptInput,
  type ReviewCardInput,
  type ReviewResponse,
  type SpeakingAttemptInput,
  type SpeakingAttemptResponse,
  type TutorChatInput,
  type TutorChatResponse,
  type TutorScenario
} from "@contracts";
import { API_URL, ApiError, apiFetch } from "./api";

/**
 * Query definitions live in one file so every screen shares the same cache
 * keys. Invalidate `["vocabulary"]` / `["stats"]` / `["me"]` after a mutation
 * and the whole UI stays consistent.
 */

export const meQuery = () =>
  queryOptions({
    queryKey: ["me"],
    queryFn: async () => meResponseSchema.parse(await apiFetch("/api/me")),
    staleTime: 60_000,
    retry: false
  });

export const statsQuery = () =>
  queryOptions({
    queryKey: ["stats"],
    queryFn: async () => statsResponseSchema.parse(await apiFetch("/api/stats")),
    staleTime: 15_000
  });

export const vocabularyQuery = () =>
  queryOptions({
    queryKey: ["vocabulary"],
    queryFn: async () => vocabularyResponseSchema.parse(await apiFetch("/api/vocabulary")),
    staleTime: 15_000
  });

export const lessonsQuery = () =>
  queryOptions({
    queryKey: ["lessons"],
    queryFn: async () => lessonsResponseSchema.parse(await apiFetch("/api/lessons")),
    staleTime: 60_000
  });

export const lessonQuery = (slug: string) =>
  queryOptions({
    queryKey: ["lessons", slug],
    queryFn: async () =>
      lessonDetailSchema.parse(await apiFetch(`/api/lessons/${encodeURIComponent(slug)}`)),
    staleTime: 60_000
  });

export const speakingQuery = () =>
  queryOptions({
    queryKey: ["speaking"],
    queryFn: async () => speakingResponseSchema.parse(await apiFetch("/api/speaking")),
    staleTime: 15_000
  });

export const listeningQuery = () =>
  queryOptions({
    queryKey: ["listening"],
    queryFn: async () => dictationResponseSchema.parse(await apiFetch("/api/listening")),
    staleTime: 15_000
  });

export const tutorHistoryQuery = (scenario: TutorScenario) =>
  queryOptions({
    queryKey: ["tutor", scenario],
    queryFn: async () =>
      tutorHistoryResponseSchema.parse(
        await apiFetch(`/api/tutor/history?scenario=${encodeURIComponent(scenario)}`)
      ),
    staleTime: 10_000
  });

/* ─────────────────────────────── mutations ─────────────────────────────── */

export async function submitReview(input: ReviewCardInput): Promise<ReviewResponse> {
  return apiFetch<ReviewResponse>("/api/vocabulary/review", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function submitLessonAttempt(
  slug: string,
  input: LessonAttemptInput
): Promise<{ ok: true; xpGained: number; totalXp: number; streak: number }> {
  return apiFetch(`/api/lessons/${encodeURIComponent(slug)}/attempts`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function submitSpeakingAttempt(
  input: SpeakingAttemptInput | FormData
): Promise<SpeakingAttemptResponse> {
  if (input instanceof FormData) {
    return apiFetch<SpeakingAttemptResponse>("/api/speaking/attempt", {
      method: "POST",
      body: input
    });
  }

  return apiFetch<SpeakingAttemptResponse>("/api/speaking/attempt", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

/** Authenticated download of a stored recording; returned as an object URL. */
export async function fetchSpeakingAudio(attemptId: string): Promise<string> {
  const response = await fetch(
    `${API_URL}/api/speaking/attempts/${encodeURIComponent(attemptId)}/audio`,
    { credentials: "include" }
  );

  if (!response.ok) {
    throw new ApiError(response.status, "audio_unavailable", "That recording is not available.");
  }

  return URL.createObjectURL(await response.blob());
}

export async function deleteSpeakingAttempt(attemptId: string): Promise<{ ok: true }> {
  return apiFetch(`/api/speaking/attempts/${encodeURIComponent(attemptId)}`, {
    method: "DELETE"
  });
}

export async function submitDictationAttempt(
  input: DictationAttemptInput
): Promise<DictationAttemptResponse> {
  return apiFetch<DictationAttemptResponse>("/api/listening/attempt", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function sendTutorMessage(input: TutorChatInput): Promise<TutorChatResponse> {
  return apiFetch<TutorChatResponse>("/api/tutor/chat", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function clearTutorHistory(scenario: TutorScenario): Promise<{ ok: true }> {
  return apiFetch(`/api/tutor/history?scenario=${encodeURIComponent(scenario)}`, {
    method: "DELETE"
  });
}

/* ───────────────────────── streaming tutor replies ─────────────────────── */

export interface TutorStreamHandlers {
  onMeta?: (conversationId: string, provider: "openai" | "local") => void;
  onDelta?: (text: string) => void;
  onDone?: (reply: string, correction: string | null) => void;
}

/**
 * Consume the tutor SSE endpoint. Fetch + ReadableStream are used directly
 * because `apiFetch` buffers whole responses and would defeat the point.
 */
export async function streamTutorMessage(
  input: TutorChatInput,
  handlers: TutorStreamHandlers
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/tutor/chat/stream`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "text/event-stream",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });
  } catch {
    throw new ApiError(0, "network_error", `Cannot reach the API at ${API_URL}. Is the server running?`);
  }

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    let message = `The tutor could not reply (${response.status}).`;
    let code = "tutor_unavailable";
    try {
      const parsed = JSON.parse(text) as { error?: { code?: string; message?: string } };
      if (parsed.error?.message) message = parsed.error.message;
      if (parsed.error?.code) code = parsed.error.code;
    } catch {
      // Keep the generic message.
    }
    throw new ApiError(response.status, code, message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let data: string[] = [];
  let sawDone = false;

  const dispatch = () => {
    if (data.length === 0) return;

    const raw = data.join("\n");
    data = [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const event = tutorStreamEventSchema.safeParse(parsed);
    if (!event.success) return;

    const value = event.data;
    if (value.type === "meta") {
      handlers.onMeta?.(value.conversationId, value.provider);
    } else if (value.type === "delta") {
      handlers.onDelta?.(value.text);
    } else if (value.type === "done") {
      sawDone = true;
      handlers.onDone?.(value.reply, value.correction);
    } else if (value.type === "error") {
      throw new Error(value.message);
    }
  };

  const consume = (line: string) => {
    const clean = line.endsWith("\r") ? line.slice(0, -1) : line;

    if (clean === "") {
      dispatch();
      return;
    }
    if (clean.startsWith(":")) return;
    if (clean.startsWith("data:")) {
      data.push(clean.slice(5).trimStart());
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      consume(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
    }
  }

  if (buffer !== "") consume(buffer);
  dispatch();

  if (!sawDone) {
    throw new ApiError(502, "tutor_stream_ended", "The tutor stopped before finishing. Try again.");
  }
}
