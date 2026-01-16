import React from 'react';
import { createRoot } from 'react-dom/client';
import Panel from './components/Panel/Panel';

// Détection du contexte d'extension invalide
window.addEventListener('error', (event) => {
  if (event.error && event.error.message && event.error.message.includes('Extension context invalidated')) {
    console.log('LikeThat: Extension rechargée, rechargement de la page...');
    event.preventDefault();
    // Recharger la page après un court délai
    setTimeout(() => {
      window.location.reload();
    }, 500);
  }
});

// Vérifier périodiquement si le contexte d'extension est toujours valide
function checkExtensionContext() {
  try {
    if (chrome.runtime && chrome.runtime.id) {
      // Le contexte est valide
      return true;
    }
  } catch (e) {
    // Vérifier si c'est l'erreur "Extension context invalidated"
    if (e.message && e.message.includes('Extension context invalidated')) {
      console.log('LikeThat: Contexte d\'extension invalide détecté, rechargement...');
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
    return false;
  }
  return false;
}

// Fonction utilitaire pour vérifier le contexte avant d'utiliser l'API Chrome
function isExtensionContextValid() {
  try {
    // Tenter d'accéder à chrome.runtime.id
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      return true;
    }
  } catch (e) {
    // Si l'erreur contient "Extension context invalidated", le contexte est invalide
    if (e.message && e.message.includes('Extension context invalidated')) {
      return false;
    }
  }
  return false;
}

/**
 * Vérifie si l'URL actuelle est une page newtab
 * @param {string} url - URL à vérifier
 * @returns {boolean} True si c'est une page newtab
 */
function isNewTabPage(url) {
  if (!url) return false;
  const NEWTAB_URLS = [
    'chrome://newtab/',
    'edge://newtab/',
    'about:newtab',
    'about:home'
  ];
  return NEWTAB_URLS.some(newtabUrl => url === newtabUrl || url.startsWith(newtabUrl));
}

