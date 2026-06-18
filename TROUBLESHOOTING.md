# Troubleshooting Guide - LINE Notifications Not Working on Railway

## Quick Diagnosis

Your app is deployed but notifications aren't being sent. This guide will help you identify and fix the issue.

## Step 1: Check Railway Logs (MOST IMPORTANT)

1. Go to your Railway project dashboard
2. Click on your service
3. Click **"Deployments"** → Select the latest deployment → **"View Logs"**
4. Look for these key indicators:

### ✅ What you SHOULD see on startup:
```
[config] Configuration loaded:
  PORT: 3000
  PUBLIC_BASE_URL: https://your-app.up.railway.app
  LINE_TARGET_ID: Cxxxx...
  LINE_CHANNEL_ACCESS_TOKEN: ✓ set (xxx chars)
  LAZADA_APP_KEY: ✓ set
  LAZADA_ACCESS_TOKEN: ✓ set
  ...
[store] Loaded X seen orders from /data/seen-orders.json
Order notifier listening on :3000
```

### ❌ If you see this - CRITICAL ERROR:
```
[config] FATAL: LINE_CHANNEL_ACCESS_TOKEN is required but not set
```
**Fix:** Go to Railway → Variables → Add the missing LINE credentials

### 🔍 When an order arrives, you should see:
```
[lazada] ✉ Webhook received
[lazada] Processing order 123456, status: pending
[line] Attempting to push 1 message(s) to target: Cxxxx...
[line] ✓ Push successful to Cxxxx...
[notify] sent Lazada:123456 (2 items)
```

### ❌ If you see LINE push failures:
```
[line] ❌ Push FAILED - Status: 400
[line] Response: {"message":"Invalid reply token"}
```
or
```
[line] ❌ Push FAILED - Status: 401
[line] Response: {"message":"Invalid access token"}
```

## Step 2: Test LINE Integration Manually

Visit this URL in your browser (replace with your Railway domain):
```
https://your-app.up.railway.app/test-line
```

### ✅ Success Response:
```json
{
  "success": true,
  "message": "Test notification sent successfully!",
  "targetId": "Cxxxx..."
}
```
**AND** you should receive a test message in your LINE group!

### ❌ Failure Response:
```json
{
  "success": false,
  "error": "LINE push failed (401): ...",
  "targetId": "Cxxxx...",
  "hint": "Check Railway logs for detailed error information"
}
```

## Step 3: Common Issues & Fixes

### Issue 1: Missing Environment Variables
**Symptoms:** App crashes on startup or shows config warnings

**Fix:**
1. Railway Dashboard → Your Service → **Variables**
2. Verify ALL these are set:
   - `LINE_CHANNEL_ACCESS_TOKEN` - Long-lived token from LINE Developers Console
   - `LINE_CHANNEL_SECRET` - From LINE Developers Console
   - `LINE_TARGET_ID` - Your group ID (starts with "C")
   - `PUBLIC_BASE_URL` - Your Railway domain (e.g., `https://your-app.up.railway.app`)
   - `LAZADA_APP_KEY`, `LAZADA_APP_SECRET`, `LAZADA_ACCESS_TOKEN`
   - `DATA_DIR` - Should be `/data` if you have a volume mounted

### Issue 2: Invalid LINE Credentials
**Symptoms:** `401 Unauthorized` or `Invalid access token`

**Fix:**
1. Go to [LINE Developers Console](https://developers.line.biz/console/)
2. Select your channel → **Messaging API** tab
3. **Issue a NEW Channel Access Token** (long-lived)
4. Copy the new token
5. Railway → Variables → Update `LINE_CHANNEL_ACCESS_TOKEN`
6. Redeploy

### Issue 3: Wrong LINE_TARGET_ID
**Symptoms:** `400 Bad Request` or no error but no message received

**Fix:**
1. Make sure your LINE bot is **invited to the group**
2. In LINE Developers Console → **Messaging API** tab:
   - Set Webhook URL to `https://your-app.up.railway.app/webhook/line`
   - Enable "Use webhook"
3. Send any message in the group
4. Check Railway logs for:
   ```
   [line] event=message type=group id=Cxxxx...
   ```
5. Copy that `Cxxxx...` ID
6. Railway → Variables → Update `LINE_TARGET_ID` with this exact ID
7. Redeploy

### Issue 4: Lazada Webhooks Not Arriving
**Symptoms:** No `[lazada] ✉ Webhook received` in logs when orders come in

**Fix:**
1. Lazada Open Platform → Your App → **Push Message**
2. Set callback URL to: `https://your-app.up.railway.app/webhook/lazada`
3. Subscribe to **order** messages
4. Save and test the webhook
5. Verify `PUBLIC_BASE_URL` in Railway matches your domain exactly

### Issue 5: Deduplication Preventing Notifications
**Symptoms:** First order worked, but subsequent orders don't notify

**Fix:**
1. Check if you have a **persistent volume** mounted:
   - Railway → Your Service → **Volumes**
   - Should have a volume mounted at `/data`
2. If no volume exists:
   - Create one: **New Volume** → Mount path: `/data`
   - Set variable: `DATA_DIR=/data`
   - Redeploy
3. Without a volume, the dedup store resets on every deploy

### Issue 6: Orders Filtered by Status
**Symptoms:** Some orders notify, others don't

**Check:** The app only notifies for these statuses:
- **Lazada:** `pending`, `ready_to_ship`, `packed`
- **Shopee:** `READY_TO_SHIP`, `UNPAID`, `PROCESSED`, `TO_SHIP`

Look in logs for:
```
[lazada] Skipping non-packable status: shipped
```

If you need different statuses, edit the `packable` arrays in `src/server.js`

## Step 4: Verify LINE Bot Settings

1. LINE Developers Console → Your Channel → **Messaging API**
2. Check these settings:
   - ✅ **Allow bot to join group chats** = ON
   - ✅ **Webhook** = Enabled
   - ✅ Webhook URL = `https://your-app.up.railway.app/webhook/line`
   - ⚠️ **Auto-reply messages** = OFF (optional, keeps group clean)
   - ⚠️ **Greeting messages** = OFF (optional)

## Step 5: Test with a Manual Order

If you want to test without waiting for a real order:

1. Create a test order on Lazada seller dashboard
2. Watch Railway logs in real-time
3. You should see the webhook arrive and processing steps
4. If notification fails, the detailed error will be logged

## Debugging Checklist

- [ ] Railway deployment is running (green status)
- [ ] All environment variables are set in Railway
- [ ] `/test-line` endpoint returns success
- [ ] Test message appears in LINE group
- [ ] LINE bot is a member of the target group
- [ ] Webhook URLs are configured in Lazada/Shopee consoles
- [ ] `PUBLIC_BASE_URL` matches Railway domain exactly
- [ ] Volume is mounted at `/data` and `DATA_DIR=/data` is set
- [ ] Railway logs show webhook arrivals when orders come in
- [ ] No error messages in Railway logs

## Still Not Working?

Check Railway logs for the **exact error message** and:

1. Copy the full error from logs
2. Check if it's a LINE API error (401, 400, 403)
3. Verify your LINE credentials are fresh (not expired)
4. Ensure the bot hasn't been removed from the group
5. Test if the bot can send messages via LINE Messaging API tester

## Success Indicators

When everything works, you'll see this flow in logs:
```
[lazada] ✉ Webhook received
[lazada] Processing order 123456, status: pending
[line] Attempting to push 1 message(s) to target: Cxxxx...
[line] ✓ Push successful to Cxxxx...
[notify] sent Lazada:123456 (3 items)
```

And your LINE group receives a formatted card with order details! 📦
