# LZD / SHP → LINE Order Notification

Sends a LINE message to your **Packaging team's group chat** the moment a new
order arrives from **Lazada** or **Shopee**, so they can start packing without
watching two seller dashboards.

```
Lazada push ─┐
             ├─►  this service  ──►  LINE Messaging API  ──►  Packaging group
Shopee push ─┘     (Node.js)         (push message)
```

It is **webhook-first** (real-time, recommended) with a **polling fallback**
for environments that can't expose a public URL.

> **Note on LINE Notify:** LINE Notify was shut down in 2025. This project uses
> the current, supported **LINE Messaging API** (a bot / Official Account that
> pushes into your group).

---

## What it does

- Receives order-status pushes from Lazada and Shopee and verifies their signatures.
- Fetches full order details (buyer, items, SKUs, quantities, ship-to).
- Formats a clear "PACK THIS" card and pushes it to your Packaging LINE group.
- **Deduplicates** so the team never gets the same order twice (platforms retry).
- Optional **poller** if you can't host a public webhook.

---

## Project layout

```
src/
  config.js     env loading
  line.js       LINE push + webhook signature verify
  lazada.js     Lazada signing, order fetch, normalize
  shopee.js     Shopee signing, push verify, order fetch, normalize
  notifier.js   builds the LINE Flex card + dedup gate
  store.js      file-backed "seen orders" dedup store
  server.js     Express webhook endpoints (Shopee / Lazada / LINE)
  poller.js     polling fallback
test/
  signing.test.js
.env.example
```

---

## Setup

### 0. Install

Requires Node.js 20+.

```bash
npm install
cp .env.example .env   # then fill in .env (Windows: copy .env.example .env)
```

### 1. LINE — create the bot and get it into the group

1. Go to the **LINE Developers Console** → create a **Provider** → create a
   **Messaging API channel** (this is your bot / Official Account).
2. In the channel:
   - **Basic settings** tab → copy **Channel secret** → `LINE_CHANNEL_SECRET`.
   - **Messaging API** tab → issue/copy **Channel access token (long-lived)** →
     `LINE_CHANNEL_ACCESS_TOKEN`.
   - Turn **Allow bot to join group chats** = ON, and turn **Auto-reply / greeting**
     OFF (optional, keeps the group clean).
3. **Get your group ID** (`LINE_TARGET_ID`):
   - Set the channel's **Webhook URL** to `https://<your-domain>/webhook/line`
     and enable "Use webhook".
   - Invite the bot into your Packaging group, then send any message in the group.
   - This service logs `[line] event=message type=group id=Cxxxx…`.
   - Copy that `Cxxxx…` value into `LINE_TARGET_ID`.

### 2. Lazada — app + push callback

1. At **open.lazada.com**, create an app and copy **App Key / App Secret** →
   `LAZADA_APP_KEY` / `LAZADA_APP_SECRET`.
2. Authorize the seller account and store the **access token** → `LAZADA_ACCESS_TOKEN`.
3. Set `LAZADA_API_BASE` to your country gateway (e.g. Thailand
   `https://api.lazada.co.th/rest`).
4. In the App Console → **Push Message**, set the callback URL to
   `https://<your-domain>/webhook/lazada` and subscribe to **order** messages.

### 3. Shopee — app + push URL

1. At **open.shopee.com**, create an app and copy **Partner ID / Partner Key** →
   `SHOPEE_PARTNER_ID` / `SHOPEE_PARTNER_KEY`.
2. Authorize the shop, store **shop_id** and **access token** →
   `SHOPEE_SHOP_ID` / `SHOPEE_ACCESS_TOKEN`.
3. In the Console → **Push Mechanism**, set the **Live Push URL** to
   `https://<your-domain>/webhook/shopee` and enable **order_status_push**.

### 4. Run

```bash
npm start          # starts the webhook server on PORT (default 3000)
```

You need a **public HTTPS URL**. For local testing use a tunnel
(`cloudflared tunnel --url http://localhost:3000` or `ngrok http 3000`) and use
that URL in the platform consoles and in `PUBLIC_BASE_URL`.

---

## Deploy on Railway

