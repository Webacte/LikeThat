import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { FolderIconsProvider, useFolderIcons } from '../FolderIconsContext';
import { chromeMock } from '../../tests/mocks/chrome';

// S'assurer que chrome est bien mocké
global.chrome = chromeMock;

// Composant de test pour utiliser le hook useFolderIcons
const TestComponent = () => {
  const { folderIcons, loading, setFolderIcon, removeFolderIcon, getFolderIcon } = useFolderIcons();
  
  const testIcon = getFolderIcon('12');
  
  return (
    <div>
      <div data-testid="loading">{loading ? 'loading' : 'loaded'}</div>
      <div data-testid="icons-count">{Object.keys(folderIcons).length}</div>
      <div data-testid="test-icon">{testIcon ? `${testIcon.icon}-${testIcon.color}` : 'none'}</div>
      <button 
        data-testid="set-icon" 
        onClick={() => setFolderIcon('12', 'art', 'neon-blue')}
      >
        Set Icon
      </button>
      <button
        data-testid="remove-icon"
        onClick={() => removeFolderIcon('12')}
      >
        Remove Icon
      </button>
      <button
        data-testid="set-multiple"
        onClick={() => {
          setFolderIcon('13', 'book', 'neon-green');
          setFolderIcon('14', 'cat', 'neon-red');
        }}
      >
        Set Multiple
      </button>
    </div>
  );
};

describe('FolderIconsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset chrome.storage.local avec une implémentation par défaut
    chromeMock.storage.local.get.mockImplementation((keys) => {
      const result = { folderIcons: {} };
      if (Array.isArray(keys)) {
        keys.forEach(key => {
          if (key === 'folderIcons') {
            result[key] = {};
          }
        });
      } else if (keys === 'folderIcons' || keys === null || keys === undefined) {
        result.folderIcons = {};
      }
      return Promise.resolve(result);
    });
    
    chromeMock.storage.local.set.mockImplementation((items) => {
      // Mettre à jour le mock pour que get retourne les nouvelles valeurs
      if (items.folderIcons) {
        chromeMock.storage.local.get.mockImplementation(() => {
          return Promise.resolve({ folderIcons: items.folderIcons });
        });
      }
      return Promise.resolve();
    });
  });

  it('charge les icônes vides par défaut', async () => {
    render(
      <FolderIconsProvider>
        <TestComponent />
      </FolderIconsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    }, { timeout: 3000 });

    expect(screen.getByTestId('icons-count')).toHaveTextContent('0');
    expect(screen.getByTestId('test-icon')).toHaveTextContent('none');
  });

  it('charge les icônes depuis le stockage local', async () => {
    const mockIcons = {
      '12': { icon: 'book', color: 'neon-blue' },
      '13': { icon: 'art', color: 'neon-green' }
    };

    chromeMock.storage.local.get.mockImplementationOnce((keys) => {
      const result = {};
      if (Array.isArray(keys)) {
        keys.forEach(key => {
          if (key === 'folderIcons') {
            result[key] = mockIcons;
          }
        });
      } else if (keys === 'folderIcons') {
        result.folderIcons = mockIcons;
      } else {
        result.folderIcons = mockIcons;
      }
      return Promise.resolve(result);
    });

    render(
      <FolderIconsProvider>
        <TestComponent />
      </FolderIconsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    }, { timeout: 3000 });

    await waitFor(() => {
      expect(screen.getByTestId('icons-count')).toHaveTextContent('2');
    }, { timeout: 2000 });
    
    expect(screen.getByTestId('test-icon')).toHaveTextContent('book-neon-blue');
  });

  it('définit une nouvelle icône pour un dossier', async () => {
    render(
      <FolderIconsProvider>
        <TestComponent />
      </FolderIconsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    }, { timeout: 3000 });

    // Aucune icône initialement
    expect(screen.getByTestId('test-icon')).toHaveTextContent('none');

    // Définir une icône
    await act(async () => {
      screen.getByTestId('set-icon').click();
    });

    // Attendre que l'icône soit définie
    await waitFor(() => {
      expect(screen.getByTestId('test-icon')).toHaveTextContent('art-neon-blue');
    }, { timeout: 3000 });

    // Vérifier que chrome.storage.local.set a été appelé
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        folderIcons: expect.objectContaining({
          '12': { icon: 'art', color: 'neon-blue' }
        })
      })
    );
  });

  it('supprime une icône personnalisée', async () => {
    // Commencer avec une icône existante
    const mockIcons = {
      '12': { icon: 'book', color: 'neon-blue' }
    };

    let currentIcons = { ...mockIcons };
    
    chromeMock.storage.local.get.mockImplementation((keys) => {
      const result = {};
      if (Array.isArray(keys)) {
        keys.forEach(key => {
          if (key === 'folderIcons') {
            result[key] = currentIcons;
          }
        });
      } else if (keys === 'folderIcons' || keys === null || keys === undefined) {
        result.folderIcons = currentIcons;
      }
      return Promise.resolve(result);
    });

    // Mock pour simuler la suppression
    chromeMock.storage.local.set.mockImplementation((items) => {
      if (items.folderIcons) {
        currentIcons = items.folderIcons;
      }
      return Promise.resolve();
    });

    render(
      <FolderIconsProvider>
        <TestComponent />
      </FolderIconsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    }, { timeout: 3000 });

    // Vérifier que l'icône existe
    await waitFor(() => {
      expect(screen.getByTestId('test-icon')).toHaveTextContent('book-neon-blue');
    }, { timeout: 2000 });

    // Supprimer l'icône
    await act(async () => {
      screen.getByTestId('remove-icon').click();
    });

    // Attendre que l'icône soit supprimée
    await waitFor(() => {
      expect(screen.getByTestId('test-icon')).toHaveTextContent('none');
    }, { timeout: 3000 });

    // Vérifier que chrome.storage.local.set a été appelé avec un objet sans l'icône
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        folderIcons: {}
      })
    );
  });

  it('retourne null pour getFolderIcon si l\'icône n\'existe pas', async () => {
    render(
      <FolderIconsProvider>
        <TestComponent />
      </FolderIconsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    }, { timeout: 3000 });

    expect(screen.getByTestId('test-icon')).toHaveTextContent('none');
  });

  it('gère les erreurs de chargement', async () => {
    chromeMock.storage.local.get.mockImplementationOnce(() => {
      return Promise.reject(new Error('Storage error'));
    });

    render(
      <FolderIconsProvider>
        <TestComponent />
      </FolderIconsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    }, { timeout: 3000 });

    // Devrait continuer avec un objet vide
    expect(screen.getByTestId('icons-count')).toHaveTextContent('0');
  });

  it('gère les erreurs de sauvegarde', async () => {
    chromeMock.storage.local.set.mockImplementationOnce(() => {
      return Promise.reject(new Error('Storage error'));
    });

    render(
      <FolderIconsProvider>
        <TestComponent />
      </FolderIconsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    }, { timeout: 3000 });

    // Essayer de définir une icône
    await act(async () => {
      screen.getByTestId('set-icon').click();
    });

    // L'erreur devrait être gérée (logged mais pas de crash)
    expect(chromeMock.storage.local.set).toHaveBeenCalled();
  });

  it('lance une erreur si useFolderIcons est utilisé hors du provider', () => {
    // Capturer l'erreur de console
    const consoleError = console.error;
    console.error = () => {};

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useFolderIcons must be used within a FolderIconsProvider');

    console.error = consoleError;
  });
});
