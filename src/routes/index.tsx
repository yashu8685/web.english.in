import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Icon } from "../components/icons";
import { Logo } from "../components/ui";
import { meQuery } from "../lib/queries";

export const Route = createFileRoute("/")({
  component: LandingPage
});

const features = [
  {
    icon: "cards" as const,
    title: "Spaced repetition that adapts",
    body: "An SM-2 scheduler decides when you see each word again — right before you would forget it."
  },
  {
    icon: "lessons" as const,
    title: "Grammar you can use",
    body: "Short lessons built around the mistakes B1–B2 learners actually make, with instant feedback."
  },
  {
    icon: "target" as const,
    title: "A goal you can finish",
    body: "Set a daily card target. Streaks and XP keep the habit visible without turning it into a grind."
  },
  {
    icon: "spark" as const,
    title: "One account, every device",
    body: "Your reviews and progress live in Postgres, so the schedule follows you from laptop to phone."
  }
];

function LandingPage() {
  const { data } = useQuery({ ...meQuery(), retry: false });
  const signedIn = Boolean(data?.user);

  return (
    <div className="landing">
      <header className="landing-nav">
        <Logo />
        <nav className="landing-nav-links" aria-label="Main">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
        </nav>
        <div className="landing-nav-actions">
          {signedIn ? (
            <Link to="/app/dashboard" className="btn btn-primary btn-sm">
              Open dashboard <Icon name="arrow-right" size={16} />
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">
                Sign in
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Start free
              </Link>
            </>
          )}
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="dot" /> For B1–B2 English learners
            </p>
            <h1>
              Stop translating.
              <br />
              Start <em>speaking</em>.
            </h1>
            <p className="hero-sub">
              Fluent turns the words you almost know into words you actually use — with adaptive
              flashcards, focused grammar lessons, and a daily habit you can keep.
            </p>
            <div className="hero-actions">
              <Link to="/register" className="btn btn-primary btn-lg">
                Create your free account <Icon name="arrow-right" size={18} />
              </Link>
              <Link to="/login" className="btn btn-outline btn-lg">
                I already have one
              </Link>
            </div>
            <ul className="hero-points">
              <li>
                <Icon name="check" size={16} /> No credit card
              </li>
              <li>
                <Icon name="check" size={16} /> 12-word starter deck
              </li>
              <li>
                <Icon name="check" size={16} /> Progress synced everywhere
              </li>
            </ul>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="mock-card">
              <div className="mock-card-top">
                <span className="badge badge-level badge-b2">B2</span>
                <span className="mock-card-count">3 / 12</span>
              </div>
              <div className="mock-word">reluctant</div>
              <div className="mock-ipa">/rɪˈlʌktənt/ · adjective</div>
              <div className="mock-divider" />
              <p className="mock-meaning">not willing to do something; hesitant</p>
              <p className="mock-example">
                &ldquo;She was <mark>reluctant</mark> to admit the mistake.&rdquo;
              </p>
              <div className="mock-actions">
                <span className="mock-pill">Again</span>
                <span className="mock-pill">Hard</span>
                <span className="mock-pill mock-pill-active">Good</span>
                <span className="mock-pill">Easy</span>
              </div>
            </div>
            <div className="mock-float mock-float-streak">
              <Icon name="flame" size={18} /> 7-day streak
            </div>
            <div className="mock-float mock-float-xp">
              <Icon name="spark" size={18} /> +10 XP
            </div>
          </div>
        </section>

        <section className="landing-strip" aria-label="Product principles">
          <div>
            <strong>2 min</strong>
            <span>minimum daily session</span>
          </div>
          <div>
            <strong>SM-2</strong>
            <span>scheduling algorithm</span>
          </div>
          <div>
            <strong>B1 → B2</strong>
            <span>level-aware content</span>
          </div>
          <div>
            <strong>0</strong>
            <span>streak freezes to buy</span>
          </div>
        </section>

        <section id="features" className="section">
          <div className="section-head">
            <p className="eyebrow">What&apos;s inside</p>
            <h2>Everything you need to move up a level</h2>
            <p className="muted">
              No endless content library. A small, focused system that gets out of your way.
            </p>
          </div>
          <div className="feature-grid">
            {features.map((feature) => (
              <article key={feature.title} className="feature">
                <span className="feature-icon">
                  <Icon name={feature.icon} size={22} />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how" className="section how">
          <div className="section-head">
            <p className="eyebrow">How it works</p>
            <h2>Three steps, repeated daily</h2>
          </div>
          <ol className="steps">
            <li>
              <span className="step-num">01</span>
              <h3>Review your due cards</h3>
              <p>
                Words you rated <em>again</em> come back in minutes; words you knew come back in
                days. The schedule does the thinking.
              </p>
            </li>
            <li>
              <span className="step-num">02</span>
              <h3>Fix one grammar point</h3>
              <p>
                Read a short explanation, study the common mistakes, then take a four-question quiz
                with explanations for every answer.
              </p>
            </li>
            <li>
              <span className="step-num">03</span>
              <h3>Keep the streak alive</h3>
              <p>
                Hit your daily goal to grow your streak and XP. Miss a day and it resets — which is
                exactly why you come back.
              </p>
            </li>
          </ol>
        </section>

        <section className="cta">
          <div>
            <h2>Your next 100 words are waiting.</h2>
            <p>Set up your account in under a minute. The first review takes two.</p>
          </div>
          <Link to="/register" className="btn btn-inverse btn-lg">
            Start learning free <Icon name="arrow-right" size={18} />
          </Link>
        </section>
      </main>

      <footer className="landing-footer">
        <Logo />
        <p>Built with TanStack, Hono, Drizzle and Neon Postgres.</p>
        <span className="muted">© {new Date().getFullYear()} Fluent</span>
      </footer>
    </div>
  );
}
