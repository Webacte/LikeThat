import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FolderIconsProvider } from '../../context/FolderIconsContext';
import BookmarkList from '../Bookmarks/BookmarkList';

const toggleFolderMock = vi.fn();
const openBookmarkMock = vi.fn();

vi.mock('../../context/BookmarksContext', () => ({
  useBookmarks: () => ({
    moveBookmark: vi.fn(),
    draggedItem: null,
    setDraggedItem: vi.fn(),
    setDragOverItem: vi.fn(),
    isEditMode: false,
    toggleFolder: toggleFolderMock,
    openBookmark: openBookmarkMock
  })
}));

vi.mock('../../context/SettingsContext', () => ({
  useSettings: () => ({
    settings: {
      bookmarksBarPosition: 'bottom',
      panelPosition: 'left'
    }
  })
}));

// Mock chrome API pour FolderIconsProvider
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
    local: {
      get: vi.fn().mockResolvedValue({ folderIcons: {} }),
      set: vi.fn().mockResolvedValue(undefined)
    }
  }
};

let defaultSendMessage = null;

const bookmarksFixture = {
  children: [
    { id: '1', title: 'Barre de favoris', children: [] },
    {
      id: '2',
      title: 'Autres favoris',
      children: [
        {
          id: 'folder-docs',
          title: 'Docs',
          children: [
            { id: 'doc-link', title: 'Doc Chrome', url: 'https://example.com/docs' }
          ]
        },
        { id: 'direct-link', title: 'LikeThat', url: 'https://likethat.app' }
      ]
    }
  ]
};

describe('BookmarkList - recherche dynamique', () => {
  beforeEach(() => {
    toggleFolderMock.mockReset();
    openBookmarkMock.mockReset();

    defaultSendMessage =
      global.chrome?.runtime?.sendMessage?.getMockImplementation?.() || null;

    global.chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (message.action === 'getCurrentTab') {
        const response = { success: true, data: { isValid: true } };
        if (callback && typeof callback === 'function') {
          queueMicrotask(() => callback(response));
        }
        return Promise.resolve(response);
      }
      if (message.action === 'getAllTabs') {
        const response = { success: true, hasValidTabs: true, data: [{ isValid: true }] };
        if (callback && typeof callback === 'function') {
          queueMicrotask(() => callback(response));
        }
        return Promise.resolve(response);
      }
      if (defaultSendMessage) {
        return defaultSendMessage(message, callback);
      }
      const fallback = { success: true };
      if (callback && typeof callback === 'function') {
        queueMicrotask(() => callback(fallback));
      }
      return Promise.resolve(fallback);
    });
  });

  afterEach(() => {
    if (defaultSendMessage) {
      global.chrome.runtime.sendMessage.mockImplementation(defaultSendMessage);
    } else {
      global.chrome.runtime.sendMessage.mockReset();
    }
    defaultSendMessage = null;
  });

  const renderWithProviders = (ui) => {
    return render(
      <FolderIconsProvider>
        {ui}
      </FolderIconsProvider>
    );
  };

  it('filtre les favoris et ouvre un lien depuis les résultats', async () => {
    renderWithProviders(<BookmarkList bookmarks={bookmarksFixture} />);

    const searchButton = screen.getByLabelText('Rechercher dans les favoris');
    fireEvent.click(searchButton);

    const input = await screen.findByPlaceholderText('Rechercher dans vos favoris...');
    fireEvent.change(input, { target: { value: 'doc' } });

    // Attendre que les résultats de recherche soient affichés
    await waitFor(() => {
      expect(screen.getByText('Doc Chrome')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Vérifier que le dossier parent est visible (expanded)
    expect(screen.getByText('Docs')).toBeInTheDocument();

    // Cliquer sur le bookmark
    const bookmarkTitle = screen.getByText('Doc Chrome');
    fireEvent.click(bookmarkTitle);
    expect(openBookmarkMock).toHaveBeenCalledWith('https://example.com/docs');
  });

  it('déclenche toggleFolder pour un dossier et permet de fermer la recherche', async () => {
    renderWithProviders(<BookmarkList bookmarks={bookmarksFixture} />);

    fireEvent.click(screen.getByLabelText('Rechercher dans les favoris'));
    const input = await screen.findByPlaceholderText('Rechercher dans vos favoris...');
    fireEvent.change(input, { target: { value: 'docs' } });

    await waitFor(() => {
      const folderTitle = screen.getAllByText('Docs');
      expect(folderTitle.length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    const folderTitle = await screen.findAllByText('Docs');
    fireEvent.click(folderTitle[0]);
    expect(toggleFolderMock).toHaveBeenCalledWith('folder-docs');

    fireEvent.click(screen.getByLabelText('Fermer la recherche'));
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Rechercher dans vos favoris...')).not.toBeInTheDocument();
    }, { timeout: 2000 });
  });
});

