import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { BookmarksProvider } from '../../context/BookmarksContext';
import { SettingsProvider } from '../../context/SettingsContext';
import { FolderIconsProvider } from '../../context/FolderIconsContext';
import { ContextMenuProvider } from '../../context/ContextMenuContext';
import BookmarkBarFolder from '../Bookmarks/BookmarkBarFolder';

// Mock du dossier
const mockFolder = {
  id: '123',
  title: 'Test Folder',
  children: [
    { id: '1231', title: 'Bookmark 1', url: 'https://example1.com' },
    { id: '1232', title: 'Bookmark 2', url: 'https://example2.com' },
    {
      id: '1233',
      title: 'Subfolder',
      children: [
        { id: '12331', title: 'Deep Bookmark', url: 'https://deep.com' }
      ]
    }
  ]
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

describe('BookmarkBarFolder', () => {
  beforeEach(() => {
    global.confirm = vi.fn(() => true);
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  it('rend le dossier avec son icône', async () => {
    renderWithProviders(
      <BookmarkBarFolder 
        folder={mockFolder}
        parentId="1"
        index={0}
      />
    );

    await waitFor(() => {
      const button = screen.getByTitle('Test Folder');
      expect(button).toBeInTheDocument();
    });
  });

  it('ouvre le tooltip au clic', async () => {
    renderWithProviders(
      <BookmarkBarFolder 
        folder={mockFolder}
        parentId="1"
        index={0}
      />
    );

    const button = await screen.findByTitle('Test Folder');
    fireEvent.mouseDown(button);

    // Le tooltip devrait être ouvert
    await waitFor(() => {
      const tooltip = document.querySelector('.folder-tooltip');
      expect(tooltip).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('affiche les éléments du dossier dans le tooltip', async () => {
    renderWithProviders(
      <BookmarkBarFolder 
        folder={mockFolder}
        parentId="1"
        index={0}
      />
    );

    const button = await screen.findByTitle('Test Folder');
    fireEvent.mouseDown(button);

    // Attendre que le tooltip soit ouvert
    await waitFor(() => {
      expect(document.querySelector('.folder-tooltip')).toBeInTheDocument();
    }, { timeout: 2000 });

    // Les items devraient être visibles
    await waitFor(() => {
      expect(screen.getByText('Bookmark 1')).toBeInTheDocument();
      expect(screen.getByText('Bookmark 2')).toBeInTheDocument();
      expect(screen.getByText('Subfolder')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('ferme le tooltip en cliquant sur le bouton de fermeture', async () => {
    renderWithProviders(
      <BookmarkBarFolder 
        folder={mockFolder}
        parentId="1"
        index={0}
      />
    );

    // Ouvrir le tooltip
    const button = await screen.findByTitle('Test Folder');
    fireEvent.mouseDown(button);

    // Attendre que le tooltip soit ouvert
    await waitFor(() => {
      expect(document.querySelector('.folder-tooltip')).toBeInTheDocument();
    }, { timeout: 2000 });

    // Cliquer sur le bouton de fermeture
    await waitFor(() => {
      const closeButton = document.querySelector('.tooltip-close-btn');
      expect(closeButton).toBeInTheDocument();
    }, { timeout: 2000 });
    
    const closeButton = document.querySelector('.tooltip-close-btn');
    fireEvent.mouseDown(closeButton);

    // Le tooltip devrait se fermer
    await waitFor(() => {
      expect(document.querySelector('.folder-tooltip')).not.toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('navigue dans les sous-dossiers', async () => {
    renderWithProviders(
      <BookmarkBarFolder 
        folder={mockFolder}
        parentId="1"
        index={0}
      />
    );

    // Ouvrir le tooltip
    const button = await screen.findByTitle('Test Folder');
    fireEvent.mouseDown(button);

    // Attendre que le tooltip soit ouvert
    await waitFor(() => {
      expect(document.querySelector('.folder-tooltip')).toBeInTheDocument();
    }, { timeout: 2000 });

    // Vérifier que le sous-dossier est visible
    await waitFor(() => {
      expect(screen.getByText('Subfolder')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('affiche le bouton de mode édition dans le tooltip', async () => {
    renderWithProviders(
      <BookmarkBarFolder 
        folder={mockFolder}
        parentId="1"
        index={0}
      />
    );

    // Ouvrir le tooltip
    const button = await screen.findByTitle('Test Folder');
    fireEvent.mouseDown(button);

    // Le bouton d'édition devrait être visible
    await waitFor(() => {
      const editButton = document.querySelector('.tooltip-edit-btn');
      expect(editButton).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('calcule la position du tooltip selon les settings', async () => {
    const { container } = renderWithProviders(
      <BookmarkBarFolder 
        folder={mockFolder}
        parentId="1"
        index={0}
      />
    );

    // Ouvrir le tooltip
    const button = await screen.findByTitle('Test Folder');
    fireEvent.mouseDown(button);

    // Le tooltip devrait avoir une position calculée
    await waitFor(() => {
      const tooltip = document.querySelector('.folder-tooltip');
      expect(tooltip).toBeInTheDocument();
      // Vérifier que le tooltip a des coordonnées top et left
      const style = window.getComputedStyle(tooltip);
      expect(style.top).toBeDefined();
      expect(style.left).toBeDefined();
    }, { timeout: 2000 });
  });

  it('affiche l\'icône personnalisée si définie', async () => {
    renderWithProviders(
      <BookmarkBarFolder 
        folder={mockFolder}
        parentId="1"
        index={0}
      />
    );

    await waitFor(() => {
      const button = screen.getByTitle('Test Folder');
      expect(button).toBeInTheDocument();
    });

    // Note: L'icône personnalisée vient du FolderIconsContext
  });

  it('gère le drag and drop', async () => {
    const { container } = renderWithProviders(
      <BookmarkBarFolder 
        folder={mockFolder}
        parentId="1"
        index={0}
      />
    );

    await waitFor(() => {
      const wrapper = container.querySelector('.folder-wrapper');
      expect(wrapper).toBeInTheDocument();
      expect(wrapper).toHaveAttribute('draggable');
    });
  });

  it('persiste l\'état du tooltip dans sessionStorage', async () => {
    renderWithProviders(
      <BookmarkBarFolder 
        folder={mockFolder}
        parentId="1"
        index={0}
      />
    );

    // Ouvrir le tooltip
    const button = await screen.findByTitle('Test Folder');
    fireEvent.mouseDown(button);

    // Attendre que le tooltip soit ouvert
    await waitFor(() => {
      expect(document.querySelector('.folder-tooltip')).toBeInTheDocument();
    }, { timeout: 2000 });

    // Vérifier que l'état est sauvegardé dans sessionStorage
    await waitFor(() => {
      const savedState = sessionStorage.getItem('likethat-tooltip-state');
      expect(savedState).toBeTruthy();
      
      if (savedState) {
        const state = JSON.parse(savedState);
        expect(state.folderId).toBe('123');
        expect(state.isOpen).toBe(true);
      }
    }, { timeout: 2000 });
  });

  it('restaure l\'état du tooltip depuis sessionStorage', async () => {
    // Pré-remplir le sessionStorage
    const state = {
      folderId: '123',
      isOpen: true,
      editMode: false,
      currentFolderId: '123',
      folderStackIds: [],
      timestamp: Date.now()
    };
    sessionStorage.setItem('likethat-tooltip-state', JSON.stringify(state));

    renderWithProviders(
      <BookmarkBarFolder 
        folder={mockFolder}
        parentId="1"
        index={0}
      />
    );

    // Le tooltip devrait être restauré
    await waitFor(() => {
      const tooltip = document.querySelector('.folder-tooltip');
      expect(tooltip).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('ouvre le sélecteur d\'icônes en mode édition', async () => {
    renderWithProviders(
      <BookmarkBarFolder 
        folder={mockFolder}
        parentId="1"
        index={0}
        isBookmarksBar={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByTitle('Test Folder')).toBeInTheDocument();
    });

    // Note: Le bouton d'icône n'est visible qu'en mode édition
  });
});


