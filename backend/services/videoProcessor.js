const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const fs = require('fs');

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

const ANIMATED_MAX_BYTES = 500 * 1024; // WhatsApp animated sticker limit

function runFfmpeg(inputPath, outputPath, { startSec, durationSec, fps, qscale }) {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(inputPath);

    // Seek before input (fast seek) when trimming
    if (startSec != null) {
      cmd.seekInput(startSec);
    }
    // Trim duration (default cap: 10s)
    cmd.setDuration(durationSec != null ? Math.min(durationSec, 10) : 10);

    cmd
      .noAudio()
      .format('webp')
      .fps(fps)
      // Scale to 512x512, keeping aspect ratio with transparent padding
      // (chained with commas — a single filter chain)
      .videoFilters([
        'scale=512:512:force_original_aspect_ratio=decrease',
        'pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0'
      ])
      .outputOptions([
        '-vcodec libwebp',
        '-lossless 0',
        '-compression_level 6',
        `-qscale ${qscale}`,
        '-loop 0', // infinite loop
        '-an'
      ])
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .save(outputPath);
  });
}

/**
 * Processes a video to create a WhatsApp animated sticker (WebP, 512x512, <500KB, max 10s).
 * Optional trim: { startSec, durationSec }.
 * Retries with lower fps/quality until under the size limit.
 */
async function processVideo(inputPath, outputPath, trim = {}) {
  console.log(`Starting video conversion to WebP: ${inputPath}`, trim);

  const attempts = [
    { fps: 15, qscale: 50 },
    { fps: 12, qscale: 40 },
    { fps: 10, qscale: 30 },
    { fps: 8, qscale: 20 }
  ];

  for (const attempt of attempts) {
    await runFfmpeg(inputPath, outputPath, { ...trim, ...attempt });
    const size = fs.statSync(outputPath).size;
    if (size <= ANIMATED_MAX_BYTES) {
      console.log(`Video processed (${size} bytes, fps=${attempt.fps}) -> ${outputPath}`);
      return outputPath;
    }
    console.log(`Sticker too big (${size} bytes) at fps=${attempt.fps}/q=${attempt.qscale}, retrying...`);
  }

  // Last attempt result stays on disk even if above the limit; caller decides.
  console.warn('Could not get animated sticker under 500KB; sending last attempt anyway.');
  return outputPath;
}

module.exports = {
  processVideo
};
