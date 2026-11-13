import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { AuthLayout, Field, FormError } from "../components/auth-layout";
import { authClient } from "../lib/auth-client";

function safeRedirect(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (!value.startsWith("/") || value.startsWith("//")) return undefined;
  return value;
}

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const redirect = safeRedirect(search.redirect);
    return redirect ? { redirect } : {};
  },
  component: LoginPage
});

function LoginPage() {
  const { redirect: redirectTo } = Route.useSearch();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const { error: authError } = await authClient.signIn.email({ email, password });

    if (authError) {
      setError(authError.message ?? "Those details didn't work. Try again.");
      setPending(false);
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ["me"] });
    window.location.assign(redirectTo ?? "/app/dashboard");
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Pick up where you left off — your due cards are waiting."
      footer={
        <>
          New to Fluent?{" "}
          <Link to="/register" search={{ redirect: redirectTo }}>
            Create an account
          </Link>
        </>
      }
    >
      <form className="form" onSubmit={handleSubmit} noValidate>
        <FormError message={error} />

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

        <Field id="password" label="Password">
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="Your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthLayout>
  );
}
