import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { chromeMock } from '../../tests/mocks/chrome';

// Mock global de chrome
global.chrome = chromeMock;

// Mock du DOM avec tous les éléments d'apparence
const mockHTML = `
  <div id="previewPanel" class="preview-panel left">
    <div class="preview-panel-header"></div>
    <div class="preview-bookmark-list">
      <div class="preview-bookmark">
        <span class="preview-favicon">🌐</span>
        <div class="preview-bookmark-text">
          <span class="preview-bookmark-title">Test</span>
          <span class="preview-bookmark-url">test.com</span>
        </div>
      </div>
    </div>
  </div>
  <input type="radio" name="panelPosition" value="left" id="position-left" checked>
  <input type="radio" name="panelPosition" value="right" id="position-right">
  <input type="range" id="panelWidth" min="200" max="500" value="300">
  <input type="radio" name="colorMode" value="light" id="colorMode-light" checked>
  <input type="radio" name="colorMode" value="dark" id="colorMode-dark">
  <input type="radio" name="colorMode" value="auto" id="colorMode-auto">
  <input type="radio" name="theme" value="ocean" id="theme-ocean" checked>
  <input type="radio" name="theme" value="forest" id="theme-forest">
  <input type="radio" name="panelStyle" value="flat" id="panelStyle-flat">
  <input type="radio" name="panelStyle" value="elevated" id="panelStyle-elevated" checked>
  <input type="radio" name="panelStyle" value="strong-elevated" id="panelStyle-strong-elevated">
  <input type="radio" name="panelStyle" value="fade" id="panelStyle-fade">
  <input type="radio" name="panelStyle" value="glow" id="panelStyle-glow">
  <input type="range" id="panelOpacity" min="0.5" max="1.0" value="1.0" step="0.05">
  <input type="range" id="fontSize" min="12" max="20" value="14" step="1">
  <input type="range" id="iconSize" min="12" max="32" value="20" step="2">
`;