Railway runs the webhook server 24/7 and gives you the public HTTPS URL the
platforms need. Files in `railway.json` and `.nvmrc` are already included.

### 1. Push to a Git repo

```bash
git init && git add . && git commit -m "order notifier"
# push to GitHub/GitLab
```

### 2. Create the service

- **railway.com → New Project → Deploy from GitHub repo** (select this repo).
  Railway auto-detects Node via Nixpacks and runs `npm start`.
- Or with the CLI:
  ```bash
  npm i -g @railway/cli
  railway login
  railway init
  railway up
  ```

### 3. Add a persistent volume (important)

Railway's filesystem is **ephemeral** — without a volume the dedup state is
wiped on every redeploy and the Packaging team gets **duplicate** notifications.

- In the service → **Variables/Settings → Volumes → New Volume**.
- Mount path: **`/data`**.
- Then set the variable `DATA_DIR=/data` (next step) so the store writes there.

### 4. Set environment variables

In the service → **Variables**, add everything from `.env.example`:

| Variable | Value |
|---|---|
| `PUBLIC_BASE_URL` | your Railway domain, e.g. `https://your-app.up.railway.app` |
| `DATA_DIR` | `/data` (the volume mount path) |
| `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `LINE_TARGET_ID` | from LINE console |
| `LAZADA_APP_KEY`, `LAZADA_APP_SECRET`, `LAZADA_ACCESS_TOKEN`, `LAZADA_API_BASE` | from Lazada console |
| `SHOPEE_PARTNER_ID`, `SHOPEE_PARTNER_KEY`, `SHOPEE_SHOP_ID`, `SHOPEE_ACCESS_TOKEN`, `SHOPEE_API_BASE` | from Shopee console |

Do **not** set `PORT` — Railway injects it and `config.js` reads it automatically.

### 5. Generate a domain

Service → **Settings → Networking → Generate Domain**. Copy it into
`PUBLIC_BASE_URL`, then register these callback URLs in the platform consoles:

- Shopee Live Push URL → `https://<domain>/webhook/shopee`
- Lazada callback URL → `https://<domain>/webhook/lazada`
- LINE Webhook URL → `https://<domain>/webhook/line`

Railway redeploys on every push. Check **Deploy Logs** for the startup banner
and `/healthz` (used as the healthcheck) to confirm it's live.

> **Tip:** Instead of a volume you can swap `src/store.js` for Railway's managed
> **Redis** plugin — same `isNew` / `markSeen` interface. Best if you run more
> than one replica (a file volume isn't shared across replicas).

---

## Polling fallback (no public URL?)

If you can't expose a webhook, use polling instead:

```bash
ENABLE_POLLING=true   # in .env
npm run poll          # standalone, or it auto-starts with `npm start`
```

It checks each platform every `POLL_INTERVAL_SECONDS` for orders created since
the last run and notifies any new ones. Real-time webhooks are still preferred —
polling adds delay and uses more API quota.

---

## How the message looks

A colored card (Lazada navy / Shopee orange) with header **"NEW … ORDER"**,
order number, buyer, item count, total, ship-to, status, and a **PACK THIS**
list of `qty × item — variation` plus the SKU list for picking.

---

## Security notes

- All three webhooks verify signatures (LINE `x-line-signature`, Shopee
  `Authorization` HMAC of `url|body`, Lazada challenge handshake). Shopee
  verification requires `PUBLIC_BASE_URL` to be set to the exact callback URL.
- Keep `.env` out of version control (already in `.gitignore`).
- Tokens expire — Lazada/Shopee access tokens need periodic refresh; wire your
  refresh-token flow into `config` if you run this long-term.

---

## Testing

```bash
npm test
```

Covers Lazada/Shopee/LINE signature generation + verification and the Flex
message builder.

---

## Customizing

- **Which statuses notify**: edit the `packable` arrays in `src/server.js`.
- **Message format**: edit `buildFlexMessage` in `src/notifier.js`.
- **Dedup backend**: `src/store.js` is a simple JSON file — swap for Redis/DB at
  scale (same `isNew` / `markSeen` interface).
- **Tag the packing team**: LINE group messages can't @-mention via push; instead
  add a fixed prefix line in the card body if you want it to stand out.
