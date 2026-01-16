import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import BookmarkBar from '../../components/Bookmarks/BookmarkBar';
import { BookmarksProvider } from '../../context/BookmarksContext';
import { SettingsProvider } from '../../context/SettingsContext';
import { FolderIconsProvider } from '../../context/FolderIconsContext';

// Mock chrome API complet
global.chrome = {
  runtime: {
    sendMessage: vi.fn((message, callback) => {
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

// Mock sessionStorage
let sessionStore = {};

const setupSessionStorageMock = () => {
  sessionStore = {};
  
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
    console.log(`[STORAGE] GET '${key}':`, sessionStore[key] ? 'EXISTS' : 'NULL');
    return sessionStore[key] || null;
  });
  
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
    const parsed = JSON.parse(value);
    console.log(`[STORAGE] SET '${key}': folderId=${parsed.folderId}, isOpen=${parsed.isOpen}`);
    sessionStore[key] = value;
  });
  
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
    console.log(`[STORAGE] REMOVE '${key}'`);
    delete sessionStore[key];
  });
};

// Mock bookmarks avec plusieurs dossiers
const mockBookmarks = {
  id: '1',
  title: 'Barre de favoris',
  children: [
    {
      id: 'folder1',
      title: 'Dossier 1',
      children: [
        { id: 'f1_link1', title: 'Lien 1-1', url: 'https://example1.com' },
        { id: 'f1_link2', title: 'Lien 1-2', url: 'https://example2.com' }
      ]
    },
    {
      id: 'folder2',
      title: 'Dossier 2',
      children: [
        { id: 'f2_link1', title: 'Lien 2-1', url: 'https://test1.com' },
        { id: 'f2_link2', title: 'Lien 2-2', url: 'https://test2.com' }
      ]
    },
    {
      id: 'folder3',
      title: 'Dossier 3',
      children: [
        { id: 'f3_link1', title: 'Lien 3-1', url: 'https://demo1.com' }
      ]
    }
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

describe('Test Réaliste : Toggle de Tooltip avec Plusieurs Dossiers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSessionStorageMock();
    console.log('\n==================== DÉBUT DU TEST ====================');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    console.log('==================== FIN DU TEST ====================\n');
  });

  it('SCÉNARIO COMPLET : Ouvrir Dossier 1, fermer, ouvrir Dossier 2, re-cliquer Dossier 2', async () => {
    console.log('[TEST] Rendu de la BookmarkBar avec 3 dossiers');
    
    render(
      <TestWrapper>
        <BookmarkBar bookmarks={mockBookmarks} />
      </TestWrapper>
    );

    // Trouver les 3 boutons de dossiers
    const folder1Button = screen.getByTitle('Dossier 1');
    const folder2Button = screen.getByTitle('Dossier 2');
    const folder3Button = screen.getByTitle('Dossier 3');
    
    console.log('[TEST] ✓ 3 boutons de dossiers trouvés\n');

    // === ÉTAPE 1 : Ouvrir Dossier 1 ===
    console.log('[ÉTAPE 1] Clic sur Dossier 1 pour OUVRIR');
    fireEvent.mouseDown(folder1Button);

    await waitFor(() => {
      const tooltips = document.querySelectorAll('.folder-tooltip');
      console.log(`[ÉTAPE 1] Tooltips ouverts: ${tooltips.length}`);
      expect(tooltips.length).toBe(1);
    }, { timeout: 2000 });

    let closeButtons = document.querySelectorAll('.tooltip-close-btn');
    console.log(`[ÉTAPE 1] ✓ Dossier 1 ouvert - Boutons fermer: ${closeButtons.length}\n`);

    // === ÉTAPE 2 : Fermer Dossier 1 ===
    console.log('[ÉTAPE 2] Re-clic sur Dossier 1 pour FERMER');
    fireEvent.mouseDown(folder1Button);

    await waitFor(() => {
      const tooltips = document.querySelectorAll('.folder-tooltip');
      console.log(`[ÉTAPE 2] Tooltips ouverts: ${tooltips.length}`);
      expect(tooltips.length).toBe(0);
    });

    console.log(`[ÉTAPE 2] ✓ Dossier 1 fermé\n`);

    // Attendre pour détecter une réouverture
    await new Promise(resolve => setTimeout(resolve, 500));

    let tooltipsAfterWait = document.querySelectorAll('.folder-tooltip');
    console.log(`[ÉTAPE 2] Tooltips après 500ms: ${tooltipsAfterWait.length}`);
    expect(tooltipsAfterWait.length).toBe(0);
    console.log('[ÉTAPE 2] ✅ Pas de réouverture détectée\n');

    // === ÉTAPE 3 : Ouvrir Dossier 2 ===
    console.log('[ÉTAPE 3] Clic sur Dossier 2 pour OUVRIR');
    fireEvent.mouseDown(folder2Button);

    await waitFor(() => {
      const tooltips = document.querySelectorAll('.folder-tooltip');
      console.log(`[ÉTAPE 3] Tooltips ouverts: ${tooltips.length}`);
      expect(tooltips.length).toBe(1);
    }, { timeout: 2000 });

    // Vérifier que c'est bien le Dossier 2
    await waitFor(() => {
      expect(screen.getByText('Lien 2-1')).toBeInTheDocument();
    }, { timeout: 2000 });

    console.log('[ÉTAPE 3] ✓ Dossier 2 ouvert avec le bon contenu\n');

    // === ÉTAPE 4 : Re-cliquer sur Dossier 2 (TEST CRITIQUE) ===
    console.log('[ÉTAPE 4 - CRITIQUE] Re-clic sur Dossier 2 pour FERMER');
    console.log('[ÉTAPE 4] SessionStorage avant fermeture:', sessionStore['likethat-tooltip-state'] ? 'EXISTS' : 'NULL');
    
    fireEvent.mouseDown(folder2Button);

    // Vérifier la fermeture
    await waitFor(() => {
      const tooltips = document.querySelectorAll('.folder-tooltip');
      console.log(`[ÉTAPE 4] Tooltips après clic: ${tooltips.length}`);
      expect(tooltips.length).toBe(0);
    }, { timeout: 2000 });

    console.log('[ÉTAPE 4] ✓ Dossier 2 fermé');
    console.log('[ÉTAPE 4] SessionStorage après fermeture:', sessionStore['likethat-tooltip-state'] ? 'EXISTS' : 'NULL');

    // Attendre 1.5 secondes pour détecter toute réouverture
    console.log('[ÉTAPE 4] Attente de 1500ms pour détecter une réouverture...');
    await new Promise(resolve => setTimeout(resolve, 100));

    // Vérification finale
    const tooltipsFinal = document.querySelectorAll('.folder-tooltip');
    const closeButtonsFinal = document.querySelectorAll('.tooltip-close-btn');
    
    console.log('\n[VÉRIFICATION FINALE]');
    console.log(`  - Tooltips présents: ${tooltipsFinal.length}`);
    console.log(`  - Boutons fermer: ${closeButtonsFinal.length}`);
    console.log(`  - SessionStorage: ${sessionStore['likethat-tooltip-state'] ? 'EXISTS (BUG!)' : 'NULL (OK)'}`);

    expect(tooltipsFinal.length).toBe(0);
    expect(closeButtonsFinal.length).toBe(0);

    console.log('\n✅✅✅ TEST RÉUSSI : Aucune réouverture détectée ! ✅✅✅');
  });

  it('SCÉNARIO : Alterner rapidement entre plusieurs dossiers', async () => {
    console.log('[TEST] Test d\'alternance rapide entre dossiers');
    
    render(
      <TestWrapper>
        <BookmarkBar bookmarks={mockBookmarks} />
      </TestWrapper>
    );

    const folder1Button = screen.getByTitle('Dossier 1');
    const folder2Button = screen.getByTitle('Dossier 2');
    const folder3Button = screen.getByTitle('Dossier 3');

    // Ouvrir Dossier 1
    console.log('[1] Ouvrir Dossier 1');
    fireEvent.mouseDown(folder1Button);
    await waitFor(() => expect(document.querySelectorAll('.folder-tooltip').length).toBe(1));

    // Fermer Dossier 1
    console.log('[2] Fermer Dossier 1');
    fireEvent.mouseDown(folder1Button);
    await waitFor(() => expect(document.querySelectorAll('.folder-tooltip').length).toBe(0));

    // Ouvrir Dossier 2
    console.log('[3] Ouvrir Dossier 2');
    fireEvent.mouseDown(folder2Button);
    await waitFor(() => expect(document.querySelectorAll('.folder-tooltip').length).toBe(1));

    // Fermer Dossier 2
    console.log('[4] Fermer Dossier 2');
    fireEvent.mouseDown(folder2Button);
    await waitFor(() => expect(document.querySelectorAll('.folder-tooltip').length).toBe(0));

    // Ouvrir Dossier 3
    console.log('[5] Ouvrir Dossier 3');
    fireEvent.mouseDown(folder3Button);
    await waitFor(() => expect(document.querySelectorAll('.folder-tooltip').length).toBe(1));

    // Re-cliquer sur Dossier 3
    console.log('[6] Re-cliquer Dossier 3');
    fireEvent.mouseDown(folder3Button);
    await waitFor(() => expect(document.querySelectorAll('.folder-tooltip').length).toBe(0));

    // Attendre pour détecter toute réouverture
    await new Promise(resolve => setTimeout(resolve, 100));

    const finalTooltips = document.querySelectorAll('.folder-tooltip');
    console.log(`[FINAL] Tooltips présents: ${finalTooltips.length}`);
    expect(finalTooltips.length).toBe(0);

    console.log('✅ Alternance rapide OK - Pas de réouverture');
  });
});


