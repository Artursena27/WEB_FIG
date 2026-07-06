import React from 'react';
import { Download, Share2, RefreshCw } from 'lucide-react';

const PreviewCard = ({ stickerUrl, isAnimated, fileSize, onReset }) => {
  const formatSize = (bytes) => {
    if (!bytes) return '';
    return (bytes / 1024).toFixed(1) + ' KB';
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = stickerUrl;
    a.download = `sticker_${Date.now()}.webp`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        const response = await fetch(stickerUrl);
        const blob = await response.blob();
        const file = new File([blob], `sticker.webp`, { type: 'image/webp' });
        
        await navigator.share({
          files: [file]
        });
      } catch (err) {
        console.error('Erro ao compartilhar:', err);
      }
    } else {
      alert('Seu navegador não suporta a API de compartilhamento nativo. Use o botão Baixar.');
    }
  };

  return (
    <div className="preview-container">
      <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', fontWeight: 700 }}>Sua Figurinha está pronta!</h2>
      <div className="preview-card">
        <div className="preview-image-container">
          <img src={stickerUrl} alt="Sticker Preview" />
        </div>
        
        <div className="preview-meta">
          <span>{isAnimated ? '🎬 Animada' : '🖼️ Estática'}</span>
          <span>•</span>
          <span>{formatSize(fileSize)}</span>
        </div>

        <div className="preview-actions">
          <button className="btn" onClick={handleDownload}>
            <Download size={20} />
            Baixar WebP
          </button>
          
          <button className="btn btn-secondary" onClick={handleShare}>
            <Share2 size={20} />
            Compartilhar
          </button>
        </div>

        <button 
          className="btn btn-secondary" 
          style={{ marginTop: '1.5rem', width: '100%' }} 
          onClick={onReset}
        >
          <RefreshCw size={20} />
          Criar outra figurinha
        </button>
      </div>
    </div>
  );
};

export default PreviewCard;
