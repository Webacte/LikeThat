import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';

const SettingsContext = createContext();

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState({
    panelPosition: 'left',
    panelWidth: 300,
    clickBehavior: 'current',
    theme: 'ocean', // 'ocean', 'forest', 'sunset', 'night', 'rose', 'neutral'
    colorMode: 'light', // 'light', 'dark', 'auto'
    excludedSites: [],
    hoverDelay: 500,
    useClickMode: false,
    bookmarksBarPosition: 'bottom', // 'top' ou 'bottom'
    iconAnimationEnabled: true, // Animation des icônes personnalisées
    iconSize: 20, // Taille des icônes en pixels (min: 12, max: 32)
    fontSize: 14, // Taille de la police en pixels (min: 12, max: 20)
    panelOpacity: 1.0, // Opacité du fond du panneau (min: 0.5, max: 1.0)
    panelStyle: 'elevated', // Style du panneau : 'flat', 'elevated', 'strong-elevated', 'fade', 'glow'
    searchCaseSensitive: false // Recherche sensible à la casse
  });

  const [loading, setLoading] = useState(false);

  // Fonction utilitaire pour vérifier le contexte d'extension
  const isExtensionContextValid = useCallback(() => {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        return true;
      }
    } catch (e) {
      if (e.message && e.message.includes('Extension context invalidated')) {
        return false;
      }
    }
    return false;
  }, []);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      // Vérifier que le contexte d'extension est valide avant d'accéder à chrome.storage
      if (!isExtensionContextValid()) {
        console.log('LikeThat: Contexte d\'extension invalide, impossible de charger les paramètres');
        setLoading(false);
        return;
      }

      // Charger directement depuis chrome.storage.sync
      const result = await chrome.storage.sync.get([
        'panelPosition',
        'panelWidth',
        'clickBehavior',
        'theme',
        'colorMode',
        'excludedSites',
        'hoverDelay',
        'useClickMode',
        'bookmarksBarPosition',
        'iconAnimationEnabled',
        'iconSize',
        'fontSize',
        'panelOpacity',
        'panelStyle',
        'searchCaseSensitive'
      ]);
      
      if (result && Object.keys(result).length > 0) {
        setSettings(prev => ({ ...prev, ...result }));
      }
    } catch (error) {
      // Vérifier si c'est l'erreur "Extension context invalidated"
      if (error.message && error.message.includes('Extension context invalidated')) {
        console.log('LikeThat: Contexte d\'extension invalide lors du chargement des paramètres');
      } else {
        console.error('LikeThat: Erreur lors du chargement des paramètres:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [isExtensionContextValid]);

  const updateSettings = useCallback((newSettings) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  // Chargement des paramètres au montage
  useEffect(() => {
    loadSettings();

    // Écouter les changements de settings
    const handleMessage = (message) => {
      if (message && message.action === 'settingsChanged') {
        loadSettings();
      }
    };

    // Ajouter le listener seulement si le contexte est valide
    let messageListenerAdded = false;
    if (isExtensionContextValid()) {
      try {
        chrome.runtime.onMessage.addListener(handleMessage);
        messageListenerAdded = true;
      } catch (error) {
        if (error.message && error.message.includes('Extension context invalidated')) {
          console.log('LikeThat: Contexte d\'extension invalide lors de l\'ajout du listener');
        }
      }
    }
    
    // Écouter la demande de settings depuis content.jsx
    const handleRequestSettings = () => {
      // Envoyer les settings à content.jsx via un CustomEvent
      // (plus fiable que chrome.runtime.sendMessage pour la communication interne)
      window.dispatchEvent(new CustomEvent('likethat-settings-loaded', {
        detail: { settings }
      }));
    };
    
    window.addEventListener('likethat-request-settings', handleRequestSettings);

    return () => {
      if (messageListenerAdded && isExtensionContextValid()) {
        try {
          chrome.runtime.onMessage.removeListener(handleMessage);
        } catch (error) {
          // Ignorer les erreurs lors du nettoyage
        }
      }
      window.removeEventListener('likethat-request-settings', handleRequestSettings);
    };
  }, [loadSettings, settings, isExtensionContextValid]);
  
  // Envoyer les settings à content.jsx quand ils changent
  useEffect(() => {
    // Envoyer les settings une fois qu'ils sont chargés
    if (!loading && settings) {
      // Utiliser un petit délai pour s'assurer que content.jsx est prêt
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('likethat-settings-loaded', {
          detail: { settings }
        }));
      }, 50);
    }
  }, [settings, loading]);

  const value = {
    settings,
    updateSettings,
    loading
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

// Fonction utilitaire pour envoyer des messages
const sendMessage = (message) => {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response || { success: false, error: 'No response' });
      });
    } catch (error) {
      resolve({ success: false, error: error.message });
    }
  });
};