// Fonction principale du panneau
function createLikeThatPanel() {
  // État du panneau
  const state = {
    panel: null,
    shadowRoot: null,
    toggleButton: null,
    isVisible: false,
    isHovering: false,
    hoverTimeout: null,
    hoverEventsInitialized: false,
    panelEventsInitialized: false,
    panelMouseEnterHandler: null,
    panelMouseLeaveHandler: null,
    panelInitialized: false,
    initializationTime: null,
    lastAppliedPanelStyle: null, // Pour éviter les appels répétés inutiles
    lastAppliedPanelPosition: null, // Pour le style "fade" qui dépend de la position
    applyPanelStyleTimeout: null, // Pour le debounce
    isApplyingPanelStyle: false, // Verrou pour empêcher les appels simultanés
    lastGlowColor: null, // Pour éviter de réappliquer le glow si la couleur n'a pas changé
    isApplyingTheme: false, // Verrou pour empêcher les appels simultanés de applyTheme
    lastAppliedTheme: null, // Pour éviter de réappliquer le même thème
    lastAppliedColorMode: null, // Pour éviter de réappliquer le même colorMode
    lastSettingsHash: null, // Hash des derniers settings pour éviter les traitements répétés
    isApplyingAllSettings: false, // Verrou pour empêcher les appels simultanés de applyAllSettings
    settings: {
      panelPosition: 'left',
      panelWidth: 300,
      clickBehavior: 'current',
      theme: 'ocean',
      colorMode: 'light',
      excludedSites: [],
      hoverDelay: 500,
      useClickMode: false,
      bookmarksBarPosition: 'bottom',
      iconAnimationEnabled: true,
      iconSize: 20,
      fontSize: 14,
      panelOpacity: 1.0,
      panelStyle: 'elevated'
    }
  };

  const TOOLTIP_SELECTOR = '.folder-tooltip, .icon-selector-tooltip, .add-folder-tooltip, .rename-folder-tooltip, .folder-selector-tooltip';

  // Initialisation
  init();

  async function init() {
    // Vérifier si déjà initialisé
    if (window.likeThatInitialized) {
      return;
    }
    window.likeThatInitialized = true;

    // Attendre que le DOM soit prêt
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setupPanel());
    } else {
      setupPanel();
    }
  }

  async function setupPanel() {
    try {
      // Crée le panneau immédiatement (sans attendre les settings)
      // Les settings seront chargés par SettingsContext et appliqués via le listener
      await createPanel();
      
      // Configure les événements
      setupEvents();
      
      // Écoute les changements de settings depuis React
      setupSettingsListener();
      
    } catch (error) {
      console.error('LikeThat: Erreur lors de l\'initialisation:', error);
    }
  }

  // Les settings sont maintenant chargés uniquement par SettingsContext
  // Cette fonction écoute les CustomEvents depuis React pour recevoir les settings
  function setupSettingsListener() {
    // Fonction pour créer un hash simple des settings
    const createSettingsHash = (settings) => {
      return JSON.stringify({
        panelPosition: settings.panelPosition,
        panelWidth: settings.panelWidth,
        theme: settings.theme,
        colorMode: settings.colorMode,
        panelStyle: settings.panelStyle,
        panelOpacity: settings.panelOpacity
      });
    };
    
    // Écouter les CustomEvents depuis React (SettingsContext)
    const handleSettingsLoaded = (event) => {
      if (event.detail && event.detail.settings) {
        const newSettings = { ...state.settings, ...event.detail.settings };
        const newHash = createSettingsHash(newSettings);
        
        // Vérifier si les settings ont réellement changé
        if (state.lastSettingsHash === newHash) {
          // Les settings sont identiques, ne pas les réappliquer
          // Cela évite les boucles infinies quand React envoie le même événement plusieurs fois
          return;
        }
        
        state.settings = newSettings;
        state.lastSettingsHash = newHash;
        
        // Appliquer les settings critiques immédiatement (position, width)
        applyCriticalSettings();
        
        // Différer l'application des autres settings avec requestIdleCallback
        if (window.requestIdleCallback) {
          requestIdleCallback(() => {
            applyAllSettings();
          }, { timeout: 100 });
        } else {
          setTimeout(() => {
            applyAllSettings();
          }, 0);
        }
      }
    };
    
    window.addEventListener('likethat-settings-loaded', handleSettingsLoaded);
    
    // Écouter aussi les changements via chrome.runtime.onMessage (pour les changements depuis options)
    if (isExtensionContextValid()) {
      try {
        chrome.runtime.onMessage.addListener((message) => {
          if (message && message.action === 'settingsChanged') {
            // Demander les nouveaux settings à React
            window.dispatchEvent(new CustomEvent('likethat-request-settings'));
          }
        });
      } catch (error) {
        if (error.message && error.message.includes('Extension context invalidated')) {
          console.log('LikeThat: Contexte d\'extension invalide lors de l\'ajout du listener');
        }
      }
    }
    
    // Demander les settings à React une fois qu'il est monté
    setTimeout(() => {
      try {
        // Les settings seront chargés par SettingsContext et envoyés via un CustomEvent
        window.dispatchEvent(new CustomEvent('likethat-request-settings'));
      } catch (e) {
        // Erreur silencieuse
      }
    }, 200);
    
    // Fallback : charger depuis storage si React ne répond pas après 500ms
    setTimeout(() => {
      if (!state.settings || Object.keys(state.settings).length <= 8) {
        // Si les settings ne sont pas encore chargés, utiliser le fallback
        loadSettingsFromStorage().then(() => {
          applyCriticalSettings();
          if (window.requestIdleCallback) {
            requestIdleCallback(() => {
              applyAllSettings();
            }, { timeout: 100 });
          } else {
            setTimeout(() => {
              applyAllSettings();
            }, 0);
          }
        });
      }
    }, 500);
  }
  
  // Fonction de fallback pour charger les settings depuis storage
  // (utilisée seulement si React n'envoie pas les settings)
  async function loadSettingsFromStorage() {
    try {
      // Vérifier que le contexte d'extension est valide avant d'accéder à chrome.storage
      if (!isExtensionContextValid()) {
        console.log('LikeThat: Contexte d\'extension invalide, impossible de charger les paramètres');
        return;
      }

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
      
      // Fusionner avec les paramètres actuels
      state.settings = { ...state.settings, ...result };
    } catch (error) {
      // Vérifier si c'est l'erreur "Extension context invalidated"
      if (error.message && error.message.includes('Extension context invalidated')) {
        console.log('LikeThat: Contexte d\'extension invalide, rechargement de la page...');
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else {
        console.error('LikeThat: Erreur lors du chargement des paramètres:', error);
      }
    }
  }

  /**
   * Applique seulement les settings critiques (position, width)
   * Ces settings doivent être appliqués immédiatement pour le rendu
   */
  function applyCriticalSettings() {
    applyPosition();
    applyWidth();
    updateToggleButtonVisibility();
    applyToggleButton();
  }

  function applyAllSettings() {
    // Verrou pour empêcher les appels simultanés
    if (state.isApplyingAllSettings) {
      return;
    }
    
    state.isApplyingAllSettings = true;
    
    try {
      applyPosition();
      applyWidth();
      applyTheme();
      updateToggleButtonVisibility();
      applyToggleButton();
      applyHoverDelay();
      applyIconSettings();
      applyFontSize();
      applyPanelOpacity();
      applyPanelStyle();
      updateToggleButtonState();
    } finally {
      // Libérer le verrou après un court délai pour éviter les appels trop rapides
      setTimeout(() => {
        state.isApplyingAllSettings = false;
      }, 100);
    }
  }

  function applyPosition() {
    if (state.panel) {
      state.panel.className = `likethat-panel ${state.settings.panelPosition}`;
      // Réappliquer le style car "fade" dépend de la position
      applyPanelStyle();
    }
  }

  function applyWidth() {
    if (state.panel && state.isVisible) {
      state.panel.style.width = `${state.settings.panelWidth}px`;
    }
  }

  function applyTheme() {
    // Verrou pour empêcher les appels simultanés
    if (state.isApplyingTheme) {
      return;
    }
    
    const theme = state.settings.theme || 'ocean';
    let colorMode = state.settings.colorMode || 'light';
    if (colorMode === 'auto') {
      colorMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    // Vérifier si le thème et le colorMode ont déjà été appliqués
    if (state.lastAppliedTheme === theme && state.lastAppliedColorMode === colorMode) {
      // Le thème n'a pas changé, vérifier si on doit quand même réappliquer le style glow
      const currentStyle = state.settings.panelStyle || 'elevated';
      if (currentStyle === 'glow') {
        // Pour le style glow, vérifier si la couleur a changé
        // On laisse applyPanelStyle() gérer cela avec sa propre logique
        if (state.applyPanelStyleTimeout) {
          clearTimeout(state.applyPanelStyleTimeout);
        }
        state.applyPanelStyleTimeout = setTimeout(() => {
          applyPanelStyle();
          state.applyPanelStyleTimeout = null;
        }, 150);
      }
      return;
    }
    
    state.isApplyingTheme = true;
    
    try {
      // S'assurer que les styles complets sont injectés avant d'appliquer le thème
      if (!state.shadowRoot || !state.shadowRoot.getElementById('likethat-full-styles')) {
        // Injecter les styles complets immédiatement si pas encore fait
        if (state.shadowRoot) {
          injectAllStyles();
        }
      }
      
      setTimeout(() => {
        try {
          if (state.shadowRoot) {
            // Chercher dans le shadowRoot et aussi dans react-root
            let likeThatPanel = state.shadowRoot.querySelector('.likethat-panel');
            if (!likeThatPanel) {
              // Si pas trouvé, chercher dans react-root
              const reactRoot = state.shadowRoot.getElementById('react-root');
              if (reactRoot) {
                likeThatPanel = reactRoot.querySelector('.likethat-panel');
              }
            }
            
            if (likeThatPanel) {
              // Appliquer le thème sélectionné via data-theme
              likeThatPanel.setAttribute('data-theme', theme);
              likeThatPanel.setAttribute('data-color-mode', colorMode);
            } else {
              // Si le panneau React n'est pas encore monté, appliquer sur le panneau principal
              if (state.panel) {
                state.panel.setAttribute('data-theme', theme);
                state.panel.setAttribute('data-color-mode', colorMode);
              }
            }
          }
          
          // Mémoriser le thème et colorMode appliqués
          state.lastAppliedTheme = theme;
          state.lastAppliedColorMode = colorMode;
          
          // Réappliquer le style du panneau UNIQUEMENT si le style est "glow"
          // car seul ce style dépend de la couleur du thème
          const currentStyle = state.settings.panelStyle || 'elevated';
          if (currentStyle === 'glow') {
            // Utiliser un debounce pour éviter les appels multiples rapides
            if (state.applyPanelStyleTimeout) {
              clearTimeout(state.applyPanelStyleTimeout);
            }
            state.applyPanelStyleTimeout = setTimeout(() => {
              applyPanelStyle();
              state.applyPanelStyleTimeout = null;
            }, 150);
          }
        } finally {
          // Toujours libérer le verrou
          state.isApplyingTheme = false;
        }
      }, 50);
    } catch (error) {
      state.isApplyingTheme = false;
      console.error('LikeThat: Erreur lors de l\'application du thème:', error);
    }
  }

  function applyFontSize() {
    if (!state.shadowRoot) return;
    
    const likeThatPanel = state.shadowRoot.querySelector('.likethat-panel');
    if (likeThatPanel) {
      const fontSize = state.settings.fontSize || 14;
      likeThatPanel.style.setProperty('--font-size', `${fontSize}px`);
    }
  }

  function applyPanelOpacity() {
    if (!state.shadowRoot) return;
    
    const likeThatPanel = state.shadowRoot.querySelector('.likethat-panel');
    if (likeThatPanel) {
      const opacity = state.settings.panelOpacity !== undefined ? state.settings.panelOpacity : 1.0;
      console.log('Applying panel opacity:', opacity);
      likeThatPanel.style.setProperty('--panel-opacity', opacity);
      
      // Forcer le recalcul du style
      likeThatPanel.offsetHeight;
    }
  }

  function applyPanelStyle() {
    if (!state.panel) return;
    
    // Verrou pour empêcher les appels simultanés
    if (state.isApplyingPanelStyle) {
      return;
    }
    
    state.isApplyingPanelStyle = true;
    
    try {
      const style = state.settings.panelStyle || 'elevated';
      const isLeft = state.settings.panelPosition === 'left';
      
      // Vérifier si le style a déjà été appliqué pour éviter les modifications DOM inutiles
      // Cela évite de déclencher des MutationObserver en boucle
      // Exception : pour le style "fade", il faut aussi vérifier la position car elle affecte le masque
      const expectedClass = style === 'strong-elevated' ? 'panel-strong-elevated' : `panel-${style}`;
      const styleAlreadyApplied = state.lastAppliedPanelStyle === style && 
          state.panel.classList.contains(expectedClass);
      const positionUnchanged = state.lastAppliedPanelPosition === state.settings.panelPosition;
      
      if (styleAlreadyApplied && (style !== 'fade' || positionUnchanged)) {
        // Le style est déjà appliqué et la position n'a pas changé (ou le style ne dépend pas de la position)
        // Pas besoin de modifier le DOM
        state.isApplyingPanelStyle = false;
        return;
      }
      
      // Retirer tous les anciens styles
      state.panel.classList.remove('panel-flat', 'panel-elevated', 'panel-strong-elevated', 'panel-fade', 'panel-glow');
    
    // Appliquer le nouveau style
    switch (style) {
      case 'flat':
        state.panel.style.boxShadow = 'none';
        state.panel.style.border = `1px solid var(--border-color, #dee2e6)`;
        state.panel.classList.add('panel-flat');
        break;
      
      case 'elevated':
        state.panel.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        state.panel.style.border = 'none';
        state.panel.classList.add('panel-elevated');
        break;
      
      case 'strong-elevated':
        state.panel.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3), 0 16px 48px rgba(0, 0, 0, 0.15)';
        state.panel.style.border = 'none';
        state.panel.classList.add('panel-strong-elevated');
        break;
      
      case 'fade':
        state.panel.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
        state.panel.style.border = 'none';
        // Appliquer un masque de gradient uniquement sur le côté qui touche la page web
        if (isLeft) {
          // Panneau à gauche : fondu vers la droite (page web)
          state.panel.style.maskImage = 'linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 70%, rgba(0,0,0,0.3) 95%, rgba(0,0,0,0) 100%)';
          state.panel.style.webkitMaskImage = 'linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 70%, rgba(0,0,0,0.3) 95%, rgba(0,0,0,0) 100%)';
        } else {
          // Panneau à droite : fondu vers la gauche (page web)
          state.panel.style.maskImage = 'linear-gradient(to left, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 70%, rgba(0,0,0,0.3) 95%, rgba(0,0,0,0) 100%)';
          state.panel.style.webkitMaskImage = 'linear-gradient(to left, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 70%, rgba(0,0,0,0.3) 95%, rgba(0,0,0,0) 100%)';
        }
        state.panel.classList.add('panel-fade');
        break;
      
      case 'glow':
        // Récupérer la couleur primaire du thème actuel depuis le shadow DOM
        let primaryColor = '#0ea5e9';
        if (state.shadowRoot) {
          const likeThatPanel = state.shadowRoot.querySelector('.likethat-panel');
          if (likeThatPanel) {
            const computedStyle = getComputedStyle(likeThatPanel);
            primaryColor = computedStyle.getPropertyValue('--primary-color').trim() || '#0ea5e9';
          }
        }
        
        // Vérifier si la couleur a changé pour éviter les modifications inutiles
        if (state.lastGlowColor === primaryColor && state.panel.classList.contains('panel-glow')) {
          // La couleur n'a pas changé et la classe est déjà présente, pas besoin de modifier
          state.isApplyingPanelStyle = false;
          return;
        }
        
        // Convertir la couleur hex en rgba pour l'ombre secondaire
        const hexToRgb = (hex) => {
          const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
          return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
          } : { r: 14, g: 165, b: 233 }; // Couleur par défaut
        };
        
        const rgb = hexToRgb(primaryColor);
        state.panel.style.boxShadow = `0 0 20px ${primaryColor}, 0 0 40px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3), 0 4px 12px rgba(0, 0, 0, 0.2)`;
        state.panel.style.border = 'none';
        state.panel.classList.add('panel-glow');
        state.lastGlowColor = primaryColor; // Mémoriser la couleur appliquée
        break;
      
      default:
        state.panel.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        state.panel.style.border = 'none';
    }
    
    // Mémoriser le style et la position appliqués pour éviter les appels répétés
    state.lastAppliedPanelStyle = style;
    state.lastAppliedPanelPosition = state.settings.panelPosition;
    } finally {
      // Libérer le verrou
      state.isApplyingPanelStyle = false;
    }
  }

  function applyToggleButton() {
    if (state.toggleButton) {
      const isLeft = state.settings.panelPosition === 'left';
      state.toggleButton.style.left = isLeft ? '0px' : 'auto';
      state.toggleButton.style.right = isLeft ? 'auto' : '0px';
      state.toggleButton.style.borderRadius = isLeft ? '0 8px 8px 0' : '8px 0 0 8px';
    }
  }

  function applyHoverDelay() {
    // Le délai est géré directement dans setupHoverEvents
    // Pas besoin d'appliquer ici
  }

  function applyIconSettings() {
    if (!state.shadowRoot) return;
    
    // Supprimer l'ancien style dynamique s'il existe
    const oldDynamicStyle = state.shadowRoot.querySelector('#likethat-dynamic-icon-styles');
    if (oldDynamicStyle) {
      oldDynamicStyle.remove();
    }
    
    // Créer le nouveau style dynamique
    const iconSize = state.settings.iconSize || 16;
    const animationEnabled = state.settings.iconAnimationEnabled !== false;
    
    const dynamicStyleElement = document.createElement('style');
    dynamicStyleElement.id = 'likethat-dynamic-icon-styles';
    dynamicStyleElement.textContent = `
      /* ========================================
         TAILLE DYNAMIQUE DE TOUTES LES ICÔNES
         ======================================== */
      
      /* Icônes personnalisées de dossiers */
      img[data-custom-icon="true"],
      .folder-custom-icon[data-custom-icon="true"] {
        width: ${iconSize}px !important;
        height: ${iconSize}px !important;
        max-width: ${iconSize}px !important;
        max-height: ${iconSize}px !important;
        min-width: ${iconSize}px !important;
        min-height: ${iconSize}px !important;
      }
      
      /* Favicons des liens (dans les autres favoris) */
      .bookmark-favicon,
      .bookmark-favicon img {
        width: ${iconSize}px !important;
        height: ${iconSize}px !important;
        max-width: ${iconSize}px !important;
        max-height: ${iconSize}px !important;
        min-width: ${iconSize}px !important;
        min-height: ${iconSize}px !important;
      }
      
      /* Favicons dans la barre de favoris (BookmarkButton) */
      .bookmark-button-favicon {
        width: ${iconSize}px !important;
        height: ${iconSize}px !important;
        max-width: ${iconSize}px !important;
        max-height: ${iconSize}px !important;
        min-width: ${iconSize}px !important;
        min-height: ${iconSize}px !important;
      }
      
      /* Icônes de dossiers par défaut (émoji 📁) dans le titre */
      .bookmark-title > span[style*="font-size"] {
        font-size: ${iconSize}px !important;
        line-height: ${iconSize}px !important;
      }
      
      /* Icônes dans la barre de favoris */
      .bookmarks-bar img[data-custom-icon="true"],
      .bookmarks-bar .bookmark-favicon,
      .bookmarks-bar .bookmark-favicon img {
        width: ${iconSize}px !important;
        height: ${iconSize}px !important;
        max-width: ${iconSize}px !important;
        max-height: ${iconSize}px !important;
      }
      
      /* Icônes dans les autres favoris */
      .bookmark-item img[data-custom-icon="true"],
      .bookmark-item .bookmark-favicon,
      .bookmark-item .bookmark-favicon img {
        width: ${iconSize}px !important;
        height: ${iconSize}px !important;
        max-width: ${iconSize}px !important;
        max-height: ${iconSize}px !important;
      }
      
      /* Icônes dans les tooltips de dossiers */
      .tooltip-folder-icon {
        width: ${Math.max(12, iconSize - 4)}px !important;
        height: ${Math.max(12, iconSize - 4)}px !important;
        max-width: ${Math.max(12, iconSize - 4)}px !important;
        max-height: ${Math.max(12, iconSize - 4)}px !important;
        min-width: ${Math.max(12, iconSize - 4)}px !important;
        min-height: ${Math.max(12, iconSize - 4)}px !important;
      }
      
      .tooltip-icon {
        width: ${Math.max(12, iconSize - 4)}px !important;
        height: ${Math.max(12, iconSize - 4)}px !important;
        max-width: ${Math.max(12, iconSize - 4)}px !important;
        max-height: ${Math.max(12, iconSize - 4)}px !important;
        min-width: ${Math.max(12, iconSize - 4)}px !important;
        min-height: ${Math.max(12, iconSize - 4)}px !important;
      }
      
      .tooltip-favicon {
        width: ${Math.max(12, iconSize - 2)}px !important;
        height: ${Math.max(12, iconSize - 2)}px !important;
        max-width: ${Math.max(12, iconSize - 2)}px !important;
        max-height: ${Math.max(12, iconSize - 2)}px !important;
        min-width: ${Math.max(12, iconSize - 2)}px !important;
        min-height: ${Math.max(12, iconSize - 2)}px !important;
      }
      
      /* Ajuster la taille des boutons de la barre de favoris en fonction de la taille des icônes */
      .bookmark-button {
        font-size: ${iconSize}px !important;
        padding: ${Math.max(6, iconSize * 0.5)}px ${Math.max(8, iconSize * 0.75)}px !important;
      }
      
      .bookmark-button.folder-button {
        min-width: ${Math.max(32, iconSize * 2)}px !important;
      }
      
      /* Animation conditionnelle */
      ${animationEnabled ? `
      .icon-neon {
        animation: neonPulse 1.8s ease-in-out infinite !important;
      }
      ` : `
      .icon-neon {
        animation: none !important;
      }
      `}
    `;
    
    state.shadowRoot.appendChild(dynamicStyleElement);
  }

  async function createPanel() {
    // Vérifie si le panneau existe déjà
    const existingPanel = document.getElementById('likethat-panel');
    if (existingPanel) {
      existingPanel.remove();
    }
    
    // Vérifie si le bouton existe déjà
    const existingButton = document.getElementById('likethat-toggle-button');
    if (existingButton) {
      existingButton.remove();
    }
    
    // Crée l'élément conteneur
    state.panel = document.createElement('div');
    state.panel.id = 'likethat-panel';
    state.panel.className = 'likethat-panel left';
    
    // Appliquer les attributs de thème par défaut
    state.panel.setAttribute('data-theme', state.settings.theme || 'ocean');
    let colorMode = state.settings.colorMode || 'light';
    if (colorMode === 'auto') {
      colorMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    state.panel.setAttribute('data-color-mode', colorMode);
    
    // Styles de base pour que le panneau soit visible
    state.panel.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: ${state.settings.panelWidth || 300}px;
      height: 100vh;
      z-index: 2147483647;
      overflow: hidden;
    `;
    
    // Crée le Shadow DOM
    state.shadowRoot = state.panel.attachShadow({ mode: 'open' });
    
    // Ajoute au DOM immédiatement pour que le panneau soit visible
    document.body.appendChild(state.panel);
    
    // Afficher un skeleton loader immédiatement (avant React)
    createSkeletonLoader();
    
    // Injecte les styles critiques immédiatement (nécessaires pour le rendu)
    injectCriticalStyles();
    
    // Injecte le reste des styles de manière asynchrone (non bloquant)
    // Les styles complets seront injectés en arrière-plan pendant que React se monte
    if (window.requestIdleCallback) {
      requestIdleCallback(() => {
        injectAllStyles();
      }, { timeout: 200 });
    } else {
      setTimeout(() => {
        injectAllStyles();
      }, 0);
    }
    
    // Crée le conteneur React immédiatement (sans attendre les styles)
    const reactContainer = document.createElement('div');
    reactContainer.id = 'react-root';
    reactContainer.style.cssText = `
      position: relative;
      width: 100%;
      height: 100%;
      z-index: 2;
    `;
    state.shadowRoot.appendChild(reactContainer);
    
    // Monte l'application React (non bloquant)
    // React peut se monter pendant que les styles sont injectés
    // Le skeleton sera remplacé automatiquement par React
    const root = createRoot(reactContainer);
    root.render(<Panel />);
    
    // Crée le bouton toggle
    createToggleButton();
    
    // Le panneau reste caché à l'initialisation, même sur newtab
    // Il ne s'ouvrira que lorsqu'on le demande (via hover selon les options)
    // IMPORTANT: Laisser le panneau visible pendant l'initialisation de React
    // pour permettre à React de se monter correctement, puis le cacher après
    const hidePanelAfterInit = () => {
      if (state.panel) {
        // Vérifier que React est vraiment monté et qu'il n'y a pas d'erreur
        const reactRoot = state.shadowRoot?.querySelector('#react-root');
        if (!reactRoot) {
          // React n'est pas encore monté, réessayer plus tard
          setTimeout(hidePanelAfterInit, 200);
          return;
        }
        
        // Vérifier s'il y a une erreur React (ErrorBoundary actif)
        const errorBoundary = reactRoot.querySelector('div[style*="padding: 20px"]');
        if (errorBoundary) {
          console.error('LikeThat: Erreur détectée dans React, ne pas cacher le panneau');
          return; // Ne pas cacher si il y a une erreur
        }
        
        // Vérifier que le contenu React est bien monté (pas juste le skeleton)
        const hasReactContent = reactRoot.querySelector('.likethat-panel') || 
                                reactRoot.querySelector('.panel-content') ||
                                reactRoot.children.length > 1; // Plus que juste le skeleton
        
        if (!hasReactContent) {
          // React n'est pas encore complètement monté, réessayer plus tard
          setTimeout(hidePanelAfterInit, 200);
          return;
        }
        
        // React est monté et fonctionne, on peut maintenant cacher le panneau
        const isLeft = state.settings.panelPosition === 'left';
        state.panel.classList.remove('expanded');
        
        // Cacher le panneau SANS utiliser visibility: hidden ou display: none
        state.panel.style.width = '0px';
        state.panel.style.opacity = '0';
        state.panel.style.pointerEvents = 'none';
        state.panel.style.overflow = 'hidden';
        state.panel.style.backgroundColor = 'transparent';
        state.panel.style.border = 'none';
        state.panel.style.boxShadow = 'none';
        
        // Positionner le bouton toggle correctement
        if (state.toggleButton) {
          if (isLeft) {
            state.toggleButton.style.left = '0px';
          } else {
            state.toggleButton.style.right = '0px';
          }
        }
        
        state.isVisible = false;
        console.log('LikeThat: Panneau caché après initialisation réussie');
      }
    };
    
    // Attendre que React et les Context providers soient complètement initialisés
    // Commencer à vérifier après 500ms, puis toutes les 200ms jusqu'à ce que React soit prêt
    setTimeout(() => {
      hidePanelAfterInit();
    }, 500);
    
    // Configure les événements du panneau après sa création
    setupPanelEvents();
    
    // Marquer le panneau comme initialisé
    state.panelInitialized = true;
    state.initializationTime = Date.now();
  }

  /**
   * Crée un skeleton loader minimal qui s'affiche avant React
   * Utilise uniquement du CSS inline pour être instantané
   */
  function createSkeletonLoader() {
    const skeleton = document.createElement('div');
    skeleton.id = 'likethat-skeleton';
    skeleton.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: skeleton-loading 1.5s ease-in-out infinite;
      z-index: 1;
      pointer-events: none;
    `;
    
    // Ajouter l'animation CSS inline
    const style = document.createElement('style');
    style.textContent = `
      @keyframes skeleton-loading {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `;
    state.shadowRoot.appendChild(style);
    state.shadowRoot.appendChild(skeleton);
    
    // Le z-index est déjà défini lors de la création de react-root
    
    // Supprimer le skeleton une fois que React est monté
    // Utiliser un MutationObserver pour détecter quand React a rendu du contenu
    const observer = new MutationObserver((mutations) => {
      const reactRootEl = state.shadowRoot.getElementById('react-root');
      if (reactRootEl && reactRootEl.children.length > 0) {
        // React a rendu du contenu, supprimer le skeleton
        const skeletonEl = state.shadowRoot.getElementById('likethat-skeleton');
        if (skeletonEl) {
          skeletonEl.style.opacity = '0';
          skeletonEl.style.transition = 'opacity 0.3s ease-out';
          setTimeout(() => {
            if (skeletonEl.parentNode) {
              skeletonEl.remove();
            }
            observer.disconnect();
          }, 300);
        } else {
          observer.disconnect();
        }
      }
    });
    
    // Observer les changements dans react-root
    const reactRootEl = state.shadowRoot.getElementById('react-root');
    if (reactRootEl) {
      observer.observe(reactRootEl, { childList: true, subtree: true });
    }
    
    // Fallback : supprimer le skeleton après 2 secondes maximum
    setTimeout(() => {
      const skeletonEl = state.shadowRoot.getElementById('likethat-skeleton');
      if (skeletonEl) {
        skeletonEl.style.opacity = '0';
        skeletonEl.style.transition = 'opacity 0.3s ease-out';
        setTimeout(() => {
          if (skeletonEl.parentNode) {
            skeletonEl.remove();
          }
        }, 300);
      }
      observer.disconnect();
    }, 2000);
  }

  function createToggleButton() {
    // Créer le bouton seulement en mode clic
    if (!state.settings.useClickMode) {
      return;
    }

    const button = document.createElement('div');
    button.id = 'likethat-toggle-button';
    button.innerHTML = '☰';
    button.style.cssText = `
      position: fixed;
      top: 50%;
      ${state.settings.panelPosition === 'left' ? 'left: 0px' : 'right: 0px'};
      transform: translateY(-50%);
      width: 30px;
      height: 60px;
      background: #f0f0f0;
      color: #333;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 2147483646;
      border-radius: ${state.settings.panelPosition === 'left' ? '0 8px 8px 0' : '8px 0 0 8px'};
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      font-size: ${Math.max(16, (state.settings.fontSize || 14) * 1.43)}px;
      font-weight: bold;
      transition: all 0.3s ease;
      user-select: none;
    `;
    
    button.addEventListener('click', () => {
      if (shouldDisableToggleButton()) {
        return;
      }
      if (state.isVisible) {
        hidePanel();
      } else {
        showPanel();
      }
    });
    
    button.addEventListener('mouseenter', () => {
      if (shouldDisableToggleButton()) {
        return;
      }
      button.style.transform = `translateY(-50%) ${state.settings.panelPosition === 'left' ? 'translateX(5px)' : 'translateX(-5px)'}`;
    });
    
    button.addEventListener('mouseleave', () => {
      if (shouldDisableToggleButton()) {
        return;
      }
      button.style.transform = 'translateY(-50%)';
    });
    
    state.toggleButton = button;
    document.body.appendChild(button);
    updateToggleButtonState();
  }

  function removeToggleButton() {
    if (state.toggleButton) {
      state.toggleButton.remove();
      state.toggleButton = null;
    }
  }

  function updateToggleButtonVisibility() {
    if (state.settings.useClickMode) {
      if (!state.toggleButton) {
        createToggleButton();
      }
    } else {
      removeToggleButton();
    }
  }

  /**
   * Injecte seulement les styles critiques (reset, variables CSS de base)
   * Ces styles sont nécessaires pour le rendu initial
   */
  function injectCriticalStyles() {
    if (!state.shadowRoot) {
      return;
    }

    const criticalStyleElement = document.createElement('style');
    criticalStyleElement.id = 'likethat-critical-styles';
    criticalStyleElement.textContent = `
      /* Reset complet pour le conteneur React */
      #react-root {
        all: initial;
        display: block;
        width: 100%;
        height: 100%;
        overflow: visible;
      }

      /* Reset de base - box-sizing pour tous */
      * {
        box-sizing: border-box;
      }

      /* Variables CSS par défaut */
      .likethat-panel {
        --primary-color: #007bff;
        --primary-hover: #0056b3;
        --background-color-rgb: 255, 255, 255;
        --background-color: rgb(var(--background-color-rgb));
        --surface-color: #f8f9fa;
        --surface-color-transparent: rgba(248, 249, 250, 0.85);
        --surface-color-transparent-hover: rgba(248, 249, 250, 0.95);
        --text-color: #212529;
        --text-muted: #6c757d;
        --border-color: #dee2e6;
        --panel-opacity: 1.0;
      }
    `;
    state.shadowRoot.appendChild(criticalStyleElement);
  }

  /**
   * Injecte tous les styles (thèmes, etc.)
   * Cette fonction est appelée avec requestIdleCallback pour ne pas bloquer
   */
  function injectAllStyles() {
    if (!state.shadowRoot) {
      return;
    }

    // Vérifier si les styles complets sont déjà injectés
    if (state.shadowRoot.getElementById('likethat-full-styles')) {
      return;
    }

    const styleElement = document.createElement('style');
    styleElement.id = 'likethat-full-styles';
    styleElement.textContent = `

      /* Thème Océan - Mode Clair */
      .likethat-panel[data-theme="ocean"][data-color-mode="light"] {
        --primary-color: #0ea5e9;
        --primary-hover: #0284c7;
        --background-color-rgb: 240, 249, 255;
        --background-color: #f0f9ff;
        --surface-color: #e0f2fe;
        --surface-color-transparent: rgba(224, 242, 254, 0.85);
        --surface-color-transparent-hover: rgba(224, 242, 254, 0.95);
        --text-color: #0c4a6e;
        --text-muted: #075985;
        --border-color: #bae6fd;
      }

      /* Thème Océan - Mode Sombre */
      .likethat-panel[data-theme="ocean"][data-color-mode="dark"] {
        --primary-color: #38bdf8;
        --primary-hover: #0ea5e9;
        --background-color-rgb: 12, 30, 46;
        --background-color: #0c1e2e;
        --surface-color: #1e3a52;
        --surface-color-transparent: rgba(30, 58, 82, 0.85);
        --surface-color-transparent-hover: rgba(30, 58, 82, 0.95);
        --text-color: #e0f2fe;
        --text-muted: #7dd3fc;
        --border-color: #164e63;
      }

      /* Thème Forêt - Mode Clair */
      .likethat-panel[data-theme="forest"][data-color-mode="light"] {
        --primary-color: #10b981;
        --primary-hover: #059669;
        --background-color-rgb: 240, 253, 244;
        --background-color: #f0fdf4;
        --surface-color: #dcfce7;
        --surface-color-transparent: rgba(220, 252, 231, 0.85);
        --surface-color-transparent-hover: rgba(220, 252, 231, 0.95);
        --text-color: #064e3b;
        --text-muted: #065f46;
        --border-color: #bbf7d0;
      }

      /* Thème Forêt - Mode Sombre */
      .likethat-panel[data-theme="forest"][data-color-mode="dark"] {
        --primary-color: #34d399;
        --primary-hover: #10b981;
        --background-color-rgb: 10, 31, 22;
        --background-color: #0a1f16;
        --surface-color: #1a3d2b;
        --surface-color-transparent: rgba(26, 61, 43, 0.85);
        --surface-color-transparent-hover: rgba(26, 61, 43, 0.95);
        --text-color: #d1fae5;
        --text-muted: #6ee7b7;
        --border-color: #14532d;
      }

      /* Thème Coucher de soleil - Mode Clair */
      .likethat-panel[data-theme="sunset"][data-color-mode="light"] {
        --primary-color: #f97316;
        --primary-hover: #ea580c;
        --background-color-rgb: 255, 247, 237;
        --background-color: #fff7ed;
        --surface-color: #ffedd5;
        --surface-color-transparent: rgba(255, 237, 213, 0.85);
        --surface-color-transparent-hover: rgba(255, 237, 213, 0.95);
        --text-color: #7c2d12;
        --text-muted: #9a3412;
        --border-color: #fed7aa;
      }

      /* Thème Coucher de soleil - Mode Sombre */
      .likethat-panel[data-theme="sunset"][data-color-mode="dark"] {
        --primary-color: #fb923c;
        --primary-hover: #f97316;
        --background-color-rgb: 46, 23, 8;
        --background-color: #2e1708;
        --surface-color: #4a2c17;
        --surface-color-transparent: rgba(74, 44, 23, 0.85);
        --surface-color-transparent-hover: rgba(74, 44, 23, 0.95);
        --text-color: #ffedd5;
        --text-muted: #fdba74;
        --border-color: #7c2d12;
      }

      /* Thème Nuit - Mode Clair */
      .likethat-panel[data-theme="night"][data-color-mode="light"] {
        --primary-color: #8b5cf6;
        --primary-hover: #7c3aed;
        --background-color-rgb: 250, 245, 255;
        --background-color: #faf5ff;
        --surface-color: #f3e8ff;
        --surface-color-transparent: rgba(243, 232, 255, 0.85);
        --surface-color-transparent-hover: rgba(243, 232, 255, 0.95);
        --text-color: #4c1d95;
        --text-muted: #6b21a8;
        --border-color: #ddd6fe;
      }

      /* Thème Nuit - Mode Sombre */
      .likethat-panel[data-theme="night"][data-color-mode="dark"] {
        --primary-color: #a78bfa;
        --primary-hover: #8b5cf6;
        --background-color-rgb: 30, 19, 51;
        --background-color: #1e1333;
        --surface-color: #3730a3;
        --surface-color-transparent: rgba(55, 48, 163, 0.85);
        --surface-color-transparent-hover: rgba(55, 48, 163, 0.95);
        --text-color: #e9d5ff;
        --text-muted: #c4b5fd;
        --border-color: #4c1d95;
      }

      /* Thème Rose - Mode Clair */
      .likethat-panel[data-theme="rose"][data-color-mode="light"] {
        --primary-color: #ec4899;
        --primary-hover: #db2777;
        --background-color-rgb: 253, 242, 248;
        --background-color: #fdf2f8;
        --surface-color: #fce7f3;
        --surface-color-transparent: rgba(252, 231, 243, 0.85);
        --surface-color-transparent-hover: rgba(252, 231, 243, 0.95);
        --text-color: #831843;
        --text-muted: #9f1239;
        --border-color: #fbcfe8;
      }

      /* Thème Rose - Mode Sombre */
      .likethat-panel[data-theme="rose"][data-color-mode="dark"] {
        --primary-color: #f472b6;
        --primary-hover: #ec4899;
        --background-color-rgb: 46, 10, 31;
        --background-color: #2e0a1f;
        --surface-color: #4a1e37;
        --surface-color-transparent: rgba(74, 30, 55, 0.85);
        --surface-color-transparent-hover: rgba(74, 30, 55, 0.95);
        --text-color: #fce7f3;
        --text-muted: #f9a8d4;
        --border-color: #831843;
      }

      /* Thème Neutre - Mode Clair */
      .likethat-panel[data-theme="neutral"][data-color-mode="light"] {
        --primary-color: #64748b;
        --primary-hover: #475569;
        --background-color-rgb: 248, 250, 252;
        --background-color: #f8fafc;
        --surface-color: #f1f5f9;
        --surface-color-transparent: rgba(241, 245, 249, 0.85);
        --surface-color-transparent-hover: rgba(241, 245, 249, 0.95);
        --text-color: #1e293b;
        --text-muted: #334155;
        --border-color: #cbd5e1;
      }

      /* Thème Neutre - Mode Sombre */
      .likethat-panel[data-theme="neutral"][data-color-mode="dark"] {
        --primary-color: #94a3b8;
        --primary-hover: #64748b;
        --background-color-rgb: 15, 23, 42;
        --background-color: #0f172a;
        --surface-color: #1e293b;
        --surface-color-transparent: rgba(30, 41, 59, 0.85);
        --surface-color-transparent-hover: rgba(30, 41, 59, 0.95);
        --text-color: #e2e8f0;
        --text-muted: #94a3b8;
        --border-color: #334155;
      }

      /* Styles de base pour le panneau principal */
      .likethat-panel {
        display: flex !important;
        flex-direction: column !important;
        width: 100% !important;
        height: 100% !important;
        background: rgba(var(--background-color-rgb), var(--panel-opacity, 1.0)) !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        font-size: var(--font-size, 14px) !important;
        color: var(--text-color) !important;
        overflow: visible !important;
        position: relative !important;
      }

      /* Panel Content */
      .panel-content {
        flex: 1 !important;
        display: flex !important;
        flex-direction: column !important;
        overflow-y: auto !important;
        overflow-x: visible !important;
        padding: 8px !important;
        background: transparent !important;
        position: relative !important;
        z-index: 1 !important;
      }

      /* Bookmark Items */
      .bookmark-list-container {
        display: flex !important;
        flex-direction: column !important;
        height: 100% !important;
        overflow: visible !important;
      }

      .bookmarks-list {
        display: flex !important;
        flex-direction: column !important;
        gap: 2px !important;
        flex: 1 !important;
        overflow-y: auto !important;
        min-height: 0 !important;
        position: relative !important;
      }

      .bookmarks-search-bar {
        display: flex !important;
        align-items: center !important;
        padding: 6px 0 !important;
        border-bottom: 1px solid rgba(0, 0, 0, 0.08) !important;
        margin-bottom: 8px !important;
      }

      .bookmarks-search-input-wrapper {
        flex: 1 !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        padding: 6px 12px !important;
        border-radius: 999px !important;
        background: rgba(0, 0, 0, 0.04) !important;
        border: 1px solid rgba(0, 0, 0, 0.08) !important;
      }

      .bookmarks-search-icon {
        font-size: 0.9em !important;
        color: #6b7280 !important;
      }

      .bookmarks-search-input {
        flex: 1 !important;
        border: none !important;
        background: transparent !important;
        color: inherit !important;
        font-size: 0.95em !important;
        outline: none !important;
      }

      .bookmarks-search-input::placeholder {
        color: #9ca3af !important;
      }

      .bookmarks-search-clear {
        background: rgba(0, 0, 0, 0.08) !important;
        border: 1px solid rgba(0, 0, 0, 0.12) !important;
        color: #4b5563 !important;
        cursor: pointer !important;
        font-size: 0.85em !important;
        font-weight: 500 !important;
        width: 24px !important;
        height: 24px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        border-radius: 999px !important;
        transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease !important;
      }

      .bookmarks-search-clear:hover {
        color: #111827 !important;
        background: rgba(0, 0, 0, 0.15) !important;
        border-color: rgba(0, 0, 0, 0.2) !important;
      }

      .bookmarks-search-close-btn.tooltip-close-btn,
      .bookmarks-search-bar .bookmarks-search-close-btn {
        background: rgba(0, 0, 0, 0.12) !important;
        color: #374151 !important;
        border: 1px solid rgba(0, 0, 0, 0.15) !important;
        border-radius: 999px !important;
        width: 28px !important;
        height: 28px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: pointer !important;
        font-size: 0.85em !important;
        font-weight: 500 !important;
        transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease !important;
        opacity: 1 !important;
      }

      .bookmarks-search-close-btn.tooltip-close-btn:hover,
      .bookmarks-search-bar .bookmarks-search-close-btn:hover {
        background: rgba(0, 0, 0, 0.2) !important;
        border-color: rgba(0, 0, 0, 0.25) !important;
        color: #111827 !important;
        opacity: 1 !important;
      }

      .bookmarks-search-empty {
        padding: 12px !important;
        text-align: center !important;
        color: #6b7280 !important;
        font-style: italic !important;
      }

      .bookmark-item-right {
        min-height: 24px !important;
      }

      .bookmark-search-path {
        font-size: 0.78em !important;
        color: #9ca3af !important;
        white-space: nowrap !important;
        max-width: 180px !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        display: inline-block !important;
        vertical-align: middle !important;
      }

      .bookmarks-list.empty-list {
        min-height: 100px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }

      .bookmarks-list.drag-over-drop-zone {
        background-color: #e3f2fd !important;
        box-shadow: 0 0 0 2px #2196F3 inset !important;
        border-radius: 6px !important;
      }

      .empty-drop-zone {
        text-align: center !important;
        color: #999 !important;
        font-size: 0.93em !important;
        padding: 20px !important;
        width: 100% !important;
      }

      .bookmarks-bar-container {
        display: flex !important;
        flex-direction: column !important;
        gap: 4px !important;
        flex-shrink: 0 !important;
        padding-top: 8px !important;
        margin-top: 0 !important;
        overflow: visible !important;
      }

      .bookmarks-divider-with-controls {
        position: relative !important;
        width: 100% !important;
        height: 30px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }

      .bookmarks-divider {
        position: absolute !important;
        top: 50% !important;
        left: 0 !important;
        right: 0 !important;
        transform: translateY(-50%) !important;
        height: 1px !important;
        background-color: var(--border-color) !important;
      }

      .divider-controls-wrapper {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        pointer-events: none !important;
        padding: 0 4px !important;
      }

      .divider-controls-left,
      .divider-controls-right {
        display: flex !important;
        align-items: center !important;
        gap: 0 !important;
        pointer-events: auto !important;
      }

      /* Cacher les boutons par défaut */
      .divider-controls-wrapper:not(.visible) .divider-control-button {
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* Afficher les boutons au hover */
      .divider-controls-wrapper.visible .divider-control-button {
        opacity: 0.7 !important;
        pointer-events: auto !important;
      }

      /* Styles pour la barre de favoris vide */
      .empty-bar-controls-only {
        position: relative !important;
        min-height: 28px !important;
        padding: 0 !important;
        margin: 0 !important;
      }

      /* Position en bas (par défaut) */
      .empty-bar-position-bottom {
        order: 999 !important;
        margin-top: auto !important;
        padding-bottom: 8px !important;
      }

      /* Position en haut */
      .empty-bar-position-top {
        order: -1 !important;
        margin-bottom: auto !important;
        padding-top: 8px !important;
      }

      .empty-bar-divider {
        justify-content: center !important;
        min-height: 28px !important;
        padding: 4px 0 !important;
      }

      .empty-bar-divider .bookmarks-divider {
        display: none !important;
      }

      .empty-bar-divider .divider-controls-wrapper {
        opacity: 0 !important;
        transition: opacity 0.3s ease !important;
      }

      .empty-bar-divider:hover .divider-controls-wrapper,
      .empty-bar-divider .divider-controls-wrapper.visible {
        opacity: 1 !important;
      }

      .empty-bar-divider:hover .divider-control-button,
      .empty-bar-divider .divider-controls-wrapper.visible .divider-control-button {
        opacity: 0.7 !important;
        pointer-events: auto !important;
      }

      .divider-segment {
        width: 8px !important;
        height: 1px !important;
        background-color: var(--border-color) !important;
        flex-shrink: 0 !important;
        opacity: 0 !important;
        transition: opacity 0.2s ease !important;
      }

      .divider-controls-wrapper.visible .divider-segment {
        opacity: 1 !important;
      }

      .divider-control-button {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 4px !important;
        background: transparent !important;
        border: none !important;
        border-radius: 4px !important;
        cursor: pointer !important;
        font-size: 1em !important;
        transition: background-color 0.2s ease, opacity 0.2s ease !important;
        position: relative !important;
        width: 20px !important;
        height: 20px !important;
      }


      .divider-control-button:hover {
        background-color: rgba(0, 0, 0, 0.1) !important;
        opacity: 1 !important;
      }

      .divider-control-button.edit-button.active {
        background-color: #bbdefb !important;
      }

      .divider-controls-wrapper.visible .divider-control-button.edit-button.active {
        opacity: 1 !important;
      }

      .divider-control-button.search-favorites-button.active {
        background-color: rgba(59, 130, 246, 0.2) !important;
        color: #1d4ed8 !important;
      }

      .divider-controls-wrapper.visible .divider-control-button.search-favorites-button.active {
        opacity: 1 !important;
      }

      .divider-control-button:hover:not(.active) {
        background-color: var(--border-color) !important;
      }

      /* Animations pour l'apparition des boutons */
      @keyframes slideFromLeft {
        from {
          transform: translateX(-10px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 0.7;
        }
      }

      @keyframes slideFromRight {
        from {
          transform: translateX(10px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 0.7;
        }
      }

      /* Animations selon le groupe de boutons et la position du panneau */
      .divider-controls-wrapper.panel-left.visible .divider-controls-left .divider-control-button {
        animation: slideFromLeft 0.3s ease forwards !important;
      }

      .divider-controls-wrapper.panel-left.visible .divider-controls-right .divider-control-button {
        animation: slideFromRight 0.3s ease forwards !important;
      }

      .divider-controls-wrapper.panel-right.visible .divider-controls-left .divider-control-button {
        animation: slideFromRight 0.3s ease forwards !important;
      }

      .divider-controls-wrapper.panel-right.visible .divider-controls-right .divider-control-button {
        animation: slideFromLeft 0.3s ease forwards !important;
      }


      /* Add Folder Tooltip */
      .add-folder-tooltip {
        position: fixed !important;
        background: var(--background-color) !important;
        border: 1px solid var(--border-color) !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        min-width: 250px !important;
        z-index: 2147483649 !important;
        overflow: hidden !important;
        display: flex !important;
        flex-direction: column !important;
      }

      .add-folder-header {
        display: flex !important;
        align-items: center !important;
        padding: 8px 12px !important;
        background: var(--surface-color) !important;
        border-bottom: 1px solid var(--border-color) !important;
        flex-shrink: 0 !important;
        height: 40px !important;
        box-sizing: border-box !important;
      }

      .add-folder-title {
        font-weight: 600 !important;
        font-size: 1em !important;
        color: var(--text-color) !important;
        flex: 1 !important;
      }

      .add-folder-content {
        padding: 12px !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 12px !important;
      }

      .add-folder-input {
        width: 100% !important;
        padding: 8px 12px !important;
        border: 2px solid var(--border-color) !important;
        border-radius: 4px !important;
        font-size: 1em !important;
        font-family: inherit !important;
        transition: border-color 0.2s ease !important;
        box-sizing: border-box !important;
        background: var(--background-color) !important;
        color: var(--text-color) !important;
      }

      .add-folder-input:focus {
        outline: none !important;
        border-color: var(--primary-color) !important;
        box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1) !important;
      }

      .add-folder-input.error {
        border-color: #f44336 !important;
        background-color: #ffebee !important;
      }

      .add-folder-input.error:focus {
        border-color: #d32f2f !important;
        box-shadow: 0 0 0 3px rgba(244, 67, 54, 0.1) !important;
      }

      .add-folder-error {
        color: #f44336 !important;
        font-size: 0.86em !important;
        margin-top: -8px !important;
        padding: 0 4px !important;
      }

      .add-folder-buttons {
        display: flex !important;
        gap: 8px !important;
        justify-content: flex-end !important;
      }

      .add-folder-btn {
        padding: 6px 12px !important;
        border: none !important;
        border-radius: 4px !important;
        font-size: 0.86em !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        transition: background-color 0.2s ease !important;
      }

      .add-folder-btn-cancel {
        background: #6c757d !important;
        color: white !important;
      }

      .add-folder-btn-cancel:hover {
        background: #545b62 !important;
      }

      .add-folder-btn-create {
        background: #007bff !important;
        color: white !important;
      }

      .add-folder-btn-create:hover:not(:disabled) {
        background: #0056b3 !important;
      }

      .add-folder-btn-create:disabled {
        background: #ccc !important;
        cursor: not-allowed !important;
      }

      /* Rename Folder Tooltip */
      .rename-folder-tooltip {
        position: fixed !important;
        background: var(--background-color) !important;
        border: 1px solid var(--border-color) !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        min-width: 250px !important;
        z-index: 2147483649 !important;
        overflow: hidden !important;
        display: flex !important;
        flex-direction: column !important;
      }

      .rename-folder-header {
        display: flex !important;
        align-items: center !important;
        padding: 8px 12px !important;
        background: var(--surface-color) !important;
        border-bottom: 1px solid var(--border-color) !important;
        flex-shrink: 0 !important;
        height: 40px !important;
        box-sizing: border-box !important;
      }

      .rename-folder-title {
        font-weight: 600 !important;
        font-size: 1em !important;
        color: var(--text-color) !important;
        flex: 1 !important;
      }

      .rename-folder-content {
        padding: 12px !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 12px !important;
      }

      .rename-folder-input {
        width: 100% !important;
        padding: 8px 12px !important;
        border: 2px solid var(--border-color) !important;
        border-radius: 4px !important;
        font-size: 1em !important;
        font-family: inherit !important;
        transition: border-color 0.2s ease !important;
        box-sizing: border-box !important;
        background: var(--background-color) !important;
        color: var(--text-color) !important;
      }

      .rename-folder-input:focus {
        outline: none !important;
        border-color: var(--primary-color) !important;
        box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1) !important;
      }

      .rename-folder-buttons {
        display: flex !important;
        gap: 8px !important;
        justify-content: flex-end !important;
      }

      .rename-folder-btn {
        padding: 6px 12px !important;
        border: none !important;
        border-radius: 4px !important;
        font-size: 0.86em !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        transition: background-color 0.2s ease !important;
      }

      .rename-folder-btn-cancel {
        background: #6c757d !important;
        color: white !important;
      }

      .rename-folder-btn-cancel:hover {
        background: #545b62 !important;
      }

      .rename-folder-btn-submit {
        background: #007bff !important;
        color: white !important;
      }

      .rename-folder-btn-submit:hover:not(:disabled) {
        background: #0056b3 !important;
      }

      .rename-folder-btn-submit:disabled {
        background: #ccc !important;
        cursor: not-allowed !important;
      }

      .bookmarks-bar {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 6px !important;
        overflow: visible !important;
      }

      .bookmarks-bar.empty-drop-zone {
        box-shadow: 0 0 0 2px #ccc inset !important;
        border-radius: 6px !important;
        padding: 12px !important;
        justify-content: center !important;
        align-items: center !important;
      }

      .bookmarks-bar.empty-drop-zone.drag-over {
        box-shadow: 0 0 0 2px #2196F3 inset !important;
        background-color: #e3f2fd !important;
      }

      .empty-bar-message {
        color: var(--text-muted) !important;
        font-size: 0.86em !important;
        text-align: center !important;
      }

      /* Zone de drop invisible pour la barre de favoris avec éléments */
      .bookmarks-bar.has-drop-zone {
        min-width: 100% !important;
      }

      .bookmarks-bar-drop-zone {
        flex: 1 !important;
        min-width: 60px !important;
        min-height: 40px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        border: 2px dashed transparent !important;
        border-radius: 6px !important;
        transition: all 0.2s ease !important;
        cursor: pointer !important;
        position: relative !important;
      }

      .bookmarks-bar-drop-zone.active {
        border-color: #2196F3 !important;
        background-color: #e3f2fd !important;
      }

      .bookmarks-bar-drop-zone.active::after {
        content: "↓" !important;
        font-size: 1.43em !important;
        color: #2196F3 !important;
        opacity: 0.7 !important;
      }

      .bookmark-item {
        display: flex !important;
        flex-direction: column !important;
        align-items: stretch !important;
        margin: 0 !important;
        border-radius: 6px !important;
        cursor: pointer !important;
        transition: background-color 0.2s ease !important;
        user-select: none !important;
        position: relative !important;
        background: transparent !important;
      }

      .bookmark-item-header {
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        padding: 4px 8px !important;
        gap: 6px !important;
        min-height: 28px !important;
      }

      /* Hover uniquement sur l'élément directement ciblé, pas sur les parents */
      .bookmark-folder-toggle-title-container {
        padding: 4px 8px !important;
        border-radius: 4px !important;
        margin: 0 !important;
      }
      
      .bookmark-folder-toggle-title-container:hover {
        background-color: var(--surface-color) !important;
      }

      .bookmark-item:not(.folder) > div {
        padding: 4px 8px !important;
        border-radius: 4px !important;
        width: 100% !important;
      }

      .bookmark-item:not(.folder) > div:hover {
        background-color: var(--surface-color) !important;
      }

      .bookmark-folder-toggle {
        width: 16px !important;
        height: 16px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 0.86em !important;
        color: #666666 !important;
        flex-shrink: 0 !important;
      }

      .bookmark-folder-toggle::before {
        content: '▶' !important;
        display: block !important;
      }

      .bookmark-folder-toggle.expanded::before {
        content: '▼' !important;
      }

      .bookmark-folder-toggle-title-container {
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        gap: 6px !important;
      }

      .bookmark-title {
        display: flex !important;
        gap: 6px !important;
        flex: 1 !important;
        font-size: 0.93em !important;
        color: var(--text-color) !important;
        line-height: 1.4 !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
      }

      /* Styles pour le défilement automatique du texte */
      .scrolling-text-container {
        position: relative !important;
        overflow: hidden !important;
        min-width: 0 !important;
      }

      .scrolling-text-wrapper {
        display: inline-flex !important;
        white-space: nowrap !important;
      }

      .scrolling-text {
        display: inline-block !important;
        white-space: nowrap !important;
      }

      .scrolling-text-wrapper.scrolling {
        animation: scrollTextLoop 10s linear infinite !important;
      }

      @keyframes scrollTextLoop {
        0% {
          transform: translateX(0) !important;
        }
        100% {
          transform: translateX(calc(-1 * var(--text-width, 0px) - 30px)) !important;
        }
      }

      /* S'assurer que le texte dans les tooltips peut défiler */
      .tooltip-text.scrolling-text-container {
        overflow: hidden !important;
        text-overflow: clip !important;
      }

      .tooltip-title .scrolling-text-container {
        overflow: hidden !important;
        text-overflow: clip !important;
      }

      .bookmark-favicon {
        width: 14px !important;
        height: 14px !important;
        flex-shrink: 0 !important;
        border-radius: 2px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 0.86em !important;
      }

      .bookmark-favicon img {
        width: 100% !important;
        height: 100% !important;
        object-fit: contain !important;
        display: block !important;
      }

      .bookmark-children {
        display: flex !important;
        flex-direction: column !important;
        padding-left: 20px !important;
        margin-top: 0 !important;
        gap: 2px !important;
      }

      .bookmark-button-wrapper {
        position: relative !important;
        display: inline-flex !important;
        flex-direction: column !important;
        align-items: center !important;
        gap: 4px !important;
        margin: 4px !important;
      }

      .bookmark-button-wrapper.folder-wrapper {
        overflow: visible !important;
      }

      .bookmark-button-wrapper.dragging {
        opacity: 0.5 !important;
      }

      .bookmark-button-wrapper.drag-over-before {
        box-shadow: 3px 0 0 0 #2196F3 inset !important;
      }

      .bookmark-button-wrapper.drag-over-after {
        box-shadow: -3px 0 0 0 #2196F3 inset !important;
      }

      .bookmark-button-wrapper.folder-wrapper.drag-over-inside {
        box-shadow: 0 0 0 3px #2196F3 inset !important;
        background-color: #e3f2fd !important;
        border-radius: 6px !important;
      }

      .bookmark-button {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 8px 12px !important;
        margin: 0 !important;
        background-color:rgb(0, 0, 0, 0.1) !important;
        transition: background-color 0.3s ease !important;
        border: none !important;
        cursor: pointer !important;
        user-select: none !important;
        border-radius: 6px !important;
        position: relative !important;
        gap: 4px !important;
        font-size: 1.14em !important;
      }

      .bookmark-button.folder-button {
        min-width: 44px !important;
      }

      .bookmark-button:hover {
        background-color:rgb(0, 0, 0, 0.5) !important;
      }

      .bookmark-button-wrapper[draggable="true"] .bookmark-button {
        cursor: grab !important;
      }

      .bookmark-button-wrapper[draggable="true"]:active .bookmark-button {
        cursor: grabbing !important;
      }

      .bookmark-button-icon {
        position: absolute !important;
        top: -8px !important;
        right: 12px !important;
        background: #4CAF50 !important;
        color: white !important;
        border: none !important;
        border-radius: 50% !important;
        width: 20px !important;
        height: 20px !important;
        font-size: 0.71em !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: pointer !important;
        padding: 0 !important;
        z-index: 10 !important;
      }

      .bookmark-button-icon:hover {
        background: #66BB6A !important;
      }

      .bookmark-button-rename {
        position: absolute !important;
        top: -8px !important;
        right: 36px !important;
        background: #FF9800 !important;
        color: white !important;
        border: none !important;
        border-radius: 50% !important;
        width: 20px !important;
        height: 20px !important;
        font-size: 0.71em !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: pointer !important;
        padding: 0 !important;
        z-index: 10 !important;
      }

      .bookmark-button-rename:hover {
        background: #F57C00 !important;
      }

      .bookmark-button-delete {
        position: absolute !important;
        top: -8px !important;
        right: -8px !important;
        background: #ff5252 !important;
        color: white !important;
        border: none !important;
        border-radius: 50% !important;
        width: 20px !important;
        height: 20px !important;
        font-size: 0.71em !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: pointer !important;
        padding: 0 !important;
        z-index: 10 !important;
      }

      .bookmark-button-delete:hover {
        background: #d32f2f !important;
      }

      .drag-handle-icon {
        font-size: 0.57em !important;
        color: #666 !important;
        line-height: 1 !important;
      }

      .drag-handle-icon.hidden {
        visibility: hidden !important;
      }

      /* Icon Selector Tooltip */
      .icon-selector-tooltip {
        position: fixed !important;
        background: var(--background-color) !important;
        border: 1px solid var(--border-color) !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        min-width: 250px !important;
        max-width: 400px !important;
        z-index: 2147483649 !important;
        overflow: hidden !important;
        display: flex !important;
        flex-direction: column !important;
      }

      .icon-selector-header {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        padding: 8px 12px !important;
        background: var(--surface-color) !important;
        border-bottom: 1px solid var(--border-color) !important;
        flex-shrink: 0 !important;
        height: 40px !important;
        box-sizing: border-box !important;
      }

      .icon-selector-back-btn {
        background: none !important;
        border: none !important;
        cursor: pointer !important;
        font-size: 1.14em !important;
        color: var(--text-muted) !important;
        padding: 4px !important;
        border-radius: 4px !important;
      }

      .icon-selector-back-btn:hover {
        background-color: rgba(0, 0, 0, 0.1) !important;
      }

      .icon-selector-title {
        font-weight: 600 !important;
        font-size: 1em !important;
        color: var(--text-color) !important;
        flex: 1 !important;
      }

      .icon-selector-content {
        flex: 1 !important;
        overflow-y: auto !important;
        padding: 8px !important;
        display: flex !important;
        flex-direction: column !important;
      }

      .icon-grid {
        display: grid !important;
        grid-template-columns: repeat(auto-fill, minmax(40px, 1fr)) !important;
        gap: 8px !important;
        max-height: 300px !important;
        overflow-y: auto !important;
      }

      .icon-option {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 8px !important;
        border-radius: 6px !important;
        cursor: pointer !important;
        transition: background-color 0.2s ease !important;
      }

      .icon-option:hover {
        background-color: rgba(0, 0, 0, 0.1) !important;
      }

      .color-grid {
        display: grid !important;
        grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)) !important;
        gap: 12px !important;
        max-height: 300px !important;
        overflow-y: auto !important;
      }

      .color-option {
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        gap: 4px !important;
        padding: 12px 8px !important;
        border-radius: 8px !important;
        cursor: pointer !important;
        transition: background-color 0.2s ease !important;
      }

      .color-option:hover {
        background-color: rgba(0, 0, 0, 0.05) !important;
      }

      .icon-preview {
        width: 24px !important;
        height: 24px !important;
        object-fit: contain !important;
        filter: brightness(0) saturate(100%) !important;
        transition: filter 0.3s ease !important;
      }

      .color-name {
        font-size: 0.79em !important;
        color: #666 !important;
        text-align: center !important;
        font-weight: 500 !important;
      }

      /* Effets néon pour les icônes - Version améliorée */
      /* 
      Explication des propriétés CSS :
      - brightness(0) : Convertit l'icône en noir pur (base pour la coloration)
      - saturate(100%) : Maintient la saturation maximale
      - invert() : Inverse les couleurs pour créer la base de couleur
      - sepia() : Ajoute une teinte sépia pour la base
      - saturate() : Augmente l'intensité de la couleur (néon)
      - hue-rotate() : Ajuste la teinte pour obtenir la couleur désirée
      - brightness() : Contrôle la luminosité finale (néon plus ou moins intense)
      - contrast() : Augmente le contraste pour un effet plus percutant
      - drop-shadow() : Crée l'effet de halo lumineux autour de l'icône
      */
      
      .neon-blue {
        filter: brightness(0) 
                saturate(100%) 
                invert(27%) sepia(100%) saturate(2000%) hue-rotate(240deg) 
                brightness(1.8) contrast(1.4)
                drop-shadow(0 0 1px rgba(0, 150, 255, 0.8))
                drop-shadow(0 0 2px rgba(0, 150, 255, 0.6))
                drop-shadow(0 0 3px rgba(0, 150, 255, 0.4)) !important;
      }

      .neon-green {
        filter: brightness(0) 
                saturate(100%) 
                invert(48%) sepia(100%) saturate(2000%) hue-rotate(90deg) 
                brightness(1.8) contrast(1.4)
                drop-shadow(0 0 1px rgba(0, 255, 100, 0.8))
                drop-shadow(0 0 2px rgba(0, 255, 100, 0.6))
                drop-shadow(0 0 3px rgba(0, 255, 100, 0.4)) !important;
      }

      .neon-red {
        filter: brightness(0) 
                saturate(100%) 
                invert(17%) sepia(100%) saturate(2000%) hue-rotate(0deg) 
                brightness(1.8) contrast(1.4)
                drop-shadow(0 0 1px rgba(255, 50, 50, 0.8))
                drop-shadow(0 0 2px rgba(255, 50, 50, 0.6))
                drop-shadow(0 0 3px rgba(255, 50, 50, 0.4)) !important;
      }

      .neon-purple {
        filter: brightness(0) 
                saturate(100%) 
                invert(20%) sepia(100%) saturate(2000%) hue-rotate(270deg) 
                brightness(1.8) contrast(1.4)
                drop-shadow(0 0 1px rgba(180, 50, 255, 0.8))
                drop-shadow(0 0 2px rgba(180, 50, 255, 0.6))
                drop-shadow(0 0 3px rgba(180, 50, 255, 0.4)) !important;
      }

      .neon-orange {
        filter: brightness(0) 
                saturate(100%) 
                invert(48%) sepia(100%) saturate(2000%) hue-rotate(15deg) 
                brightness(1.8) contrast(1.4)
                drop-shadow(0 0 1px rgba(255, 150, 0, 0.8))
                drop-shadow(0 0 2px rgba(255, 150, 0, 0.6))
                drop-shadow(0 0 3px rgba(255, 150, 0, 0.4)) !important;
      }

      .neon-pink {
        filter: brightness(0) 
                saturate(100%) 
                invert(17%) sepia(100%) saturate(2000%) hue-rotate(320deg) 
                brightness(1.8) contrast(1.4)
                drop-shadow(0 0 1px rgba(255, 50, 150, 0.8))
                drop-shadow(0 0 2px rgba(255, 50, 150, 0.6))
                drop-shadow(0 0 3px rgba(255, 50, 150, 0.4)) !important;
      }

      /* ========================================
         ANIMATIONS NÉON
         ======================================== */

      /* Animation principale : pulse lumineux doux (respiration)
         Fait varier l'opacité et légèrement l'échelle pour simuler
         l'intensité changeante d'une enseigne néon */
      @keyframes neonPulse {
        0%, 100% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: 0.7;
          transform: scale(1.05);
        }
      }

      /* Classe générique pour activer l'animation de pulse
         À ajouter à n'importe quelle icône avec une classe .neon-* */
      .icon-neon {
        animation: neonPulse 1.8s ease-in-out infinite;
        transition: all 0.3s ease;
      }

      /* Animation bonus : flicker (clignotement initial comme un néon qui s'allume)
         Simule les micro-coupures d'un tube néon au démarrage */
      @keyframes neonFlicker {
        0%, 100% {
          opacity: 1;
        }
        2%, 8%, 12%, 20%, 25%, 40%, 45% {
          opacity: 0.4;
        }
        4%, 10%, 15%, 22%, 42% {
          opacity: 0.1;
        }
        6%, 18%, 28%, 50% {
          opacity: 1;
        }
        55% {
          opacity: 0.9;
        }
        60% {
          opacity: 1;
        }
      }

      /* Classe pour l'effet de flicker au démarrage
         L'animation ne joue qu'une fois, puis l'icône reste stable
         Peut être combinée avec .icon-neon pour avoir flicker + pulse continu */
      .neon-flicker {
        animation: neonFlicker 1.5s ease-in-out 1;
      }

      /* Version combinée : flicker au démarrage puis pulse continu
         Utilise plusieurs animations séquencées */
      .neon-flicker-pulse {
        animation: neonFlicker 1.5s ease-in-out 1, neonPulse 1.8s ease-in-out 1.5s infinite;
        transition: all 0.3s ease;
      }

      /* Variante plus intense du pulse (optionnel)
         Pour un effet plus prononcé sur certaines icônes */
      @keyframes neonPulseIntense {
        0%, 100% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: 0.6;
          transform: scale(1.1);
        }
      }

      .icon-neon-intense {
        animation: neonPulseIntense 1.2s ease-in-out infinite;
        transition: all 0.3s ease;
      }

      /* Styles pour les icônes de dossiers personnalisées */
      .folder-custom-icon {
        width: 16px !important;
        height: 16px !important;
        object-fit: contain !important;
        margin-right: 4px !important;
      }

      /* Styles pour les icônes dans les tooltips de dossiers */
      .tooltip-folder-icon {
        margin-bottom: 4px !important;
        width: 18px !important;
        height: 18px !important;
        max-width: 18px !important;
        max-height: 18px !important;
        min-width: 18px !important;
        min-height: 18px !important;
        margin-right: 6px !important;
        object-fit: contain !important;
        display: inline-block !important;
        vertical-align: middle !important;
      }

      .tooltip-icon {
        width: 12px !important;
        height: 12px !important;
        max-width: 12px !important;
        max-height: 12px !important;
        min-width: 12px !important;
        min-height: 12px !important;
        object-fit: contain !important;
        flex-shrink: 0 !important;
        display: inline-block !important;
        vertical-align: middle !important;
      }

      /* Folder Tooltip */
      .folder-tooltip {
        position: fixed !important;
        background: var(--background-color) !important;
        border: 1px solid var(--border-color) !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        min-width: 200px !important;
        max-width: 300px !important;
        z-index: 2147483648 !important;
        overflow: hidden !important;
        display: flex !important;
        flex-direction: column !important;
      }

      .tooltip-header {
        position: relative !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        padding: 8px 12px !important;
        background: var(--surface-color) !important;
        border-bottom: 1px solid var(--border-color) !important;
        flex-shrink: 0 !important;
        height: 40px !important;
        box-sizing: border-box !important;
        overflow: visible !important;
      }

      .tooltip-back-btn {
        background: none !important;
        border: none !important;
        cursor: pointer !important;
        font-size: 1em !important;
        padding: 4px !important;
        color: var(--text-muted) !important;
        display: flex !important;
        align-items: center !important;
        position: relative !important;
        z-index: 10 !important;
        opacity: 0 !important;
        transition: all 0.2s ease !important;
      }

      .tooltip-header:hover .tooltip-back-btn {
        opacity: 0.7 !important;
      }

      .tooltip-back-btn:hover {
        opacity: 1 !important;
        color: var(--text-color) !important;
        background: var(--border-color) !important;
        border-radius: 4px !important;
      }

      .tooltip-content {
        flex: 1 !important;
        overflow-y: auto !important;
        padding: 4px !important;
        display: flex !important;
        flex-direction: column !important;
      }

      .tooltip-item {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        padding: 8px 12px !important;
        cursor: pointer !important;
        border-radius: 4px !important;
        transition: background-color 0.2s ease !important;
        min-height: 40px !important;
        height: 40px !important;
        box-sizing: border-box !important;
      }

      .tooltip-item:hover {
        background-color: var(--surface-color) !important;
      }

      .tooltip-icon {
        margin-bottom: 8px !important;
        font-size: 1em !important;
        flex-shrink: 0 !important;
      }

      /* Retirer le margin-bottom pour les icônes personnalisées dans les tooltips */
      .tooltip-icon[class*="neon-"],
      img.tooltip-icon {
        margin-bottom: 0 !important;
      }

      .tooltip-favicon {
        width: 14px !important;
        height: 14px !important;
        flex-shrink: 0 !important;
      }

      .tooltip-text {
        flex: 1 !important;
        font-size: 0.93em !important;
        color: var(--text-color) !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      .tooltip-arrow {
        font-size: 0.86em !important;
        color: var(--text-muted) !important;
        flex-shrink: 0 !important;
      }

      .tooltip-empty {
        padding: 20px !important;
        text-align: center !important;
        color: var(--text-muted) !important;
        font-size: 0.86em !important;
      }

      /* Bouton Edit du tooltip */
      .tooltip-edit-btn,
      .tooltip-open-all-btn,
      .tooltip-rename-folder-btn {
        background: none !important;
        border: none !important;
        cursor: pointer !important;
        font-size: 1.14em !important;
        padding: 4px 8px !important;
        color: var(--text-muted) !important;
        display: flex !important;
        align-items: center !important;
        border-radius: 4px !important;
        opacity: 0 !important;
        transition: all 0.2s ease !important;
        position: relative !important;
        z-index: 10 !important;
      }

      .tooltip-header:hover .tooltip-edit-btn,
      .tooltip-header:hover .tooltip-open-all-btn,
      .tooltip-header:hover .tooltip-rename-folder-btn {
        opacity: 0.7 !important;
      }

      .tooltip-edit-btn:hover,
      .tooltip-open-all-btn:hover,
      .tooltip-rename-folder-btn:hover {
        opacity: 1 !important;
      }

      .tooltip-edit-btn:hover {
        opacity: 1 !important;
        color: var(--text-color) !important;
        background: var(--border-color) !important;
      }

      .tooltip-edit-btn.active {
        opacity: 1 !important;
        color: #4CAF50 !important;
        background: #e8f5e9 !important;
      }

      .tooltip-open-all-btn:hover {
        opacity: 1 !important;
        color: var(--text-color) !important;
        background: var(--border-color) !important;
      }

      .tooltip-rename-folder-btn:hover {
        opacity: 1 !important;
        color: var(--text-color) !important;
        background: var(--border-color) !important;
      }

      /* Bouton "Ouvrir tous" dans la section Autres favoris */
      .open-all-btn {
        opacity: 0 !important;
        pointer-events: none !important;
        background: none !important;
        border: none !important;
        cursor: pointer !important;
        font-size: 1em !important;
        padding: 4px 8px !important;
        color: var(--text-muted) !important;
        display: flex !important;
        align-items: center !important;
        border-radius: 4px !important;
        transition: all 0.2s ease !important;
      }

      .bookmark-item:hover .open-all-btn {
        opacity: 0.7 !important;
        pointer-events: auto !important;
      }

      .open-all-btn:hover {
        opacity: 1 !important;
        color: #4CAF50 !important;
        background: #e8f5e9 !important;
      }

      /* Bouton de fermeture universel pour tous les tooltips */
      .tooltip-close-btn {
        background: none !important;
        border: none !important;
        cursor: pointer !important;
        font-size: 1.29em !important;
        padding: 4px 8px !important;
        color: var(--text-muted) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        border-radius: 4px !important;
        opacity: 0 !important;
        transition: all 0.2s ease !important;
        margin-left: 4px !important;
        line-height: 1 !important;
        width: 28px !important;
        height: 28px !important;
      }

      .tooltip-header:hover .tooltip-close-btn,
      .icon-selector-header:hover .tooltip-close-btn,
      .add-folder-header:hover .tooltip-close-btn,
      .rename-folder-header:hover .tooltip-close-btn {
        opacity: 1 !important;
      }

      .tooltip-close-btn:hover {
        color: #f44336 !important;
        background: #ffebee !important;
      }

      /* Titre du tooltip */
      .tooltip-title {
        font-weight: 600 !important;
        font-size: 0.93em !important;
        color: var(--text-color) !important;
        flex: 1 !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 6px !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
        pointer-events: none !important;
        min-width: 0 !important;
      }

      /* Conteneur des boutons du header */
      .tooltip-header-actions {
        display: flex !important;
        align-items: center !important;
        gap: 4px !important;
        margin-left: auto !important;
        position: relative !important;
        z-index: 10 !important;
        background: transparent !important;
        padding: 2px !important;
        border-radius: 6px !important;
        transition: background-color 0.2s ease !important;
      }

      /* Background semi-transparent quand les boutons apparaissent au hover */
      .tooltip-header:hover .tooltip-header-actions {
        background: var(--surface-color-transparent, rgba(245, 245, 245, 0.75)) !important;
      }

      /* Boutons d'édition du titre */
      .tooltip-title-editing {
        flex: 1 !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
      }

      .tooltip-title-input {
        flex: 1 !important;
        max-width: 200px !important;
        padding: 4px 8px !important;
        border: 1px solid #2196f3 !important;
        border-radius: 4px !important;
        font-size: 1em !important;
        font-weight: 600 !important;
        background: white !important;
        outline: none !important;
      }

      .tooltip-validate-rename-btn,
      .tooltip-cancel-rename-btn {
        background: none !important;
        border: none !important;
        cursor: pointer !important;
        font-size: 1.14em !important;
        padding: 4px 8px !important;
        border-radius: 4px !important;
        transition: background-color 0.2s, transform 0.2s !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 28px !important;
        height: 28px !important;
        line-height: 1 !important;
      }

      .tooltip-validate-rename-btn {
        color: #4CAF50 !important;
      }

      .tooltip-validate-rename-btn:hover {
        background: #e8f5e9 !important;
        transform: scale(1.1) !important;
      }

      .tooltip-cancel-rename-btn {
        color: #f44336 !important;
      }

      .tooltip-cancel-rename-btn:hover {
        background: #ffebee !important;
        transform: scale(1.1) !important;
      }

      /* Item en mode édition */
      .tooltip-item.edit-mode {
        justify-content: space-between !important;
        cursor: default !important;
      }

      .tooltip-item-content {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        flex: 1 !important;
        min-width: 0 !important;
        height: 100% !important;
      }

      .tooltip-item.edit-mode .tooltip-item-content {
        cursor: default !important;
      }

      /* Actions du tooltip */
      .tooltip-item-actions {
        display: flex !important;
        gap: 4px !important;
        flex-shrink: 0 !important;
        margin-left: 8px !important;
        height: 100% !important;
        align-items: center !important;
      }

      .tooltip-action-btn {
        background: none !important;
        border: none !important;
        cursor: pointer !important;
        font-size: 1em !important;
        padding: 4px 6px !important;
        border-radius: 4px !important;
        transition: all 0.2s ease !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 24px !important;
        height: 24px !important;
      }

      .tooltip-action-btn:hover {
        background: #f0f0f0 !important;
        transform: scale(1.1) !important;
      }

      .tooltip-rename-btn:hover {
        background: #e3f2fd !important;
      }

      .tooltip-icon-btn:hover {
        background: #f3e5f5 !important;
      }

      .tooltip-delete-btn:hover {
        background: #ffebee !important;
      }

      .tooltip-validate-btn:hover {
        background: #e8f5e9 !important;
      }

      .tooltip-cancel-btn:hover {
        background: #ffebee !important;
      }

      /* Input de renommage dans le tooltip */
      .tooltip-rename-input {
        flex: 0 1 auto !important;
        max-width: 150px !important;
        min-width: 80px !important;
        width: auto !important;
        border: 1px solid var(--primary-color) !important;
        border-radius: 3px !important;
        padding: 2px 6px !important;
        font-size: 0.93em !important;
        outline: none !important;
        background: var(--background-color) !important;
        color: var(--text-color) !important;
      }

      .tooltip-rename-input:focus {
        border-color: var(--primary-hover) !important;
        box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1) !important;
      }

      /* Scrollbar */
      .panel-content::-webkit-scrollbar {
        width: 8px !important;
      }

      .panel-content::-webkit-scrollbar-track {
        background: var(--surface-color) !important;
      }

      .panel-content::-webkit-scrollbar-thumb {
        background: var(--text-muted) !important;
        border-radius: 4px !important;
      }

      .panel-content::-webkit-scrollbar-thumb:hover {
        background: var(--text-color) !important;
      }

      /* Folder Selector Tooltip */
      .folder-selector-tooltip {
        position: fixed !important;
        background: var(--background-color) !important;
        border: 1px solid var(--border-color) !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15) !important;
        min-width: 300px !important;
        max-width: 400px !important;
        max-height: 500px !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
        z-index: 2147483649 !important;
      }

      .folder-selector-header {
        display: flex !important;
        align-items: center !important;
        padding: 12px !important;
        border-bottom: 1px solid var(--border-color) !important;
        background: var(--surface-color) !important;
        gap: 8px !important;
      }

      .folder-selector-back-btn {
        background: none !important;
        border: none !important;
        cursor: pointer !important;
        font-size: 1.14em !important;
        padding: 4px !important;
        opacity: 0.7 !important;
        transition: opacity 0.2s !important;
      }

      .folder-selector-back-btn:hover {
        opacity: 1 !important;
      }

      .folder-selector-title {
        flex: 1 !important;
        font-weight: 600 !important;
        font-size: 1em !important;
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
        color: var(--text-color) !important;
      }

      .folder-selector-icon {
        width: 16px !important;
        height: 16px !important;
        flex-shrink: 0 !important;
      }

      .folder-selector-close-btn {
        background: none !important;
        border: none !important;
        cursor: pointer !important;
        font-size: 1.29em !important;
        padding: 4px 8px !important;
        color: var(--text-muted) !important;
        border-radius: 4px !important;
        opacity: 0.7 !important;
        transition: opacity 0.2s !important;
      }

      .folder-selector-close-btn:hover {
        opacity: 1 !important;
        color: #f44336 !important;
        background: #ffebee !important;
      }

      .folder-selector-content {
        padding: 8px !important;
        max-height: 400px !important;
        overflow-y: auto !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 4px !important;
      }

      .folder-selector-item {
        display: flex !important;
        align-items: center !important;
        padding: 8px 12px !important;
        border-radius: 4px !important;
        cursor: pointer !important;
        transition: background-color 0.2s !important;
        gap: 8px !important;
      }

      .folder-selector-item:hover {
        background-color: var(--border-color) !important;
      }

      .folder-selector-current {
        background-color: #e3f2fd !important;
        border: 2px solid #2196f3 !important;
      }

      .folder-selector-current:hover {
        background-color: #bbdefb !important;
      }

      .folder-selector-item-content {
        flex: 1 !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
      }

      .folder-selector-text {
        flex: 1 !important;
        font-size: 0.93em !important;
        color: var(--text-color) !important;
      }

      .folder-selector-add-btn {
        background: #4caf50 !important;
        color: white !important;
        border: none !important;
        border-radius: 4px !important;
        padding: 4px 8px !important;
        cursor: pointer !important;
        font-size: 1em !important;
        font-weight: bold !important;
        transition: transform 0.2s, background-color 0.2s !important;
      }

      .folder-selector-add-btn:hover {
        transform: scale(1.1) !important;
        background: #388e3c !important;
      }

      .folder-selector-empty {
        padding: 20px !important;
        text-align: center !important;
        color: var(--text-muted) !important;
        font-size: 0.93em !important;
        font-style: italic !important;
      }

      .folder-selector-create-form {
        padding: 12px !important;
        border-top: 1px solid var(--border-color) !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 8px !important;
      }

      .folder-selector-input {
        padding: 8px 12px !important;
        border: 1px solid var(--border-color) !important;
        border-radius: 4px !important;
        font-size: 0.93em !important;
        outline: none !important;
        transition: border-color 0.2s !important;
        background: var(--background-color) !important;
        color: var(--text-color) !important;
      }

      .folder-selector-input:focus {
        border-color: #2196f3 !important;
      }

      .folder-selector-input.error {
        border-color: #f44336 !important;
      }

      .folder-selector-error {
        color: #f44336 !important;
        font-size: 0.86em !important;
      }

      .folder-selector-buttons {
        display: flex !important;
        gap: 8px !important;
        justify-content: flex-end !important;
      }

      .folder-selector-btn {
        padding: 6px 12px !important;
        border-radius: 4px !important;
        border: none !important;
        cursor: pointer !important;
        font-size: 0.93em !important;
        transition: background-color 0.2s !important;
      }

      .folder-selector-btn-cancel {
        background: var(--border-color) !important;
        color: var(--text-color) !important;
      }

      .folder-selector-btn-cancel:hover {
        background: var(--text-muted) !important;
      }

      .folder-selector-btn-create {
        background: #2196f3 !important;
        color: white !important;
      }

      .folder-selector-btn-create:hover {
        background: #1976d2 !important;
      }

      .folder-selector-btn-create:disabled {
        background: #ccc !important;
        cursor: not-allowed !important;
        opacity: 0.5 !important;
      }

      .folder-selector-new-folder-btn {
        width: 100% !important;
        padding: 8px !important;
        border: 1px dashed var(--border-color) !important;
        border-radius: 4px !important;
        background: none !important;
        cursor: pointer !important;
        font-size: 0.93em !important;
        color: var(--text-muted) !important;
        transition: background-color 0.2s, border-color 0.2s !important;
      }

      .folder-selector-new-folder-btn:hover {
        background: var(--border-color) !important;
        border-color: #2196f3 !important;
        color: var(--text-color) !important;
      }

      /* Responsive */
      @media (max-width: 768px) {
        .likethat-panel {
          width: 100% !important;
        }
      }

      /* Drag and Drop Styles */
      .drag-handle {
        cursor: grab !important;
        color: var(--text-muted) !important;
        font-size: 1.14em !important;
        user-select: none !important;
        opacity: 0.6 !important;
        transition: opacity 0.2s ease !important;
      }

      .drag-handle:hover {
        opacity: 1 !important;
      }

      .drag-handle.hidden {
        visibility: hidden !important;
      }

      .bookmark-item.dragging {
        opacity: 0.5 !important;
        background-color: #e3f2fd !important;
      }

      .bookmark-item.drag-over-before {
        box-shadow: 0 -3px 0 0 #2196F3 inset !important;
      }

      .bookmark-item.drag-over-inside.folder {
        box-shadow: 0 0 0 3px #2196F3 inset, inset 0 0 8px rgba(33, 150, 243, 0.3) !important;
        background-color: #e3f2fd !important;
      }

      .bookmark-item.drag-over-after {
        box-shadow: 0 3px 0 0 #2196F3 inset !important;
      }

      .bookmark-item[draggable="true"] {
        cursor: grab !important;
      }

      .bookmark-item[draggable="true"]:active {
        cursor: grabbing !important;
      }

      /* Edit Controls */
      .edit-controls {
        display: flex !important;
        gap: 4px !important;
        align-items: center !important;
      }

      .edit-btn {
        padding: 4px 6px !important;
        font-size: 0.86em !important;
        border: none !important;
        border-radius: 4px !important;
        cursor: pointer !important;
        transition: background-color 0.2s ease !important;
        background: transparent !important;
      }

      .edit-btn:hover {
        background-color: #e0e0e0 !important;
      }

      .edit-btn.delete:hover {
        background-color: #ffcdd2 !important;
      }

      /* Utility classes */
      .flex {
        display: flex !important;
      }

      .items-center {
        align-items: center !important;
      }

      .justify-between {
        justify-content: space-between !important;
      }

      .justify-center {
        justify-content: center !important;
      }

      .gap-1 {
        gap: 4px !important;
      }

      .gap-2 {
        gap: 8px !important;
      }

      .mr-2 {
        margin-right: 8px !important;
      }

      .p-1 {
        padding: 4px !important;
      }

      .p-2 {
        padding: 8px !important;
      }

      .text-xs {
        font-size: 0.86em !important;
      }

      .rounded {
        border-radius: 4px !important;
      }

    `;
    state.shadowRoot.appendChild(styleElement);
  }

  function injectStyles() {
    if (!state.shadowRoot) {
      return Promise.resolve();
    }

    // Injecter les styles critiques immédiatement
    injectCriticalStyles();

    // Injecter le reste des styles avec requestIdleCallback
    return new Promise((resolve) => {
      const injectRemaining = () => {
        injectAllStyles();
        resolve();
      };

      if (window.requestIdleCallback) {
        requestIdleCallback(injectRemaining, { timeout: 200 });
      } else {
        requestAnimationFrame(() => {
          setTimeout(injectRemaining, 0);
        });
      }
    });
  }


  function setupEvents() {
    setupHoverEvents();
    setupEditModeObserver();
  }
  
  // Observer pour détecter les changements de mode édition et tooltips
  function setupEditModeObserver() {
    if (!state.shadowRoot) return;
    
    // Observer les changements dans le Shadow DOM pour détecter les tooltips et le mode édition
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          // Vérifier si c'est le bouton d'édition qui a changé
          if (mutation.target.classList.contains('edit-button')) {
            console.log('Changement du mode édition détecté');
          }
        }
        
        if (mutation.type === 'childList') {
          // Vérifier si des tooltips ont été ajoutés ou supprimés
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const tooltips = node.querySelectorAll ? node.querySelectorAll(TOOLTIP_SELECTOR) : [];
              if (tooltips.length > 0 || (node.matches && node.matches(TOOLTIP_SELECTOR))) {
                console.log('Tooltip ajouté détecté');
                updateToggleButtonState();
              }
            }
          });
          
          mutation.removedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const tooltips = node.querySelectorAll ? node.querySelectorAll(TOOLTIP_SELECTOR) : [];
              if (tooltips.length > 0 || (node.matches && node.matches(TOOLTIP_SELECTOR))) {
                console.log('Tooltip supprimé détecté');
                // Attendre un peu pour vérifier si ce n'est pas juste un re-render
                // Si un tooltip existe toujours après 300ms, c'est probablement un re-render
                setTimeout(() => {
                  updateToggleButtonState();
                  if (shouldKeepPanelOpen()) {
                    console.log('Tooltip toujours présent après suppression, probablement un re-render');
                    return;
                  }
                  // Vérifier si la souris est toujours dans le panneau après la fermeture du tooltip
                  checkMousePositionAfterTooltipClose();
                }, 300);
              }
            }
          });
        }
      });
    });
    
    // Observer le Shadow DOM pour les changements
    observer.observe(state.shadowRoot, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }
  
  // Fonction pour vérifier la position de la souris après la fermeture d'un tooltip
  function checkMousePositionAfterTooltipClose() {
    setTimeout(() => {
      // Attendre un peu pour laisser le temps au DOM de se mettre à jour
      const mouseX = state.lastMouseX || 0;
      const mouseY = state.lastMouseY || 0;
      
      console.log('Vérification position souris après fermeture tooltip:', mouseX, mouseY);
      
      // Vérifier d'abord si un tooltip est toujours ouvert
      if (shouldKeepPanelOpen()) {
        console.log('Tooltip toujours ouvert, panneau reste ouvert');
        return;
      }
      
      // Vérifier si la souris est dans le panneau
      if (state.panel) {
        const panelRect = state.panel.getBoundingClientRect();
        const isInPanel = mouseX >= panelRect.left && 
                         mouseX <= panelRect.right && 
                         mouseY >= panelRect.top && 
                         mouseY <= panelRect.bottom;
        
        console.log('Souris dans le panneau:', isInPanel);
        
        if (!isInPanel && !state.settings.useClickMode) {
          // La souris est en dehors du panneau, vérifier si on doit le fermer
          if (!shouldKeepPanelOpen()) {
            console.log('Fermeture du panneau après fermeture tooltip');
            state.isHovering = false;
            hidePanel();
          }
        }
      }
    }, 50);
  }

  // Fonction helper pour vérifier si le panneau doit rester ouvert
  function shouldKeepPanelOpen() {
    // Ne plus forcer l'ouverture sur newtab - le panneau reste caché jusqu'à ce qu'on le demande
    
    // Vérifier si le menu contextuel est ouvert
    if (state.shadowRoot) {
      const contextMenu = state.shadowRoot.querySelector('.context-menu');
      if (contextMenu && contextMenu.offsetParent !== null) {
        // Le menu contextuel est visible
        return true;
      }
    }
    
    // Vérifier si la recherche est ouverte (attribut ajouté par React)
    const hasSearchOpenAttr = state.panel && state.panel.getAttribute('data-search-open') === 'true';
    if (hasSearchOpenAttr) {
      return true;
    }

    // Vérifier si un drag est en cours via l'attribut data-dragging
    const hasDraggingAttr = state.panel && state.panel.hasAttribute('data-dragging');
    if (hasDraggingAttr) {
      return true;
    }
    
    // Vérifier si le mode édition est activé dans le Shadow DOM
    if (state.shadowRoot) {
      const editButton = state.shadowRoot.querySelector('.edit-button.active');
      if (editButton) {
        return true;
      }
    }
    
    // Vérifier si un drag est en cours via les classes CSS
    if (state.shadowRoot) {
      const draggingElements = state.shadowRoot.querySelectorAll('.dragging, [draggable="true"]:active');
      if (draggingElements.length > 0) {
        return true;
      }
    }
    
    // Vérifier si un tooltip est ouvert et visible dans le Shadow DOM
    if (hasVisibleTooltip()) {
      return true;
    }
    
    // Vérifier si le menu contextuel est ouvert et visible dans le Shadow DOM
    if (state.shadowRoot) {
      const contextMenu = state.shadowRoot.querySelector('.context-menu');
      if (contextMenu) {
        // Vérifier que le menu est vraiment visible (pas display: none ou opacity: 0)
        const style = window.getComputedStyle(contextMenu);
        const rect = contextMenu.getBoundingClientRect();
        if (style.display !== 'none' && 
            style.visibility !== 'hidden' && 
            style.opacity !== '0' &&
            rect.width > 0 && 
            rect.height > 0) {
          return true;
        }
      }
    }
    
    return false;
  }

  function hasVisibleTooltip() {
    if (!state.shadowRoot) {
      return false;
    }

    const tooltips = state.shadowRoot.querySelectorAll(TOOLTIP_SELECTOR);
    console.log('Nombre de tooltips trouvés:', tooltips.length);

    for (let tooltip of tooltips) {
      const rect = tooltip.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(tooltip);
      const isVisible =
        rect.width > 0 &&
        rect.height > 0 &&
        computedStyle.visibility !== 'hidden' &&
        computedStyle.display !== 'none' &&
        parseFloat(computedStyle.opacity || '1') > 0;

      if (isVisible) {
        return true;
      }
    }

    return false;
  }

  function shouldDisableToggleButton() {
    return state.settings.useClickMode && state.isVisible && hasVisibleTooltip();
  }

  function updateToggleButtonState() {
    if (!state.toggleButton) {
      return;
    }

    const disabled = shouldDisableToggleButton();
    state.toggleButton.classList.toggle('likethat-toggle-disabled', disabled);
    state.toggleButton.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    state.toggleButton.dataset.disabled = disabled ? 'true' : 'false';
    state.toggleButton.style.cursor = disabled ? 'not-allowed' : 'pointer';
    state.toggleButton.style.opacity = disabled ? '0.4' : '1';
    state.toggleButton.style.background = disabled ? '#d1d5db' : '#f0f0f0';
    state.toggleButton.title = disabled
      ? "Onglet indisponible pendant l'ouverture d'un menu"
      : 'Afficher ou masquer le panneau';
  }

  function setupHoverEvents() {
    // Si déjà initialisé, ne rien faire
    if (state.hoverEventsInitialized) {
      return;
    }

    let lastX = 0;
    let lastY = 0;
    // Écouter les événements de souris sur tout le document pour détecter les tooltips
    document.addEventListener('mouseover', (e) => {
      const target = e.target;
        if (target && state.shadowRoot && state.shadowRoot.contains(target)) {
          if (target.classList.contains('folder-tooltip') ||
              target.classList.contains('icon-selector-tooltip') ||
              target.classList.contains('add-folder-tooltip') ||
              target.classList.contains('rename-folder-tooltip') ||
              target.classList.contains('folder-selector-tooltip') ||
              target.closest('.folder-tooltip') ||
              target.closest('.icon-selector-tooltip') ||
              target.closest('.add-folder-tooltip') ||
              target.closest('.rename-folder-tooltip') ||
              target.closest('.folder-selector-tooltip')) {
          console.log('Mouse over tooltip detected');
          state.isHovering = true;
        }
      }
    });
    
    document.addEventListener('mouseout', (e) => {
      const target = e.target;
        if (target && state.shadowRoot && state.shadowRoot.contains(target)) {
          if (target.classList.contains('folder-tooltip') ||
              target.classList.contains('icon-selector-tooltip') ||
              target.classList.contains('add-folder-tooltip') ||
              target.classList.contains('rename-folder-tooltip') ||
              target.classList.contains('folder-selector-tooltip') ||
              target.closest('.folder-tooltip') ||
              target.closest('.icon-selector-tooltip') ||
              target.closest('.add-folder-tooltip') ||
              target.closest('.rename-folder-tooltip') ||
              target.closest('.folder-selector-tooltip')) {
          console.log('Mouse out of tooltip detected');
        }
      }
    });
    
    document.addEventListener('mousemove', (e) => {
      // Vérifier à nouveau si le mode clic est activé
      if (state.settings.useClickMode) {
        return;
      }

      // Protection contre l'ouverture automatique au chargement :
      // Ignorer les événements de souris pendant les 500 premières millisecondes après l'initialisation
      // pour éviter que le panneau s'ouvre si la souris est déjà près du bord au chargement
      if (!state.panelInitialized || !state.initializationTime) {
        return;
      }
      
      const timeSinceInitialization = Date.now() - state.initializationTime;
      const INITIALIZATION_DELAY = 500; // 500ms de protection
      
      if (timeSinceInitialization < INITIALIZATION_DELAY) {
        // Ignorer cet événement si le panneau vient juste d'être initialisé
        return;
      }

      lastX = e.clientX;
      lastY = e.clientY;
      
      // Sauvegarder la position de la souris dans l'état global
      state.lastMouseX = e.clientX;
      state.lastMouseY = e.clientY;
      
      const isNearLeftEdge = lastX <= 20;
      const isNearRightEdge = lastX >= window.innerWidth - 20;
      
      const isNearEdge = state.settings.panelPosition === 'left' ? isNearLeftEdge : isNearRightEdge;
      
      // Le panneau s'ouvre uniquement lorsqu'on le demande (via hover)
      // Même sur newtab, le panneau reste caché jusqu'à ce qu'on passe la souris au bon endroit
      
      if (isNearEdge && !state.isVisible && !state.isHovering) {
        if (state.hoverTimeout) {
          clearTimeout(state.hoverTimeout);
        }
        state.hoverTimeout = setTimeout(() => {
          showPanel();
        }, state.settings.hoverDelay || 500);
      } else if (!isNearEdge && !state.isHovering && state.hoverTimeout) {
        // Vérifier si le panneau doit rester ouvert
        if (!shouldKeepPanelOpen() && !(state.panel && state.panel.hasAttribute('data-dragging'))) {
          clearTimeout(state.hoverTimeout);
          state.hoverTimeout = null;
        }
      }
    });
    
    state.hoverEventsInitialized = true;
  }

  function setupPanelEvents() {
    if (!state.panel || state.panelEventsInitialized) return;
    
    const handleMouseEnter = () => {
      if (state.settings.useClickMode) {
        return;
      }
      state.isHovering = true;
    };
    
    const handleMouseLeave = (e) => {
      if (state.settings.useClickMode) {
        return;
      }
      
      // Sur une page newtab, ne jamais fermer le panneau
      if (isNewTabPage(window.location.href)) {
        return;
      }
      
      // Vérifier immédiatement si on doit garder le panneau ouvert (drag en cours, etc.)
      const keepOpenImmediate = shouldKeepPanelOpen();
      if (keepOpenImmediate) {
        return;
      }
      
      // Ne rien faire immédiatement, attendre un peu pour voir si un tooltip s'ouvre
      setTimeout(() => {
        // Re-vérifier si le panneau doit rester ouvert (peut avoir changé)
        const keepOpenAfterTimeout = shouldKeepPanelOpen();
        if (keepOpenAfterTimeout) {
          return;
        }
        
        // Vérifier si la souris se déplace vers un tooltip ou le menu contextuel
        const relatedTarget = e.relatedTarget;
        if (relatedTarget && (
          relatedTarget.classList.contains('folder-tooltip') ||
          relatedTarget.classList.contains('icon-selector-tooltip') ||
          relatedTarget.classList.contains('add-folder-tooltip') ||
          relatedTarget.classList.contains('rename-folder-tooltip') ||
          relatedTarget.classList.contains('folder-selector-tooltip') ||
          relatedTarget.classList.contains('context-menu') ||
          relatedTarget.closest('.folder-tooltip') ||
          relatedTarget.closest('.icon-selector-tooltip') ||
          relatedTarget.closest('.add-folder-tooltip') ||
          relatedTarget.closest('.rename-folder-tooltip') ||
          relatedTarget.closest('.folder-selector-tooltip') ||
          relatedTarget.closest('.context-menu')
        )) {
          // Si on se déplace vers un tooltip ou le menu contextuel, ne pas fermer le panneau
          return;
        }
        
        // Vérifier une dernière fois si le panneau doit rester ouvert
        const keepOpen = shouldKeepPanelOpen();
        if (keepOpen) {
          return;
        }
        
        // Vérification finale avant de mettre isHovering à false
        if (state.panel && state.panel.hasAttribute('data-dragging')) {
          return;
        }
        
        state.isHovering = false;
        hidePanel();
      }, 100); // Petit délai pour laisser le temps au tooltip de s'ouvrir
    };

    state.panel.addEventListener('mouseenter', handleMouseEnter);
    state.panel.addEventListener('mouseleave', handleMouseLeave);
    state.panelMouseEnterHandler = handleMouseEnter;
    state.panelMouseLeaveHandler = handleMouseLeave;
    state.panelEventsInitialized = true;
  }

  function showPanel() {
    if (state.panel) {
      state.panel.classList.add('expanded');
      
      // Force les styles directement sur l'élément pour garantir un overlay par-dessus la page
      // Position fixed pour que le panneau soit toujours par-dessus la page, indépendamment du scroll
      state.panel.style.position = 'fixed';
      state.panel.style.top = '0px';
      state.panel.style.bottom = '0px';
      
      // Position gauche ou droite
      const isLeft = state.settings.panelPosition === 'left';
      if (isLeft) {
        state.panel.style.left = '0px';
        state.panel.style.right = 'auto';
      } else {
        state.panel.style.right = '0px';
        state.panel.style.left = 'auto';
      }
      
      // Taille et hauteur pour couvrir toute la hauteur de l'écran
      state.panel.style.height = '100vh';
      state.panel.style.minHeight = '100vh';
      state.panel.style.maxHeight = '100vh';
      state.panel.style.width = `${state.settings.panelWidth}px`;
      
      // Z-index maximal pour garantir que le panneau apparaît toujours par-dessus la page
      // Utiliser la valeur maximale pour un entier 32-bit signé moins 1
      state.panel.style.zIndex = '2147483647';
      
      // Visibilité et interactions
      state.panel.style.opacity = '1';
      state.panel.style.pointerEvents = 'auto';
      // Ne pas utiliser display: block car le panneau est déjà dans le DOM
      // Ne pas utiliser visibility: visible car on n'utilise pas visibility: hidden
      
      // Overflow visible pour permettre aux tooltips de dépasser
      state.panel.style.overflow = 'visible';
      state.panel.style.backgroundColor = 'transparent';
      
      // S'assurer qu'il n'y a pas de marges qui pourraient décaler le panneau
      state.panel.style.margin = '0';
      state.panel.style.padding = '0';
      state.panel.style.border = 'none';
      
      // Appliquer le style du panneau (shadow, border, etc.)
      applyPanelStyle();
      
      // Déplacer le bouton toggle
      if (state.toggleButton) {
        const panelWidth = state.settings.panelWidth;
        if (isLeft) {
          state.toggleButton.style.left = `${panelWidth}px`;
        } else {
          state.toggleButton.style.right = `${panelWidth}px`;
        }
      }
      
      state.isVisible = true;
      updateToggleButtonState();
    }
  }

  function hidePanel() {
    console.log('===== hidePanel() appelé =====');
    console.log('Stack trace:', new Error().stack);
    
    // Vérifier si le panneau doit rester ouvert
    const shouldKeep = shouldKeepPanelOpen();
    console.log('shouldKeepPanelOpen in hidePanel():', shouldKeep);
    console.log('data-dragging in hidePanel():', state.panel ? state.panel.getAttribute('data-dragging') : 'panel not found');
    
    if (shouldKeep) {
      console.log('shouldKeepPanelOpen() empêche la fermeture dans hidePanel()');
      return;
    }
    
    console.log('hidePanel() va effectivement fermer le panneau');
    
    if (state.panel) {
      state.panel.classList.remove('expanded');
      
      // Remet les styles par défaut pour masquer complètement le panneau
      state.panel.style.position = 'fixed';
      state.panel.style.top = '0px';
      state.panel.style.bottom = 'auto';
      
      // Position gauche ou droite
      const isLeft = state.settings.panelPosition === 'left';
      if (isLeft) {
        state.panel.style.left = '0px';
        state.panel.style.right = 'auto';
      } else {
        state.panel.style.right = '0px';
        state.panel.style.left = 'auto';
      }
      
      // Taille minimale pour que le panneau soit invisible
      state.panel.style.height = '100vh';
      state.panel.style.minHeight = '100vh';
      state.panel.style.maxHeight = '100vh';
      state.panel.style.width = '0px';
      
      // Z-index élevé mais panneau invisible
      state.panel.style.zIndex = '2147483647';
      
      // Couleurs et bordures transparentes
      state.panel.style.backgroundColor = 'transparent';
      state.panel.style.border = 'none';
      state.panel.style.boxShadow = 'none';
      state.panel.style.maskImage = 'none';
      state.panel.style.webkitMaskImage = 'none';
      
      // Visibilité et interactions désactivées
      // IMPORTANT: Ne pas utiliser visibility: hidden ni display: none
      // car cela empêche React de fonctionner correctement
      state.panel.style.opacity = '0';
      state.panel.style.pointerEvents = 'none'; // CRITIQUE : empêche toute interaction avec le panneau caché
      state.panel.style.overflow = 'hidden';
      
      // S'assurer qu'il n'y a pas de marges ou paddings qui pourraient créer de l'espace
      state.panel.style.margin = '0';
      state.panel.style.padding = '0';
      
      // Remettre le bouton toggle à sa position initiale
      if (state.toggleButton) {
        if (isLeft) {
          state.toggleButton.style.left = '0px';
        } else {
          state.toggleButton.style.right = '0px';
        }
      }
      
      state.isVisible = false;
      updateToggleButtonState();
    }
  }
}

// Créer le panneau
createLikeThatPanel();

