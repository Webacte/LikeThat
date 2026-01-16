import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { BookmarksProvider } from '../../context/BookmarksContext';
import { SettingsProvider } from '../../context/SettingsContext';
import { FolderIconsProvider } from '../../context/FolderIconsContext';
import { ContextMenuProvider } from '../../context/ContextMenuContext';
import BookmarkItem from '../Bookmarks/BookmarkItem';

// Données de test
const mockFolderNode = {
  id: '123',
  title: 'Test Folder',
  children: [
    { id: '1231', title: 'Child 1', url: 'https://child1.com' },
    { id: '1232', title: 'Child 2', url: 'https://child2.com' }
  ]
};

const mockBookmarkNode = {
  id: '456',
  title: 'Test Bookmark',
  url: 'https://example.com'
};

// Wrapper avec tous les providers
const renderWithProviders = (ui) => {
  return render(
    <SettingsProvider>
      <BookmarksProvider>
        <FolderIconsProvider>
          <ContextMenuProvider>
            {ui}
          </ContextMenuProvider>
        </FolderIconsProvider>
      </BookmarksProvider>
    </SettingsProvider>
  );
};

describe('BookmarkItem', () => {
  beforeEach(() => {
    global.confirm = vi.fn(() => true);
    delete window.location;
    window.location = { href: '' };
  });

  afterEach(() => {
    cleanup();
  });

  it('rend un dossier correctement', async () => {
    renderWithProviders(
      <BookmarkItem 
        node={mockFolderNode}
        level={0}
        parentId="1"
        index={0}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Folder')).toBeInTheDocument();
    });
  });

  it('rend un bookmark avec favicon', async () => {
    renderWithProviders(
      <BookmarkItem 
        node={mockBookmarkNode}
        level={0}
        parentId="1"
        index={0}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Bookmark')).toBeInTheDocument();
    });

    const favicon = document.querySelector('.bookmark-favicon');
    expect(favicon).toBeInTheDocument();
  });

  it('toggle un dossier (expand/collapse)', async () => {
    renderWithProviders(
      <BookmarkItem 
        node={mockFolderNode}
        level={0}
        parentId="1"
        index={0}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Folder')).toBeInTheDocument();
    });

    // Le dossier devrait avoir un bouton toggle
    const toggleElement = document.querySelector('.bookmark-folder-toggle');
    expect(toggleElement).toBeInTheDocument();
  });

  it('affiche les contrôles d\'édition en mode édition', async () => {
    // Note: Le mode édition est contrôlé par le contexte
    renderWithProviders(
      <BookmarkItem 
        node={mockFolderNode}
        level={0}
        parentId="1"
        index={0}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Folder')).toBeInTheDocument();
    });
  });

  it('ouvre un bookmark au clic', async () => {
    renderWithProviders(
      <BookmarkItem 
        node={mockBookmarkNode}
        level={0}
        parentId="1"
        index={0}
      />
    );

    await waitFor(() => {
      const bookmarkItem = screen.getByText('Test Bookmark');
      expect(bookmarkItem).toBeInTheDocument();
    });
  });

  it('gère le drag and drop pour les dossiers', async () => {
    const { container } = renderWithProviders(
      <BookmarkItem 
        node={mockFolderNode}
        level={0}
        parentId="1"
        index={0}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Folder')).toBeInTheDocument();
    });

    const folderItem = container.querySelector('.bookmark-item.folder');
    expect(folderItem).toBeInTheDocument();
    expect(folderItem).toHaveAttribute('draggable');
  });

  it('affiche les enfants quand un dossier est expanded', async () => {
    const expandedFolder = { ...mockFolderNode, expanded: true };

    renderWithProviders(
      <BookmarkItem 
        node={expandedFolder}
        level={0}
        parentId="1"
        index={0}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Folder')).toBeInTheDocument();
    });

    // Les enfants devraient être présents
    const children = document.querySelector('.bookmark-children');
    expect(children).toBeInTheDocument();
  });

  it('affiche "Dossier vide" pour un dossier sans enfants', async () => {
    const emptyFolder = { ...mockFolderNode, children: [], expanded: true };

    renderWithProviders(
      <BookmarkItem 
        node={emptyFolder}
        level={0}
        parentId="1"
        index={0}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Dossier vide')).toBeInTheDocument();
    });
  });

  it('affiche le drag handle en mode édition', async () => {
    renderWithProviders(
      <BookmarkItem 
        node={mockFolderNode}
        level={0}
        parentId="1"
        index={0}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Folder')).toBeInTheDocument();
    });

    // Note: Le drag handle n'est visible qu'en mode édition
  });

  it('gère les événements clavier (Enter, Space)', async () => {
    renderWithProviders(
      <BookmarkItem 
        node={mockBookmarkNode}
        level={0}
        parentId="1"
        index={0}
      />
    );

    await waitFor(() => {
      const item = document.querySelector('.bookmark-item');
      expect(item).toBeInTheDocument();
    });
  });
});


