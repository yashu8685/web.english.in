import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { SpeakingAttemptResponse, SpeakingPhrase } from "@contracts";
import { Icon } from "../components/icons";
import { EmptyState, ErrorPanel, LevelBadge, Spinner } from "../components/ui";
import {
  convertToWav,
  createRecognition,
  primeVoices,
  recordingSupported,
  speakBritish,
  speechRecognitionSupported,
  startRecording,
  stopSpeaking,
  type ClipRecorder,
  type Recognition
} from "../lib/speech";
import {
  deleteSpeakingAttempt,
  fetchSpeakingAudio,
  speakingQuery,
  submitSpeakingAttempt
} from "../lib/queries";

export const Route = createFileRoute("/app/speaking")({
  component: SpeakingPage
});

function scoreLabel(score: number): string {
  if (score >= 95) return "Excellent";
  if (score >= 80) return "Good";
  if (score >= 60) return "Getting there";
  if (score >= 30) return "Keep going";
  return "Try again";
}

function fileExtension(blob: Blob): string {
  if (blob.type.includes("wav")) return "wav";
  if (blob.type.includes("ogg")) return "ogg";
  if (blob.type.includes("mp4")) return "m4a";
  if (blob.type.includes("mpeg")) return "mp3";
  return "webm";
}

function phonemeClass(accuracy: number | null): string {
  if (accuracy === null) return "";
  if (accuracy >= 80) return " is-high";
  if (accuracy >= 60) return " is-mid";
  return " is-low";
}

