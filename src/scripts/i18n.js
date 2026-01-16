/**
 * Système d'internationalisation pour LikeThat Extension
 * 
 * Ce fichier gère :
 * - Les traductions en français et anglais
 * - La détection automatique de la langue
 * - L'application des traductions aux éléments DOM
 */

// ============================================================================
// TRADUCTIONS
// ============================================================================

const translations = {
  fr: {
    // Interface générale
    'app.name': 'LikeThat',
    'app.description': 'Panneau latéral personnalisable pour vos favoris',
    'app.version': 'Version 1.0.0',
    
    // Panneau
    'panel.title': 'LikeThat',
    'panel.loading': 'Chargement des favoris...',
    'panel.noBookmarks': 'Aucun favori trouvé',
    'panel.error': 'Erreur lors du chargement des favoris',
    
    // Options
    'options.title': 'LikeThat - Options',
    'options.subtitle': 'Configuration du panneau de favoris',
    'options.position.title': 'Position du panneau',
    'options.position.right': 'Droite',
    'options.position.left': 'Gauche',
    'options.width.title': 'Largeur du panneau',
    'options.width.narrow': 'Étroit',
    'options.width.wide': 'Large',
    'options.width.px': 'px',
    'options.click.title': 'Comportement du clic',
    'options.click.current': 'Ouvrir dans l\'onglet courant',
    'options.click.newTab': 'Nouvel onglet',
    'options.click.newWindow': 'Nouvelle fenêtre',
    'options.theme.title': 'Thème',
    'options.theme.light': 'Clair',
    'options.theme.dark': 'Sombre',
    'options.theme.auto': 'Automatique',
    'options.activation.title': 'Mode d\'activation',
    'options.activation.clickMode': 'Mode clic (désactive le survol)',
    'options.hover.title': 'Délai de survol',
    'options.hover.fast': 'Rapide',
    'options.hover.slow': 'Lent',
    'options.hover.ms': 'ms',
    'options.excluded.title': 'Sites exclus',
    'options.excluded.description': 'Ajoutez des domaines à exclure du panneau (un par ligne)',
    'options.excluded.placeholder': 'exemple.com\nautre-site.fr',
    'options.bookmarksBar.title': 'Position de la barre de favoris',
    'options.bookmarksBar.top': 'En haut',
    'options.bookmarksBar.bottom': 'En bas',
    'options.searchCaseSensitive.title': 'Recherche des favoris',
    'options.searchCaseSensitive.enabled': 'Prendre en compte la casse dans la recherche',
    'options.iconAnimation.title': 'Animation des icônes',
    'options.iconAnimation.enabled': 'Activer l\'animation néon des icônes personnalisées',
    'options.shortcuts.title': 'Raccourcis clavier',
    'options.shortcuts.tab': 'Navigation dans le panneau',
    'options.shortcuts.enter': 'Ouvrir un favori',
    'options.shortcuts.click': 'Basculer un dossier',
    'options.shortcuts.drag': 'Réorganiser les favoris',
    'options.preview.title': 'Aperçu',
    'options.preview.folder': 'Dossier exemple',
    'options.preview.bookmark': 'Favori exemple',
    'options.footer.version': 'LikeThat v1.0.0 - Extension Chrome pour la gestion des favoris',
    'options.categories.appearance': 'Apparence',
    'options.categories.interactions': 'Interactions',
    'options.categories.personalization': 'Personnalisation',
    'options.categories.newtab': 'Moteur de recherche',
    'options.categories.searchEngine': 'Moteur de recherche',
    'options.newTab.title': 'Configuration du nouvel onglet',
    'options.newTab.description': 'Choisissez l\'URL à ouvrir lorsque vous créez un nouvel onglet. Cela permet au panneau des favoris d\'apparaître sur cette page. Note: Cette configuration n\'affecte pas le moteur de recherche par défaut de Chrome dans la barre d\'adresse.',
    'options.newTab.searchEngine': 'Moteur de recherche',
    'options.newTab.google': 'Google',
    'options.newTab.bing': 'Bing',
    'options.newTab.duckduckgo': 'DuckDuckGo',
    'options.newTab.yahoo': 'Yahoo',
    'options.newTab.ecosia': 'Ecosia',
    'options.newTab.qwant': 'Qwant',
    'options.newTab.customUrl': 'OU URL personnalisée',
    'options.newTab.customUrlDescription': 'Entrez une URL personnalisée (ex: https://example.com). Si remplie, cette URL sera utilisée à la place du moteur de recherche pour les nouveaux onglets uniquement.',
    'options.newTab.placeholder': 'https://example.com',
    
    // Popup
    'popup.title': 'LikeThat',
    'popup.subtitle': 'Panneau de favoris',
    'popup.status.active': 'Extension active',
    'popup.actions.options': 'Options',
    'popup.actions.toggle': 'Basculer le panneau',
    'popup.info.position': 'Position:',
    'popup.info.width': 'Largeur:',
    'popup.info.theme': 'Thème:',
    'popup.version': 'v1.0.0',
    
    // Actions
    'actions.save': 'Sauvegarder',
    'actions.reset': 'Réinitialiser',
    'actions.export': 'Exporter',
    'actions.import': 'Importer',
    
    // Messages
    'messages.saveSuccess': 'Paramètres sauvegardés avec succès',
    'messages.saveError': 'Erreur lors de la sauvegarde',
    'messages.resetSuccess': 'Paramètres réinitialisés',
    'messages.resetError': 'Erreur lors de la réinitialisation',
    'messages.exportSuccess': 'Paramètres exportés',
    'messages.exportError': 'Erreur lors de l\'export',
    'messages.importSuccess': 'Paramètres importés avec succès',
    'messages.importError': 'Erreur lors de l\'import',
    'messages.loadError': 'Erreur lors du chargement des paramètres',
    'messages.resetConfirm': 'Êtes-vous sûr de vouloir réinitialiser tous les paramètres ?',
    'messages.invalidFile': 'Fichier de paramètres invalide',
    'messages.widthError': 'La largeur doit être entre 200 et 500 pixels',
    'messages.delayError': 'Le délai doit être entre 100 et 2000 millisecondes',
    'messages.domainError': 'Les domaines ne doivent pas contenir d\'espaces',
    
    // Accessibilité
    'aria.togglePanel': 'Basculer le panneau LikeThat',
    'aria.toggle': 'Basculer',
    'aria.bookmarksPanel': 'Panneau de favoris',
    'aria.folder': 'Dossier',
    'aria.bookmark': 'Favori',
    'aria.expanded': 'Développé',
    'aria.collapsed': 'Replié'
  },
  
  en: {
    // General interface
    'app.name': 'LikeThat',
    'app.description': 'Customizable sidebar for your bookmarks',
    'app.version': 'Version 1.0.0',
    
    // Panel
    'panel.title': 'LikeThat',
    'panel.loading': 'Loading bookmarks...',
    'panel.noBookmarks': 'No bookmarks found',
    'panel.error': 'Error loading bookmarks',
    
    // Options
    'options.title': 'LikeThat - Options',
    'options.subtitle': 'Bookmark panel configuration',
    'options.position.title': 'Panel position',
    'options.position.right': 'Right',
    'options.position.left': 'Left',
    'options.width.title': 'Panel width',
    'options.width.narrow': 'Narrow',
    'options.width.wide': 'Wide',
    'options.width.px': 'px',
    'options.click.title': 'Click behavior',
    'options.click.current': 'Open in current tab',
    'options.click.newTab': 'New tab',
    'options.click.newWindow': 'New window',
    'options.theme.title': 'Theme',
    'options.theme.light': 'Light',
    'options.theme.dark': 'Dark',
    'options.theme.auto': 'Automatic',
    'options.activation.title': 'Activation mode',
    'options.activation.clickMode': 'Click mode (disables hover)',
    'options.hover.title': 'Hover delay',
    'options.hover.fast': 'Fast',
    'options.hover.slow': 'Slow',
    'options.hover.ms': 'ms',
    'options.excluded.title': 'Excluded sites',
    'options.excluded.description': 'Add domains to exclude from the panel (one per line)',
    'options.excluded.placeholder': 'example.com\nother-site.com',
    'options.bookmarksBar.title': 'Bookmarks bar position',
    'options.bookmarksBar.top': 'Top',
    'options.bookmarksBar.bottom': 'Bottom',
    'options.searchCaseSensitive.title': 'Bookmark search',
    'options.searchCaseSensitive.enabled': 'Case-sensitive search',
    'options.iconAnimation.title': 'Icon animation',
    'options.iconAnimation.enabled': 'Enable neon animation for custom icons',
    'options.shortcuts.title': 'Keyboard shortcuts',
    'options.shortcuts.tab': 'Navigate in panel',
    'options.shortcuts.enter': 'Open bookmark',
    'options.shortcuts.click': 'Toggle folder',
    'options.shortcuts.drag': 'Reorder bookmarks',
    'options.preview.title': 'Preview',
    'options.preview.folder': 'Example folder',
    'options.preview.bookmark': 'Example bookmark',
    'options.footer.version': 'LikeThat v1.0.0 - Chrome extension for bookmark management',
    'options.categories.appearance': 'Appearance',
    'options.categories.interactions': 'Interactions',
    'options.categories.personalization': 'Personalization',
    'options.categories.newtab': 'New Tab',
    'options.newTab.title': 'New Tab Configuration',
    'options.newTab.description': 'Choose the URL to open when you create a new tab. This allows the bookmarks panel to appear on this page. Note: This setting does not affect Chrome\'s default search engine in the address bar.',
    'options.newTab.searchEngine': 'Search Engine',
    'options.newTab.google': 'Google',
    'options.newTab.bing': 'Bing',
    'options.newTab.duckduckgo': 'DuckDuckGo',
    'options.newTab.yahoo': 'Yahoo',
    'options.newTab.ecosia': 'Ecosia',
    'options.newTab.qwant': 'Qwant',
    'options.newTab.customUrl': 'OR Custom URL',
    'options.newTab.customUrlDescription': 'Enter a custom URL (ex: https://example.com). If filled, this URL will be used instead of the search engine for new tabs only.',
    'options.newTab.placeholder': 'https://example.com',
    
    // Popup
    'popup.title': 'LikeThat',
    'popup.subtitle': 'Bookmark panel',
    'popup.status.active': 'Extension active',
    'popup.actions.options': 'Options',
    'popup.actions.toggle': 'Toggle panel',
    'popup.info.position': 'Position:',
    'popup.info.width': 'Width:',
    'popup.info.theme': 'Theme:',
    'popup.version': 'v1.0.0',
    
    // Actions
    'actions.save': 'Save',
    'actions.reset': 'Reset',
    'actions.export': 'Export',
    'actions.import': 'Import',
    
    // Messages
    'messages.saveSuccess': 'Settings saved successfully',
    'messages.saveError': 'Error saving settings',
    'messages.resetSuccess': 'Settings reset',
    'messages.resetError': 'Error resetting settings',
    'messages.exportSuccess': 'Settings exported',
    'messages.exportError': 'Error exporting',
    'messages.importSuccess': 'Settings imported successfully',
    'messages.importError': 'Error importing',
    'messages.loadError': 'Error loading settings',
    'messages.resetConfirm': 'Are you sure you want to reset all settings?',
    'messages.invalidFile': 'Invalid settings file',
    'messages.widthError': 'Width must be between 200 and 500 pixels',
    'messages.delayError': 'Delay must be between 100 and 2000 milliseconds',
    'messages.domainError': 'Domains should not contain spaces',
    
    // Accessibility
    'aria.togglePanel': 'Toggle LikeThat panel',
    'aria.toggle': 'Toggle',
    'aria.bookmarksPanel': 'Bookmarks panel',
    'aria.folder': 'Folder',
    'aria.bookmark': 'Bookmark',
    'aria.expanded': 'Expanded',
    'aria.collapsed': 'Collapsed'
  }
};

