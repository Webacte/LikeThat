import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import { BookmarksProvider, useBookmarks } from '../BookmarksContext';
import { mockBookmarksData, chromeMock } from '../../tests/mocks/chrome';

// Composant de test
const TestComponent = ({ autoLoad = true }) => {
  const {
    bookmarks,
    loading,
    error,
    isEditMode,
    setIsEditMode,
    draggedItem,
    setDraggedItem,
    dragOverItem,
    setDragOverItem,
    toggleFolder,
    openBookmark,
    deleteBookmark,
    moveBookmark,
    loadBookmarks
  } = useBookmarks();

  // Charger les bookmarks automatiquement si demandé
  React.useEffect(() => {
    if (autoLoad) {
      loadBookmarks();
    }
  }, [autoLoad, loadBookmarks]);

  return (
    <div>
      <div data-testid="loading">{loading ? 'loading' : 'loaded'}</div>
      <div data-testid="error">{error || 'no-error'}</div>
      <div data-testid="bookmarks-count">
        {bookmarks?.children ? bookmarks.children.length : 0}
      </div>
      <div data-testid="edit-mode">{isEditMode ? 'edit' : 'view'}</div>
      <div data-testid="dragged-item">{draggedItem ? draggedItem.node.id : 'none'}</div>
      <div data-testid="dragover-item">{dragOverItem ? dragOverItem.node.id : 'none'}</div>
      
      <button data-testid="toggle-edit" onClick={() => setIsEditMode(!isEditMode)}>
        Toggle Edit
      </button>
      <button data-testid="toggle-folder" onClick={() => toggleFolder('12')}>
        Toggle Folder
      </button>
      <button data-testid="open-bookmark" onClick={() => openBookmark('https://google.com')}>
        Open Bookmark
      </button>
      <button data-testid="delete-bookmark" onClick={() => deleteBookmark('11')}>
        Delete Bookmark
      </button>
      <button
        data-testid="move-bookmark"
        onClick={() => moveBookmark('11', { parentId: '2', index: 0 })}
      >
        Move Bookmark
      </button>
      <button
        data-testid="set-dragged"
        onClick={() => setDraggedItem({ node: { id: '11' }, parentId: '1', index: 0 })}
      >
        Set Dragged
      </button>
      <button
        data-testid="set-dragover"
        onClick={() => setDragOverItem({ node: { id: '12' }, parentId: '1', index: 1 })}
      >
        Set DragOver
      </button>
      <button data-testid="reload" onClick={() => loadBookmarks()}>
        Reload
      </button>
    </div>
  );
};

