// In production, the API is on the same domain. In dev, it's on port 3001.
const API_URL = import.meta.env.PROD 
  ? '/api/stickers' 
  : 'http://localhost:3001/api/stickers';

export const convertToSticker = async (file, options = {}) => {
  const formData = new FormData();
  formData.append('file', file);
  
  if (options.removeBackground) {
    formData.append('removeBackground', 'true');
  }

  const response = await fetch(`${API_URL}/convert`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Falha ao converter o arquivo');
  }

  // Get the Blob
  const blob = await response.blob();
  const isAnimated = response.headers.get('X-Sticker-Animated') === 'true';
  
  return { blob, isAnimated };
};
