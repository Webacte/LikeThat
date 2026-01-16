import React, { useState } from 'react';

// Helper pour obtenir l'URL de manière sécurisée
const safeGetURL = (path) => {
  try {
    if (chrome.runtime && chrome.runtime.id) {
      return chrome.runtime.getURL(path);
    }
  } catch (e) {
    console.error('Extension context invalidated, rechargement...');
    setTimeout(() => window.location.reload(), 500);
  }
  return '';
};

const IconSelector = ({ onIconSelect, onClose, position }) => {
  const [selectedIcon, setSelectedIcon] = useState(null);
  const [showColorSelector, setShowColorSelector] = useState(false);

  // Liste des icônes disponibles
  const availableIcons = [
    'art', 'bag', 'ballon', 'baseball', 'bath', 'bike', 'bivouac', 'bones', 
    'book', 'books', 'bulle', 'caddies', 'car', 'cat', 'check', 'coeur', 
    'direction', 'dog', 'entrainement', 'feuille', 'flocon', 'graph', 
    'holliday', 'idea', 'media', 'movie', 'musique', 'network', 'photo', 
    'screenpc', 'smiley', 'tag', 'work'
  ];

  // Couleurs néon disponibles
  const neonColors = [
    { name: 'Bleu', value: '#00BFFF', class: 'neon-blue' },
    { name: 'Vert', value: '#00FF7F', class: 'neon-green' },
    { name: 'Rouge', value: '#FF1744', class: 'neon-red' },
    { name: 'Violet', value: '#8A2BE2', class: 'neon-purple' },
    { name: 'Orange', value: '#FF6B35', class: 'neon-orange' },
    { name: 'Rose', value: '#FF1493', class: 'neon-pink' }
  ];

  const handleIconClick = (iconName) => {
    setSelectedIcon(iconName);
    setShowColorSelector(true);
  };

  const handleColorSelect = (color) => {
    onIconSelect(selectedIcon, color);
    onClose();
  };

  const handleBackToIcons = () => {
    setSelectedIcon(null);
    setShowColorSelector(false);
  };

  
  return (
    <div 
      className="icon-selector-tooltip"
      style={{
        top: `${position?.top || 0}px`,
        left: `${position?.left || 0}px`
      }}
    >
      <div className="icon-selector-header">
        {showColorSelector && (
          <button 
            className="icon-selector-back-btn" 
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleBackToIcons();
            }}
            title="Retour aux icônes"
          >
            ← 
          </button>
        )}
        <div className="icon-selector-title">
          {showColorSelector ? `Choisir une couleur pour ${selectedIcon}` : 'Choisir une icône'}
        </div>
        <button 
          className="tooltip-close-btn"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          title="Fermer"
        >
          ✕
        </button>
      </div>

      <div className="icon-selector-content">
        {!showColorSelector ? (
          // Sélection d'icône
          <div className="icon-grid">
            {/* Option dossier par défaut */}
            <div
              className="icon-option default-folder-option"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // Appliquer directement le dossier par défaut (pas besoin de couleur)
                onIconSelect('default', null);
                onClose();
              }}
              title="Dossier par défaut"
            >
              <div className="default-folder-icon">📁</div>
            </div>
            
            {availableIcons.map((iconName) => (
              <div
                key={iconName}
                className="icon-option"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleIconClick(iconName);
                }}
                title={iconName}
              >
                <img 
                  src={safeGetURL(`assets/icons/${iconName}.png`)}
                  alt={iconName}
                  className="icon-preview neon-blue"
                />
              </div>
            ))}
          </div>
        ) : (
          // Sélection de couleur
          <div className="color-grid">
            {neonColors.map((color) => (
              <div
                key={color.value}
                className="color-option"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleColorSelect(color);
                }}
                title={color.name}
              >
                <img 
                  src={safeGetURL(`assets/icons/${selectedIcon}.png`)}
                  alt={`${selectedIcon} en ${color.name.toLowerCase()}`}
                  className={`icon-preview ${color.class}`}
                />
                <span className="color-name">{color.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default IconSelector;
