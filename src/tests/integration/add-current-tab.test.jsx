import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import BookmarkBar from '../../components/Bookmarks/BookmarkBar';
import { BookmarksProvider } from '../../context/BookmarksContext';
import { SettingsProvider } from '../../context/SettingsContext';
import { FolderIconsProvider } from '../../context/FolderIconsContext';

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

const mockBookmarks = {
  id: '1',
  title: 'Barre de favoris',
  children: []
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

describe('Ajouter l\'onglet actuel', () => {
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

  it('affiche le bouton "Ajouter l\'onglet actuel" au survol', async () => {
    render(
      <TestWrapper>
        <BookmarkBar bookmarks={mockBookmarks} />
      </TestWrapper>
    );

    const divider = document.querySelector('.bookmarks-divider-with-controls');
    fireEvent.mouseEnter(divider);

    await waitFor(() => {
      const button = screen.getByTitle('Ajouter l\'onglet actuel');
      expect(button).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('ouvre le sélecteur de dossier au clic', async () => {
    const mockTab = { url: 'https://example.com', title: 'Test Page' };
    chrome.runtime.sendMessage.mockImplementationOnce((message, callback) => {
      if (message.action === 'getCurrentTab') {
        if (callback && typeof callback === 'function') {
          queueMicrotask(() => callback({ success: true, data: mockTab }));
        }
        return Promise.resolve({ success: true, data: mockTab });
      }
      const response = { success: true, data: {} };
      if (callback && typeof callback === 'function') {
        queueMicrotask(() => callback(response));
      }
      return Promise.resolve(response);
    });

    render(
      <TestWrapper>
        <BookmarkBar bookmarks={mockBookmarks} />
      </TestWrapper>
    );

    const divider = document.querySelector('.bookmarks-divider-with-controls');
    fireEvent.mouseEnter(divider);

    const button = await screen.findByTitle('Ajouter l\'onglet actuel');
    fireEvent.click(button);

    await waitFor(() => {
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { action: 'getCurrentTab' },
        expect.any(Function)
      );
    }, { timeout: 3000 });
  });

  it('crée un favori dans le dossier sélectionné', async () => {
    const mockTab = { url: 'https://example.com', title: 'Test Page' };
    
    let callIndex = 0;
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (message.action === 'getCurrentTab') {
        if (callback && typeof callback === 'function') {
          queueMicrotask(() => callback({ success: true, data: mockTab }));
        }
        return Promise.resolve({ success: true, data: mockTab });
      } else if (message.action === 'createBookmark') {
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
        <BookmarkBar bookmarks={mockBookmarks} />
      </TestWrapper>
    );

    // Ouvrir le sélecteur
    const divider = document.querySelector('.bookmarks-divider-with-controls');
    fireEvent.mouseEnter(divider);
    const button = await screen.findByTitle('Ajouter l\'onglet actuel');
    fireEvent.click(button);

    // Sélectionner le dossier "Ajouter ici"
    await waitFor(() => {
      const addHereButton = screen.getByText(/Ajouter ici/);
      expect(addHereButton).toBeInTheDocument();
    }, { timeout: 3000 });

    const addHereButton = screen.getByText(/Ajouter ici/);
    fireEvent.click(addHereButton);

    await waitFor(() => {
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'createBookmark',
          data: expect.objectContaining({
            url: mockTab.url,
            title: mockTab.title
          })
        }),
        expect.any(Function)
      );
    }, { timeout: 3000 });
  });
});

