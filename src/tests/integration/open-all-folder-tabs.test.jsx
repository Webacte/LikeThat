import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import BookmarkItem from '../../components/Bookmarks/BookmarkItem';
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

const mockFolder = {
  id: '21',
  title: 'Dossier Test',
  children: [
    { id: '211', title: 'Site 1', url: 'https://example.com' },
    { id: '212', title: 'Site 2', url: 'https://test.com' },
    {
      id: '213',
      title: 'Sous-dossier',
      children: [
        { id: '2131', title: 'Site 3', url: 'https://demo.com' }
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

describe('Ouvrir tous les onglets d\'un dossier', () => {
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

  it('affiche le bouton "Ouvrir tous" au survol', async () => {
    render(
      <TestWrapper>
        <BookmarkItem node={mockFolder} level={1} parentId="2" index={0} />
      </TestWrapper>
    );

    const folderItem = screen.getByText('Dossier Test').closest('.bookmark-item');
    fireEvent.mouseEnter(folderItem);

    await waitFor(() => {
      const button = screen.getByTitle('Ouvrir tous les onglets');
      expect(button).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('ouvre tous les onglets récursivement', async () => {
    let openedTabs = [];
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (message.action === 'openInNewTab') {
        openedTabs.push(message.url);
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
        <BookmarkItem node={mockFolder} level={1} parentId="2" index={0} />
      </TestWrapper>
    );

    const folderItem = screen.getByText('Dossier Test').closest('.bookmark-item');
    fireEvent.mouseEnter(folderItem);

    const button = await screen.findByTitle('Ouvrir tous les onglets');
    
    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(openedTabs).toHaveLength(3);
      expect(openedTabs).toContain('https://example.com');
      expect(openedTabs).toContain('https://test.com');
      expect(openedTabs).toContain('https://demo.com');
    }, { timeout: 3000 });
  });

  it('n\'ouvre aucun onglet si le dossier est vide', async () => {
    const emptyFolder = {
      id: '22',
      title: 'Dossier Vide',
      children: []
    };

    render(
      <TestWrapper>
        <BookmarkItem node={emptyFolder} level={1} parentId="2" index={0} />
      </TestWrapper>
    );

    const folderItem = screen.getByText('Dossier Vide').closest('.bookmark-item');
    fireEvent.mouseEnter(folderItem);

    await waitFor(() => {
      const button = screen.queryByTitle('Ouvrir tous les onglets');
      expect(button).not.toBeInTheDocument();
    }, { timeout: 2000 });
  });
});

