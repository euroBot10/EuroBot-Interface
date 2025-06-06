import React from 'react';

interface LightboxProps {
  url: string;
  onClose: () => void;
}

const Lightbox: React.FC<LightboxProps> = ({ url, onClose }) => {
  return (
    <div className="lightbox" onClick={onClose}>
      <div className="lightbox-content" onClick={e => e.stopPropagation()}>
        <button className="lightbox-close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
        <img src={url} alt="Foto ampliada" className="lightbox-img" />
      </div>
    </div>
  );
};

export default Lightbox; 