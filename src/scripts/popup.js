/**
 * Script pour le popup de LikeThat Extension
 * 
 * Ce fichier gère :
 * - L'affichage des informations de l'extension
 * - La communication avec le content script
 * - L'ouverture de la page d'options
 */

// ============================================================================
// FONCTION PRINCIPALE DU POPUP
// ============================================================================

// Initialise les traductions au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
  if (typeof i18n !== 'undefined') {
    i18n.translateElements();
  }
});

function createLikeThatPopup() {
  const state = {
    settings: {}
  };

  // Initialisation
  init();

  // ============================================================================
  // INITIALISATION
  // ============================================================================

  /**
   * Initialise le popup
   */
  async function init() {
    try {
      // Charge les paramètres
      await loadSettings();
      
      // Met à jour l'interface
      updateUI();
      
      // Configure les événements
      setupEvents();
    } catch (error) {
      console.error('LikeThat: Erreur lors de l\'initialisation du popup:', error);
    }
  }

  // ============================================================================
  // GESTION DES PARAMÈTRES
  // ============================================================================

  /**
   * Charge les paramètres depuis le stockage
   */
  async function loadSettings() {
    try {
      const result = await chrome.storage.sync.get([
        'panelPosition',
        'panelWidth',
        'theme',
        'colorMode',
        'fontSize'
      ]);
      
      state.settings = {
        panelPosition: result.panelPosition || 'left',
        panelWidth: result.panelWidth || 300,
        theme: result.theme || 'ocean',
        colorMode: result.colorMode || 'light',
        fontSize: result.fontSize || 14
      };
    } catch (error) {
      console.error('LikeThat: Erreur lors du chargement des paramètres:', error);
      state.settings = {
        panelPosition: 'left',
        panelWidth: 300,
        theme: 'ocean',
        colorMode: 'light',
        fontSize: 14
      };
    }
  }

  // ============================================================================
  // GESTION DU THÈME
  // ============================================================================

  /**
   * Applique le thème et le mode de couleur au popup
   */
  function applyThemeToPopup() {
    const body = document.body;
    if (body) {
      const theme = state.settings.theme || 'ocean';
      body.setAttribute('data-theme', theme);
      
      // Déterminer le mode de couleur
      let colorMode = state.settings.colorMode || 'light';
      if (colorMode === 'auto') {
        // Mode automatique : détecter la préférence système
        colorMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      body.setAttribute('data-color-mode', colorMode);
      
      // Appliquer la taille de police
      const fontSize = state.settings.fontSize || 14;
      body.style.setProperty('--font-size', `${fontSize}px`);
    }
  }

  // ============================================================================
  // INTERFACE UTILISATEUR
  // ============================================================================

  /**
   * Met à jour l'interface utilisateur
   */
  function updateUI() {
    // Appliquer le thème au popup
    applyThemeToPopup();
    
    // Position
    const positionElement = document.getElementById('currentPosition');
    if (positionElement) {
      const positionKey = state.settings.panelPosition === 'left' ? 'options.position.left' : 'options.position.right';
      positionElement.textContent = i18n.t(positionKey);
    }

    // Largeur
    const widthElement = document.getElementById('currentWidth');
    if (widthElement) {
      widthElement.textContent = `${state.settings.panelWidth}${i18n.t('options.width.px')}`;
    }

    // Thème
    const themeElement = document.getElementById('currentTheme');
    if (themeElement) {
      const themeKey = `options.theme.${state.settings.theme}`;
      themeElement.textContent = i18n.t(themeKey);
    }
  }

  // ============================================================================
  // GESTION DES ÉVÉNEMENTS
  // ============================================================================

  /**
   * Configure les événements
   */
  function setupEvents() {
    // Bouton Options
    const openOptionsButton = document.getElementById('openOptions');
    if (openOptionsButton) {
      openOptionsButton.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
        window.close();
      });
    }

    // Bouton Basculer le panneau
    const togglePanelButton = document.getElementById('togglePanel');
    if (togglePanelButton) {
      togglePanelButton.addEventListener('click', () => {
        togglePanel();
      });
    }
  }

  // ============================================================================
  // COMMUNICATION AVEC LE CONTENT SCRIPT
  // ============================================================================

  /**
   * Bascule le panneau sur l'onglet actuel
   */
  async function togglePanel() {
    try {
      // Obtient l'onglet actuel
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab && tab.id) {
        // Vérifie si l'onglet supporte les content scripts
        if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
          try {
            // Envoie un message au content script
            await chrome.tabs.sendMessage(tab.id, { action: 'togglePanel' });
            window.close();
          } catch (error) {
            // Si le content script n'est pas disponible, injecte-le d'abord
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            });
            
            // Attendre un peu puis réessayer
            setTimeout(async () => {
              try {
                await chrome.tabs.sendMessage(tab.id, { action: 'togglePanel' });
                window.close();
              } catch (retryError) {
                showToggleError('Impossible de basculer le panneau sur cette page');
              }
            }, 500);
          }
        } else {
          showToggleError('Le panneau n\'est pas disponible sur cette page');
        }
      } else {
        console.error('LikeThat: Impossible d\'obtenir l\'onglet actuel');
        showToggleError('Impossible d\'obtenir l\'onglet actuel');
      }
    } catch (error) {
      console.error('LikeThat: Erreur lors du basculement du panneau:', error);
      showToggleError('Erreur lors du basculement du panneau');
    }
  }

  /**
   * Affiche un message d'erreur pour le bouton toggle
   * @param {string} message - Message d'erreur à afficher
   */
  function showToggleError(message) {
    const toggleButton = document.getElementById('togglePanel');
    if (toggleButton) {
      const originalText = toggleButton.textContent;
      toggleButton.textContent = message;
      toggleButton.style.background = '#dc3545';
      
      setTimeout(() => {
        toggleButton.textContent = originalText;
        toggleButton.style.background = '';
      }, 3000);
    }
  }
  // Retourne l'objet state pour accès externe si nécessaire
  return state;
}

// ============================================================================
// INITIALISATION
// ============================================================================

// Initialise le popup quand le DOM est prêt
document.addEventListener('DOMContentLoaded', () => {
  createLikeThatPopup();
});