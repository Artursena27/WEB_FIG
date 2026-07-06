const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

/**
 * Processes a video or GIF to create a WhatsApp animated sticker (WebP, 512x512, < 500kb, max 10s)
 */
function processVideo(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    console.log(`Starting video conversion to WebP: ${inputPath}`);
    
    ffmpeg(inputPath)
      // Max duration 10 seconds
      .setDuration(10)
      // No audio
      .noAudio()
      // WebP format
      .format('webp')
      // Video codec
      .videoCodec('libwebp')
      // Framerate to keep size small (15 fps is usually good enough for stickers)
      .fps(15)
      // Scale to 512x512, keeping aspect ratio by adding transparent padding
      .complexFilter([
        'scale=512:512:force_original_aspect_ratio=decrease',
        'pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0'
      ])
      // Options to try and keep file size under 500kb
      // -lossless 0, -qscale 50, -m 6
      .outputOptions([
        '-vcodec libwebp',
        '-lossless 0',
        '-compression_level 6',
        '-qscale 50',
        '-loop 0', // infinite loop
        '-an' // no audio
      ])
      .on('end', () => {
        console.log(`Video processed and saved to ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('Error processing video:', err);
        reject(err);
      })
      .save(outputPath);
  });
}

module.exports = {
  processVideo
};
