import React, { useState, useRef } from 'react';
import { UploadCloud, Image as ImageIcon, Video } from 'lucide-react';

const UploadZone = ({ onFileSelect }) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files[0]);
    }
  };

  const handleFiles = (file) => {
    // Basic validation
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'];
    if (!validTypes.includes(file.type)) {
      alert('Formato não suportado. Envie imagens, GIFs ou vídeos curtos.');
      return;
    }
    onFileSelect(file);
  };

  return (
    <div
      className={`upload-zone ${isDragActive ? 'drag-active' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current.click()}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleChange}
        accept="image/*,video/*"
      />
      <div className="upload-icon">
        <UploadCloud size={48} />
      </div>
      <div className="upload-text">
        Arraste e solte seu arquivo aqui
      </div>
      <div className="upload-subtext">
        ou clique para procurar no seu dispositivo
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1.5rem', color: 'var(--text-muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><ImageIcon size={16} /> Imagens (PNG, JPG, WEBP)</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Video size={16} /> Vídeos & GIFs</span>
      </div>
    </div>
  );
};

export default UploadZone;
