const fs = require('fs');
const path = require('path');

const { sendText, downloadMedia, sendSticker } = require('./waClient');
const { processImage } = require('./imageProcessor');
const { processVideo } = require('./videoProcessor');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Conversation steps
const STEP = {
  AWAITING_FILE: 'AWAITING_FILE',
  AWAITING_VIDEO_CHOICE: 'AWAITING_VIDEO_CHOICE',
  AWAITING_VIDEO_TRIM: 'AWAITING_VIDEO_TRIM'
};

const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes

// from (phone) -> { step, filePath, expiresAt }
const sessions = new Map();

function getSession(from) {
  const s = sessions.get(from);
  if (!s) return null;
  if (Date.now() > s.expiresAt) {
    clearSession(from);
    return null;
  }
  return s;
}

function setSession(from, data) {
  sessions.set(from, { ...data, expiresAt: Date.now() + SESSION_TTL_MS });
}

function clearSession(from) {
  const s = sessions.get(from);
  if (s && s.filePath) safeUnlink(s.filePath);
  sessions.delete(from);
}

function safeUnlink(p) {
  try {
    if (p && fs.existsSync(p)) fs.unlinkSync(p);
  } catch (e) {
    console.error('Cleanup error:', e.message);
  }
}

// Sweep expired sessions (and their temp files) once a minute
setInterval(() => {
  const now = Date.now();
  for (const [from, s] of sessions) {
    if (now > s.expiresAt) clearSession(from);
  }
}, 60 * 1000).unref();

const HELP_TEXT =
  '🤖 *Bot de Figurinhas*\n\n' +
  'Envie */fig* para começar. Depois é só mandar uma *imagem*, *GIF* ou *vídeo* ' +
  'e eu devolvo como figurinha de WhatsApp. ✨';

/**
 * Converts a downloaded file into a sticker and sends it back. Always cleans up.
 */
async function convertAndSend(from, inputPath, kind, trim) {
  const outputPath = path.join(uploadDir, `sticker_${Date.now()}.webp`);
  try {
    await sendText(from, '⏳ Gerando sua figurinha...');
    if (kind === 'video') {
      await processVideo(inputPath, outputPath, trim);
    } else {
      await processImage(inputPath, outputPath);
    }
    await sendSticker(from, outputPath);
  } finally {
    safeUnlink(inputPath);
    safeUnlink(outputPath);
    sessions.delete(from);
  }
}

/**
 * Handles one incoming message from the Cloud API webhook.
 */
async function handleMessage(msg) {
  const from = msg.from;

  try {
    const session = getSession(from);
    const text = (msg.text?.body || '').trim();

    // --- Trigger command (works at any point, resets the flow) ---
    if (msg.type === 'text' && /^\/fig(urinha)?$/i.test(text)) {
      clearSession(from);
      setSession(from, { step: STEP.AWAITING_FILE });
      await sendText(from, '📎 Envie o arquivo que você quer transformar em figurinha (imagem, GIF ou vídeo).');
      return;
    }

    // --- No active session: only offer help ---
    if (!session) {
      await sendText(from, HELP_TEXT);
      return;
    }

    // --- AWAITING_FILE: expecting media ---
    if (session.step === STEP.AWAITING_FILE) {
      const media =
        msg.type === 'image' ? { id: msg.image.id, kind: 'image', ext: '.img' } :
        msg.type === 'video' ? { id: msg.video.id, kind: 'video', ext: '.mp4' } :
        msg.type === 'document' && msg.document?.mime_type === 'image/gif'
          ? { id: msg.document.id, kind: 'image', ext: '.gif' } :
        msg.type === 'document' && msg.document?.mime_type?.startsWith('video/')
          ? { id: msg.document.id, kind: 'video', ext: '.mp4' } :
        null;

      if (!media) {
        clearSession(from);
        await sendText(from, '😅 Isso não parece uma imagem, GIF ou vídeo. Envie */fig* para tentar de novo.');
        return;
      }

      const inputPath = path.join(uploadDir, `in_${Date.now()}_${from}${media.ext}`);
      await downloadMedia(media.id, inputPath);

      if (media.kind === 'image') {
        // Image or GIF: convert straight away
        await convertAndSend(from, inputPath, 'image');
      } else {
        // Video: ask what to do
        setSession(from, { step: STEP.AWAITING_VIDEO_CHOICE, filePath: inputPath });
        await sendText(
          from,
          '🎬 O que fazer com o vídeo?\n\n' +
          '1️⃣ Vídeo inteiro (até 10s) como figurinha animada\n' +
          '2️⃣ Recorte exato (você informa início e duração)\n\n' +
          'Responda *1* ou *2*.'
        );
      }
      return;
    }

    // --- AWAITING_VIDEO_CHOICE ---
    if (session.step === STEP.AWAITING_VIDEO_CHOICE) {
      if (text === '1') {
        await convertAndSend(from, session.filePath, 'video');
      } else if (text === '2') {
        setSession(from, { ...session, step: STEP.AWAITING_VIDEO_TRIM });
        await sendText(from, '✂️ Envie: `inicio duracao` em segundos.\nExemplo: *3 5* (começa no segundo 3, dura 5s).');
      } else {
        await sendText(from, 'Responda *1* (vídeo inteiro) ou *2* (recorte). 🙂');
      }
      return;
    }

    // --- AWAITING_VIDEO_TRIM ---
    if (session.step === STEP.AWAITING_VIDEO_TRIM) {
      const match = text.match(/^(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)$/);
      if (!match) {
        await sendText(from, 'Formato inválido. Envie `inicio duracao`, ex: *3 5*. ✂️');
        return;
      }
      const startSec = parseFloat(match[1].replace(',', '.'));
      const durationSec = parseFloat(match[2].replace(',', '.'));
      if (durationSec <= 0 || durationSec > 10) {
        await sendText(from, 'A duração precisa ser entre 1 e 10 segundos. Tente de novo, ex: *3 5*.');
        return;
      }
      await convertAndSend(from, session.filePath, 'video', { startSec, durationSec });
      return;
    }
  } catch (err) {
    console.error('Bot error handling message:', err);
    clearSession(from);
    try {
      await sendText(from, '❌ Ops, algo deu errado ao processar. Envie */fig* para tentar de novo.');
    } catch (e) {
      console.error('Failed to send error message:', e.message);
    }
  }
}

module.exports = {
  handleMessage
};
