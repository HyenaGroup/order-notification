import express from 'express';
import config from './config.js';
import { verifyLineSignature } from './line.js';
import * as lazada from './lazada.js';
import * as shopee from './shopee.js';
import { notifyOrder } from './notifier.js';

const app = express();

// Capture the raw body on every request so we can verify HMAC signatures.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf; // Buffer of the exact bytes received
    },
  })
);

// ---- Health check ----
app.get('/', (_req, res) => res.send('OK — LZD/SHP order notifier running'));
app.get('/healthz', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// ---- Diagnostic endpoint to test LINE integration ----
app.get('/test-line', async (_req, res) => {
  try {
    console.log('[test] Testing LINE notification...');
    const testMessage = {
      type: 'text',
      text: '🧪 Test notification from Railway deployment\nIf you see this, LINE integration is working! ✅'
    };
    
    const { pushMessages } = await import('./line.js');
    await pushMessages([testMessage]);
    
    res.json({ 
      success: true, 
      message: 'Test notification sent successfully!',
      targetId: config.line.targetId 
    });
  } catch (err) {
    console.error('[test] ❌ LINE test failed:', err.message);
    res.status(500).json({ 
      success: false, 
      error: err.message,
      targetId: config.line.targetId,
      hint: 'Check Railway logs for detailed error information'
    });
  }
});

// ---- Get shipping label for a specific Lazada order ----
app.get('/shipping-label/:orderId', async (req, res) => {
  try {
    const orderId = req.params.orderId;
    console.log(`[label] Fetching shipping label for order ${orderId}`);
    
    const labelUrl = await lazada.getOrderShippingLabel(orderId);
    
    // Redirect to the PDF URL so it downloads directly
    res.redirect(labelUrl);
  } catch (err) {
    console.error(`[label] ❌ Failed to get shipping label: ${err.message}`);
    res.status(500).json({ 
      success: false, 
      error: err.message,
      hint: 'Make sure the order ID is correct and the order has a shipping label available'
    });
  }
});

// ============================================================
//  Shopee push endpoint
//  Configure this URL in Shopee Console > Push Mechanism > "Live Push URL".
//  Shopee order-status pushes arrive with code = 3.
// ============================================================
app.post('/webhook/shopee', async (req, res) => {
  console.log('[shopee] ✉ Webhook received');
  const callbackUrl = `${config.publicBaseUrl}/webhook/shopee`;
  const auth = req.headers['authorization'] || '';
  const rawBody = req.rawBody?.toString('utf8') || '';

  if (config.publicBaseUrl && !shopee.verifyShopeePush(callbackUrl, rawBody, auth)) {
    console.warn('[shopee] ❌ Signature mismatch — rejecting');
    return res.status(401).send('invalid signature');
  }

  // ACK fast; Shopee retries on non-2xx, so respond before doing slow work.
  res.status(200).send('ok');

  try {
    const body = req.body || {};
    console.log(`[shopee] Push code: ${body.code}, data:`, JSON.stringify(body.data || {}).substring(0, 200));
    
    // code 3 = order status push. Newly created orders surface here.
    if (body.code !== 3) {
      console.log(`[shopee] Ignoring non-order push (code ${body.code})`);
      return;
    }
    const orderSn = body.data?.ordersn || body.data?.order_sn;
    const status = body.data?.status;
    if (!orderSn) {
      console.warn('[shopee] ⚠ No order_sn in push data');
      return;
    }

    console.log(`[shopee] Processing order ${orderSn}, status: ${status}`);
    
    // Only notify for fresh, packable orders (ignore CANCELLED/SHIPPED echoes).
    const packable = ['READY_TO_SHIP', 'UNPAID', 'PROCESSED', 'TO_SHIP'];
    if (status && !packable.includes(status)) {
      console.log(`[shopee] Skipping non-packable status: ${status}`);
      return;
    }

    const details = await shopee.getOrderDetail(orderSn);
    if (!details.length) {
      console.warn(`[shopee] ⚠ No details returned for order ${orderSn}`);
      return;
    }
    await notifyOrder(shopee.normalizeShopeeOrder(details[0]));
  } catch (err) {
    console.error('[shopee] ❌ Handler error:', err.message);
    console.error('[shopee] Stack:', err.stack);
  }
});

// ============================================================
//  Lazada push endpoint
//  Configure this URL in Lazada App Console > "Push Message" > callback URL.
//  Lazada sends a verification challenge when you save the URL.
// ============================================================
app.post('/webhook/lazada', async (req, res) => {
  console.log('[lazada] ✉ Webhook received');
  // Verification handshake: Lazada may POST a challenge to confirm ownership.
  const body = req.body || {};
  if (body.challenge) {
    console.log('[lazada] Responding to challenge handshake');
    return res.status(200).json({ challenge: body.challenge });
  }

  res.status(200).send('ok'); // ACK fast; process async.

  try {
    console.log('[lazada] Push payload:', JSON.stringify(body).substring(0, 300));
    // Order push payload carries the trade order id + new status.
    const data = body.data || body;
    const orderId = data.trade_order_id || data.order_id;
    const status = data.order_status || data.status;
    if (!orderId) {
      console.warn('[lazada] ⚠ No order_id in push data');
      return;
    }

    console.log(`[lazada] Processing order ${orderId}, status: ${status}`);
    
    // Only notify for new/pending orders ready to pack.
    const packable = ['pending', 'ready_to_ship', 'packed'];
    if (status && !packable.includes(String(status).toLowerCase())) {
      console.log(`[lazada] Skipping non-packable status: ${status}`);
      return;
    }

    const [order, items] = await Promise.all([
      lazada.getOrder(orderId),
      lazada.getOrderItems(orderId).catch(() => []),
    ]);
    if (!order) {
      console.warn(`[lazada] ⚠ No order data returned for ${orderId}`);
      return;
    }
    
    // Fetch shipping label PDF URL for packaging team
    // Only try for ready_to_ship/packed orders - pending orders don't have labels yet
    let shippingLabelUrl = null;
    const orderStatus = String(status || order.status || '').toLowerCase();
    const hasLabel = ['ready_to_ship', 'packed'].includes(orderStatus);
    
    if (hasLabel) {
      try {
        shippingLabelUrl = await lazada.getOrderShippingLabel(orderId);
        console.log(`[lazada] ✓ Shipping label URL obtained`);
      } catch (err) {
        console.warn(`[lazada] ⚠ Could not fetch shipping label: ${err.message}`);
      }
    } else {
      console.log(`[lazada] Skipping label fetch for status: ${orderStatus} (not available yet)`);
    }
    
    await notifyOrder(lazada.normalizeLazadaOrder(order, items), shippingLabelUrl);
  } catch (err) {
    console.error('[lazada] ❌ Handler error:', err.message);
    console.error('[lazada] Stack:', err.stack);
  }
});

// ============================================================
//  LINE webhook (optional) — lets you capture your group's ID.
//  Add this URL in the LINE channel's "Messaging API" > Webhook URL,
//  invite the bot to the group, send any message, and read the logged
//  groupId — paste it into LINE_TARGET_ID.
// ============================================================
app.post('/webhook/line', (req, res) => {
  const signature = req.headers['x-line-signature'];
  if (!verifyLineSignature(req.rawBody || Buffer.from(''), signature)) {
    return res.status(401).send('invalid signature');
  }
  for (const ev of req.body.events || []) {
    const src = ev.source || {};
    console.log(`[line] event=${ev.type} type=${src.type} id=${src.groupId || src.roomId || src.userId}`);
  }
  res.status(200).send('ok');
});

const server = app.listen(config.port, () => {
  console.log(`Order notifier listening on :${config.port}`);
  console.log(`  Shopee push -> POST ${config.publicBaseUrl || ''}/webhook/shopee`);
  console.log(`  Lazada push -> POST ${config.publicBaseUrl || ''}/webhook/lazada`);
  console.log(`  LINE webhook-> POST ${config.publicBaseUrl || ''}/webhook/line`);
  if (config.polling.enabled) {
    import('./poller.js').then((m) => m.startPolling());
  }
});

export default server;