function SpeakingPage() {
  const queryClient = useQueryClient();
  const phrases = useQuery(speakingQuery());

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [recording, setRecording] = useState(false);
  const [heard, setHeard] = useState("");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SpeakingAttemptResponse | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [serverAudioUrl, setServerAudioUrl] = useState<string | null>(null);
  const [saveRecording, setSaveRecording] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const recognitionRef = useRef<Recognition | null>(null);
  const recorderRef = useRef<ClipRecorder | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const serverAudioRef = useRef<string | null>(null);

  const liveSupported = useMemo(() => speechRecognitionSupported(), []);
  const canRecord = useMemo(() => recordingSupported(), []);
  const capabilities = phrases.data?.capabilities;

  const list = phrases.data?.phrases ?? [];
  const selected: SpeakingPhrase | undefined =
    list.find((phrase) => phrase.id === selectedId) ?? list[0];

  useEffect(() => {
    primeVoices();
    return () => {
      recognitionRef.current?.abort();
      void recorderRef.current?.stop();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      if (serverAudioRef.current) URL.revokeObjectURL(serverAudioRef.current);
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const mutation = useMutation({
    mutationFn: submitSpeakingAttempt,
    onSuccess: (data) => {
      setResult(data);
      setToast(`+${data.xpGained} XP`);
      void queryClient.invalidateQueries({ queryKey: ["speaking"] });
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
      void queryClient.invalidateQueries({ queryKey: ["me"] });

      if (serverAudioRef.current) URL.revokeObjectURL(serverAudioRef.current);
      serverAudioRef.current = null;
      setServerAudioUrl(null);

      if (data.audioUrl) {
        void fetchSpeakingAudio(data.attemptId)
          .then((url) => {
            serverAudioRef.current = url;
            setServerAudioUrl(url);
          })
          .catch(() => undefined);
      }
    },
    onError: (mutationError) => setError(mutationError.message)
  });

  function clearLocalAudio() {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    setAudioUrl(null);
  }

  function clearServerAudio() {
    if (serverAudioRef.current) URL.revokeObjectURL(serverAudioRef.current);
    serverAudioRef.current = null;
    setServerAudioUrl(null);
  }

  async function stopRecorder(): Promise<Blob | null> {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (!recorder) return null;

    const blob = await recorder.stop();
    if (!blob) return null;

    clearLocalAudio();
    const url = URL.createObjectURL(blob);
    audioUrlRef.current = url;
    setAudioUrl(url);
    return blob;
  }

  async function discardRecording() {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder) await recorder.stop();
    clearLocalAudio();
  }

  async function submit(transcript: string | null, blob: Blob | null) {
    if (!selected) return;

    setError(null);
    setResult(null);
    clearServerAudio();

    if (!blob) {
      if (!transcript) {
        setError("Say or type the phrase first.");
        return;
      }
      mutation.mutate({ phraseId: selected.id, transcript });
      return;
    }

    // Azure expects 16 kHz mono WAV; fall back to the raw clip if the browser
    // cannot decode it (transcription still works with webm/ogg).
    let upload = blob;
    try {
      upload = await convertToWav(blob);
    } catch {
      upload = blob;
    }

    const form = new FormData();
    form.append("phraseId", selected.id);
    if (transcript) form.append("transcript", transcript);
    form.append("saveAudio", saveRecording ? "true" : "false");
    form.append("audio", upload, `attempt.${fileExtension(upload)}`);

    mutation.mutate(form);
  }

  function choose(phraseId: string) {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    void discardRecording();
    setListening(false);
    setRecording(false);
    setSelectedId(phraseId);
    setResult(null);
    setHeard("");
    setTyped("");
    setError(null);
    clearServerAudio();
    stopSpeaking();
  }

  function startListening() {
    if (!selected) return;
    if (!liveSupported) {
      void startClip();
      return;
    }

    const recognition = createRecognition();
    if (!recognition) {
      void startClip();
      return;
    }

    stopSpeaking();
    clearLocalAudio();
    setError(null);
    setResult(null);
    setHeard("");
    recognitionRef.current = recognition;

    let finalText = "";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const alternative = event.results[i][0];
        if (event.results[i].isFinal) {
          finalText += `${alternative.transcript} `;
        } else {
          interim += alternative.transcript;
        }
      }
      setHeard(`${finalText} ${interim}`.replace(/\s+/g, " ").trim());
    };

    recognition.onerror = (event) => {
      setListening(false);
      if (event.error === "aborted") return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError(
          "Microphone access was blocked. Allow it in your browser's site settings, or type the phrase below."
        );
      } else if (event.error === "no-speech") {
        setError("I didn't hear anything. Try again a little closer to the microphone.");
      } else {
        setError(`Speech recognition stopped (${event.error}). You can type the phrase instead.`);
      }
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      void (async () => {
        const blob = await stopRecorder();
        const spoken = finalText.trim();
        if (spoken) {
          await submit(spoken, blob);
        } else if (blob && capabilities?.transcription) {
          await submit(null, blob);
        } else {
          setError("I didn't catch that. Try again, or type the phrase below.");
        }
      })();
    };

    try {
      recognition.start();
      setListening(true);
      void startRecording()
        .then((recorder) => {
          recorderRef.current = recorder;
        })
        .catch(() => {
          recorderRef.current = null;
        });
    } catch {
      setError("Could not start the microphone. Close other tabs using it and try again.");
    }
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  async function startClip() {
    if (!selected) return;
    if (!canRecord) {
      setError("This browser cannot record audio. Type the phrase below instead.");
      return;
    }

    stopSpeaking();
    clearLocalAudio();
    setError(null);
    setResult(null);
    setHeard("");

    try {
      const recorder = await startRecording();
      if (!recorder) {
        setError("This browser cannot record audio. Type the phrase below instead.");
        return;
      }
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError(
        "Microphone access was blocked. Allow it in your browser's site settings, or type the phrase below."
      );
    }
  }

  async function stopClip() {
    setRecording(false);
    const blob = await stopRecorder();
    if (!blob) {
      setError("That recording was empty. Try again, or type the phrase below.");
      return;
    }
    await submit(null, blob);
  }

  async function removeSavedRecording() {
    if (!result) return;
    setDeleting(true);
    try {
      await deleteSpeakingAttempt(result.attemptId);
      clearServerAudio();
      setResult({ ...result, audioUrl: null });
      setToast("Recording deleted");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete it.");
    } finally {
      setDeleting(false);
    }
  }

  if (phrases.isLoading) {
    return (
      <div className="page">
        <div className="panel">
          <Spinner label="Loading speaking drills" />
        </div>
      </div>
    );
  }

  if (phrases.isError) {
    return (
      <div className="page">
        <ErrorPanel
          title="Could not load speaking drills"
          message={phrases.error.message}
          onRetry={() => phrases.refetch()}
        />
      </div>
    );
  }

  const assessment = result?.assessment;
  const subscores: Array<[string, number | null]> =
    assessment && assessment.provider === "azure"
      ? [
          ["Phonemes", assessment.pronunciation],
          ["Accuracy", assessment.accuracy],
          ["Fluency", assessment.fluency],
          ["Complete", assessment.completeness]
        ]
      : [];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Speaking · UK English</p>
          <h1>Speak like a Brit</h1>
          <p className="muted page-sub">
            Listen to the model in a British accent, say the phrase out loud, and get word-by-word
            feedback. The clip is uploaded for scoring; it is saved only if you ask us to.
          </p>
        </div>
        <span className="chip chip-quiet">
          <Icon name={capabilities?.phonemes ? "spark" : "volume"} size={15} />
          {capabilities?.phonemes ? "Phoneme scoring" : "en-GB"}
        </span>
      </header>

      {list.length === 0 ? (
        <EmptyState
          icon={<Icon name="volume" size={22} />}
          title="No speaking drills yet"
          body="Seed the database with `npm run db:seed` in the api folder."
        />
      ) : (
        <div className="speaking-layout">
          <aside className="panel speaking-rail" aria-label="Speaking drills">
            <div className="panel-head">
              <div>
                <h2>Drills</h2>
                <p className="muted">Everyday British phrases</p>
              </div>
              <span className="chip chip-quiet">{list.length}</span>
            </div>

            <ul className="speaking-list">
              {list.map((phrase) => (
                <li key={phrase.id}>
                  <button
                    type="button"
                    className={`speaking-item${phrase.id === selected?.id ? " is-active" : ""}`}
                    onClick={() => choose(phrase.id)}
                    aria-pressed={phrase.id === selected?.id}
                  >
                    <span className="speaking-item-text">{phrase.text}</span>
                    <span className="speaking-item-meta">
                      <LevelBadge level={phrase.level} />
                      {phrase.bestScore !== null ? (
                        <span className="score-pill">
                          <Icon name="trophy" size={13} /> {phrase.bestScore}%
                        </span>
                      ) : (
                        <span className="speaking-item-focus">{phrase.focus}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {selected ? (
            <section className="panel speaking-stage" aria-label="Speaking practice">
              <div className="speaking-stage-head">
                <div>
                  <span className="speaking-focus">{selected.focus}</span>
                  <p className="speaking-tip">
                    <Icon name="target" size={15} /> {selected.tip}
                  </p>
                </div>
                <LevelBadge level={selected.level} />
              </div>

              <blockquote className="speaking-target" data-testid="speaking-target">
                {selected.text}
              </blockquote>

              <div className="speaking-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => speakBritish(selected.text)}
                >
                  <Icon name="volume" size={17} /> Hear it
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => speakBritish(selected.text, 0.7)}
                >
                  <Icon name="clock" size={16} /> Slower
                </button>
                {listening ? (
                  <button
                    type="button"
                    className="btn btn-primary is-recording"
                    onClick={stopListening}
                  >
                    <Icon name="mic" size={17} /> Stop listening
                  </button>
                ) : recording ? (
                  <button
                    type="button"
                    className="btn btn-primary is-recording"
                    onClick={() => void stopClip()}
                  >
                    <Icon name="mic" size={17} /> Stop & check
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={startListening}
                    disabled={mutation.isPending || !canRecord}
                  >
                    <Icon name="mic" size={17} />{" "}
                    {liveSupported ? "Start listening" : "Record my voice"}
                  </button>
                )}
              </div>

              {!canRecord ? (
                <p className="speaking-note">
                  This browser cannot record audio. Type the phrase below to check your rhythm.
                </p>
              ) : !liveSupported ? (
                <p className="speaking-note">
                  {capabilities?.transcription || capabilities?.phonemes
                    ? "Your browser has no on-device recognition, so the clip is transcribed on the server."
                    : "Your browser has no on-device recognition. Add OPENAI_API_KEY (or Azure Speech) in api/.env to use the microphone here, or type below."}
                </p>
              ) : null}

              {listening ? (
                <p className="speaking-hearing" role="status">
                  <span className="recording-dot" aria-hidden="true" />
                  Listening… {heard || "say the phrase now"}
                </p>
              ) : heard && !result ? (
                <p className="speaking-hearing">
                  <Icon name="volume" size={15} /> Heard: {heard}
                </p>
              ) : null}

              {error ? (
                <p className="panel-error speaking-error" role="alert">
                  {error}
                </p>
              ) : null}

              {capabilities?.storage ? (
                <label className="speaking-save">
                  <input
                    type="checkbox"
                    checked={saveRecording}
                    onChange={(event) => setSaveRecording(event.target.checked)}
                  />
                  <span>
                    Save my recording so I can replay it later
                    <small>Stored on this server; delete it whenever you like.</small>
                  </span>
                </label>
              ) : null}

              {audioUrl ? (
                <div className="field">
                  <span className="muted">Your recording — from this browser</span>
                  <audio className="speaking-playback" controls src={audioUrl}>
                    Your browser cannot play this recording.
                  </audio>
                </div>
              ) : null}

              {mutation.isPending ? (
                <Spinner label="Scoring your pronunciation" />
              ) : result ? (
                <div className="speaking-result" data-testid="speaking-result">
                  <div
                    className={`score-ring${result.score >= 80 ? " is-strong" : result.score >= 60 ? " is-ok" : ""}`}
                  >
                    <strong>{result.score}%</strong>
                    <span>{scoreLabel(result.score)}</span>
                  </div>
                  <div className="speaking-result-body">
                    <p className="speaking-feedback">{result.feedback}</p>

                    {subscores.length > 0 ? (
                      <div className="speaking-subscores" aria-label="Pronunciation detail">
                        {subscores
                          .filter(([, value]) => value !== null)
                          .map(([label, value]) => (
                            <span key={label} className="subscore">
                              <strong>{value}%</strong>
                              {label}
                            </span>
                          ))}
                      </div>
                    ) : null}

                    <ul className="word-row" aria-label="Word-by-word feedback">
                      {result.words.map((word, index) => (
                        <li
                          key={`${word.word}-${index}`}
                          className={`word-chip${word.matched ? " is-good" : " is-missed"}`}
                        >
                          {word.word}
                        </li>
                      ))}
                    </ul>

                    {assessment && assessment.phonemes.length > 0 ? (
                      <ul className="phoneme-row" aria-label="Phoneme accuracy per word">
                        {assessment.phonemes.map((phoneme, index) => (
                          <li
                            key={`${phoneme.word}-${index}`}
                            className={`phoneme-chip${phonemeClass(phoneme.accuracy)}`}
                            title={phoneme.errorType ?? "Clear"}
                          >
                            {phoneme.word}
                            {phoneme.accuracy !== null ? (
                              <small>{phoneme.accuracy}</small>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="speaking-note">
                        Word-accuracy mode. Add AZURE_SPEECH_KEY and AZURE_SPEECH_REGION to api/.env
                        for phoneme-by-phoneme scores.
                      </p>
                    )}

                    <div className="speaking-result-foot">
                      <span className="xp-gain">
                        <Icon name="spark" size={15} /> +{result.xpGained} XP
                      </span>
                      <button
                        type="button"
                        className="btn btn-soft btn-sm"
                        onClick={() => {
                          setResult(null);
                          setHeard("");
                          setError(null);
                        }}
                      >
                        <Icon name="refresh" size={15} /> Try again
                      </button>
                    </div>

                    {serverAudioUrl ? (
                      <div className="field">
                        <span className="muted">Saved recording</span>
                        <audio className="speaking-playback" controls src={serverAudioUrl}>
                          Your browser cannot play this recording.
                        </audio>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => void removeSavedRecording()}
                          disabled={deleting}
                        >
                          <Icon name="trash" size={15} />{" "}
                          {deleting ? "Deleting…" : "Delete recording"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <form
                className="speaking-type"
                onSubmit={(event) => {
                  event.preventDefault();
                  const text = typed.trim();
                  if (text) void submit(text, null);
                }}
              >
                <label className="field">
                  <span>No microphone? Type what you said</span>
                  <input
                    value={typed}
                    onChange={(event) => setTyped(event.target.value)}
                    placeholder={selected.text}
                    autoComplete="off"
                  />
                </label>
                <button
                  type="submit"
                  className="btn btn-soft"
                  disabled={mutation.isPending || typed.trim().length === 0}
                >
                  Check
                </button>
              </form>
            </section>
          ) : null}
        </div>
      )}

      {toast ? (
        <div className="xp-toast" role="status">
          <Icon name="spark" size={16} /> {toast}
        </div>
      ) : null}
    </div>
  );
}
