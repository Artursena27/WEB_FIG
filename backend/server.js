const express = require('express');
const crypto = require('crypto');
const { handleMessage } = require('./services/bot');

const app = express();
const PORT = process.env.PORT || 3001;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const APP_SECRET = process.env.APP_SECRET;

// Keep the raw body so we can validate Meta's webhook signature
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// Healthcheck (Railway)
app.get('/health', (req, res) => res.sendStatus(200));

// Webhook verification (Meta calls this once when you register the webhook URL)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified.');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

function isValidSignature(req) {
  if (!APP_SECRET) return true; // signature check disabled
  const signature = req.headers['x-hub-signature-256'];
  if (!signature || !req.rawBody) return false;
  const expected = 'sha256=' +
    crypto.createHmac('sha256', APP_SECRET).update(req.rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// Webhook receiver
app.post('/webhook', (req, res) => {
  if (!isValidSignature(req)) {
    return res.sendStatus(403);
  }

  // ACK immediately — Meta retries if we don't answer 200 fast
  res.sendStatus(200);

  // Then process asynchronously (fire-and-forget)
  const entries = req.body?.entry || [];
  for (const entry of entries) {
    for (const change of entry.changes || []) {
      const messages = change.value?.messages || [];
      for (const msg of messages) {
        handleMessage(msg).catch((err) =>
          console.error('Unhandled bot error:', err)
        );
      }
      // change.value.statuses (delivery receipts) are intentionally ignored
    }
  }
});

app.listen(PORT, () => {
  console.log(`Sticker bot webhook listening on port ${PORT}`);
});
