/**
 * Browser speech helpers for the UK speaking drill.
 *
 * - `createRecognition()` wraps the Web Speech API (Chrome/Edge) in `en-GB`.
 * - `speakBritish()` uses speech synthesis, preferring an actual British voice.
 * - `startRecording()` captures audio with MediaRecorder in every modern
 *   browser; `convertToWav()` turns it into 16 kHz mono PCM so the server can
 *   run Azure pronunciation assessment.
 *
 * Audio is only uploaded when the learner checks a phrase, and is stored solely
 * when they tick "Save this recording".
 */

export interface SpeechAlternative {
  transcript: string;
}

export interface SpeechResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechAlternative;
}

export interface SpeechResultList {
  readonly length: number;
  [index: number]: SpeechResult;
}

export interface RecognitionEvent {
  readonly resultIndex: number;
  readonly results: SpeechResultList;
}

export interface RecognitionErrorEvent {
  readonly error: string;
}

/** The subset of the SpeechRecognition interface this app uses. */
export interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type RecognitionConstructor = new () => Recognition;

interface SpeechWindow extends Window {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
}

function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as SpeechWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function speechRecognitionSupported(): boolean {
  return recognitionConstructor() !== null;
}

export function createRecognition(): Recognition | null {
  const Constructor = recognitionConstructor();
  if (!Constructor) return null;

  const recognition = new Constructor();
  recognition.lang = "en-GB";
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  return recognition;
}

/* ───────────────────────────── text to speech ───────────────────────────── */

let cachedVoice: SpeechSynthesisVoice | null = null;
let voicesPrimed = false;

function pickVoice(): SpeechSynthesisVoice | null {
  if (!("speechSynthesis" in window)) return null;

  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  if (cachedVoice && voices.some((voice) => voice.voiceURI === cachedVoice?.voiceURI)) {
    return cachedVoice;
  }

  const british = voices.filter((voice) => voice.lang.toLowerCase() === "en-gb");
  const preferred =
    british.find((voice) => /kate|serena|sonia|libby|female/i.test(voice.name)) ?? british[0];

  cachedVoice =
    preferred ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en-gb")) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en")) ??
    null;

  return cachedVoice;
}

/** Browsers load voices asynchronously; call once so `en-GB` is ready to use. */
export function primeVoices(): void {
  if (voicesPrimed || !("speechSynthesis" in window)) return;
  voicesPrimed = true;
  pickVoice();
  window.speechSynthesis.addEventListener("voiceschanged", () => {
    cachedVoice = null;
    pickVoice();
  });
}

/** Speak with a British voice when the device has one. */
export function speakBritish(text: string, rate = 0.95): boolean {
  if (!("speechSynthesis" in window)) return false;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-GB";
  utterance.rate = rate;
  utterance.pitch = 1;

  const voice = pickVoice();
  if (voice) utterance.voice = voice;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking(): void {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

/* ───────────────────────────── clip recording ───────────────────────────── */

export interface ClipRecorder {
  stop(): Promise<Blob | null>;
}

/** MediaRecorder works in Chrome, Edge, Firefox and Safari. */
export function recordingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined"
  );
}

/**
 * Capture the learner's voice with MediaRecorder. The clip is converted to WAV
 * before upload and kept on the server only when the learner opts in.
 */
export async function startRecording(): Promise<ClipRecorder | null> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return null;
  if (typeof MediaRecorder === "undefined") return null;

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream);

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  recorder.start();

  return {
    stop: () =>
      new Promise((resolve) => {
        const finish = () => {
          stream.getTracks().forEach((track) => track.stop());
          resolve(
            chunks.length > 0
              ? new Blob(chunks, { type: recorder.mimeType || "audio/webm" })
              : null
          );
        };

        if (recorder.state === "inactive") {
          finish();
          return;
        }

        recorder.onstop = finish;
        recorder.stop();
      })
  };
}

/* ─────────────────────────── WAV conversion ─────────────────────────────── */

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

/**
 * MediaRecorder gives us webm/ogg/mp4 audio. Azure's short-audio endpoint wants
 * 16 kHz mono PCM WAV, so decode the clip, downmix it and write a WAV header.
 * Falls back to the original blob in the caller if this throws.
 */
export async function convertToWav(input: Blob, sampleRate = 16_000): Promise<Blob> {
  if (typeof OfflineAudioContext === "undefined" || typeof AudioContext === "undefined") {
    throw new Error("WAV conversion is not supported in this browser.");
  }

  const context = new AudioContext();
  let decoded: AudioBuffer;

  try {
    decoded = await context.decodeAudioData(await input.arrayBuffer());
  } finally {
    await context.close().catch(() => undefined);
  }

  const frames = Math.max(1, Math.ceil(decoded.duration * sampleRate));
  const offline = new OfflineAudioContext(1, frames, sampleRate);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();

  const rendered = await offline.startRendering();
  const samples = rendered.getChannelData(0);

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}
