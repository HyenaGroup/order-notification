# Quick Fix - Notifications Not Working

## 🚨 Do This First (5 minutes)

### 1. Test LINE Integration
Visit: `https://YOUR-RAILWAY-DOMAIN.up.railway.app/test-line`

- ✅ **Success?** → Problem is with Lazada webhooks (see #3)
- ❌ **Failed?** → LINE credentials issue (see #2)

### 2. Fix LINE Credentials (if test failed)

**Railway Dashboard → Your Service → Variables**

Check these 3 variables are set correctly:

```
LINE_CHANNEL_ACCESS_TOKEN = (long token from LINE Developers Console)
LINE_CHANNEL_SECRET = (from LINE Developers Console)  
LINE_TARGET_ID = Cxxxx... (your group ID, starts with C)
```

**How to get a fresh token:**
1. Go to https://developers.line.biz/console/
2. Your Channel → **Messaging API** tab
3. Click **"Issue"** under Channel Access Token (long-lived)
4. Copy the new token
5. Paste into Railway Variables → `LINE_CHANNEL_ACCESS_TOKEN`
6. Click **Redeploy**

**How to get the correct Group ID:**
1. LINE Developers Console → Messaging API → Webhook URL: `https://YOUR-DOMAIN/webhook/line`
2. Enable webhook
3. Invite bot to your group
4. Send any message in the group
5. Check Railway logs for: `[line] event=message type=group id=Cxxxx...`
6. Copy that ID → Railway Variables → `LINE_TARGET_ID`
7. Redeploy

### 3. Fix Lazada Webhooks (if LINE test passed)

**Lazada Open Platform → Your App → Push Message**

1. Callback URL: `https://YOUR-RAILWAY-DOMAIN.up.railway.app/webhook/lazada`
2. Subscribe to: **order** messages
3. Save

**Railway Variables:**
```
PUBLIC_BASE_URL = https://YOUR-RAILWAY-DOMAIN.up.railway.app
```
(Must match exactly, no trailing slash)

### 4. Check Railway Logs

**Railway → Deployments → Latest → View Logs**

Look for errors. Should see on startup:
```
[config] Configuration loaded:
  LINE_CHANNEL_ACCESS_TOKEN: ✓ set (xxx chars)
  LINE_TARGET_ID: Cxxxx...
```

When order arrives:
```
[lazada] ✉ Webhook received
[lazada] Processing order 123456
[line] ✓ Push successful
```

### 5. Verify Volume (prevents duplicates)

**Railway → Your Service → Volumes**

- Should have volume mounted at `/data`
- If not: **New Volume** → Mount path: `/data`
- Set variable: `DATA_DIR=/data`
- Redeploy

## ⚡ Most Common Issues

| Symptom | Fix |
|---------|-----|
| App crashes on startup | Missing LINE env vars in Railway |
| Test endpoint returns 401 | LINE token expired, issue new one |
| Test works but no real orders | Lazada webhook URL not configured |
| First order worked, rest didn't | No persistent volume mounted |
| Some orders notify, others don't | Check order status (only notifies pending/ready_to_ship) |

## 📋 Environment Variables Checklist

Railway Variables tab should have:

- ✅ `LINE_CHANNEL_ACCESS_TOKEN`
- ✅ `LINE_CHANNEL_SECRET`
- ✅ `LINE_TARGET_ID`
- ✅ `PUBLIC_BASE_URL`
- ✅ `LAZADA_APP_KEY`
- ✅ `LAZADA_APP_SECRET`
- ✅ `LAZADA_ACCESS_TOKEN`
- ✅ `LAZADA_API_BASE`
- ✅ `DATA_DIR` (set to `/data`)
- ⚠️ `PORT` (Railway sets this automatically, don't add it)

## 🎯 Success Checklist

- [ ] `/test-line` returns success
- [ ] Test message appears in LINE group
- [ ] Bot is member of the group
- [ ] Railway logs show config loaded successfully
- [ ] Volume mounted at `/data`
- [ ] Lazada webhook URL configured
- [ ] `PUBLIC_BASE_URL` matches Railway domain

---

**Still stuck?** See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed diagnostics.
