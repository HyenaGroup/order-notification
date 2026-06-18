# Fixes Applied - June 18, 2026

## Issues Reported

1. ❌ **Duplicate notifications** - Same order sent 3 times
2. ❌ **No PDF download button** - Shipping label button not appearing in LINE

---

## Root Causes Identified

### Issue 1: Race Condition in Deduplication

**Problem:**
- Lazada sends **one webhook per order item** (e.g., 3 items = 3 webhooks)
- All 3 webhooks arrive at the **same millisecond**
- Deduplication check (`isNew()`) happened **before** marking as seen
- All 3 webhooks passed the check simultaneously → 3 notifications sent

**Evidence from logs:**
```
06:29:24.745 [lazada] Processing order 1110579722800175, status: pending
06:29:24.746 [lazada] Processing order 1110579722800175, status: pending  ← Same time!
06:29:24.746 [lazada] Processing order 1110579722800175, status: pending  ← Same time!
...
06:29:25.503 [notify] sent Lazada:1110579722800175 (3 items)  ← Sent 3x!
06:29:25.528 [notify] sent Lazada:1110579722800175 (3 items)
06:29:25.633 [notify] sent Lazada:1110579722800175 (3 items)
```

### Issue 2: Shipping Labels Not Available for Pending Orders

**Problem:**
- System tried to fetch shipping labels for **`pending`** status orders
- Lazada doesn't generate labels until order is **confirmed/paid** (`ready_to_ship`)
- API returned error: `30012: rts package not found`
- No button appeared in notification

**Evidence from logs:**
```
[lazada] Processing order 1110579722800175, status: pending
[lazada] Fetching shipping label for 3 item(s)
[lazada] ⚠ Could not fetch shipping label: error 30012: rts package not found
```

---

## Fixes Applied

### Fix 1: Prevent Race Condition ✅

**File:** `src/notifier.js`

**Change:** Mark order as seen **immediately** after dedup check, before any async operations

**Before:**
```javascript
if (!isNew(key)) return false;
// ... async operations ...
await pushMessages([buildFlexMessage(order)]);
markSeen(key);  // ❌ Too late! Other webhooks already passed isNew() check
```

**After:**
```javascript
if (!isNew(key)) return false;
markSeen(key);  // ✅ Mark IMMEDIATELY to block concurrent webhooks
// ... async operations ...
await pushMessages([buildFlexMessage(order)]);
```

**Result:** Only the first webhook passes the check. Subsequent webhooks (even milliseconds later) see it's already marked and skip.

---

### Fix 2: Smart Shipping Label Fetch ✅

**File:** `src/server.js`

**Change:** Only fetch shipping labels for orders in `ready_to_ship` or `packed` status

**Before:**
```javascript
// Always tried to fetch label, regardless of status
let shippingLabelUrl = null;
try {
  shippingLabelUrl = await lazada.getOrderShippingLabel(orderId);
} catch (err) {
  console.warn(`Could not fetch shipping label: ${err.message}`);
}
```

**After:**
```javascript
let shippingLabelUrl = null;
const orderStatus = String(status || order.status || '').toLowerCase();
const hasLabel = ['ready_to_ship', 'packed'].includes(orderStatus);

if (hasLabel) {
  // Only fetch if status indicates label should exist
  try {
    shippingLabelUrl = await lazada.getOrderShippingLabel(orderId);
  } catch (err) {
    console.warn(`Could not fetch shipping label: ${err.message}`);
  }
} else {
  console.log(`Skipping label fetch for status: ${orderStatus} (not available yet)`);
}
```

**Result:** 
- `pending` orders → No label fetch attempt, no error, notification sent without button
- `ready_to_ship` orders → Label fetched, button appears in notification

---

## Expected Behavior After Fix

### Scenario 1: New Order (Pending Status)

**What happens:**
1. Lazada sends 3 webhooks (one per item)
2. First webhook → Notification sent (no label button)
3. Second & third webhooks → Skipped (duplicate)

**Logs you'll see:**
```
[lazada] Processing order 123456, status: pending
[lazada] Skipping label fetch for status: pending (not available yet)
[notify] sent Lazada:123456 (3 items)
[notify] skip duplicate Lazada:123456
[notify] skip duplicate Lazada:123456
```

**LINE notification:**
- ✅ Order details card
- ❌ No shipping label button (not available yet)

---

### Scenario 2: Order Ready to Ship

**What happens:**
1. Order confirmed/paid → Status changes to `ready_to_ship`
2. Lazada sends webhooks again
3. First webhook → Fetches label, notification sent WITH button
4. Subsequent webhooks → Skipped (duplicate)

**Logs you'll see:**
```
[lazada] Processing order 123456, status: ready_to_ship
[lazada] Fetching shipping label for 3 item(s)
[lazada] ✓ Shipping label URL obtained
[notify] Including shipping label URL
[notify] sent Lazada:123456 (3 items) with shipping label
[notify] skip duplicate Lazada:123456
```

**LINE notification:**
- ✅ Order details card
- ✅ **📄 ดาวน์โหลดฉลากจัดส่ง** button (click to download PDF)

---

## Testing Checklist

After deploying these fixes:

- [ ] New `pending` order → Single notification, no duplicates, no button
- [ ] Order changes to `ready_to_ship` → Single notification with PDF button
- [ ] PDF button downloads label successfully
- [ ] No duplicate notifications
- [ ] Railway logs show "skip duplicate" for concurrent webhooks
- [ ] Railway logs show "Skipping label fetch" for pending orders

---

## Deploy Instructions

```bash
git add .
git commit -m "Fix: Prevent duplicate notifications and handle shipping label timing"
git push
```

Railway will auto-deploy. Monitor logs for next order to verify fixes.

---

## Summary

✅ **Duplicate notifications** - Fixed by marking as seen immediately
✅ **Missing PDF buttons** - Fixed by only fetching labels when available
✅ **Graceful handling** - Pending orders notify without button, ready_to_ship orders include button
✅ **No breaking changes** - System still notifies for all packable orders

Your packaging team will now receive:
- **One notification per order** (no duplicates)
- **PDF button only when available** (ready_to_ship/packed status)
- **Clean notifications for pending orders** (without button clutter)
