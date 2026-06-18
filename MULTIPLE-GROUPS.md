# Multiple LINE Groups Setup Guide

## Overview

You can now send order notifications to **multiple LINE groups** simultaneously. Perfect for:
- 📦 Packaging team
- 📊 Management/supervisors
- 🚚 Shipping department
- 💼 Sales team

---

## Step 1: Detect Group IDs

### Method: Use the LINE Webhook

Your system already has a built-in group ID detector!

**Steps:**

1. **Ensure LINE webhook is enabled:**
   - Go to [LINE Developers Console](https://developers.line.biz/console/)
   - Select your channel → **Messaging API** tab
   - **Webhook URL:** `https://order-notification-production.up.railway.app/webhook/line`
   - **Use webhook:** ✅ Enabled

2. **Invite bot to each group:**
   - Open LINE app
   - Go to the group (or create new group)
   - Add members → Search for your bot
   - Add the bot to the group

3. **Send a test message:**
   - In the group, type any message: "test", "hello", etc.

4. **Check Railway logs:**
   ```
   Railway Dashboard → Deployments → View Logs
   ```
   
   Look for:
   ```
   [line] event=message type=group id=Cxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

5. **Copy the Group ID** (starts with "C")

6. **Repeat for each group** you want to add

---

## Step 2: Configure Multiple Groups

### Railway Environment Variables

Go to: **Railway Dashboard → Your Service → Variables**

**Update `LINE_TARGET_ID` with comma-separated group IDs:**

```
LINE_TARGET_ID=C1d071fc0531fca18769ea33d1ecb9655,C9876543210abcdef1234567890abcde,Cabcdef1234567890abcdef1234567890
```

**Format:**
- Separate each Group ID with a comma `,`
- No spaces (or spaces will be trimmed automatically)
- Can add 2, 3, 4, or more groups

**Example with spaces (also works):**
```
LINE_TARGET_ID=C1d071fc0531fca18769ea33d1ecb9655, C9876543210abcdef1234567890abcde, Cabcdef1234567890abcdef1234567890
```

---

## Step 3: Redeploy

After updating the variable:

1. Railway will **automatically redeploy**
2. Or manually trigger: **Deploy → Redeploy**

---

## Step 4: Verify Configuration

Check Railway logs after deployment:

```
[config] Configuration loaded:
  LINE_TARGET_ID: C1d07...
  LINE_TARGET_GROUPS: 3 group(s) configured
    [1] C1d07...
    [2] C9876...
    [3] Cabcd...
```

✅ You should see all your groups listed!

---

## How It Works

When a new order arrives:

1. ✅ Order processed once
2. ✅ Notification sent to **Group 1**
3. ✅ Notification sent to **Group 2**
4. ✅ Notification sent to **Group 3**
5. ✅ ... (all configured groups)

**Each group receives:**
- Same order details
- Same shipping label button (if available)
- Same formatted card

---

## Example Use Cases

### Use Case 1: Packaging + Management
```
LINE_TARGET_ID=C_packaging_group_id,C_management_group_id
```
- Packaging team gets notified to pack
- Management sees all incoming orders

### Use Case 2: Multiple Warehouses
```
LINE_TARGET_ID=C_warehouse_bangkok,C_warehouse_chiang_mai,C_warehouse_phuket
```
- All warehouses see orders
- Each can claim/pack relevant orders

### Use Case 3: Department Separation
```
LINE_TARGET_ID=C_packaging,C_shipping,C_customer_service,C_management
```
- Everyone stays informed
- Each department sees order flow

---

## Railway Logs

### Successful Multi-Group Notification:
```
[lazada] ✉ Webhook received
[lazada] Processing order 1110579722800175, status: ready_to_ship
[lazada] ✓ Shipping label URL obtained
[line] Attempting to push 1 message(s) to target: C1d071fc0531fca18769ea33d1ecb9655
[line] ✓ Push successful to C1d071fc0531fca18769ea33d1ecb9655
[line] Attempting to push 1 message(s) to target: C9876543210abcdef1234567890abcde
[line] ✓ Push successful to C9876543210abcdef1234567890abcde
[line] Attempting to push 1 message(s) to target: Cabcdef1234567890abcdef1234567890
[line] ✓ Push successful to Cabcdef1234567890abcdef1234567890
[notify] sent Lazada:1110579722800175 to 3 group(s) (3 items) with shipping label
```

---

## Troubleshooting

### Issue: Bot not in group

**Error:**
```
[line] ❌ Push FAILED - Status: 400
[line] Response: {"message":"Invalid target"}
```

**Fix:**
1. Make sure bot is **added to the group**
2. Bot must be a **member** (not just invited)
3. Check group ID is correct (starts with "C")

### Issue: Wrong group ID format

**Error:**
```
[line] ❌ Push FAILED - Status: 400
```

**Fix:**
1. Group IDs must start with "C"
2. User IDs start with "U" (won't work for groups)
3. Room IDs start with "R" (different from groups)

### Issue: Only one group receives notification

**Check:**
1. Railway Variables → `LINE_TARGET_ID` has comma-separated IDs
2. No typos in group IDs
3. Check Railway logs for all push attempts

---

## Testing

### Test with `/test-line` endpoint:

Visit:
```
https://order-notification-production.up.railway.app/test-line
```

**Expected:**
- Test message sent to **all configured groups**
- Each group receives: "🧪 Test notification from Railway deployment..."

**Verify:**
- ✅ All groups receive the message
- ✅ Railway logs show push to each group
- ✅ No errors in logs

---

## Removing a Group

To remove a group from notifications:

1. **Railway → Variables → LINE_TARGET_ID**
2. **Remove the group ID** from the comma-separated list
3. **Save** (Railway auto-redeploys)

**Example:**

Before (3 groups):
```
LINE_TARGET_ID=C_group1,C_group2,C_group3
```

After (2 groups):
```
LINE_TARGET_ID=C_group1,C_group3
```

---

## Single Group (Original Behavior)

To use just one group (original setup):

```
LINE_TARGET_ID=C1d071fc0531fca18769ea33d1ecb9655
```

No comma = single group mode.

---

## Limits

**LINE API Limits:**
- No hard limit on number of groups
- But consider: Each notification = 1 API call per group
- 3 groups = 3x API calls
- 10 groups = 10x API calls

**Recommended:**
- **2-5 groups** for most use cases
- **10+ groups** may slow down notifications slightly

---

## Summary

✅ **Easy setup** - Just comma-separate group IDs
✅ **Automatic** - All groups notified simultaneously
✅ **Flexible** - Add/remove groups anytime
✅ **No code changes** - Pure configuration
✅ **Same features** - Shipping labels work for all groups

Perfect for keeping multiple teams informed! 📱✨
