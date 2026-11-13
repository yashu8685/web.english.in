import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { Icon, type IconName } from "../components/icons";
import { Logo, PageLoader } from "../components/ui";
import { RootError } from "./__root";
import { ApiError } from "../lib/api";
import { authClient } from "../lib/auth-client";
import { meQuery } from "../lib/queries";
import { todayLabel } from "../lib/format";

export const Route = createFileRoute("/app")({
  // Runs before the layout renders: no flash of protected content, and the
  // profile is guaranteed to exist for every child route.
  beforeLoad: async ({ context, location }) => {
    try {
      await context.queryClient.ensureQueryData(meQuery());
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        throw redirect({ to: "/login", search: { redirect: location.href } });
      }
      throw error;
    }
  },
  pendingComponent: PageLoader,
  errorComponent: ({ error, reset }) => <RootError error={error} reset={reset} />,
  component: AppLayout
});

const nav: Array<{ to: string; label: string; icon: IconName }> = [
  { to: "/app/dashboard", label: "Dashboard", icon: "home" },
  { to: "/app/vocabulary", label: "Vocabulary", icon: "cards" },
  { to: "/app/lessons", label: "Lessons", icon: "lessons" },
  { to: "/app/speaking", label: "Speaking", icon: "mic" },
  { to: "/app/listening", label: "Listening", icon: "headphones" },
  { to: "/app/tutor", label: "Tutor", icon: "chat" }
];

function AppLayout() {
  const queryClient = useQueryClient();
  const { data } = useQuery(meQuery());
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const profile = data?.profile;
  const user = data?.user;
  const name = profile?.displayName ?? user?.name ?? "learner";
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleSignOut() {
    setSigningOut(true);
    await authClient.signOut();
    queryClient.clear();
    window.location.assign("/");
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar${menuOpen ? " is-open" : ""}`}>
        <div className="sidebar-top">
          <Logo to="/app/dashboard" />
          <button
            type="button"
            className="icon-btn sidebar-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="App">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="nav-item"
              activeProps={{ className: "nav-item is-active" }}
              onClick={() => setMenuOpen(false)}
            >
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-goal">
          <div className="sidebar-goal-head">
            <span>Streak</span>
            <strong>
              {profile?.streak ?? 0} {(profile?.streak ?? 0) === 1 ? "day" : "days"}
            </strong>
          </div>
          <p>
            {profile?.streak
              ? "One review today keeps the flame alive."
              : "Review one card to start a streak."}
          </p>
          <Link to="/app/vocabulary" className="btn btn-soft btn-sm btn-block">
            Review now
          </Link>
        </div>

        <div className="sidebar-user">
          <span className="avatar" aria-hidden="true">
            {initials || "F"}
          </span>
          <div className="sidebar-user-meta">
            <strong>{name}</strong>
            <span>{user?.email}</span>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={handleSignOut}
            disabled={signingOut}
            aria-label="Sign out"
            title="Sign out"
          >
            <Icon name="logout" size={18} />
          </button>
        </div>
      </aside>

      {menuOpen ? (
        <button
          type="button"
          className="sidebar-scrim"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <div className="app-main">
        <header className="topbar">
          <button
            type="button"
            className="icon-btn topbar-menu"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Icon name="menu" size={20} />
          </button>
          <span className="topbar-date">{todayLabel()}</span>
          <div className="topbar-right">
            <span className="chip">
              <Icon name="flame" size={15} /> {profile?.streak ?? 0}
            </span>
            <span className="chip">
              <Icon name="spark" size={15} /> {profile?.xp ?? 0} XP
            </span>
          </div>
        </header>

        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
