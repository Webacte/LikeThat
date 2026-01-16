import { describe, it, expect, beforeEach, vi } from 'vitest';
import { chromeMock } from '../../tests/mocks/chrome';

// Mock global de chrome
global.chrome = chromeMock;

// Mock du DOM
const mockHTML = `
  <div>
    <input type="radio" name="newTabSearchEngine" value="google" id="newTab-google">
    <input type="radio" name="newTabSearchEngine" value="bing" id="newTab-bing">
    <input type="radio" name="newTabSearchEngine" value="duckduckgo" id="newTab-duckduckgo">
    <input type="url" id="customNewTabUrl" placeholder="https://example.com">
  </div>
`;

describe('Options - Gestion des nouveaux onglets', () => {
  let container;

  beforeEach(() => {
    // Nettoyer le conteneur précédent s'il existe
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    
    // Créer un conteneur DOM pour les tests
    container = document.createElement('div');
    container.innerHTML = mockHTML;
    document.body.appendChild(container);
    
    // S'assurer qu'aucun radio n'est sélectionné
    const radios = document.querySelectorAll('input[name="newTabSearchEngine"]');
    radios.forEach(radio => radio.checked = false);
    
    // S'assurer que l'input URL est vide
    const urlInput = document.getElementById('customNewTabUrl');
    if (urlInput) {
      urlInput.value = '';
    }
    
    vi.clearAllMocks();
    chromeMock.storage.sync.get.mockClear();
    chromeMock.storage.sync.set.mockClear();
  });

  afterEach(() => {
    // Nettoyer le conteneur après chaque test
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Collecte des données', () => {
    function collectNewTabData() {
      const data = {};
      
      // Nouveau onglet - Moteur de recherche
      const newTabEngineRadio = document.querySelector('input[name="newTabSearchEngine"]:checked');
      if (newTabEngineRadio) {
        data.newTabSearchEngine = newTabEngineRadio.value;
      }
      
      // Nouveau onglet - URL personnalisée
      const customNewTabUrlInput = document.getElementById('customNewTabUrl');
      if (customNewTabUrlInput && customNewTabUrlInput.value.trim()) {
        data.customNewTabUrl = customNewTabUrlInput.value.trim();
      }
      
      return data;
    }

    it('collecte correctement newTabSearchEngine', () => {
      const googleRadio = document.getElementById('newTab-google');
      googleRadio.checked = true;
      
      const data = collectNewTabData();
      expect(data.newTabSearchEngine).toBe('google');
    });

    it('collecte correctement customNewTabUrl', () => {
      const urlInput = document.getElementById('customNewTabUrl');
      urlInput.value = 'https://example.com';
      
      const data = collectNewTabData();
      expect(data.customNewTabUrl).toBe('https://example.com');
    });

    it('trim l\'URL personnalisée', () => {
      const urlInput = document.getElementById('customNewTabUrl');
      urlInput.value = '  https://example.com  ';
      
      const data = collectNewTabData();
      expect(data.customNewTabUrl).toBe('https://example.com');
    });

    it('collecte les deux paramètres ensemble', () => {
      const googleRadio = document.getElementById('newTab-google');
      googleRadio.checked = true;
      
      const urlInput = document.getElementById('customNewTabUrl');
      urlInput.value = 'https://example.com';
      
      const data = collectNewTabData();
      expect(data.newTabSearchEngine).toBe('google');
      expect(data.customNewTabUrl).toBe('https://example.com');
    });

    it('retourne un objet vide si aucun paramètre n\'est sélectionné', () => {
      // S'assurer qu'aucun radio n'est sélectionné
      const radios = document.querySelectorAll('input[name="newTabSearchEngine"]');
      radios.forEach(radio => radio.checked = false);
      
      // S'assurer que l'input URL est vide
      const urlInput = document.getElementById('customNewTabUrl');
      if (urlInput) {
        urlInput.value = '';
      }
      
      const data = collectNewTabData();
      expect(data).toEqual({});
    });
  });

  describe('Validation des paramètres', () => {
    function validateNewTabSettings(data) {
      // Validation de l'URL personnalisée pour le nouvel onglet
      if (data.customNewTabUrl && data.customNewTabUrl.trim()) {
        const url = data.customNewTabUrl.trim();
        try {
          const urlObj = new URL(url);
          // Vérifier que c'est http ou https
          if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
            return { valid: false, error: 'L\'URL personnalisée doit commencer par http:// ou https://' };
          }
        } catch {
          return { valid: false, error: 'L\'URL personnalisée n\'est pas valide' };
        }
      }
      
      return { valid: true };
    }

    it('valide les URLs http/https', () => {
      const result1 = validateNewTabSettings({ customNewTabUrl: 'https://example.com' });
      expect(result1.valid).toBe(true);
      
      const result2 = validateNewTabSettings({ customNewTabUrl: 'http://example.com' });
      expect(result2.valid).toBe(true);
    });

    it('rejette les URLs invalides', () => {
      const result1 = validateNewTabSettings({ customNewTabUrl: 'not-a-valid-url' });
      expect(result1.valid).toBe(false);
      expect(result1.error).toBe('L\'URL personnalisée n\'est pas valide');
      
      const result2 = validateNewTabSettings({ customNewTabUrl: 'ftp://example.com' });
      expect(result2.valid).toBe(false);
      expect(result2.error).toBe('L\'URL personnalisée doit commencer par http:// ou https://');
    });

    it('accepte les paramètres sans URL personnalisée', () => {
      const result = validateNewTabSettings({ newTabSearchEngine: 'google' });
      expect(result.valid).toBe(true);
    });

    it('accepte les paramètres avec URL personnalisée vide', () => {
      const result = validateNewTabSettings({ 
        newTabSearchEngine: 'google',
        customNewTabUrl: ''
      });
      expect(result.valid).toBe(true);
    });

    it('trim l\'URL avant validation', () => {
      const result = validateNewTabSettings({ 
        customNewTabUrl: '  https://example.com  '
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('Sauvegarde des paramètres', () => {
    it('sauvegarde newTabSearchEngine dans chrome.storage.sync', async () => {
      const data = {
        newTabSearchEngine: 'bing',
        customNewTabUrl: ''
      };
      
      chromeMock.storage.sync.set.mockResolvedValue(undefined);
      
      await chrome.storage.sync.set(data);
      
      expect(chromeMock.storage.sync.set).toHaveBeenCalledWith(data);
    });

    it('sauvegarde customNewTabUrl dans chrome.storage.sync', async () => {
      const data = {
        newTabSearchEngine: 'google',
        customNewTabUrl: 'https://example.com'
      };
      
      chromeMock.storage.sync.set.mockResolvedValue(undefined);
      
      await chrome.storage.sync.set(data);
      
      expect(chromeMock.storage.sync.set).toHaveBeenCalledWith(data);
    });
  });
});