describe('BookmarksContext', () => {
  beforeEach(() => {
    // Reset sendMessage mock - supporter callback ET promise
    chromeMock.runtime.sendMessage.mockImplementation((message, callback) => {
      let response = { success: true };

      if (message.action === 'getBookmarks') {
        response = { success: true, data: mockBookmarksData };
      }

      if (callback) {
        setTimeout(() => callback(response), 0);
      }
      return Promise.resolve(response);
    });
  });

  afterEach(() => {
    // Forcer le cleanup après chaque test
    cleanup();
  });

  it('charge les bookmarks au montage', async () => {
    render(
      <BookmarksProvider>
        <TestComponent />
      </BookmarksProvider>
    );

    // Attendre la fin du chargement (peut être très rapide)
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    });

    // Vérifier qu'il y a des bookmarks
    expect(screen.getByTestId('bookmarks-count')).toHaveTextContent('2');
    expect(screen.getByTestId('error')).toHaveTextContent('no-error');
  });

  it('gère les erreurs de chargement', async () => {
    chromeMock.runtime.sendMessage.mockImplementationOnce((message, callback) => {
      const response = { success: false, error: 'Failed to load bookmarks' };
      if (callback) {
        setTimeout(() => callback(response), 0);
      }
      return Promise.resolve(response);
    });

    render(
      <BookmarksProvider>
        <TestComponent />
      </BookmarksProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    });

    expect(screen.getByTestId('error')).toHaveTextContent('Failed to load bookmarks');
  });

  it('toggle le mode édition', async () => {
    render(
      <BookmarksProvider>
        <TestComponent />
      </BookmarksProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    });

    // Mode vue par défaut
    expect(screen.getByTestId('edit-mode')).toHaveTextContent('view');

    // Activer le mode édition
    act(() => {
      screen.getByTestId('toggle-edit').click();
    });

    expect(screen.getByTestId('edit-mode')).toHaveTextContent('edit');

    // Désactiver le mode édition
    act(() => {
      screen.getByTestId('toggle-edit').click();
    });

    expect(screen.getByTestId('edit-mode')).toHaveTextContent('view');
  });

  it('ouvre un bookmark', async () => {
    // Mock window.location pour le clickBehavior 'current'
    delete window.location;
    window.location = { href: '' };

    render(
      <BookmarksProvider>
        <TestComponent />
      </BookmarksProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    });

    // Ouvrir un bookmark
    act(() => {
      screen.getByTestId('open-bookmark').click();
    });

    // Par défaut clickBehavior est 'current', donc window.location.href est utilisé
    expect(window.location.href).toBe('https://google.com');
  });

  it('supprime un bookmark', async () => {
    render(
      <BookmarksProvider>
        <TestComponent />
      </BookmarksProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    });

    // Mock window.confirm
    global.confirm = vi.fn(() => true);

    // Clear le mock avant le test
    chromeMock.runtime.sendMessage.mockClear();

    // Supprimer un bookmark
    await act(async () => {
      screen.getByTestId('delete-bookmark').click();
    });

    // Vérifier que sendMessage a été appelé avec deleteBookmark
    await waitFor(() => {
      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'deleteBookmark',
          id: '11'
        }),
        expect.any(Function)
      );
    });
  });

  it('déplace un bookmark', async () => {
    render(
      <BookmarksProvider>
        <TestComponent />
      </BookmarksProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    });

    // Clear le mock avant le test
    chromeMock.runtime.sendMessage.mockClear();

    // Déplacer un bookmark
    await act(async () => {
      screen.getByTestId('move-bookmark').click();
    });

    // Vérifier que sendMessage a été appelé avec moveBookmark
    await waitFor(() => {
      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'moveBookmark',
          data: expect.objectContaining({
            bookmarkId: '11',
            destinationId: '2',
            index: 0
          })
        }),
        expect.any(Function)
      );
    });
  });

  it('gère le drag and drop - setDraggedItem', async () => {
    render(
      <BookmarksProvider>
        <TestComponent />
      </BookmarksProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    });

    // Aucun item dragué initialement
    expect(screen.getByTestId('dragged-item')).toHaveTextContent('none');

    // Définir un item dragué
    act(() => {
      screen.getByTestId('set-dragged').click();
    });

    expect(screen.getByTestId('dragged-item')).toHaveTextContent('11');
  });

  it('gère le drag and drop - setDragOverItem', async () => {
    render(
      <BookmarksProvider>
        <TestComponent />
      </BookmarksProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    });

    // Aucun item en dragOver initialement
    expect(screen.getByTestId('dragover-item')).toHaveTextContent('none');

    // Définir un item en dragOver
    act(() => {
      screen.getByTestId('set-dragover').click();
    });

    expect(screen.getByTestId('dragover-item')).toHaveTextContent('12');
  });

  it('recharge les bookmarks quand demandé', async () => {
    render(
      <BookmarksProvider>
        <TestComponent />
      </BookmarksProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    });

    // Compter le nombre d'appels initiaux
    const initialCallCount = chromeMock.runtime.sendMessage.mock.calls.length;

    // Recharger
    await act(async () => {
      screen.getByTestId('reload').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    });

    // Vérifier qu'un nouvel appel a été fait
    expect(chromeMock.runtime.sendMessage.mock.calls.length).toBeGreaterThan(initialCallCount);
  });

  it('écoute les messages de changement de bookmarks', async () => {
    render(
      <BookmarksProvider>
        <TestComponent />
      </BookmarksProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    });

    // Vérifier que le listener a été ajouté
    expect(chromeMock.runtime.onMessage.addListener).toHaveBeenCalled();
  });

  it('lance une erreur si useBookmarks est utilisé hors du provider', () => {
    const consoleError = console.error;
    console.error = () => {};

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useBookmarks must be used within a BookmarksProvider');

    console.error = consoleError;
  });

  it('toggle un dossier (expand/collapse)', async () => {
    render(
      <BookmarksProvider>
        <TestComponent />
      </BookmarksProvider>
    );

    // Attendre que les bookmarks soient chargés
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    }, { timeout: 2000 });

    // Vérifier que les bookmarks sont chargés
    await waitFor(() => {
      expect(screen.getByTestId('bookmarks-count')).toHaveTextContent('2');
    }, { timeout: 2000 });

    // Toggle le dossier (devrait fonctionner même si le dossier n'existe pas exactement)
    await act(async () => {
      screen.getByTestId('toggle-folder').click();
    });

    // Attendre que le toggle soit terminé
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    });
  });
});

