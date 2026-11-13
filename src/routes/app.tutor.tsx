import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { TutorMessage, TutorScenario } from "@contracts";
import { Icon } from "../components/icons";
import { ErrorPanel, Spinner } from "../components/ui";
import { clearTutorHistory, streamTutorMessage, tutorHistoryQuery } from "../lib/queries";

export const Route = createFileRoute("/app/tutor")({
  component: TutorPage
});

const SCENARIOS: Array<{ value: TutorScenario; label: string }> = [
  { value: "small-talk", label: "Small talk" },
  { value: "cafe", label: "Café" },
  { value: "interview", label: "Interview" },
  { value: "travel", label: "Travel" },
  { value: "landlord", label: "Renting" }
];

function TutorPage() {
  const queryClient = useQueryClient();
  const [scenario, setScenario] = useState<TutorScenario>("small-talk");
  const [draft, setDraft] = useState("");
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [streamingReply, setStreamingReply] = useState("");
  const [pending, setPending] = useState(false);
  const [correction, setCorrection] = useState<string | null>(null);
  const [provider, setProvider] = useState<"openai" | "local" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const history = useQuery(tutorHistoryQuery(scenario));
  const listRef = useRef<HTMLDivElement | null>(null);

  const messages: TutorMessage[] = history.data?.messages ?? [];
  const opener = history.data?.opener ?? "";

  useEffect(() => {
    setCorrection(null);
    setError(null);
  }, [scenario]);

  useEffect(() => {
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length, pendingMessage, streamingReply]);

  const reset = useMutation({
    mutationFn: clearTutorHistory,
    onSuccess: () => {
      setCorrection(null);
      void queryClient.invalidateQueries({ queryKey: ["tutor", scenario] });
    },
    onError: (mutationError) => setError(mutationError.message)
  });

  async function send() {
    const message = draft.trim();
    if (!message || pending) return;

    setDraft("");
    setPendingMessage(message);
    setStreamingReply("");
    setCorrection(null);
    setError(null);
    setPending(true);

    try {
      await streamTutorMessage(
        { scenario, message },
        {
          onMeta: (_conversationId, nextProvider) => setProvider(nextProvider),
          onDelta: (text) => setStreamingReply((current) => current + text),
          onDone: (_reply, nextCorrection) => setCorrection(nextCorrection)
        }
      );
      // Wait for the stored turn before clearing the live bubble, otherwise the
      // reply flickers out for a frame.
      await queryClient.invalidateQueries({ queryKey: ["tutor", scenario] });
    } catch (streamError) {
      setError(streamError instanceof Error ? streamError.message : "The tutor could not reply.");
    } finally {
      setPending(false);
      setPendingMessage(null);
      setStreamingReply("");
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Conversation · UK English</p>
          <h1>Talk to your tutor</h1>
          <p className="muted page-sub">
            A patient British tutor for everyday situations. It corrects Americanisms and unnatural
            phrasing, then keeps the conversation going.
          </p>
        </div>
        <span className={`chip ${provider === "openai" ? "chip-live" : "chip-quiet"}`}>
          <Icon name={provider === "openai" ? "spark" : "chat"} size={15} />
          {provider === "openai" ? "AI tutor" : provider === "local" ? "Local coach" : "Practice mode"}
        </span>
      </header>

      <section className="panel tutor-panel" aria-label="Conversation tutor">
        <div className="filter-row filter-row-inline" role="group" aria-label="Choose a scenario">
          {SCENARIOS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`filter-chip${scenario === item.value ? " is-active" : ""}`}
              onClick={() => setScenario(item.value)}
              aria-pressed={scenario === item.value}
              disabled={pending}
            >
              {item.label}
            </button>
          ))}
        </div>

        {history.isLoading ? (
          <Spinner label="Loading conversation" />
        ) : history.isError ? (
          <ErrorPanel
            title="Could not load the conversation"
            message={history.error.message}
            onRetry={() => history.refetch()}
          />
        ) : (
          <>
            <div className="tutor-messages" ref={listRef} aria-live="polite">
              <div className="tutor-msg">
                <span className="tutor-avatar" aria-hidden="true">
                  <Icon name="chat" size={17} />
                </span>
                <p className="tutor-bubble">{opener}</p>
              </div>

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`tutor-msg${message.role === "user" ? " is-user" : ""}`}
                >
                  <span className="tutor-avatar" aria-hidden="true">
                    {message.role === "user" ? "You" : <Icon name="chat" size={17} />}
                  </span>
                  <p className="tutor-bubble">{message.content}</p>
                </div>
              ))}

              {pendingMessage ? (
                <div className="tutor-msg is-user">
                  <span className="tutor-avatar" aria-hidden="true">
                    You
                  </span>
                  <p className="tutor-bubble">{pendingMessage}</p>
                </div>
              ) : null}

              {pending && streamingReply ? (
                <div className="tutor-msg">
                  <span className="tutor-avatar" aria-hidden="true">
                    <Icon name="chat" size={17} />
                  </span>
                  <p className="tutor-bubble" data-testid="tutor-streaming">
                    {streamingReply}
                    <span className="tutor-cursor" aria-hidden="true" />
                  </p>
                </div>
              ) : null}

              {pending && !streamingReply ? (
                <div className="tutor-msg">
                  <span className="tutor-avatar" aria-hidden="true">
                    <Icon name="chat" size={17} />
                  </span>
                  <p className="tutor-bubble tutor-typing">
                    <span />
                    <span />
                    <span />
                  </p>
                </div>
              ) : null}
            </div>

            {correction ? (
              <p className="tutor-correction" role="status">
                <Icon name="spark" size={16} /> {correction}
              </p>
            ) : null}

            {error ? (
              <p className="panel-error speaking-error" role="alert">
                {error}
              </p>
            ) : null}

            <form
              className="tutor-form"
              onSubmit={(event) => {
                event.preventDefault();
                send();
              }}
            >
              <label className="field">
                <span>Your reply</span>
                <textarea
                  className="tutor-input"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      send();
                    }
                  }}
                  rows={2}
                  maxLength={500}
                  placeholder="Type in English — mistakes are welcome."
                />
              </label>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={pending || draft.trim().length === 0}
              >
                <Icon name="arrow-right" size={17} /> Send
              </button>
            </form>

            <div className="tutor-foot">
              <span className="muted">
                {provider === "openai"
                  ? "Replies stream from your configured OpenAI-compatible model."
                  : "No API key needed — replies stream word by word from the built-in local coach. Add OPENAI_API_KEY to api/.env for AI replies."}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => reset.mutate(scenario)}
                disabled={reset.isPending || messages.length === 0}
              >
                <Icon name="refresh" size={15} /> Start over
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
