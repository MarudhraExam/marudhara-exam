# Marudhara Exam — Payments Worker

Cloudflare Worker backend for Razorpay payments + Firestore-backed
CATEGORY-level premium mock test unlocking. Purchasing a category (e.g.
"RSSB CET") unlocks every mock inside it; other categories stay locked
until purchased separately. See `index.js` for the endpoint summary.

**This package is backend-only.** No frontend files are included or modified.

---

## 1. Prerequisites

- A Cloudflare account with the Worker already created (per your setup).
- Node.js 18+ and `npm` installed locally.
- Wrangler CLI (installed via `npm install`, uses the `devDependencies` entry).
- A **Firebase service account** with Firestore access:
  1. Firebase Console → Project Settings → Service Accounts → "Generate new private key".
  2. This downloads a JSON file containing `client_email` and `private_key`.
  3. Keep this file secret — never commit it, never put it in the frontend.
- Razorpay Dashboard access to configure a webhook (Step 5).

---

## 2. Install dependencies

```bash
cd razorpay-worker
npm install
```

---

## 3. Configure `wrangler.toml`

Open `wrangler.toml` and set:
- `FIREBASE_PROJECT_ID` — your Firebase project id (e.g. `marudhara-exam`).
- `ALLOWED_ORIGIN` — your exact GitHub Pages origin, e.g. `https://yourusername.github.io` (no trailing slash, no path). This is required for the browser to be allowed to call the Worker.

Category pricing (`isFree`, `originalPrice`, `offerPrice`) is managed entirely
in the `mockCategories/{categoryId}` Firestore documents via the admin panel
(`mock-admin.html` → Category Manager). There are no pricing environment
variables to configure — changing a category's price there automatically
affects every mock inside it and the amount charged at checkout.

---

## 4. Set secrets

Razorpay's `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` are already bound to
the Worker per your existing setup — nothing to do there.

Add the remaining secrets this implementation needs:

```bash
# Webhook signing secret (you'll generate this in Step 5 and paste it here)
wrangler secret put RAZORPAY_WEBHOOK_SECRET

# Firebase service account — client_email
wrangler secret put FIREBASE_CLIENT_EMAIL

# Firebase service account — private_key
# IMPORTANT: paste the private key with literal \n sequences (not real
# newlines) if your shell strips them, e.g.:
#   "-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
# The Worker code un-escapes \n back into real newlines before use.
wrangler secret put FIREBASE_PRIVATE_KEY
```

You can verify what's bound (names only, not values) with:
```bash
wrangler secret list
```

---

## 5. Configure the Razorpay webhook

1. Razorpay Dashboard → Settings → Webhooks → Add New Webhook.
2. URL: `https://<your-worker-subdomain>.workers.dev/api/webhook`
   (or your custom route, once mapped — see Step 7).
3. Active events: enable at least `payment.captured` (and optionally `order.paid`).
4. Set a webhook secret — copy this exact value into `RAZORPAY_WEBHOOK_SECRET` (Step 4).

This webhook is a **fallback only**. The main unlock path is
`/api/verify-payment`, called directly by the frontend right after
Razorpay Checkout succeeds. The webhook exists so a payment still gets
credited even if the student's browser closes before that call completes.

---

## 6. Firestore setup

No manual collection creation is required — `paymentOrders` and
`userCategoryAccess` are created on first use by the Worker itself.
Pricing lives on the categories you already manage in `mockCategories`
via the admin panel (`isFree`, `originalPrice`, `offerPrice`) — there is
no separate pricing collection.

**Security rules reminder:** the Worker authenticates to Firestore via the
service account (full access, bypassing security rules). Make sure your
Firestore Security Rules **deny direct client access** to the
`userCategoryAccess` and `paymentOrders` collections, since all
reads/writes to them should go through this Worker's endpoints, never
straight from the browser SDK.

---

## 7. Deploy

```bash
npm run dev      # local development / testing (wrangler dev)
npm run deploy    # publishes to Cloudflare
```

After deploying, the Worker is reachable at your `*.workers.dev` subdomain
or any custom route you've mapped to it in the Cloudflare dashboard. Point
the frontend's payment calls at that base URL (frontend changes are out of
scope for this task, per your instructions).

---

## 8. Smoke-test the endpoints

```bash
# Create an order (categoryId must reference a Premium — isFree:false — category)
curl -X POST https://<worker-url>/api/create-order \
  -H "Content-Type: application/json" \
  -d '{"mobile":"9876543210","categoryId":"rssb_cet"}'

# Purchase status for a specific category (should show paid:false before any payment)
curl "https://<worker-url>/api/purchase-status?mobile=9876543210&categoryId=rssb_cet"
```

`/api/verify-payment` and `/api/webhook` can only be exercised meaningfully
against a real (or Razorpay test-mode) payment, since they depend on a
genuine signature.

---

## 9. Monitoring

```bash
npm run tail   # wrangler tail — live request/log stream
```

Errors from Razorpay, Google OAuth token exchange, and Firestore are all
logged via `console.error` inside the relevant handler for traceability.
