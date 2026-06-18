# Changelog

## [1.1.1] - 2026-06-18

### 🐛 Critical Fixes

**Fixed Duplicate Notifications (Race Condition)**
- ✅ Fixed race condition causing 3x duplicate notifications per order
- ✅ Lazada sends one webhook per item; all arrive simultaneously
- ✅ Now marks order as seen IMMEDIATELY after dedup check
- ✅ Subsequent webhooks correctly skip as duplicates

**Fixed Shipping Label Timing**
- ✅ Only fetch labels for `ready_to_ship` and `packed` orders
- ✅ Skip label fetch for `pending` orders (not available yet)
- ✅ Prevents unnecessary API errors (30012: rts package not found)
- ✅ Notifications still send for pending orders (just without button)

**Files Modified:**
- `src/notifier.js` - Mark as seen before async operations
- `src/server.js` - Conditional label fetch based on order status
- `SHIPPING-LABELS.md` - Updated documentation on label availability

**Files Added:**
- `FIXES-APPLIED.md` - Detailed explanation of issues and fixes

---

## [1.1.0] - 2026-06-18

### ✨ Added - Shipping Label Feature

**Automatic PDF Shipping Labels for Packaging Team**

- ✅ **Auto-fetch shipping labels** from Lazada API when new orders arrive
- ✅ **One-click download** button in LINE notifications (📄 ดาวน์โหลดฉลากจัดส่ง)
- ✅ **Manual download endpoint** for past orders: `/shipping-label/:orderId`
- ✅ **Graceful fallback** - notification still sends if label unavailable

**Files Added:**
- `SHIPPING-LABELS.md` - Complete documentation for shipping label feature

**Files Modified:**
- `src/lazada.js` - Added `getShippingLabel()` and `getOrderShippingLabel()`
- `src/notifier.js` - Added shipping label button to LINE Flex Message
- `src/server.js` - Fetch labels automatically + manual download endpoint
- `README.md` - Updated feature list and message description
- `QUICK-FIX.md` - Added shipping label quick reference

### 🐛 Fixed - Diagnostic & Logging Improvements

**Enhanced Error Visibility**

- ✅ **Strict validation** for LINE credentials (fails fast if missing)
- ✅ **Comprehensive logging** for all webhook events and processing steps
- ✅ **Detailed error messages** with stack traces for debugging
- ✅ **Configuration status** logged on startup with ✓/✗ indicators
- ✅ **Test endpoint** (`/test-line`) to verify LINE integration

**Files Added:**
- `TROUBLESHOOTING.md` - Step-by-step diagnostic guide
- `QUICK-FIX.md` - 5-minute quick fix checklist

**Files Modified:**
- `src/config.js` - Added strict validation and startup logging
- `src/line.js` - Added detailed logging for push operations
- `src/server.js` - Added logging for webhook receipt and processing
- `src/store.js` - Added logging for dedup store operations

---

## [1.0.0] - Initial Release

### Features

- ✅ Webhook endpoints for Lazada and Shopee order notifications
- ✅ LINE Messaging API integration for team notifications
- ✅ Signature verification for all webhooks (security)
- ✅ Order deduplication to prevent duplicate notifications
- ✅ Formatted Flex Message cards with order details
- ✅ Polling fallback for environments without public webhooks
- ✅ Railway deployment configuration
- ✅ Persistent volume support for dedup state

### Components

- `src/server.js` - Express webhook server
- `src/config.js` - Environment configuration
- `src/line.js` - LINE Messaging API client
- `src/lazada.js` - Lazada API client
- `src/shopee.js` - Shopee API client
- `src/notifier.js` - Notification builder
- `src/store.js` - Deduplication store
- `src/poller.js` - Polling fallback

### Documentation

- `README.md` - Complete setup and deployment guide
- `.env.example` - Environment variable template
- `railway.json` - Railway deployment config
