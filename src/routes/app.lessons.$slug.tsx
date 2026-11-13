import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import type { LessonAttemptInput, LessonContent } from "@contracts";
import { Icon } from "../components/icons";
import { ErrorPanel, LevelBadge, Spinner } from "../components/ui";
import { lessonQuery, submitLessonAttempt } from "../lib/queries";

export const Route = createFileRoute("/app/lessons/$slug")({
  component: LessonPage
});

type Question = LessonContent["quiz"][number];

function isCorrect(question: Question, answer: string | undefined): boolean {
  if (answer === undefined) return false;
  if (question.type === "mcq") return Number(answer) === question.answer;
  const normalised = answer.trim().toLowerCase();
  return question.answers.some((expected) => expected.trim().toLowerCase() === normalised);
}

function LessonPage() {
  const { slug } = Route.useParams();
  const queryClient = useQueryClient();
  const lesson = useQuery(lessonQuery(slug));

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<{ score: number; total: number; xp: number } | null>(null);

  const attempt = useMutation({
    mutationFn: (input: LessonAttemptInput) => submitLessonAttempt(slug, input),
    onSuccess: (data, input) => {
      setResult({ score: input.score, total: input.total, xp: data.xpGained });
      void queryClient.invalidateQueries({ queryKey: ["lessons"] });
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    }
  });

  if (lesson.isLoading) {
    return (
      <div className="page">
        <div className="panel">
          <Spinner label="Loading lesson" />
        </div>
      </div>
    );
  }

  if (lesson.isError) {
    return (
      <div className="page">
        <Link to="/app/lessons" className="text-link back-link">
          <Icon name="arrow-left" size={15} /> All lessons
        </Link>
        <ErrorPanel
          title="Could not load this lesson"
          message={lesson.error.message}
          onRetry={() => lesson.refetch()}
        />
      </div>
    );
  }

  const data = lesson.data;
  if (!data) return null;

  const { content } = data;
  const answeredCount = content.quiz.filter((_, i) => Boolean(answers[i]?.trim())).length;
  const percentScore = result ? Math.round((result.score / result.total) * 100) : 0;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const firstUnanswered = content.quiz.findIndex((_, i) => !answers[i]?.trim());
    if (firstUnanswered !== -1) {
      setFormError(`Question ${firstUnanswered + 1} still needs an answer.`);
      return;
    }

    const score = content.quiz.reduce(
      (total, question, i) => total + (isCorrect(question, answers[i]) ? 1 : 0),
      0
    );
    attempt.mutate({ score, total: content.quiz.length });
  }

  function retry() {
    setAnswers({});
    setResult(null);
    setFormError(null);
    attempt.reset();
  }

  return (
    <div className="page lesson-detail">
      <Link to="/app/lessons" className="text-link back-link">
        <Icon name="arrow-left" size={15} /> All lessons
      </Link>

      <header className="lesson-hero">
        <div className="lesson-hero-top">
          <LevelBadge level={data.level} />
          <span className="chip chip-quiet">{data.questionCount} quiz questions</span>
          {data.attempts > 0 ? (
            <span className="chip chip-quiet">
              Best {data.bestScore ?? 0}% · {data.attempts} attempt
              {data.attempts === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
        <h1>{data.title}</h1>
        <p className="muted">{data.summary}</p>
      </header>

      {content.sections.map((section) => (
        <section key={section.heading} className="prose-card">
          <h2>{section.heading}</h2>
          {section.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
      ))}

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Examples in context</h2>
            <p className="muted">Read them aloud — the rhythm matters as much as the rule.</p>
          </div>
        </div>
        <ul className="example-list">
          {content.examples.map((example) => (
            <li key={example}>
              <Icon name="check" size={16} />
              <span>{example}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Common mistakes</h2>
            <p className="muted">These are the ones examiners notice first.</p>
          </div>
        </div>
        <ul className="mistake-list">
          {content.mistakes.map((mistake) => (
            <li key={mistake.wrong}>
              <div className="mistake-row">
                <span className="mistake-label mistake-label-wrong">
                  <Icon name="close" size={14} /> Wrong
                </span>
                <s>{mistake.wrong}</s>
              </div>
              <div className="mistake-row">
                <span className="mistake-label mistake-label-right">
                  <Icon name="check" size={14} /> Right
                </span>
                <strong>{mistake.right}</strong>
              </div>
              <p className="mistake-note">{mistake.note}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel quiz" id="quiz">
        <div className="panel-head">
          <div>
            <h2>Check your understanding</h2>
            <p className="muted">
              {result
                ? "Review the explanations below, then try again or pick another lesson."
                : `${answeredCount} of ${content.quiz.length} answered.`}
            </p>
          </div>
          {result ? (
            <div className={`quiz-score${percentScore >= 75 ? " is-good" : ""}`}>
              <strong>
                {result.score}/{result.total}
              </strong>
              <span>{percentScore}%</span>
            </div>
          ) : null}
        </div>

        {result ? (
          <div className="quiz-result" role="status">
            <span className="quiz-result-icon">
              <Icon name={percentScore >= 75 ? "trophy" : "target"} size={22} />
            </span>
            <div>
              <strong>
                {percentScore === 100
                  ? "Perfect score."
                  : percentScore >= 75
                    ? "Strong work."
                    : "Good start — read the notes and retry."}
              </strong>
              <p>
                +{result.xp} XP · your streak and totals are already updated.
              </p>
            </div>
          </div>
        ) : null}

        <form className="quiz-form" onSubmit={handleSubmit}>
          {content.quiz.map((question, i) => {
            const value = answers[i] ?? "";
            const correct = isCorrect(question, value);

            return (
              <fieldset
                key={question.prompt}
                className={`question${result ? (correct ? " is-correct" : " is-wrong") : ""}`}
              >
                <legend>
                  <span className="question-num">{i + 1}</span>
                  {question.prompt}
                </legend>

                {question.type === "mcq" ? (
                  <div className="options">
                    {question.options.map((option, optionIndex) => {
                      const chosen = value === String(optionIndex);
                      const isAnswer = result && optionIndex === question.answer;
                      return (
                        <label
                          key={option}
                          className={`option${chosen ? " is-chosen" : ""}${
                            isAnswer ? " is-answer" : ""
                          }`}
                        >
                          <input
                            type="radio"
                            name={`q-${i}`}
                            value={String(optionIndex)}
                            checked={chosen}
                            disabled={Boolean(result) || attempt.isPending}
                            onChange={() => setAnswers((prev) => ({ ...prev, [i]: String(optionIndex) }))}
                          />
                          <span className="option-mark" aria-hidden="true" />
                          <span>{option}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <input
                    type="text"
                    className="fill-input"
                    placeholder="Type your answer"
                    value={value}
                    disabled={Boolean(result) || attempt.isPending}
                    onChange={(event) =>
                      setAnswers((prev) => ({ ...prev, [i]: event.target.value }))
                    }
                    aria-label={`Answer for question ${i + 1}`}
                  />
                )}

                {result ? (
                  <p className="question-explanation">
                    <Icon name={correct ? "check" : "close"} size={15} />
                    <span>
                      {correct ? "Correct. " : "Not quite. "}
                      {question.type === "fill" && !correct
                        ? `Accepted: ${question.answers.join(", ")}. `
                        : ""}
                      {question.explanation}
                    </span>
                  </p>
                ) : null}
              </fieldset>
            );
          })}

          {formError ? (
            <p className="inline-error" role="alert">
              <Icon name="alert" size={16} /> {formError}
            </p>
          ) : null}
          {attempt.isError ? (
            <p className="inline-error" role="alert">
              <Icon name="alert" size={16} /> {attempt.error.message}
            </p>
          ) : null}

          <div className="quiz-actions">
            {result ? (
              <>
                <button type="button" className="btn btn-primary" onClick={retry}>
                  <Icon name="refresh" size={17} /> Try again
                </button>
                <Link to="/app/lessons" className="btn btn-outline">
                  Next lesson
                </Link>
              </>
            ) : (
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={attempt.isPending}
              >
                {attempt.isPending ? "Checking…" : "Check answers"}
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
