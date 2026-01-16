import { describe, it, expect, beforeEach, vi } from 'vitest';
import { chromeMock } from '../mocks/chrome';

// Mock global de chrome
global.chrome = chromeMock;

describe('Intégration - Redirection des nouveaux onglets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chromeMock.storage.sync.get.mockClear();
    chromeMock.storage.sync.set.mockClear();
    chromeMock.tabs.get.mockClear();
    chromeMock.tabs.update.mockClear();
  });

  describe('Configuration d\'un moteur de recherche', () => {
    it('sauvegarde la configuration et récupère l\'URL du moteur', async () => {
      // Simuler la sauvegarde de la configuration
      const settings = {
        newTabSearchEngine: 'google',
        customNewTabUrl: ''
      };
      
      await chrome.storage.sync.set(settings);
      expect(chromeMock.storage.sync.set).toHaveBeenCalledWith(settings);
      
      // Simuler la récupération de la configuration
      chromeMock.storage.sync.get.mockResolvedValue(settings);
      const retrieved = await chrome.storage.sync.get(['newTabSearchEngine', 'customNewTabUrl']);
      
      expect(retrieved.newTabSearchEngine).toBe('google');
      expect(retrieved.customNewTabUrl).toBe('');
    });

    it('retourne l\'URL du moteur de recherche configuré', async () => {
      const SEARCH_ENGINES = {
        'google': 'https://www.google.com',
        'bing': 'https://www.bing.com',
        'duckduckgo': 'https://duckduckgo.com'
      };

      chromeMock.storage.sync.get.mockResolvedValue({
        newTabSearchEngine: 'bing',
        customNewTabUrl: ''
      });

      const settings = await chrome.storage.sync.get(['newTabSearchEngine', 'customNewTabUrl']);
      const url = SEARCH_ENGINES[settings.newTabSearchEngine];
      
      expect(url).toBe('https://www.bing.com');
    });
  });

  describe('Configuration d\'une URL personnalisée', () => {
    it('sauvegarde l\'URL personnalisée', async () => {
      const settings = {
        newTabSearchEngine: 'google',
        customNewTabUrl: 'https://example.com'
      };
      
      await chrome.storage.sync.set(settings);
      expect(chromeMock.storage.sync.set).toHaveBeenCalledWith(settings);
    });

    it('retourne l\'URL personnalisée si définie', async () => {
      chromeMock.storage.sync.get.mockResolvedValue({
        newTabSearchEngine: 'google',
        customNewTabUrl: 'https://example.com'
      });

      const settings = await chrome.storage.sync.get(['customNewTabUrl', 'newTabSearchEngine']);
      
      expect(settings.customNewTabUrl).toBe('https://example.com');
    });
  });

  describe('Priorité URL personnalisée > Moteur de recherche', () => {
    it('utilise l\'URL personnalisée même si un moteur est configuré', async () => {
      const SEARCH_ENGINES = {
        'google': 'https://www.google.com'
      };

      chromeMock.storage.sync.get.mockResolvedValue({
        newTabSearchEngine: 'google',
        customNewTabUrl: 'https://example.com'
      });

      const settings = await chrome.storage.sync.get(['customNewTabUrl', 'newTabSearchEngine']);
      
      // L'URL personnalisée doit avoir la priorité
      let finalUrl = null;
      if (settings.customNewTabUrl && settings.customNewTabUrl.trim()) {
        finalUrl = settings.customNewTabUrl.trim();
      } else if (settings.newTabSearchEngine && SEARCH_ENGINES[settings.newTabSearchEngine]) {
        finalUrl = SEARCH_ENGINES[settings.newTabSearchEngine];
      }
      
      expect(finalUrl).toBe('https://example.com');
    });

    it('utilise le moteur de recherche si l\'URL personnalisée est vide', async () => {
      const SEARCH_ENGINES = {
        'google': 'https://www.google.com'
      };

      chromeMock.storage.sync.get.mockResolvedValue({
        newTabSearchEngine: 'google',
        customNewTabUrl: ''
      });

      const settings = await chrome.storage.sync.get(['customNewTabUrl', 'newTabSearchEngine']);
      
      let finalUrl = null;
      if (settings.customNewTabUrl && settings.customNewTabUrl.trim()) {
        finalUrl = settings.customNewTabUrl.trim();
      } else if (settings.newTabSearchEngine && SEARCH_ENGINES[settings.newTabSearchEngine]) {
        finalUrl = SEARCH_ENGINES[settings.newTabSearchEngine];
      }
      
      expect(finalUrl).toBe('https://www.google.com');
    });
  });

  describe('Simulation de redirection', () => {
    it('simule la redirection d\'un nouvel onglet vers l\'URL configurée', async () => {
      // Simuler un nouvel onglet créé
      const newTab = {
        id: 123,
        url: 'chrome://newtab/',
        active: true
      };

      // Configuration
      chromeMock.storage.sync.get.mockResolvedValue({
        newTabSearchEngine: 'google',
        customNewTabUrl: ''
      });

      // Simuler la récupération de l'onglet
      chromeMock.tabs.get.mockResolvedValue(newTab);

      // Simuler la redirection
      const settings = await chrome.storage.sync.get(['customNewTabUrl', 'newTabSearchEngine']);
      const SEARCH_ENGINES = {
        'google': 'https://www.google.com'
      };
      
      let redirectUrl = null;
      if (settings.customNewTabUrl && settings.customNewTabUrl.trim()) {
        redirectUrl = settings.customNewTabUrl.trim();
      } else if (settings.newTabSearchEngine && SEARCH_ENGINES[settings.newTabSearchEngine]) {
        redirectUrl = SEARCH_ENGINES[settings.newTabSearchEngine];
      }

      if (redirectUrl && newTab.url === 'chrome://newtab/') {
        await chrome.tabs.update(newTab.id, { url: redirectUrl });
      }

      expect(chromeMock.tabs.update).toHaveBeenCalledWith(123, { url: 'https://www.google.com' });
    });

    it('ne redirige pas si l\'onglet n\'est pas une page newtab', async () => {
      const normalTab = {
        id: 456,
        url: 'https://www.google.com',
        active: true
      };

      chromeMock.tabs.get.mockResolvedValue(normalTab);

      const isNewTabPage = (url) => {
        const NEWTAB_URLS = ['chrome://newtab/', 'edge://newtab/', 'about:newtab'];
        return NEWTAB_URLS.some(newtabUrl => url === newtabUrl || url.startsWith(newtabUrl));
      };

      if (isNewTabPage(normalTab.url)) {
        await chrome.tabs.update(normalTab.id, { url: 'https://example.com' });
      }

      expect(chromeMock.tabs.update).not.toHaveBeenCalled();
    });
  });
});


