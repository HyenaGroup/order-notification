import 'dotenv/config';

function required(name, value) {
  if (!value || String(value).trim() === '') {
    console.warn(`[config] Warning: ${name} is not set. Features depending on it will fail.`);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || '',

  line: {
    channelAccessToken: required('LINE_CHANNEL_ACCESS_TOKEN', process.env.LINE_CHANNEL_ACCESS_TOKEN),
    channelSecret: required('LINE_CHANNEL_SECRET', process.env.LINE_CHANNEL_SECRET),
    targetId: required('LINE_TARGET_ID', process.env.LINE_TARGET_ID),
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

export default config;