describe('Options - Aperçu des options d\'apparence', () => {
  let container;
  let previewPanel;

  beforeEach(() => {
    // Créer un conteneur DOM pour les tests
    container = document.createElement('div');
    container.innerHTML = mockHTML;
    document.body.appendChild(container);
    
    previewPanel = document.getElementById('previewPanel');
    
    vi.clearAllMocks();
    chromeMock.storage.sync.get.mockClear();
    chromeMock.storage.sync.set.mockClear();
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  function updatePreview() {
    if (!previewPanel) return;

    // Position
    const positionRadio = document.querySelector('input[name="panelPosition"]:checked');
    if (positionRadio) {
      previewPanel.className = previewPanel.className.replace(/\b(left|right)\b/g, '');
      previewPanel.classList.add(positionRadio.value);
    }

    // Largeur
    const widthSlider = document.getElementById('panelWidth');
    if (widthSlider) {
      previewPanel.style.width = `${widthSlider.value}px`;
    }

    // Mode de couleur et thème
    const colorModeRadio = document.querySelector('input[name="colorMode"]:checked');
    const themeRadio = document.querySelector('input[name="theme"]:checked');
    if (themeRadio && colorModeRadio) {
      previewPanel.setAttribute('data-theme', themeRadio.value);
      
      let mode = colorModeRadio.value;
      if (mode === 'auto') {
        mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      previewPanel.setAttribute('data-color-mode', mode);
    }

    // Style du panneau
    const panelStyleRadio = document.querySelector('input[name="panelStyle"]:checked');
    if (panelStyleRadio) {
      previewPanel.classList.remove('panel-flat', 'panel-elevated', 'panel-strong-elevated', 'panel-fade', 'panel-glow');
      previewPanel.classList.add(`panel-${panelStyleRadio.value}`);
    }

    // Opacité du panneau
    const panelOpacitySlider = document.getElementById('panelOpacity');
    if (panelOpacitySlider) {
      const opacity = parseFloat(panelOpacitySlider.value);
      previewPanel.style.opacity = opacity.toString();
    }

    // Taille de la police
    const fontSizeSlider = document.getElementById('fontSize');
    if (fontSizeSlider) {
      const fontSize = parseInt(fontSizeSlider.value);
      previewPanel.style.fontSize = `${fontSize}px`;
    }

    // Taille des icônes
    const iconSizeSlider = document.getElementById('iconSize');
    if (iconSizeSlider) {
      const iconSize = parseInt(iconSizeSlider.value);
      const favicons = previewPanel.querySelectorAll('.preview-favicon');
      favicons.forEach(favicon => {
        favicon.style.width = `${iconSize}px`;
        favicon.style.height = `${iconSize}px`;
        favicon.style.fontSize = `${iconSize * 0.8}px`;
      });
    }
  }

  describe('Position du panneau', () => {
    it('applique la classe "left" quand la position gauche est sélectionnée', () => {
      const leftRadio = document.getElementById('position-left');
      leftRadio.checked = true;
      updatePreview();
      
      expect(previewPanel.classList.contains('left')).toBe(true);
      expect(previewPanel.classList.contains('right')).toBe(false);
    });

    it('applique la classe "right" quand la position droite est sélectionnée', () => {
      const rightRadio = document.getElementById('position-right');
      rightRadio.checked = true;
      updatePreview();
      
      expect(previewPanel.classList.contains('right')).toBe(true);
      expect(previewPanel.classList.contains('left')).toBe(false);
    });
  });

  describe('Largeur du panneau', () => {
    it('met à jour la largeur du panneau selon le slider', () => {
      const widthSlider = document.getElementById('panelWidth');
      widthSlider.value = '400';
      updatePreview();
      
      expect(previewPanel.style.width).toBe('400px');
    });

    it('met à jour la largeur quand le slider change', () => {
      const widthSlider = document.getElementById('panelWidth');
      widthSlider.value = '250';
      updatePreview();
      
      expect(previewPanel.style.width).toBe('250px');
    });
  });

  describe('Thème et mode de couleur', () => {
    it('applique le thème sélectionné', () => {
      const forestRadio = document.getElementById('theme-forest');
      forestRadio.checked = true;
      updatePreview();
      
      expect(previewPanel.getAttribute('data-theme')).toBe('forest');
    });

    it('applique le mode clair', () => {
      const lightRadio = document.getElementById('colorMode-light');
      lightRadio.checked = true;
      updatePreview();
      
      expect(previewPanel.getAttribute('data-color-mode')).toBe('light');
    });

    it('applique le mode sombre', () => {
      const darkRadio = document.getElementById('colorMode-dark');
      darkRadio.checked = true;
      updatePreview();
      
      expect(previewPanel.getAttribute('data-color-mode')).toBe('dark');
    });
  });

  describe('Style du panneau', () => {
    it('applique le style "flat"', () => {
      const flatRadio = document.getElementById('panelStyle-flat');
      flatRadio.checked = true;
      updatePreview();
      
      expect(previewPanel.classList.contains('panel-flat')).toBe(true);
      expect(previewPanel.classList.contains('panel-elevated')).toBe(false);
    });

    it('applique le style "elevated"', () => {
      const elevatedRadio = document.getElementById('panelStyle-elevated');
      elevatedRadio.checked = true;
      updatePreview();
      
      expect(previewPanel.classList.contains('panel-elevated')).toBe(true);
      expect(previewPanel.classList.contains('panel-flat')).toBe(false);
    });

    it('applique le style "strong-elevated"', () => {
      const strongRadio = document.getElementById('panelStyle-strong-elevated');
      strongRadio.checked = true;
      updatePreview();
      
      expect(previewPanel.classList.contains('panel-strong-elevated')).toBe(true);
    });

    it('applique le style "fade"', () => {
      const fadeRadio = document.getElementById('panelStyle-fade');
      fadeRadio.checked = true;
      updatePreview();
      
      expect(previewPanel.classList.contains('panel-fade')).toBe(true);
    });

    it('applique le style "glow"', () => {
      const glowRadio = document.getElementById('panelStyle-glow');
      glowRadio.checked = true;
      updatePreview();
      
      expect(previewPanel.classList.contains('panel-glow')).toBe(true);
    });

    it('retire les anciens styles quand on change de style', () => {
      const elevatedRadio = document.getElementById('panelStyle-elevated');
      const flatRadio = document.getElementById('panelStyle-flat');
      
      elevatedRadio.checked = true;
      updatePreview();
      expect(previewPanel.classList.contains('panel-elevated')).toBe(true);
      
      flatRadio.checked = true;
      updatePreview();
      expect(previewPanel.classList.contains('panel-elevated')).toBe(false);
      expect(previewPanel.classList.contains('panel-flat')).toBe(true);
    });
  });

  describe('Opacité du panneau', () => {
    it('applique l\'opacité selon le slider', () => {
      const opacitySlider = document.getElementById('panelOpacity');
      opacitySlider.value = '0.75';
      updatePreview();
      
      expect(previewPanel.style.opacity).toBe('0.75');
    });

    it('met à jour l\'opacité quand le slider change', () => {
      const opacitySlider = document.getElementById('panelOpacity');
      opacitySlider.value = '0.5';
      updatePreview();
      
      expect(previewPanel.style.opacity).toBe('0.5');
    });
  });

  describe('Taille de la police', () => {
    it('applique la taille de police selon le slider', () => {
      const fontSizeSlider = document.getElementById('fontSize');
      fontSizeSlider.value = '16';
      updatePreview();
      
      expect(previewPanel.style.fontSize).toBe('16px');
    });

    it('met à jour la taille de police quand le slider change', () => {
      const fontSizeSlider = document.getElementById('fontSize');
      fontSizeSlider.value = '18';
      updatePreview();
      
      expect(previewPanel.style.fontSize).toBe('18px');
    });
  });

  describe('Taille des icônes', () => {
    it('applique la taille des icônes selon le slider', () => {
      const iconSizeSlider = document.getElementById('iconSize');
      iconSizeSlider.value = '24';
      updatePreview();
      
      const favicon = previewPanel.querySelector('.preview-favicon');
      expect(favicon.style.width).toBe('24px');
      expect(favicon.style.height).toBe('24px');
    });

    it('met à jour toutes les icônes quand le slider change', () => {
      const iconSizeSlider = document.getElementById('iconSize');
      iconSizeSlider.value = '28';
      updatePreview();
      
      const favicons = previewPanel.querySelectorAll('.preview-favicon');
      favicons.forEach(favicon => {
        expect(favicon.style.width).toBe('28px');
        expect(favicon.style.height).toBe('28px');
      });
    });
  });
});
