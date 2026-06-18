import 'dotenv/config';

function required(name, value) {
  if (!value || String(value).trim() === '') {
    console.warn(`[config] Warning: ${name} is not set. Features depending on it will fail.`);
  }
  return value;
}

function strictRequired(name, value) {
  if (!value || String(value).trim() === '') {
    throw new Error(`[config] FATAL: ${name} is required but not set. Check your environment variables.`);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || '',

  line: {
    channelAccessToken: strictRequired('LINE_CHANNEL_ACCESS_TOKEN', process.env.LINE_CHANNEL_ACCESS_TOKEN),
    channelSecret: strictRequired('LINE_CHANNEL_SECRET', process.env.LINE_CHANNEL_SECRET),
    targetId: strictRequired('LINE_TARGET_ID', process.env.LINE_TARGET_ID),
    // Support multiple groups: comma-separated IDs
    targetIds: process.env.LINE_TARGET_ID.split(',').map(id => id.trim()).filter(Boolean),
    pushUrl: 'https://api.line.me/v2/bot/message/push',
  },

  lazada: {
    appKey: process.env.LAZADA_APP_KEY,
    appSecret: process.env.LAZADA_APP_SECRET,
    accessToken: process.env.LAZADA_ACCESS_TOKEN,
    apiBase: process.env.LAZADA_API_BASE || 'https://api.lazada.co.th/rest',
  },

  shopee: {
    partnerId: process.env.SHOPEE_PARTNER_ID,
    partnerKey: process.env.SHOPEE_PARTNER_KEY,
    shopId: process.env.SHOPEE_SHOP_ID,
    accessToken: process.env.SHOPEE_ACCESS_TOKEN,
    apiBase: process.env.SHOPEE_API_BASE || 'https://partner.shopeemobile.com',
  },

  polling: {
    enabled: String(process.env.ENABLE_POLLING).toLowerCase() === 'true',
    intervalSeconds: parseInt(process.env.POLL_INTERVAL_SECONDS || '120', 10),
  },
};

// Log configuration status on startup
console.log('[config] Configuration loaded:');
console.log(`  PORT: ${config.port}`);
console.log(`  PUBLIC_BASE_URL: ${config.publicBaseUrl || '(not set)'}`);
console.log(`  LINE_TARGET_ID: ${config.line.targetId ? config.line.targetId.substring(0, 5) + '...' : '(missing)'}`);
console.log(`  LINE_TARGET_GROUPS: ${config.line.targetIds.length} group(s) configured`);
config.line.targetIds.forEach((id, idx) => {
  console.log(`    [${idx + 1}] ${id.substring(0, 5)}...`);
});
console.log(`  LINE_CHANNEL_ACCESS_TOKEN: ${config.line.channelAccessToken ? '✓ set (' + config.line.channelAccessToken.length + ' chars)' : '✗ missing'}`);
console.log(`  LAZADA_APP_KEY: ${config.lazada.appKey ? '✓ set' : '✗ missing'}`);
console.log(`  LAZADA_ACCESS_TOKEN: ${config.lazada.accessToken ? '✓ set' : '✗ missing'}`);
console.log(`  SHOPEE_PARTNER_ID: ${config.shopee.partnerId ? '✓ set' : '✗ missing'}`);
console.log(`  SHOPEE_ACCESS_TOKEN: ${config.shopee.accessToken ? '✓ set' : '✗ missing'}`);
console.log(`  POLLING: ${config.polling.enabled ? 'enabled' : 'disabled'}`);
console.log(`  DATA_DIR: ${process.env.DATA_DIR || '(using default ./data)'}`);

export default config;
