import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import FolderSelectorTooltip from '../Bookmarks/FolderSelectorTooltip';
import { BookmarksProvider } from '../../context/BookmarksContext';
import { SettingsProvider } from '../../context/SettingsContext';
import { FolderIconsProvider } from '../../context/FolderIconsContext';

// Définir mockBookmarks avant son utilisation dans le mock chrome
const mockBookmarks = {
  id: '0',
  children: [
    {
      id: '1',
      title: 'Barre de favoris',
      children: []
    },
    {
      id: '2',
      title: 'Autres favoris',
      children: [
        {
          id: '21',
          title: 'Dossier Test',
          children: []
        },
        {
          id: '22',
          title: 'Dossier 2',
          children: [
            {
              id: '221',
              title: 'Sous-dossier',
              children: []
            }
          ]
        }
      ]
    }
  ]
};

// Mock chrome API
global.chrome = {
  runtime: {
    sendMessage: vi.fn((message, callback) => {
      const response = { success: true, data: {} };
      if (callback && typeof callback === 'function') {
        queueMicrotask(() => callback(response));
      }
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
      get: vi.fn().mockResolvedValue({})
    },
    local: {
      get: vi.fn().mockResolvedValue({ folderIcons: {} }),
      set: vi.fn().mockResolvedValue(undefined)
    }
  },
  bookmarks: {
    getTree: vi.fn().mockResolvedValue([mockBookmarks]),
    onCreated: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    onRemoved: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    onMoved: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  }
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

describe('FolderSelectorTooltip', () => {
  const mockOnClose = vi.fn();
  const mockOnSelectFolder = vi.fn();
  const mockTabData = { url: 'https://example.com', title: 'Test Tab' };
  const defaultPosition = { top: 100, left: 200 };

  beforeEach(() => {
    vi.clearAllMocks();
    // Réinitialiser le mock sendMessage
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      const response = { success: true, data: {} };
      if (callback && typeof callback === 'function') {
        queueMicrotask(() => callback(response));
      }
      return Promise.resolve(response);
    });
    // Réinitialiser le mock getTree
    chrome.bookmarks.getTree.mockResolvedValue([mockBookmarks]);
  });

  it('affiche le tooltip avec le dossier racine', async () => {
    render(
      <TestWrapper>
        <FolderSelectorTooltip
          position={defaultPosition}
          onClose={mockOnClose}
          onSelectFolder={mockOnSelectFolder}
          tabData={mockTabData}
          isMultipleTabs={false}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Autres favoris')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('affiche l\'option "Ajouter ici"', async () => {
    render(
      <TestWrapper>
        <FolderSelectorTooltip
          position={defaultPosition}
          onClose={mockOnClose}
          onSelectFolder={mockOnSelectFolder}
          tabData={mockTabData}
          isMultipleTabs={false}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/Ajouter ici/)).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('affiche le nombre d\'onglets pour les onglets multiples', async () => {
    const multipleTabs = [mockTabData, mockTabData];
    
    render(
      <TestWrapper>
        <FolderSelectorTooltip
          position={defaultPosition}
          onClose={mockOnClose}
          onSelectFolder={mockOnSelectFolder}
          tabData={multipleTabs}
          isMultipleTabs={true}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/2 onglets/)).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('ferme le tooltip au clic sur le bouton fermer', async () => {
    render(
      <TestWrapper>
        <FolderSelectorTooltip
          position={defaultPosition}
          onClose={mockOnClose}
          onSelectFolder={mockOnSelectFolder}
          tabData={mockTabData}
          isMultipleTabs={false}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      const closeButton = screen.getByTitle('Fermer');
      expect(closeButton).toBeInTheDocument();
    }, { timeout: 5000 });

    const closeButton = screen.getByTitle('Fermer');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('affiche le formulaire de création de dossier au clic', async () => {
    render(
      <TestWrapper>
        <FolderSelectorTooltip
          position={defaultPosition}
          onClose={mockOnClose}
          onSelectFolder={mockOnSelectFolder}
          tabData={mockTabData}
          isMultipleTabs={false}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      const newFolderButton = screen.getByText('📁 Nouveau dossier');
      expect(newFolderButton).toBeInTheDocument();
    }, { timeout: 5000 });

    const newFolderButton = screen.getByText('📁 Nouveau dossier');
    fireEvent.click(newFolderButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Nom du nouveau dossier')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('valide le nom du dossier avec Entrée', async () => {
    chrome.runtime.sendMessage.mockImplementationOnce((message, callback) => {
      if (callback && typeof callback === 'function') {
        queueMicrotask(() => callback({ success: true }));
      }
      return Promise.resolve({ success: true });
    });

    render(
      <TestWrapper>
        <FolderSelectorTooltip
          position={defaultPosition}
          onClose={mockOnClose}
          onSelectFolder={mockOnSelectFolder}
          tabData={mockTabData}
          isMultipleTabs={false}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      const newFolderButton = screen.getByText('📁 Nouveau dossier');
      expect(newFolderButton).toBeInTheDocument();
    }, { timeout: 5000 });

    const newFolderButton = screen.getByText('📁 Nouveau dossier');
    fireEvent.click(newFolderButton);

    const input = await screen.findByPlaceholderText('Nom du nouveau dossier');
    fireEvent.change(input, { target: { value: 'Nouveau Dossier' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'createBookmark',
          data: expect.objectContaining({
            title: 'Nouveau Dossier'
          })
        }),
        expect.any(Function)
      );
    }, { timeout: 2000 });
  });

  it('annule la création de dossier avec Échap', async () => {
    render(
      <TestWrapper>
        <FolderSelectorTooltip
          position={defaultPosition}
          onClose={mockOnClose}
          onSelectFolder={mockOnSelectFolder}
          tabData={mockTabData}
          isMultipleTabs={false}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      const newFolderButton = screen.getByText('📁 Nouveau dossier');
      expect(newFolderButton).toBeInTheDocument();
    }, { timeout: 5000 });

    const newFolderButton = screen.getByText('📁 Nouveau dossier');
    fireEvent.click(newFolderButton);

    const input = await screen.findByPlaceholderText('Nom du nouveau dossier');
    fireEvent.change(input, { target: { value: 'Test' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Nom du nouveau dossier')).not.toBeInTheDocument();
    }, { timeout: 2000 });
  });
});

