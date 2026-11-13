import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ReviewQuality, VocabularyCard, VocabularyResponse } from "@contracts";
import { Icon } from "../components/icons";
import {
  EmptyState,
  ErrorPanel,
  LevelBadge,
  ProgressBar,
  Spinner
} from "../components/ui";
import { relativeDue } from "../lib/format";
import { submitReview, vocabularyQuery } from "../lib/queries";
import { speakBritish } from "../lib/speech";

export const Route = createFileRoute("/app/vocabulary")({
  component: VocabularyPage
});

const SESSION_LIMIT = 20;

const QUALITIES: Array<{ value: ReviewQuality; label: string; hint: string }> = [
  { value: "again", label: "Again", hint: "in 10 min" },
  { value: "hard", label: "Hard", hint: "short interval" },
  { value: "good", label: "Good", hint: "on schedule" },
  { value: "easy", label: "Easy", hint: "longer interval" }
];

type DeckFilter = "all" | "due" | "new" | "mature";

function buildQueue(data: VocabularyResponse): string[] {
  const due = data.cards.filter((card) => card.progress !== null && card.due);
  const fresh = data.cards.filter((card) => card.progress === null);
  return [...due, ...fresh].slice(0, SESSION_LIMIT).map((card) => card.id);
}

function VocabularyPage() {
  const queryClient = useQueryClient();
  const vocabulary = useQuery(vocabularyQuery());

  const [queue, setQueue] = useState<string[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [filter, setFilter] = useState<DeckFilter>("all");
  const [search, setSearch] = useState("");

  // Snapshot the queue once per session so refetching after a review doesn't
  // reshuffle the cards under the learner.
  useEffect(() => {
    if (vocabulary.data && queue === null) {
      setQueue(buildQueue(vocabulary.data));
    }
  }, [vocabulary.data, queue]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 1600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const review = useMutation({
    mutationFn: submitReview,
    onSuccess: (result) => {
      setToast(`+${result.xpGained} XP`);
      setSessionXp((xp) => xp + result.xpGained);
      setReviewed((count) => count + 1);
      setIndex((i) => i + 1);
      setRevealed(false);
      void queryClient.invalidateQueries({ queryKey: ["vocabulary"] });
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    }
  });

  const cards = vocabulary.data?.cards ?? [];
  const currentId = queue?.[index];
  const currentCard = currentId ? cards.find((card) => card.id === currentId) : undefined;
  const sessionDone = queue !== null && index >= queue.length;

  function answer(quality: ReviewQuality) {
    if (!currentCard || review.isPending) return;
    review.mutate({ wordId: currentCard.id, quality });
  }

  // 1–4 to grade, space to reveal. Faster than the mouse once you know the keys.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (event.code === "Space" && currentCard && !revealed) {
        event.preventDefault();
        setRevealed(true);
        return;
      }
      if (!revealed || !currentCard) return;
      const quality = QUALITIES[Number(event.key) - 1];
      if (quality) {
        event.preventDefault();
        answer(quality.value);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function restartSession() {
    if (!vocabulary.data) return;
    setQueue(buildQueue(vocabulary.data));
    setIndex(0);
    setRevealed(false);
    setReviewed(0);
    setSessionXp(0);
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return cards.filter((card) => {
      if (term && !`${card.term} ${card.meaning}`.toLowerCase().includes(term)) return false;
      if (filter === "due") return card.progress !== null && card.due;
      if (filter === "new") return card.progress === null;
      if (filter === "mature") {
        return (
          card.progress !== null && card.progress.reps >= 3 && card.progress.intervalDays >= 7
        );
      }
      return true;
    });
  }, [cards, filter, search]);

  if (vocabulary.isLoading) {
    return (
      <div className="page">
        <PageHeader />
        <div className="panel">
          <Spinner label="Loading your deck" />
        </div>
      </div>
    );
  }

  if (vocabulary.isError) {
    return (
      <div className="page">
        <PageHeader />
        <ErrorPanel
          title="Could not load your vocabulary"
          message={vocabulary.error.message}
          onRetry={() => vocabulary.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        due={vocabulary.data?.dueCount ?? 0}
        fresh={vocabulary.data?.newCount ?? 0}
        onRestart={queue !== null && queue.length > 0 ? restartSession : undefined}
      />

      {cards.length === 0 ? (
        <EmptyState
          icon={<Icon name="cards" size={22} />}
          title="Your deck is empty"
          body="Seed the database with `npm run db:seed` to load the starter vocabulary."
        />
      ) : queue === null ? (
        <div className="panel">
          <Spinner label="Preparing your session" />
        </div>
      ) : sessionDone ? (
        <SessionComplete
          reviewed={reviewed}
          xp={sessionXp}
          onRestart={restartSession}
          onBrowse={() => document.getElementById("deck")?.scrollIntoView({ behavior: "smooth" })}
        />
      ) : currentCard ? (
        <ReviewCard
          card={currentCard}
          revealed={revealed}
          pending={review.isPending}
          position={index + 1}
          total={queue.length}
          onReveal={() => setRevealed(true)}
          onAnswer={answer}
        />
      ) : (
        <SessionComplete
          reviewed={reviewed}
          xp={sessionXp}
          onRestart={restartSession}
          onBrowse={() => document.getElementById("deck")?.scrollIntoView({ behavior: "smooth" })}
        />
      )}

      {review.isError ? (
        <p className="inline-error" role="alert">
          <Icon name="alert" size={16} /> {review.error.message}
        </p>
      ) : null}

      <section className="panel deck" id="deck">
        <div className="panel-head deck-head">
          <div>
            <h2>Your deck</h2>
            <p className="muted">
              {cards.length} words · {vocabulary.data?.dueCount ?? 0} due ·{" "}
              {vocabulary.data?.newCount ?? 0} new
            </p>
          </div>
          <div className="deck-tools">
            <label className="search">
              <Icon name="search" size={16} />
              <input
                type="search"
                placeholder="Search words or meanings"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search vocabulary"
              />
            </label>
          </div>
        </div>

        <div className="filter-row" role="group" aria-label="Filter deck">
          {(
            [
              ["all", "All"],
              ["due", "Due"],
              ["new", "New"],
              ["mature", "Mature"]
            ] as Array<[DeckFilter, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`filter-chip${filter === value ? " is-active" : ""}`}
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
            >
              {label}
            </button>
          ))}
          <span className="filter-count">{filtered.length} shown</span>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Icon name="search" size={22} />}
            title="Nothing matches"
            body="Try a different word or clear the filters."
          />
        ) : (
          <ul className="word-grid">
            {filtered.map((card) => (
              <WordTile key={card.id} card={card} />
            ))}
          </ul>
        )}
      </section>

      {toast ? (
        <div className="xp-toast" role="status">
          <Icon name="spark" size={16} /> {toast}
        </div>
      ) : null}
    </div>
  );
}

