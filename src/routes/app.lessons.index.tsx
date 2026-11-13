import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Icon } from "../components/icons";
import { EmptyState, ErrorPanel, LevelBadge, Spinner } from "../components/ui";
import { lessonsQuery } from "../lib/queries";

export const Route = createFileRoute("/app/lessons/")({
  component: LessonsPage
});

const LEVELS = ["all", "B1", "B2"] as const;

function LessonsPage() {
  const lessons = useQuery(lessonsQuery());
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("all");

  const filtered = (lessons.data?.lessons ?? []).filter(
    (lesson) => level === "all" || lesson.level === level
  );

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Grammar</p>
          <h1>Lessons</h1>
          <p className="muted page-sub">
            Short explanations, the mistakes to avoid, and a quiz that explains every answer.
          </p>
        </div>
        <div className="filter-row filter-row-inline" role="group" aria-label="Filter by level">
          {LEVELS.map((value) => (
            <button
              key={value}
              type="button"
              className={`filter-chip${level === value ? " is-active" : ""}`}
              onClick={() => setLevel(value)}
              aria-pressed={level === value}
            >
              {value === "all" ? "All levels" : value}
            </button>
          ))}
        </div>
      </header>

      {lessons.isLoading ? (
        <div className="panel">
          <Spinner label="Loading lessons" />
        </div>
      ) : lessons.isError ? (
        <ErrorPanel
          title="Could not load lessons"
          message={lessons.error.message}
          onRetry={() => lessons.refetch()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Icon name="lessons" size={22} />}
          title="No lessons here"
          body="Try another level, or seed the database with `npm run db:seed`."
        />
      ) : (
        <ul className="lesson-grid">
          {filtered.map((lesson) => (
            <li key={lesson.id}>
              <Link
                to="/app/lessons/$slug"
                params={{ slug: lesson.slug }}
                className="lesson-card"
              >
                <div className="lesson-card-top">
                  <LevelBadge level={lesson.level} />
                  <span className="lesson-card-count">
                    <Icon name="lessons" size={14} /> {lesson.questionCount} questions
                  </span>
                </div>
                <h2>{lesson.title}</h2>
                <p>{lesson.summary}</p>
                <div className="lesson-card-foot">
                  <span className="lesson-card-stat">
                    {lesson.attempts === 0
                      ? "Not started"
                      : `${lesson.attempts} attempt${lesson.attempts === 1 ? "" : "s"}`}
                  </span>
                  {lesson.bestScore !== null ? (
                    <span className="score-pill">
                      <Icon name="trophy" size={14} /> Best {lesson.bestScore}%
                    </span>
                  ) : null}
                  <span className="lesson-card-cta">
                    {lesson.attempts === 0 ? "Start" : "Review"} <Icon name="arrow-right" size={16} />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
