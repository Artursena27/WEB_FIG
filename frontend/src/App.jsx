import React, { useState, useEffect } from 'react';
import UploadZone from './components/UploadZone';
import PreviewCard from './components/PreviewCard';
import { convertToSticker } from './services/api';

function App() {
  const [file, setFile] = useState(null);
  const [removeBackground, setRemoveBackground] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Clean up object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      if (result && result.url) {
        URL.revokeObjectURL(result.url);
      }
    };
  }, [result]);

  const handleFileSelect = async (selectedFile) => {
    setFile(selectedFile);
    setError(null);
    setIsProcessing(true);
    setResult(null);

    try {
      const { blob, isAnimated } = await convertToSticker(selectedFile, { removeBackground });
      
      const url = URL.createObjectURL(blob);
      setResult({
        url,
        isAnimated,
        size: blob.size
      });
    } catch (err) {
      setError(err.message || 'Ocorreu um erro ao processar o arquivo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="container">
      <h1>Sticker Maker Pro</h1>
      <p className="subtitle">Crie figurinhas perfeitas para o WhatsApp em segundos.</p>

      {!result && !isProcessing && (
        <>
          <UploadZone onFileSelect={handleFileSelect} />
          
          <div className="controls">
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={removeBackground} 
                onChange={(e) => setRemoveBackground(e.target.checked)} 
              />
              <span className="slider"></span>
              <span>Remover Fundo (IA)</span>
            </label>
          </div>

          {error && (
            <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '8px', color: '#fca5a5', textAlign: 'center' }}>
              {error}
            </div>
          )}
        </>
      )}

      {isProcessing && (
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <div className="loader"></div>
          <p className="loading-text">Mágica acontecendo... Aguarde!</p>
        </div>
      )}

      {result && !isProcessing && (
        <PreviewCard 
          stickerUrl={result.url} 
          isAnimated={result.isAnimated}
          fileSize={result.size}
          onReset={handleReset}
        />
      )}
    </div>
  );
}

export default App;