function PageHeader({
  due = 0,
  fresh = 0,
  onRestart
}: {
  due?: number;
  fresh?: number;
  onRestart?: () => void;
}) {
  return (
    <header className="page-head">
      <div>
        <p className="eyebrow">Vocabulary</p>
        <h1>Words worth keeping</h1>
        <p className="muted page-sub">
          {due > 0
            ? `${due} due for review${fresh > 0 ? ` · ${fresh} new waiting` : ""}. Grade honestly — the schedule learns from you.`
            : fresh > 0
              ? `Nothing due. ${fresh} new words are ready when you are.`
              : "Everything is scheduled. Come back when the next card is due."}
        </p>
      </div>
      {onRestart ? (
        <button type="button" className="btn btn-outline" onClick={onRestart}>
          <Icon name="refresh" size={17} /> New session
        </button>
      ) : null}
    </header>
  );
}

function ReviewCard({
  card,
  revealed,
  pending,
  position,
  total,
  onReveal,
  onAnswer
}: {
  card: VocabularyCard;
  revealed: boolean;
  pending: boolean;
  position: number;
  total: number;
  onReveal: () => void;
  onAnswer: (quality: ReviewQuality) => void;
}) {
  function speak() {
    speakBritish(card.term, 0.9);
  }

  return (
    <section className="review-wrap" aria-label="Vocabulary review">
      <div className="review-progress">
        <span>
          Card {position} of {total}
        </span>
        <ProgressBar value={position - 1} max={total} label="Session progress" />
      </div>

      <article className={`review-card${revealed ? " is-revealed" : ""}`}>
        <div className="review-card-top">
          <LevelBadge level={card.level} />
          <span className="review-pos">{card.pos}</span>
        </div>

        <h2 className="review-term">{card.term}</h2>

        <div className="review-pronounce">
          {card.ipa ? <span className="review-ipa">{card.ipa}</span> : null}
          <button type="button" className="icon-btn" onClick={speak} aria-label="Pronounce word">
            <Icon name="volume" size={18} />
          </button>
        </div>

        <div className="review-divider" />

        {revealed ? (
          <div className="review-answer">
            <p className="review-meaning">{card.meaning}</p>
            <p className="review-example">
              <HighlightTerm text={card.example} term={card.term} />
            </p>
            {card.synonyms ? (
              <p className="review-synonyms">
                <span>Synonyms</span> {card.synonyms}
              </p>
            ) : null}
            {card.progress ? (
              <p className="review-schedule">
                <Icon name="clock" size={14} /> Next due {relativeDue(card.progress.dueAt)} ·{" "}
                {card.progress.reps} review{card.progress.reps === 1 ? "" : "s"}
              </p>
            ) : (
              <p className="review-schedule">
                <Icon name="spark" size={14} /> New word — rate how well you know it.
              </p>
            )}
          </div>
        ) : (
          <div className="review-prompt">
            <p>Say the meaning out loud, then reveal the answer.</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={onReveal}>
              Show answer <kbd>space</kbd>
            </button>
          </div>
        )}
      </article>

      {revealed ? (
        <div className="quality-grid">
          {QUALITIES.map((quality, i) => (
            <button
              key={quality.value}
              type="button"
              className={`quality quality-${quality.value}`}
              onClick={() => onAnswer(quality.value)}
              disabled={pending}
            >
              <span className="quality-label">{quality.label}</span>
              <span className="quality-hint">{quality.hint}</span>
              <kbd>{i + 1}</kbd>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function SessionComplete({
  reviewed,
  xp,
  onRestart,
  onBrowse
}: {
  reviewed: number;
  xp: number;
  onRestart: () => void;
  onBrowse: () => void;
}) {
  return (
    <section className="panel session-complete">
      <span className="session-complete-icon">
        <Icon name="trophy" size={26} />
      </span>
      <h2>{reviewed > 0 ? "Session complete" : "Nothing due right now"}</h2>
      <p className="muted">
        {reviewed > 0
          ? `You reviewed ${reviewed} ${reviewed === 1 ? "card" : "cards"} and earned ${xp} XP. The next cards are scheduled — they'll come back exactly when they should.`
          : "You are ahead of schedule. Learn a new word below or come back later."}
      </p>
      <div className="session-complete-actions">
        <button type="button" className="btn btn-primary" onClick={onRestart}>
          <Icon name="refresh" size={17} /> Start another session
        </button>
        <button type="button" className="btn btn-outline" onClick={onBrowse}>
          Browse the deck
        </button>
      </div>
    </section>
  );
}

function WordTile({ card }: { card: VocabularyCard }) {
  const status =
    card.progress === null
      ? { label: "New", className: "status-new" }
      : card.due
        ? { label: "Due", className: "status-due" }
        : { label: relativeDue(card.progress.dueAt), className: "status-scheduled" };

  return (
    <li className="word-tile">
      <div className="word-tile-top">
        <strong>{card.term}</strong>
        <LevelBadge level={card.level} />
      </div>
      <span className="word-tile-pos">
        {card.pos}
        {card.ipa ? ` · ${card.ipa}` : ""}
      </span>
      <p className="word-tile-meaning">{card.meaning}</p>
      <span className={`status-pill ${status.className}`}>{status.label}</span>
    </li>
  );
}

function HighlightTerm({ text, term }: { text: string; term: string }) {
  const index = text.toLowerCase().indexOf(term.toLowerCase());
  if (index === -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + term.length)}</mark>
      {text.slice(index + term.length)}
    </>
  );
}
