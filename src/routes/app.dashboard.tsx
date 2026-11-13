import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Icon } from "../components/icons";
import {
  EmptyState,
  ErrorPanel,
  LevelBadge,
  ProgressBar,
  Spinner,
  StatCard
} from "../components/ui";
import { greeting, percent, todayLabel } from "../lib/format";
import { lessonsQuery, meQuery, statsQuery } from "../lib/queries";

export const Route = createFileRoute("/app/dashboard")({
  component: DashboardPage
});

function DashboardPage() {
  const me = useQuery(meQuery());
  const stats = useQuery(statsQuery());
  const lessons = useQuery(lessonsQuery());

  const profile = me.data?.profile;
  const firstName = (profile?.displayName ?? me.data?.user.name ?? "there").split(" ")[0];
  const due = stats.data?.dueCount ?? 0;
  const cardsToday = stats.data?.cardsToday ?? 0;
  const dailyGoal = stats.data?.dailyGoal ?? profile?.dailyGoal ?? 10;
  const goalHit = cardsToday >= dailyGoal;

  const lessonsWithProgress = [...(lessons.data?.lessons ?? [])]
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, 3);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">{todayLabel()}</p>
          <h1>
            {greeting()}, {firstName}.
          </h1>
          <p className="muted page-sub">
            {goalHit
              ? "Daily goal complete. Anything else you do today is a bonus."
              : due > 0
                ? `${due} ${due === 1 ? "card is" : "cards are"} due for review. A short session is enough.`
                : "Nothing is due right now — try a new word or a grammar lesson."}
          </p>
        </div>
        <Link to="/app/vocabulary" className="btn btn-primary">
          <Icon name="cards" size={18} />
          {due > 0 ? `Review ${due} ${due === 1 ? "card" : "cards"}` : "Open vocabulary"}
        </Link>
      </header>

      {stats.isError ? (
        <ErrorPanel
          title="Could not load your stats"
          message={stats.error.message}
          onRetry={() => stats.refetch()}
        />
      ) : stats.isLoading || !stats.data ? (
        <div className="panel">
          <Spinner label="Loading your stats" />
        </div>
      ) : (
        <>
          <section className="grid grid-4" aria-label="Your numbers">
            <StatCard
              icon={<Icon name="target" size={18} />}
              label="Daily goal"
              value={
                <>
                  {cardsToday}
                  <span className="stat-value-sub">/ {dailyGoal}</span>
                </>
              }
              hint={goalHit ? "Goal reached — nice." : "cards reviewed today"}
            >
              <ProgressBar value={cardsToday} max={dailyGoal} label="Daily goal progress" />
            </StatCard>

            <StatCard
              icon={<Icon name="flame" size={18} />}
              label="Streak"
              value={
                <>
                  {stats.data.streak}
                  <span className="stat-value-sub">
                    {stats.data.streak === 1 ? "day" : "days"}
                  </span>
                </>
              }
              hint={
                stats.data.streak > 0
                  ? "Review today to extend it."
                  : "Review one card to start."
              }
            />

            <StatCard
              icon={<Icon name="spark" size={18} />}
              label="Total XP"
              value={stats.data.xp.toLocaleString()}
              hint="10 XP per good review"
            />

            <StatCard
              icon={<Icon name="cards" size={18} />}
              label="Words started"
              value={
                <>
                  {stats.data.totalWords - stats.data.newCount}
                  <span className="stat-value-sub">/ {stats.data.totalWords}</span>
                </>
              }
              hint={`${stats.data.matureCount} mature`}
            >
              <ProgressBar
                value={stats.data.totalWords - stats.data.newCount}
                max={stats.data.totalWords}
                label="Deck coverage"
              />
            </StatCard>
          </section>

          <div className="grid grid-2">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Today&apos;s session</h2>
                  <p className="muted">Short, focused, and in the right order.</p>
                </div>
                <span className="chip chip-quiet">
                  {goalHit ? "Complete" : `${percent(cardsToday, dailyGoal)}%`}
                </span>
              </div>

              <ul className="session-list">
                <li>
                  <span className="session-icon session-icon-due">
                    <Icon name="clock" size={18} />
                  </span>
                  <div className="session-body">
                    <strong>{stats.data.dueCount} due now</strong>
                    <span>Cards the scheduler wants you to see again.</span>
                  </div>
                  <Link
                    to="/app/vocabulary"
                    className="btn btn-soft btn-sm"
                    aria-label="Review due cards"
                  >
                    Review
                  </Link>
                </li>
                <li>
                  <span className="session-icon session-icon-new">
                    <Icon name="spark" size={18} />
                  </span>
                  <div className="session-body">
                    <strong>{stats.data.newCount} new words</strong>
                    <span>Not started yet — add a few to the rotation.</span>
                  </div>
                  <Link
                    to="/app/vocabulary"
                    className="btn btn-soft btn-sm"
                    aria-label="Learn new words"
                  >
                    Learn
                  </Link>
                </li>
                <li>
                  <span className="session-icon session-icon-lesson">
                    <Icon name="lessons" size={18} />
                  </span>
                  <div className="session-body">
                    <strong>
                      {stats.data.lessonsCompleted} of {stats.data.totalLessons} lessons done
                    </strong>
                    <span>Grammar with explanations for every answer.</span>
                  </div>
                  <Link
                    to="/app/lessons"
                    className="btn btn-soft btn-sm"
                    aria-label="Open lessons"
                  >
                    Open
                  </Link>
                </li>
                <li>
                  <span className="session-icon session-icon-speak">
                    <Icon name="mic" size={18} />
                  </span>
                  <div className="session-body">
                    <strong>Speak like a Brit</strong>
                    <span>Everyday UK phrases with word-by-word feedback.</span>
                  </div>
                  <Link
                    to="/app/speaking"
                    className="btn btn-soft btn-sm"
                    aria-label="Practise speaking"
                  >
                    Speak
                  </Link>
                </li>
                <li>
                  <span className="session-icon session-icon-lesson">
                    <Icon name="headphones" size={18} />
                  </span>
                  <div className="session-body">
                    <strong>Dictation</strong>
                    <span>Hear a British voice, type it, check every word.</span>
                  </div>
                  <Link
                    to="/app/listening"
                    className="btn btn-soft btn-sm"
                    aria-label="Practise listening"
                  >
                    Listen
                  </Link>
                </li>
                <li>
                  <span className="session-icon session-icon-due">
                    <Icon name="chat" size={18} />
                  </span>
                  <div className="session-body">
                    <strong>Talk to your tutor</strong>
                    <span>Role-play everyday situations and get corrections.</span>
                  </div>
                  <Link
                    to="/app/tutor"
                    className="btn btn-soft btn-sm"
                    aria-label="Open the conversation tutor"
                  >
                    Chat
                  </Link>
                </li>
              </ul>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Continue learning</h2>
                  <p className="muted">Pick up a lesson where you left off.</p>
                </div>
                <Link to="/app/lessons" className="text-link">
                  All lessons <Icon name="arrow-right" size={15} />
                </Link>
              </div>

              {lessons.isLoading ? (
                <Spinner label="Loading lessons" />
              ) : lessons.isError ? (
                <ErrorPanel message={lessons.error.message} onRetry={() => lessons.refetch()} />
              ) : lessonsWithProgress.length === 0 ? (
                <EmptyState
                  icon={<Icon name="lessons" size={22} />}
                  title="No lessons yet"
                  body="Run `npm run db:seed` to load the starter lessons."
                />
              ) : (
                <ul className="lesson-list compact">
                  {lessonsWithProgress.map((lesson) => (
                    <li key={lesson.id}>
                      <Link
                        to="/app/lessons/$slug"
                        params={{ slug: lesson.slug }}
                        className="lesson-row"
                      >
                        <span className="lesson-row-main">
                          <span className="lesson-row-title">
                            {lesson.title}
                            <LevelBadge level={lesson.level} />
                          </span>
                          <span className="lesson-row-meta">
                            {lesson.questionCount} questions ·{" "}
                            {lesson.attempts === 0
                              ? "not started"
                              : `${lesson.attempts} attempt${lesson.attempts === 1 ? "" : "s"}`}
                          </span>
                        </span>
                        <span className="lesson-row-score">
                          {lesson.bestScore === null ? "—" : `${lesson.bestScore}%`}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
