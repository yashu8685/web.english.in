import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { DictationAttemptResponse, DictationClip } from "@contracts";
import { Icon } from "../components/icons";
import { EmptyState, ErrorPanel, LevelBadge, Spinner } from "../components/ui";
import { primeVoices, speakBritish, stopSpeaking } from "../lib/speech";
import { listeningQuery, submitDictationAttempt } from "../lib/queries";

export const Route = createFileRoute("/app/listening")({
  component: ListeningPage
});

function ListeningPage() {
  const queryClient = useQueryClient();
  const clips = useQuery(listeningQuery());

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<DictationAttemptResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const list = clips.data?.clips ?? [];
  const selected: DictationClip | undefined =
    list.find((clip) => clip.id === selectedId) ?? list[0];

  useEffect(() => {
    primeVoices();
    return () => stopSpeaking();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const mutation = useMutation({
    mutationFn: submitDictationAttempt,
    onSuccess: (data) => {
      setResult(data);
      setRevealed(true);
      setToast(`+${data.xpGained} XP`);
      void queryClient.invalidateQueries({ queryKey: ["listening"] });
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (mutationError) => setError(mutationError.message)
  });

  const play = useMemo(
    () => (clip: DictationClip, rate = 0.95) => {
      speakBritish(clip.text, rate);
    },
    []
  );

  function choose(clip: DictationClip) {
    setSelectedId(clip.id);
    setTyped("");
    setResult(null);
    setRevealed(false);
    setError(null);
    play(clip);
  }

  function submit() {
    if (!selected) return;
    const transcript = typed.trim();
    if (!transcript) {
      setError("Type what you heard first.");
      return;
    }
    setError(null);
    mutation.mutate({ clipId: selected.id, transcript });
  }

  if (clips.isLoading) {
    return (
      <div className="page">
        <div className="panel">
          <Spinner label="Loading dictation clips" />
        </div>
      </div>
    );
  }

  if (clips.isError) {
    return (
      <div className="page">
        <ErrorPanel
          title="Could not load dictation clips"
          message={clips.error.message}
          onRetry={() => clips.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Listening · UK English</p>
          <h1>Dictation</h1>
          <p className="muted page-sub">
            Hear a British voice, type exactly what you heard, and check it word by word. Replay as
            often as you like — the slow version is there when you need it.
          </p>
        </div>
        <span className="chip chip-quiet">
          <Icon name="headphones" size={15} /> en-GB
        </span>
      </header>

      {list.length === 0 ? (
        <EmptyState
          icon={<Icon name="headphones" size={22} />}
          title="No dictation clips yet"
          body="Seed the database with `npm run db:seed` in the api folder."
        />
      ) : (
        <div className="speaking-layout">
          <aside className="panel speaking-rail" aria-label="Dictation clips">
            <div className="panel-head">
              <div>
                <h2>Clips</h2>
                <p className="muted">Everyday British listening</p>
              </div>
              <span className="chip chip-quiet">{list.length}</span>
            </div>

            <ul className="speaking-list">
              {list.map((clip) => (
                <li key={clip.id}>
                  <button
                    type="button"
                    className={`speaking-item${clip.id === selected?.id ? " is-active" : ""}`}
                    onClick={() => choose(clip)}
                    aria-pressed={clip.id === selected?.id}
                  >
                    <span className="speaking-item-text">{clip.hint}</span>
                    <span className="speaking-item-meta">
                      <LevelBadge level={clip.level} />
                      {clip.bestScore !== null ? (
                        <span className="score-pill">
                          <Icon name="trophy" size={13} /> {clip.bestScore}%
                        </span>
                      ) : (
                        <span className="speaking-item-focus">Not tried yet</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {selected ? (
            <section className="panel speaking-stage" aria-label="Dictation practice">
              <div className="speaking-stage-head">
                <div>
                  <span className="speaking-focus">Listen · type · check</span>
                  <p className="speaking-tip">
                    <Icon name="headphones" size={15} /> {selected.hint}
                  </p>
                </div>
                <LevelBadge level={selected.level} />
              </div>

              <div className="dictation-audio">
                <span className="dictation-wave" aria-hidden="true">
                  <Icon name="volume" size={22} />
                </span>
                <div className="dictation-audio-body">
                  <strong>British model audio</strong>
                  <span>Play it as many times as you need.</span>
                </div>
                <div className="speaking-actions">
                  <button type="button" className="btn btn-outline" onClick={() => play(selected)}>
                    <Icon name="volume" size={17} /> Play
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => play(selected, 0.7)}
                  >
                    <Icon name="clock" size={16} /> Slow
                  </button>
                </div>
              </div>

              {revealed || result ? (
                <p className="dictation-reveal" data-testid="dictation-target">
                  <span>Clip text</span>
                  <strong data-testid="dictation-text">{selected.text}</strong>
                </p>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm dictation-reveal-btn"
                  onClick={() => setRevealed(true)}
                >
                  <Icon name="target" size={15} /> Show text
                </button>
              )}

              <label className="field">
                <span>Type what you heard</span>
                <textarea
                  className="dictation-input"
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  rows={3}
                  placeholder="Type the sentence exactly as you heard it…"
                  spellCheck={false}
                />
              </label>

              <div className="speaking-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={submit}
                  disabled={mutation.isPending}
                >
                  <Icon name="check" size={17} /> Check
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setTyped("");
                    setResult(null);
                    setRevealed(false);
                    setError(null);
                  }}
                >
                  <Icon name="refresh" size={16} /> Clear
                </button>
              </div>

              {error ? (
                <p className="panel-error speaking-error" role="alert">
                  {error}
                </p>
              ) : null}

              {mutation.isPending ? (
                <Spinner label="Checking your dictation" />
              ) : result ? (
                <div className="speaking-result" data-testid="dictation-result">
                  <div
                    className={`score-ring${result.score >= 80 ? " is-strong" : result.score >= 60 ? " is-ok" : ""}`}
                  >
                    <strong>{result.score}%</strong>
                    <span>{result.score >= 80 ? "Good ear" : "Keep listening"}</span>
                  </div>
                  <div className="speaking-result-body">
                    <p className="speaking-feedback">{result.feedback}</p>
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
                    <div className="speaking-result-foot">
                      <span className="xp-gain">
                        <Icon name="spark" size={15} /> +{result.xpGained} XP
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
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
