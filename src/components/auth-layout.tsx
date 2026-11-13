import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Icon } from "./icons";
import { Logo } from "./ui";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="auth">
      <aside className="auth-aside">
        <Logo />
        <div className="auth-aside-body">
          <blockquote>
            &ldquo;The limits of my language mean the limits of my world.&rdquo;
            <cite>Ludwig Wittgenstein</cite>
          </blockquote>
          <ul className="auth-aside-list">
            <li>
              <Icon name="cards" size={18} /> Adaptive vocabulary reviews
            </li>
            <li>
              <Icon name="lessons" size={18} /> B1–B2 grammar lessons
            </li>
            <li>
              <Icon name="flame" size={18} /> Streaks that keep you honest
            </li>
          </ul>
        </div>
        <p className="auth-aside-foot">
          <Link to="/">← Back to the homepage</Link>
        </p>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-card-head">
            <h1>{title}</h1>
            <p className="muted">{subtitle}</p>
          </div>
          {children}
          <div className="auth-switch">{footer}</div>
        </div>
      </main>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="form-error" role="alert">
      <Icon name="alert" size={16} />
      <span>{message}</span>
    </div>
  );
}

export function Field({
  id,
  label,
  hint,
  children
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <div className="field-head">
        <label htmlFor={id}>{label}</label>
        {hint ? <span className="field-hint">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}
