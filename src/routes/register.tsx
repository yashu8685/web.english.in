import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { registerSchema } from "@contracts";
import { AuthLayout, Field, FormError } from "../components/auth-layout";
import { authClient } from "../lib/auth-client";

function safeRedirect(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (!value.startsWith("/") || value.startsWith("//")) return undefined;
  return value;
}

export const Route = createFileRoute("/register")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const redirect = safeRedirect(search.redirect);
    return redirect ? { redirect } : {};
  },
  component: RegisterPage
});

function RegisterPage() {
  const { redirect: redirectTo } = Route.useSearch();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    // Reuse the exact schema the API validates with, so the rules never drift.
    const parsed = registerSchema.safeParse({ name, email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your details and try again.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }

    setPending(true);
    const { error: authError } = await authClient.signUp.email(parsed.data);

    if (authError) {
      setError(
        authError.code?.startsWith("USER_ALREADY_EXISTS") || authError.status === 422
          ? "An account with that email already exists. Try signing in instead."
          : (authError.message ?? "Could not create your account.")
      );
      setPending(false);
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ["me"] });
    window.location.assign(redirectTo ?? "/app/dashboard");
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Free, no card required. Start with a 12-word deck built for B1–B2."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" search={{ redirect: redirectTo }}>
            Sign in
          </Link>
        </>
      }
    >
      <form className="form" onSubmit={handleSubmit} noValidate>
        <FormError message={error} />

        <Field id="name" label="Name">
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            placeholder="Alex"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <Field id="email" label="Email">
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>

        <div className="field-row">
          <Field id="password" label="Password" hint="8+ characters">
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>

          <Field id="confirm" label="Confirm">
            <input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              placeholder="••••••••"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </Field>
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
          {pending ? "Creating your account…" : "Create account"}
        </button>
        <p className="form-fineprint">
          By continuing you agree to keep your streak alive. (Kidding — but it helps.)
        </p>
      </form>
    </AuthLayout>
  );
}
