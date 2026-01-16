import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { SettingsProvider, useSettings } from '../SettingsContext';
import { mockDefaultSettings, chromeMock } from '../../tests/mocks/chrome';

// S'assurer que chrome est bien mocké
global.chrome = chromeMock;

// Composant de test pour utiliser le hook useSettings
const TestComponent = () => {
  const { settings, updateSettings, loading } = useSettings();
  
  return (
    <div>
      <div data-testid="loading">{loading ? 'loading' : 'loaded'}</div>
      <div data-testid="panel-position">{settings.panelPosition}</div>
      <div data-testid="panel-width">{settings.panelWidth}</div>
      <div data-testid="theme">{settings.theme}</div>
      <div data-testid="color-mode">{settings.colorMode}</div>
      <button 
        data-testid="update-position" 
        onClick={() => updateSettings({ panelPosition: 'right' })}
      >
        Update Position
      </button>
      <button
        data-testid="update-theme"
        onClick={() => updateSettings({ theme: 'sunset', colorMode: 'dark' })}
      >
        Update Theme
      </button>
    </div>
  );
};

describe('SettingsContext', () => {
  beforeEach(() => {
    // Reset les mocks
    vi.clearAllMocks();
    chromeMock.storage.sync.get.mockClear();
    chromeMock.storage.sync.set.mockClear();
    chromeMock.runtime.onMessage.addListener.mockClear();
    
    // Réinitialiser le mock pour retourner les valeurs par défaut
    chromeMock.storage.sync.get.mockImplementation((keys) => {
      const result = {};
      if (Array.isArray(keys)) {
        keys.forEach(key => {
          if (mockDefaultSettings.hasOwnProperty(key)) {
            result[key] = mockDefaultSettings[key];
          }
        });
      } else if (keys === null || keys === undefined) {
        Object.assign(result, mockDefaultSettings);
      } else if (mockDefaultSettings.hasOwnProperty(keys)) {
        result[keys] = mockDefaultSettings[keys];
      }
      return Promise.resolve(result);
    });
  });

  it('charge les settings par défaut', async () => {
    render(
      <SettingsProvider>
        <TestComponent />
      </SettingsProvider>
    );

    // Attendre que le chargement soit terminé
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    }, { timeout: 3000 });

    // Vérifier les valeurs par défaut
    expect(screen.getByTestId('panel-position')).toHaveTextContent('left');
    expect(screen.getByTestId('panel-width')).toHaveTextContent('300');
    expect(screen.getByTestId('theme')).toHaveTextContent('ocean');
    expect(screen.getByTestId('color-mode')).toHaveTextContent('light');
  });

  it('charge les settings depuis chrome.storage.sync', async () => {
    // Configurer des settings personnalisés
    const customSettings = {
      panelPosition: 'right',
      panelWidth: 400,
      theme: 'forest',
      colorMode: 'dark'
    };

    chromeMock.storage.sync.get.mockImplementationOnce((keys) => {
      const result = {};
      if (Array.isArray(keys)) {
        keys.forEach(key => {
          if (customSettings.hasOwnProperty(key)) {
            result[key] = customSettings[key];
          } else if (mockDefaultSettings.hasOwnProperty(key)) {
            result[key] = mockDefaultSettings[key];
          }
        });
      } else if (keys === null || keys === undefined) {
        Object.assign(result, mockDefaultSettings, customSettings);
      } else if (customSettings.hasOwnProperty(keys)) {
        result[keys] = customSettings[keys];
      } else if (mockDefaultSettings.hasOwnProperty(keys)) {
        result[keys] = mockDefaultSettings[keys];
      }
      return Promise.resolve(result);
    });

    render(
      <SettingsProvider>
        <TestComponent />
      </SettingsProvider>
    );

    // Attendre que le chargement soit terminé
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    }, { timeout: 3000 });

    // Vérifier que les settings ont été chargés
    await waitFor(() => {
      expect(screen.getByTestId('panel-position')).toHaveTextContent('right');
    }, { timeout: 2000 });
    
    expect(screen.getByTestId('panel-width')).toHaveTextContent('400');
    expect(screen.getByTestId('theme')).toHaveTextContent('forest');
    expect(screen.getByTestId('color-mode')).toHaveTextContent('dark');
  });

  it('met à jour les settings avec updateSettings', async () => {
    render(
      <SettingsProvider>
        <TestComponent />
      </SettingsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    }, { timeout: 3000 });

    // Valeur initiale
    expect(screen.getByTestId('panel-position')).toHaveTextContent('left');

    // Mettre à jour la position
    act(() => {
      screen.getByTestId('update-position').click();
    });

    // Vérifier que la position a été mise à jour
    await waitFor(() => {
      expect(screen.getByTestId('panel-position')).toHaveTextContent('right');
    }, { timeout: 2000 });
  });

  it('met à jour plusieurs settings simultanément', async () => {
    render(
      <SettingsProvider>
        <TestComponent />
      </SettingsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    }, { timeout: 3000 });

    // Valeurs initiales
    expect(screen.getByTestId('theme')).toHaveTextContent('ocean');
    expect(screen.getByTestId('color-mode')).toHaveTextContent('light');

    // Mettre à jour le thème et le mode couleur
    act(() => {
      screen.getByTestId('update-theme').click();
    });

    // Vérifier que les deux valeurs ont été mises à jour
    await waitFor(() => {
      expect(screen.getByTestId('theme')).toHaveTextContent('sunset');
      expect(screen.getByTestId('color-mode')).toHaveTextContent('dark');
    }, { timeout: 2000 });
  });

  it('écoute les messages de changement de settings', async () => {
    render(
      <SettingsProvider>
        <TestComponent />
      </SettingsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    }, { timeout: 3000 });

    // Vérifier que le listener a été ajouté
    expect(chromeMock.runtime.onMessage.addListener).toHaveBeenCalled();
  });

  it('gère les erreurs de chargement des settings', async () => {
    // Simuler une erreur
    chromeMock.storage.sync.get.mockImplementationOnce(() => {
      return Promise.reject(new Error('Storage error'));
    });

    render(
      <SettingsProvider>
        <TestComponent />
      </SettingsProvider>
    );

    // Attendre que le chargement soit terminé (même avec erreur)
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded');
    }, { timeout: 3000 });

    // Les settings par défaut devraient être utilisés
    expect(screen.getByTestId('panel-position')).toHaveTextContent('left');
  });

  it('lance une erreur si useSettings est utilisé hors du provider', () => {
    // Capturer l'erreur de console
    const consoleError = console.error;
    console.error = () => {};

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useSettings must be used within a SettingsProvider');

    console.error = consoleError;
  });
});
