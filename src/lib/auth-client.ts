import { createAuthClient } from "better-auth/react";
import { API_URL } from "./api";

/**
 * Better Auth's React client. It talks to the Hono API mounted at
 * `/api/auth/*` and relies on the session cookie, so no tokens are stored
 * in localStorage.
 */
export const authClient = createAuthClient({
  baseURL: API_URL,
  basePath: "/api/auth",
  fetchOptions: {
    credentials: "include"
  }
});
