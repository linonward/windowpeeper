import { expect, test } from "@playwright/test";
import Stripe from "stripe";
import { BASE_URL, STRIPE_WEBHOOK_SECRET } from "../playwright.config";
import { readEmail, signIn } from "./support/auth";
import { addSubscription } from "./support/db";

test("signed-out visitors are redirected before the page renders", async ({ request }) => {
  const response = await request.get("/billing", { maxRedirects: 0 });

  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe("/sign-in?next=%2Fbilling");
});

test("the sidebar opens billing with the balance, the packs and the credit history", async ({ page }) => {
  await signIn(page);
  await page.goto("/videos");

  await page
    .getByRole("navigation", { name: "Dashboard navigation" })
    .getByRole("link", { name: "Billing" })
    .click();

  await expect(page).toHaveURL("/billing");
  await expect(page.getByRole("heading", { level: 1, name: "Credits & billing" })).toBeVisible();
  // New accounts start with no credits (signupCredits in src/server/credits/config.ts).
  await expect(page.getByText("Credit balance").locator("+ p")).toHaveText("0 credits");
  // The recommended pack starts picked; buying is off without a provider.
  await expect(page.getByRole("button", { name: "Buy 50 credits for $19.90" })).toBeDisabled();
  await expect(page.getByText("Payments aren't set up yet.")).toBeVisible();
  await expect(page.getByText("No orders yet.")).toBeVisible();
  await expect(page.getByText("No credit activity yet.")).toBeVisible();
});

// CREDIT_PACKS: one-time packs only, no subscription on sale.
test("offers the three packs with what each buys, and no subscription", async ({ page }) => {
  await signIn(page);

  await page.goto("/billing");

  const main = page.getByRole("main");
  const packs = main.getByRole("radiogroup", { name: "Buy credits" });
  for (const [name, text] of [
    ["Single · 1 video", "10 credits · $5.90 a video$5.90"],
    ["5-pack · 5 videos", "50 credits · $3.98 a video$19.90Save 33%"],
    ["25-pack · 25 videos", "250 credits · $2.80 a video$69.90Save 53%"],
  ]) {
    await expect(packs.locator("label").filter({ hasText: name })).toContainText(text);
  }
  await expect(packs.locator("label").filter({ hasText: "5-pack · 5 videos" })).toContainText("Recommended");
  await expect(main).toContainText("Secure checkout. One-time payment, no subscription.");
  await expect(main.getByRole("heading", { name: "Subscription" })).toHaveCount(0);
  await expect(main.getByRole("button", { name: /Subscribe/ })).toHaveCount(0);
});

test("subscribing and the portal need a session and a subscription", async ({ page, request }) => {
  for (const endpoint of ["/api/payment/subscribe", "/api/payment/portal"]) {
    expect((await request.post(endpoint, { data: {} })).status(), endpoint).toBe(401);
  }

  await signIn(page);
  const post = (endpoint: string, data: object) =>
    page.request.post(endpoint, { data, headers: { origin: BASE_URL } });

  // No plan is on sale (PLANS_ON_SALE), so every plan is unknown to buyers.
  for (const planId of ["pro", "pro-yearly"]) {
    const subscribe = await post("/api/payment/subscribe", { planId, locale: "en" });
    expect(subscribe.status(), planId).toBe(400);
    expect(await subscribe.json()).toEqual({ error: "UNKNOWN_PLAN" });
  }

  const portal = await post("/api/payment/portal", { locale: "en" });
  expect(portal.status()).toBe(404);
  expect(await portal.json()).toEqual({ error: "NO_SUBSCRIPTION" });
});

test("shows the result of a checkout the provider sent back", async ({ page }) => {
  await signIn(page);

  await page.goto("/es/billing?checkout=cancel");

  await expect(page.getByRole("status")).toHaveText("Pago cancelado. No se te ha cobrado nada.");
});

test("checkout needs a session, then reports payments off", async ({ page, request }) => {
  const anonymous = await request.post("/api/payment/checkout", { data: { packId: "small" } });
  expect(anonymous.status()).toBe(401);

  await signIn(page);
  const response = await page.request.post("/api/payment/checkout", {
    data: { packId: "small", locale: "en" },
    headers: { origin: BASE_URL },
  });
  expect(response.status()).toBe(503);
  expect(await response.json()).toEqual({ error: "PAYMENTS_DISABLED" });
});

test.describe("payment webhooks", () => {
  const event = (type: string, object: object) =>
    JSON.stringify({ id: "evt_e2e", object: "event", type, data: { object } });
  const payload = event("checkout.session.expired", { client_reference_id: crypto.randomUUID() });
  const signed = (body: string) =>
    Stripe.webhooks.generateTestHeaderString({ payload: body, secret: STRIPE_WEBHOOK_SECRET });

  test("accept an event Stripe signed", async ({ request }) => {
    const response = await request.post("/api/webhooks/payment/stripe", {
      data: payload,
      headers: { "content-type": "application/json", "stripe-signature": signed(payload) },
    });

    expect(response.status()).toBe(200);
  });

  // Every order is recorded before its checkout, so Stripe should retry.
  test("answer 409 to a signed payment for an order this app never recorded", async ({ request }) => {
    const paid = event("checkout.session.completed", {
      client_reference_id: crypto.randomUUID(),
      payment_status: "paid",
    });

    const response = await request.post("/api/webhooks/payment/stripe", {
      data: paid,
      headers: { "content-type": "application/json", "stripe-signature": signed(paid) },
    });

    expect(response.status()).toBe(409);
    expect(await response.json()).toEqual({ error: "UNKNOWN_ORDER" });
  });

  test("accept a signed invoice for a subscription this app doesn't know", async ({ request }) => {
    const invoice = JSON.stringify({
      id: "evt_e2e_invoice",
      object: "event",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_e2e",
          customer: "cus_e2e",
          parent: { subscription_details: { subscription: "sub_e2e", metadata: { subscriptionId: crypto.randomUUID() } } },
        },
      },
    });
    const signature = Stripe.webhooks.generateTestHeaderString({ payload: invoice, secret: STRIPE_WEBHOOK_SECRET });

    const response = await request.post("/api/webhooks/payment/stripe", {
      data: invoice,
      headers: { "content-type": "application/json", "stripe-signature": signature },
    });

    expect(response.status()).toBe(200);
  });

  test("email the subscriber when a charge fails, with a link to billing", async ({ page, request }) => {
    const email = await signIn(page);
    const subscriptionId = await addSubscription(email);
    const failed = event("customer.subscription.updated", {
      id: "sub_e2e",
      status: "past_due",
      metadata: { subscriptionId },
    });

    const response = await request.post("/api/webhooks/payment/stripe", {
      data: failed,
      headers: { "content-type": "application/json", "stripe-signature": signed(failed) },
    });
    expect(response.status()).toBe(200);

    const { text } = await readEmail(email, /payment didn't go through/);
    const link = text.match(/https?:\/\/\S+/)?.[0];
    expect(link).toBe(`${BASE_URL}/billing`);
    await page.goto(link!);
    await expect(page).toHaveURL(/\/billing$/);
  });

  test("reject an unsigned event", async ({ request }) => {
    for (const provider of ["stripe", "waffo"]) {
      const response = await request.post(`/api/webhooks/payment/${provider}`, {
        data: payload,
        headers: { "content-type": "application/json" },
      });
      expect(response.status(), provider).toBe(400);
    }
  });

  test("404 for an unknown provider", async ({ request }) => {
    const response = await request.post("/api/webhooks/payment/paypal", { data: payload });

    expect(response.status()).toBe(404);
  });
});
