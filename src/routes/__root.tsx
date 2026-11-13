import type { QueryClient } from "@tanstack/react-query";
import { Link, Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { ErrorPanel, Logo } from "../components/ui";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
  notFoundComponent: NotFound
});

function RootLayout() {
  return <Outlet />;
}

function NotFound() {
  return (
    <div className="standalone">
      <Logo />
      <div className="standalone-card">
        <p className="eyebrow">404</p>
        <h1>This page doesn&apos;t exist</h1>
        <p className="muted">
          The link may be old, or the page may have moved. Your vocabulary is still waiting.
        </p>
        <Link to="/app/dashboard" className="btn btn-primary">
          Back to practice
        </Link>
      </div>
    </div>
  );
}

export function RootError({ error, reset }: { error: unknown; reset?: () => void }) {
  const message =
    error instanceof Error && error.message
      ? error.message
      : typeof error === "string" && error
        ? error
        : "Please refresh the page and try again.";

  return (
    <div className="standalone">
      <Logo />
      <div className="standalone-card">
        <ErrorPanel
          title="The app hit an unexpected error"
          message={message}
          onRetry={reset}
        />
      </div>
    </div>
  );
}
