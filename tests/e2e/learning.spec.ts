import { expect, test } from "@playwright/test";

const API_URL = process.env.E2E_API_URL ?? "http://localhost:8787";
const PASSWORD = "password123";

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

test("sign up, review a card and see the XP on the dashboard", async ({ page }) => {
  const email = uniqueEmail("e2e-signup");

  await page.goto("/register");
  await page.getByLabel("Name").fill("E2E Learner");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/app\/dashboard/);
  await expect(page.getByRole("heading", { name: /E2E/ })).toBeVisible();

  await page.getByRole("link", { name: "Vocabulary", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Words worth keeping" })).toBeVisible();
  await expect(page.getByText(/^Card 1 of /)).toBeVisible();

  await page.getByRole("button", { name: /Show answer/ }).click();
  await expect(page.getByText("New word — rate how well you know it.")).toBeVisible();
  await page.getByRole("button", { name: /^Good/ }).click();

  // The queue advances as soon as the mutation succeeds.
  await expect(page.getByText(/^Card 2 of /)).toBeVisible();

  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page.getByRole("heading", { name: /E2E/ })).toBeVisible();

  const xpChip = page.locator(".topbar .chip").filter({ hasText: "XP" });
  await expect(xpChip).toContainText("10 XP");

  const xpCard = page.locator(".stat-card").filter({ hasText: "Total XP" });
  await expect(xpCard.locator(".stat-value")).toHaveText("10");
});

test("signed-out visitors are redirected to login and the redirect is honoured", async ({
  page,
  request
}) => {
  const email = uniqueEmail("e2e-login");

  const created = await request.post(`${API_URL}/api/auth/sign-up/email`, {
    headers: { Origin: "http://localhost:5173" },
    data: { name: "E2E Login", email, password: PASSWORD }
  });
  expect(created.ok()).toBe(true);

  await page.goto("/app/vocabulary");
  await expect(page).toHaveURL(/\/login\?redirect=/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toBeVisible();

  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/app\/vocabulary/);
  await expect(page.getByRole("heading", { name: "Words worth keeping" })).toBeVisible();
});

test("signing out clears the session", async ({ page, request }) => {
  const email = uniqueEmail("e2e-signout");

  const created = await request.post(`${API_URL}/api/auth/sign-up/email`, {
    headers: { Origin: "http://localhost:5173" },
    data: { name: "E2E Signout", email, password: PASSWORD }
  });
  expect(created.ok()).toBe(true);

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("http://localhost:5173/");

  await page.goto("/app/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("practise a British phrase and earn speaking XP", async ({ page }) => {
  const email = uniqueEmail("e2e-speaking");

  await page.goto("/register");
  await page.getByLabel("Name").fill("E2E Speaker");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/app\/dashboard/);

  await page.getByRole("link", { name: "Speaking", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Speak like a Brit" })).toBeVisible();

  const target = await page.getByTestId("speaking-target").innerText();
  await page.getByLabel("No microphone? Type what you said").fill(target);
  await page.getByRole("button", { name: "Check", exact: true }).click();

  const result = page.getByTestId("speaking-result");
  await expect(result).toBeVisible();
  await expect(result.locator(".score-ring strong")).toHaveText("100%");
  await expect(result).toContainText("+15 XP");

  const xpChip = page.locator(".topbar .chip").filter({ hasText: "XP" });
  await expect(xpChip).toContainText("15 XP");
});

test("practise British listening with a dictation clip", async ({ page }) => {
  const email = uniqueEmail("e2e-listening");

  await page.goto("/register");
  await page.getByLabel("Name").fill("E2E Listener");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/app\/dashboard/);

  await page.getByRole("link", { name: "Listening", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Dictation" })).toBeVisible();

  await page.getByRole("button", { name: "Show text" }).click();
  const clip = await page.getByTestId("dictation-text").innerText();

  await page.getByLabel("Type what you heard").fill(clip);
  await page.getByRole("button", { name: "Check", exact: true }).click();

  const result = page.getByTestId("dictation-result");
  await expect(result).toBeVisible();
  await expect(result.locator(".score-ring strong")).toHaveText("100%");

  const xpChip = page.locator(".topbar .chip").filter({ hasText: "XP" });
  await expect(xpChip).toContainText("15 XP");
});

test("streams a tutor reply and corrects Americanisms", async ({ page }) => {
  const email = uniqueEmail("e2e-tutor");

  await page.goto("/register");
  await page.getByLabel("Name").fill("E2E Tutor");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/app\/dashboard/);

  await page.getByRole("link", { name: "Tutor", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Talk to your tutor" })).toBeVisible();

  await page.getByLabel("Your reply").fill("I would like a color coffee in an apartment");
  await page.getByRole("button", { name: "Send" }).click();

  const correction = page.locator(".tutor-correction");
  await expect(correction).toContainText("colour");
  await expect(correction).toContainText("flat");

  // The streamed reply is persisted and rendered as an assistant message.
  await expect(page.locator(".tutor-bubble").filter({ hasText: "Nice one." })).toBeVisible();
});
