import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import BookmarkBarFolder from '../../components/Bookmarks/BookmarkBarFolder';
import { BookmarksProvider } from '../../context/BookmarksContext';
import { SettingsProvider } from '../../context/SettingsContext';
import { FolderIconsProvider } from '../../context/FolderIconsContext';

// Mock chrome API complet
global.chrome = {
  runtime: {
    sendMessage: vi.fn((message, callback) => {
      // Mock des réponses
      const response = { success: true, data: {} };
      if (callback) callback(response);
      return Promise.resolve(response);
    }),
    getURL: vi.fn((path) => `/assets/${path}`),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  },
  storage: {
    sync: {
      get: vi.fn((keys, callback) => {
        const result = {
          panelPosition: 'left',
          panelWidth: 300,
          theme: 'ocean',
          iconSize: 16,
          bookmarksBarPosition: 'bottom'
        };
        if (callback) callback(result);
        return Promise.resolve(result);
      }),
      set: vi.fn()
    },
    local: {
      get: vi.fn((keys, callback) => {
        const result = { folderIcons: {} };
        if (callback) callback(result);
        return Promise.resolve(result);
      }),
      set: vi.fn()
    }
  },
  bookmarks: {
    onCreated: {
      addListener: vi.fn()
    },
    onRemoved: {
      addListener: vi.fn()
    },
    onChanged: {
      addListener: vi.fn()
    },
    onMoved: {
      addListener: vi.fn()
    }
  }
};

// Mock sessionStorage avec spies
let sessionStore = {};

const setupSessionStorageMock = () => {
  sessionStore = {};
  
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
    console.log(`[TEST] sessionStorage.getItem('${key}'):`, sessionStore[key]);
    return sessionStore[key] || null;
  });
  
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
    console.log(`[TEST] sessionStorage.setItem('${key}'):`, value);
    sessionStore[key] = value;
  });
  
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
    console.log(`[TEST] sessionStorage.removeItem('${key}')`);
    delete sessionStore[key];
  });
};

const mockFolder = {
  id: '21',
  title: 'Dossier Test',
  children: [
    { id: '211', title: 'Site 1', url: 'https://example.com' },
    { id: '212', title: 'Site 2', url: 'https://test.com' }
  ]
};

const TestWrapper = ({ children }) => (
  <SettingsProvider>
    <BookmarksProvider>
      <FolderIconsProvider>
        {children}
      </FolderIconsProvider>
    </BookmarksProvider>
  </SettingsProvider>
);

describe('Bug : Tooltip se ferme et se rouvre en boucle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSessionStorageMock();
    console.log('\n========== DÉBUT DU TEST ==========');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    console.log('========== FIN DU TEST ==========\n');
  });

  it('devrait fermer le tooltip sans le rouvrir au second clic', async () => {
    console.log('[TEST] Étape 1 : Rendu du composant');
    
    render(
      <TestWrapper>
        <BookmarkBarFolder folder={mockFolder} parentId="2" index={0} />
      </TestWrapper>
    );

    const folderButton = screen.getByTitle('Dossier Test');
    console.log('[TEST] Bouton dossier trouvé');

    // Premier clic - Ouvrir le tooltip
    console.log('\n[TEST] Étape 2 : Premier clic pour OUVRIR le tooltip');
    fireEvent.mouseDown(folderButton);

    // Attendre que le tooltip soit visible
    await waitFor(() => {
      const closeButton = document.querySelector('.tooltip-close-btn');
      console.log('[TEST] Bouton fermer trouvé:', closeButton !== null);
      expect(closeButton).toBeInTheDocument();
    }, { timeout: 2000 });

    console.log('[TEST] Tooltip ouvert avec succès');

    // Second clic - Fermer le tooltip
    console.log('\n[TEST] Étape 3 : Second clic pour FERMER le tooltip');
    fireEvent.mouseDown(folderButton);

    // Vérifier que le tooltip se ferme
    await waitFor(() => {
      const closeButton = document.querySelector('.tooltip-close-btn');
      console.log('[TEST] Bouton fermer après fermeture:', closeButton !== null ? 'PRÉSENT' : 'absent');
      expect(closeButton).not.toBeInTheDocument();
    }, { timeout: 2000 });

    console.log('[TEST] Tooltip fermé avec succès');

    // Attendre plusieurs cycles de render pour détecter une réouverture
    console.log('\n[TEST] Étape 4 : Attente de 1000ms pour détecter une réouverture');
    await new Promise(resolve => setTimeout(resolve, 100));

    // Vérifier que le tooltip est toujours fermé
    const closeButtonFinal = document.querySelector('.tooltip-close-btn');
    console.log('[TEST] Bouton fermer après attente:', closeButtonFinal !== null ? '🔴 PRÉSENT (BUG!)' : '✅ absent (OK)');
    
    // Le bouton fermer ne devrait toujours pas être présent
    expect(closeButtonFinal).not.toBeInTheDocument();
    
    console.log('[TEST] ✅ Le tooltip est resté fermé - pas de réouverture !');
  });

  it('devrait ouvrir le tooltip au premier clic', async () => {
    console.log('[TEST] Test simple : ouvrir le tooltip');
    
    render(
      <TestWrapper>
        <BookmarkBarFolder folder={mockFolder} parentId="2" index={0} />
      </TestWrapper>
    );

    const folderButton = screen.getByTitle('Dossier Test');
    
    fireEvent.mouseDown(folderButton);

    await waitFor(() => {
      const closeButton = document.querySelector('.tooltip-close-btn');
      expect(closeButton).toBeInTheDocument();
    }, { timeout: 2000 });

    console.log('[TEST] ✅ Tooltip ouvert correctement');
  });

  it('devrait détecter les boucles de re-render', async () => {
    console.log('[TEST] Test de détection de boucles');
    
    let renderCount = 0;
    const RenderCounter = () => {
      renderCount++;
      console.log(`[TEST] Render #${renderCount}`);
      return null;
    };

    render(
      <TestWrapper>
        <RenderCounter />
        <BookmarkBarFolder folder={mockFolder} parentId="2" index={0} />
      </TestWrapper>
    );

    const initialRenderCount = renderCount;
    console.log(`[TEST] Nombre de renders initiaux: ${initialRenderCount}`);

    const folderButton = screen.getByTitle('Dossier Test');
    
    // Ouvrir
    fireEvent.mouseDown(folderButton);
    
    await waitFor(() => {
      const closeButton = document.querySelector('.tooltip-close-btn');
      expect(closeButton).toBeInTheDocument();
    }, { timeout: 2000 });

    const renderAfterOpen = renderCount;
    console.log(`[TEST] Renders après ouverture: ${renderAfterOpen - initialRenderCount}`);

    // Fermer
    fireEvent.mouseDown(folderButton);

    await waitFor(() => {
      const closeButton = document.querySelector('.tooltip-close-btn');
      expect(closeButton).not.toBeInTheDocument();
    }, { timeout: 2000 });

    const renderAfterClose = renderCount;
    
    // Attendre pour détecter des re-renders supplémentaires
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const renderAfterWait = renderCount;
    const rendersAfterClose = renderAfterWait - renderAfterClose;
    console.log(`[TEST] Renders après fermeture et attente: ${rendersAfterClose}`);

    // Ne devrait pas y avoir de renders supplémentaires (boucle)
    expect(rendersAfterClose).toBeLessThan(3);
    
    console.log('[TEST] ✅ Pas de boucle de re-render détectée');
  });
});


