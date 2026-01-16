import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import BookmarkBarFolder from '../../components/Bookmarks/BookmarkBarFolder';
import { BookmarksProvider } from '../../context/BookmarksContext';
import { SettingsProvider } from '../../context/SettingsContext';
import { FolderIconsProvider } from '../../context/FolderIconsContext';
import { ContextMenuProvider } from '../../context/ContextMenuContext';

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
    getTree: vi.fn().mockResolvedValue([]),
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
        <ContextMenuProvider>
          {children}
        </ContextMenuProvider>
      </FolderIconsProvider>
    </BookmarksProvider>
  </SettingsProvider>
);

describe('Renommer le dossier parent depuis le tooltip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Réinitialiser le mock par défaut
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      const response = { success: true, data: {} };
      if (callback && typeof callback === 'function') {
        queueMicrotask(() => callback(response));
      }
      return Promise.resolve(response);
    });
  });

  it('ouvre le tooltip au clic sur le dossier', async () => {
    render(
      <TestWrapper>
        <BookmarkBarFolder folder={mockFolder} parentId="2" index={0} />
      </TestWrapper>
    );

    const folderButton = screen.getByTitle('Dossier Test');
    fireEvent.mouseDown(folderButton);

    await waitFor(() => {
      const tooltip = document.querySelector('.folder-tooltip');
      expect(tooltip).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('affiche le bouton de renommage dans le header', async () => {
    render(
      <TestWrapper>
        <BookmarkBarFolder folder={mockFolder} parentId="2" index={0} />
      </TestWrapper>
    );

    const folderButton = screen.getByTitle('Dossier Test');
    fireEvent.mouseDown(folderButton);

    await waitFor(() => {
      const tooltip = document.querySelector('.folder-tooltip');
      expect(tooltip).toBeInTheDocument();
      const renameButton = screen.getByTitle('Renommer le dossier');
      expect(renameButton).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('passe en mode édition au clic sur le bouton renommer', async () => {
    render(
      <TestWrapper>
        <BookmarkBarFolder folder={mockFolder} parentId="2" index={0} />
      </TestWrapper>
    );

    const folderButton = screen.getByTitle('Dossier Test');
    fireEvent.mouseDown(folderButton);

    await waitFor(() => {
      const tooltip = document.querySelector('.folder-tooltip');
      expect(tooltip).toBeInTheDocument();
    }, { timeout: 2000 });

    const renameButton = await screen.findByTitle('Renommer le dossier');
    fireEvent.mouseDown(renameButton);
    
    await waitFor(() => {
      const input = screen.getByDisplayValue('Dossier Test');
      expect(input).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('valide le renommage avec Entrée', async () => {
    chrome.runtime.sendMessage.mockImplementationOnce((message, callback) => {
      if (message.action === 'updateBookmark') {
        if (callback && typeof callback === 'function') {
          queueMicrotask(() => callback({ success: true }));
        }
        return Promise.resolve({ success: true });
      }
      const response = { success: true, data: {} };
      if (callback && typeof callback === 'function') {
        queueMicrotask(() => callback(response));
      }
      return Promise.resolve(response);
    });

    render(
      <TestWrapper>
        <BookmarkBarFolder folder={mockFolder} parentId="2" index={0} />
      </TestWrapper>
    );

    const folderButton = screen.getByTitle('Dossier Test');
    fireEvent.mouseDown(folderButton);

    await waitFor(() => {
      const tooltip = document.querySelector('.folder-tooltip');
      expect(tooltip).toBeInTheDocument();
    }, { timeout: 2000 });

    const renameButton = await screen.findByTitle('Renommer le dossier');
    fireEvent.mouseDown(renameButton);

    const input = await screen.findByDisplayValue('Dossier Test');
    fireEvent.change(input, { target: { value: 'Nouveau Nom' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updateBookmark',
          data: expect.objectContaining({
            bookmarkId: '21',
            changes: { title: 'Nouveau Nom' }
          })
        }),
        expect.any(Function)
      );
    }, { timeout: 3000 });
  });

  it('annule le renommage avec Échap', async () => {
    render(
      <TestWrapper>
        <BookmarkBarFolder folder={mockFolder} parentId="2" index={0} />
      </TestWrapper>
    );

    const folderButton = screen.getByTitle('Dossier Test');
    fireEvent.mouseDown(folderButton);

    await waitFor(() => {
      const tooltip = document.querySelector('.folder-tooltip');
      expect(tooltip).toBeInTheDocument();
    }, { timeout: 2000 });

    const renameButton = await screen.findByTitle('Renommer le dossier');
    fireEvent.mouseDown(renameButton);

    const input = await screen.findByDisplayValue('Dossier Test');
    fireEvent.change(input, { target: { value: 'Nouveau Nom' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByDisplayValue('Nouveau Nom')).not.toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('affiche les boutons valider et annuler pendant l\'édition', async () => {
    render(
      <TestWrapper>
        <BookmarkBarFolder folder={mockFolder} parentId="2" index={0} />
      </TestWrapper>
    );

    const folderButton = screen.getByTitle('Dossier Test');
    fireEvent.mouseDown(folderButton);

    await waitFor(() => {
      const tooltip = document.querySelector('.folder-tooltip');
      expect(tooltip).toBeInTheDocument();
    }, { timeout: 2000 });

    const renameButton = await screen.findByTitle('Renommer le dossier');
    fireEvent.mouseDown(renameButton);

    await waitFor(() => {
      expect(screen.getByTitle('Valider')).toBeInTheDocument();
      expect(screen.getByTitle('Annuler')).toBeInTheDocument();
    }, { timeout: 2000 });
  });
});