// ============================================================================
// FONCTION DE GESTION DE L'INTERNATIONALISATION
// ============================================================================

function createI18n() {
  const state = {
    currentLanguage: detectLanguage()
  };

  /**
   * Détecte la langue du navigateur
   * @returns {string} Code de langue (fr ou en)
   */
  function detectLanguage() {
    const browserLang = navigator.language || navigator.userLanguage;
    const langCode = browserLang.split('-')[0].toLowerCase();
    
    // Retourne la langue si supportée, sinon français par défaut
    return translations[langCode] ? langCode : 'fr';
  }

  /**
   * Obtient une traduction
   * @param {string} key - Clé de traduction
   * @param {string} fallback - Valeur de fallback
   * @returns {string} Traduction
   */
  function t(key, fallback = '') {
    const translation = translations[state.currentLanguage];
    if (translation && translation[key]) {
      return translation[key];
    }
    
    // Fallback vers l'anglais si disponible
    if (state.currentLanguage !== 'en' && translations.en && translations.en[key]) {
      return translations.en[key];
    }
    
    // Fallback vers la clé ou la valeur fournie
    return fallback || key;
  }

  /**
   * Change la langue
   * @param {string} langCode - Code de langue
   * @returns {boolean} True si la langue est supportée
   */
  function setLanguage(langCode) {
    if (translations[langCode]) {
      state.currentLanguage = langCode;
      return true;
    }
    return false;
  }

  /**
   * Obtient la langue actuelle
   * @returns {string} Code de langue actuel
   */
  function getCurrentLanguage() {
    return state.currentLanguage;
  }

  /**
   * Obtient toutes les langues supportées
   * @returns {Array<string>} Liste des codes de langue
   */
  function getSupportedLanguages() {
    return Object.keys(translations);
  }

  /**
   * Traduit tous les éléments avec l'attribut data-i18n
   */
  function translateElements() {
    // Traduit les éléments avec data-i18n
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
      const key = element.getAttribute('data-i18n');
      const translation = t(key);
      
      if (translation) {
        if (element.tagName === 'INPUT' && element.type === 'text') {
          element.placeholder = translation;
        } else if (element.tagName === 'TEXTAREA') {
          element.placeholder = translation;
        } else {
          element.textContent = translation;
        }
      }
    });

    // Traduit les éléments avec data-i18n-placeholder
    const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
    placeholderElements.forEach(element => {
      const key = element.getAttribute('data-i18n-placeholder');
      const translation = t(key);
      
      if (translation) {
        element.placeholder = translation;
      }
    });
  }

  /**
   * Traduit un élément spécifique
   * @param {HTMLElement} element - Élément à traduire
   * @param {string} key - Clé de traduction
   */
  function translateElement(element, key) {
    const translation = t(key);
    if (translation) {
      if (element.tagName === 'INPUT' && element.type === 'text') {
        element.placeholder = translation;
      } else if (element.tagName === 'TEXTAREA') {
        element.placeholder = translation;
      } else {
        element.textContent = translation;
      }
    }
  }
  // Retourne l'objet avec les méthodes publiques
  return {
    t,
    setLanguage,
    getCurrentLanguage,
    getSupportedLanguages,
    translateElements,
    translateElement,
    state
  };
}

// ============================================================================
// INSTANCE GLOBALE
// ============================================================================

// Instance globale pour utilisation dans l'extension
const i18n = createI18n();

// Export pour utilisation dans d'autres fichiers
export { createI18n, i18n, translations };
export default i18n;