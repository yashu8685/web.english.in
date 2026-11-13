import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Icon } from "./icons";

export function Logo({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className="logo" aria-label="Fluent home">
      <span className="logo-mark" aria-hidden="true">
        F
      </span>
      <span className="logo-word">fluent</span>
    </Link>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="spinner-wrap" role="status" aria-live="polite">
      <span className="spinner" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="page-loader">
      <Spinner label="Loading page" />
    </div>
  );
}

export function ErrorPanel({
  title = "Something went wrong",
  message,
  onRetry
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="panel panel-error" role="alert">
      <span className="panel-error-icon">
        <Icon name="alert" size={22} />
      </span>
      <div>
        <h2>{title}</h2>
        <p>{message}</p>
        {onRetry ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
            <Icon name="refresh" size={16} /> Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function ProgressBar({
  value,
  max,
  label
}: {
  value: number;
  max: number;
  label?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label ?? "Progress"}
    >
      <span className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function StatCard({
  icon,
  label,
  value,
  hint,
  children
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <span className="stat-icon">{icon}</span>
        <span className="stat-label">{label}</span>
      </div>
      <div className="stat-value">{value}</div>
      {hint ? <p className="stat-hint">{hint}</p> : null}
      {children}
    </div>
  );
}

export function LevelBadge({ level }: { level: string }) {
  return <span className={`badge badge-level badge-${level.toLowerCase()}`}>{level}</span>;
}

export function EmptyState({
  icon,
  title,
  body,
  action
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}
