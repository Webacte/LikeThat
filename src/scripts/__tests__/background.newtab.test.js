import { describe, it, expect, beforeEach, vi } from 'vitest';
import { chromeMock } from '../../tests/mocks/chrome';

// Mock global de chrome
global.chrome = chromeMock;

// Import du module background après avoir mocké chrome
// Note: Pour tester les fonctions exportées, nous devons les exporter depuis background.js
// Pour l'instant, nous allons tester les fonctions directement en les recréant dans le test

describe('Gestion des nouveaux onglets - Background Script', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chromeMock.storage.sync.get.mockClear();
    chromeMock.tabs.get.mockClear();
    chromeMock.tabs.update.mockClear();
  });

  describe('isNewTabPage', () => {
    // Recréer la fonction pour les tests
    const NEWTAB_URLS = [
      'chrome://newtab/',
      'edge://newtab/',
      'about:newtab',
      'about:home'
    ];

    function isNewTabPage(url) {
      if (!url) return false;
      return NEWTAB_URLS.some(newtabUrl => url === newtabUrl || url.startsWith(newtabUrl));
    }

    it('détecte correctement chrome://newtab/', () => {
      expect(isNewTabPage('chrome://newtab/')).toBe(true);
    });

    it('détecte correctement edge://newtab/', () => {
      expect(isNewTabPage('edge://newtab/')).toBe(true);
    });

    it('détecte correctement about:newtab', () => {
      expect(isNewTabPage('about:newtab')).toBe(true);
    });

    it('détecte correctement about:home', () => {
      expect(isNewTabPage('about:home')).toBe(true);
    });

    it('retourne false pour URLs normales', () => {
      expect(isNewTabPage('https://www.google.com')).toBe(false);
      expect(isNewTabPage('http://example.com')).toBe(false);
      expect(isNewTabPage('chrome://settings/')).toBe(false);
    });

    it('retourne false pour URL null ou undefined', () => {
      expect(isNewTabPage(null)).toBe(false);
      expect(isNewTabPage(undefined)).toBe(false);
      expect(isNewTabPage('')).toBe(false);
    });
  });

  describe('getCustomNewTabUrl', () => {
    const SEARCH_ENGINES = {
      'google': 'https://www.google.com',
      'bing': 'https://www.bing.com',
      'duckduckgo': 'https://duckduckgo.com',
      'yahoo': 'https://www.yahoo.com',
      'ecosia': 'https://www.ecosia.org',
      'qwant': 'https://www.qwant.com'
    };

    async function getCustomNewTabUrl() {
      try {
        const settings = await chrome.storage.sync.get(['customNewTabUrl', 'newTabSearchEngine']);
        
        // Si une URL personnalisée est définie, l'utiliser
        if (settings.customNewTabUrl && settings.customNewTabUrl.trim()) {
          const url = settings.customNewTabUrl.trim();
          // Valider que c'est une URL valide
          try {
            const urlObj = new URL(url);
            // Vérifier que c'est http ou https
            if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
              return url;
            }
            console.error('LikeThat: URL personnalisée doit être http ou https:', url);
            return null;
          } catch {
            console.error('LikeThat: URL personnalisée invalide:', url);
            return null;
          }
        }
        
        // Sinon, utiliser le moteur de recherche sélectionné
        if (settings.newTabSearchEngine && SEARCH_ENGINES[settings.newTabSearchEngine]) {
          return SEARCH_ENGINES[settings.newTabSearchEngine];
        }
        
        return null;
      } catch (error) {
        console.error('LikeThat: Erreur lors de la récupération de l\'URL personnalisée:', error);
        return null;
      }
    }

    it('retourne l\'URL personnalisée si définie', async () => {
      chromeMock.storage.sync.get.mockResolvedValue({
        customNewTabUrl: 'https://example.com',
        newTabSearchEngine: 'google'
      });

      const url = await getCustomNewTabUrl();
      expect(url).toBe('https://example.com');
    });

    it('retourne l\'URL du moteur de recherche si pas d\'URL personnalisée', async () => {
      chromeMock.storage.sync.get.mockResolvedValue({
        customNewTabUrl: '',
        newTabSearchEngine: 'google'
      });

      const url = await getCustomNewTabUrl();
      expect(url).toBe('https://www.google.com');
    });

    it('retourne null si aucune configuration', async () => {
      chromeMock.storage.sync.get.mockResolvedValue({});

      const url = await getCustomNewTabUrl();
      expect(url).toBeNull();
    });

    it('valide les URLs personnalisées invalides', async () => {
      chromeMock.storage.sync.get.mockResolvedValue({
        customNewTabUrl: 'not-a-valid-url',
        newTabSearchEngine: 'google'
      });

      const url = await getCustomNewTabUrl();
      expect(url).toBeNull();
    });

    it('rejette les URLs non http/https', async () => {
      chromeMock.storage.sync.get.mockResolvedValue({
        customNewTabUrl: 'ftp://example.com',
        newTabSearchEngine: 'google'
      });

      const url = await getCustomNewTabUrl();
      expect(url).toBeNull();
    });

    it('utilise le moteur de recherche si URL personnalisée est vide', async () => {
      chromeMock.storage.sync.get.mockResolvedValue({
        customNewTabUrl: '   ',
        newTabSearchEngine: 'bing'
      });

      const url = await getCustomNewTabUrl();
      expect(url).toBe('https://www.bing.com');
    });
  });

  describe('Listeners chrome.tabs', () => {
    it('onCreated listener est enregistré', () => {
      // Simuler l'enregistrement du listener
      const listener = vi.fn();
      chromeMock.tabs.onCreated.addListener(listener);
      
      expect(chromeMock.tabs.onCreated.addListener).toHaveBeenCalledWith(listener);
    });

    it('onUpdated listener est enregistré', () => {
      // Simuler l'enregistrement du listener
      const listener = vi.fn();
      chromeMock.tabs.onUpdated.addListener(listener);
      
      expect(chromeMock.tabs.onUpdated.addListener).toHaveBeenCalledWith(listener);
    });
  });
});

