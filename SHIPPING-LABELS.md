# Shipping Label (ฉลากจัดส่ง) Feature

## Overview

The system now automatically fetches and includes **Lazada shipping labels (PDF)** in order notifications sent to your packaging team on LINE.

---

## How It Works

### Automatic Delivery (New Orders)

When a new Lazada order arrives:

1. ✅ Webhook received from Lazada
2. ✅ Order details fetched
3. ✅ **Shipping label PDF URL fetched automatically**
4. ✅ LINE notification sent with download button

**Your packaging team sees:**
- Order card with all details (buyer, items, SKUs)
- **📄 ดาวน์โหลดฉลากจัดส่ง (Shipping Label)** button at the bottom
- Click button → PDF downloads directly to their phone/computer

---

## LINE Message Example

```
┌─────────────────────────────────┐
│ 📦 NEW LAZADA ORDER             │
│ Order 1102248666116405          │
├─────────────────────────────────┤
│ Buyer: John Doe                 │
│ Items: 3                        │
│ Total: 1,250 THB                │
│ Ship to: Bangkok, Thailand      │
│ Status: ready_to_ship           │
│                                 │
│ PACK THIS:                      │
│ 2x Product A — Red              │
│ 1x Product B — Large            │
│                                 │
│ SKUs: SKU001, SKU002            │
├─────────────────────────────────┤
│ [📄 ดาวน์โหลดฉลากจัดส่ง]        │ ← Click to download PDF
│                                 │
│ 2026-06-18 10:48:47            │
└─────────────────────────────────┘
```

---

## Manual Label Download (For Past Orders)

If you need to download a shipping label for an order that was received before this feature was added:

### Method 1: Direct URL
Visit:
```
https://your-railway-domain.up.railway.app/shipping-label/ORDER_ID
```

Replace `ORDER_ID` with the Lazada order ID (trade_order_id).

**Example:**
```
https://order-notification-production.up.railway.app/shipping-label/1102248666116405
```

This will redirect directly to the PDF download.

### Method 2: Bookmark for Quick Access

Your packaging team can bookmark this URL pattern and just change the order ID when needed.

---

## Important Notes

### ✅ What Works
- **Lazada orders only** (Shopee has different label system)
- Orders with status: `pending`, `ready_to_ship`, `packed`
- PDF downloads work on mobile (LINE app) and desktop

### ⚠️ Limitations
- Shipping labels are only available **after** Lazada generates them
- Very new orders (just created) might not have labels yet
- If label fetch fails, notification still sends (just without the button)

### 🔍 Error Handling
If the shipping label cannot be fetched:
- Order notification still sends normally
- No download button appears
- Railway logs show: `[lazada] ⚠ Could not fetch shipping label: ...`
- This is **not critical** - the order notification still works

---

## Railway Logs

### Successful Label Fetch
```
[lazada] ✉️ Webhook received
[lazada] Processing order 1102248666116405, status: ready_to_ship
[lazada] Fetching shipping label for 1 item(s)
[lazada] ✓ Shipping label URL obtained
[line] Attempting to push 1 message(s) to target: C1d07...
[line] ✓ Push successful
[notify] sent Lazada:1102248666116405 (1 items) with shipping label
```

### Label Unavailable (Still Works)
```
[lazada] ✉️ Webhook received
[lazada] Processing order 1102248666116405, status: pending
[lazada] Fetching shipping label for 1 item(s)
[lazada] ⚠ Could not fetch shipping label: No shipping label URL returned
[line] Attempting to push 1 message(s) to target: C1d07...
[line] ✓ Push successful
[notify] sent Lazada:1102248666116405 (1 items)
```

---

## For Your Packaging Team

### How to Download on Mobile (LINE App)

1. Open the order notification in LINE
2. Scroll to the bottom
3. Tap the blue **📄 ดาวน์โหลดฉลากจัดส่ง** button
4. PDF opens in browser or downloads automatically
5. Print or save the label

### How to Download on Desktop

1. Open LINE on computer
2. Click the notification
3. Click the **📄 ดาวน์โหลดฉลากจัดส่ง** button
4. PDF downloads to your Downloads folder
5. Print the label for the parcel

---

## Troubleshooting

### "No shipping label button appears"

**Possible reasons:**
1. Order is too new - Lazada hasn't generated the label yet
   - **Solution:** Wait 5-10 minutes, then use manual download URL
2. Order status doesn't require shipping (cancelled, etc.)
   - **Solution:** Check order status in Lazada Seller Center
3. API error when fetching label
   - **Solution:** Check Railway logs for error details

### "Button doesn't work / PDF doesn't download"

1. Check your internet connection
2. Try copying the URL and opening in browser
3. Use manual download method: `/shipping-label/ORDER_ID`

### "Need label for old order"

Use the manual download URL:
```
https://your-railway-domain.up.railway.app/shipping-label/ORDER_ID
```

---

## Technical Details

### API Endpoint Used
- Lazada API: `/order/document/get`
- Document type: `shippingLabel`
- Returns: Direct URL to PDF file

### Files Modified
- `src/lazada.js` - Added `getShippingLabel()` and `getOrderShippingLabel()`
- `src/notifier.js` - Added shipping label button to LINE Flex Message
- `src/server.js` - Fetch label when processing orders + manual endpoint

### Security
- Shipping label URLs are temporary and expire after some time
- URLs are generated by Lazada and require proper authentication
- No sensitive data is stored in the notification system

---

## Future Enhancements (Optional)

If needed, you could add:
1. **Shopee shipping labels** (different API)
2. **Batch download** for multiple orders
3. **Auto-print** integration with label printer
4. **Label storage** in a database for later retrieval

---

## Summary

✅ **Automatic:** Shipping labels included in every new Lazada order notification

✅ **Easy:** One-click download from LINE message

✅ **Reliable:** Falls back gracefully if label unavailable

✅ **Manual option:** Direct URL for past orders

Your packaging team now has everything they need in one place! 📦🎉
