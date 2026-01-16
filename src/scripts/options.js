/**
 * Script pour la page d'options de LikeThat Extension
 * 
 * Ce fichier gère :
 * - L'interface de configuration de l'extension
 * - La sauvegarde et le chargement des paramètres
 * - L'export/import des paramètres
 * - L'aperçu en temps réel des modifications
 */

// ============================================================================
// FONCTION PRINCIPALE DES OPTIONS
// ============================================================================

// Initialise les traductions au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
  if (typeof i18n !== 'undefined') {
    i18n.translateElements();
  }
});

function createLikeThatOptions() {
  const state = {
    settings: {},
    defaultSettings: {
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
      panelStyle: 'elevated',
      newTabSearchEngine: 'google',
      customNewTabUrl: '',
      searchCaseSensitive: false
    }
  };

  const categories = [
    {
      id: 'appearance',
      description: 'Réglez l’apparence du panneau, du thème aux animations.'
    },
    {
      id: 'interactions',
      description: 'Contrôlez comment le panneau se comporte lorsque vous interagissez avec vos favoris.'
    },
    {
      id: 'personalization',
      description: 'Personnalisez la barre, les sites exclus et les animations pour un usage sur mesure.'
    },
    {
      id: 'newtab',
      description: 'Définissez la page ouverte lors de la création d’un nouvel onglet pour garder LikeThat accessible.'
    }
  ];

  // Initialisation
  init();

  // ============================================================================
  // INITIALISATION
  // ============================================================================

  /**
   * Initialise la page d'options
   */
  async function init() {
    try {
      // Charge les paramètres existants
      await loadSettings();
      
      // Configure les événements
      setupEvents();
      setupTabs();
      setupFixedNavColumn();
      
      // Met à jour l'aperçu
      updatePreview();
    } catch (error) {
      console.error('LikeThat: Erreur lors de l\'initialisation:', error);
      showNotification('Erreur lors du chargement des paramètres', 'error');
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
      const result = await chrome.storage.sync.get(Object.keys(state.defaultSettings));
      state.settings = { ...state.defaultSettings, ...result };
      
      // Met à jour l'interface
      updateUI();
    } catch (error) {
      console.error('LikeThat: Erreur lors du chargement des paramètres:', error);
      state.settings = { ...state.defaultSettings };
    }
  }

  /**
   * Met à jour l'interface utilisateur
   */
  function updateUI() {
    // Position du panneau
    const positionRadio = document.querySelector(`input[name="panelPosition"][value="${state.settings.panelPosition}"]`);
    if (positionRadio) {
      positionRadio.checked = true;
    }

    // Largeur du panneau
    const widthSlider = document.getElementById('panelWidth');
    const widthValue = document.getElementById('panelWidthValue');
    if (widthSlider && widthValue) {
      widthSlider.value = state.settings.panelWidth;
      widthValue.textContent = state.settings.panelWidth;
    }

    // Comportement du clic
    const clickRadio = document.querySelector(`input[name="clickBehavior"][value="${state.settings.clickBehavior}"]`);
    if (clickRadio) {
      clickRadio.checked = true;
    }

    // Mode de couleur
    const colorModeRadio = document.querySelector(`input[name="colorMode"][value="${state.settings.colorMode}"]`);
    if (colorModeRadio) {
      colorModeRadio.checked = true;
    }

    // Thème
    const themeRadio = document.querySelector(`input[name="theme"][value="${state.settings.theme}"]`);
    if (themeRadio) {
      themeRadio.checked = true;
    }

    // Mode clic
    const clickModeCheckbox = document.getElementById('useClickMode');
    if (clickModeCheckbox) {
      clickModeCheckbox.checked = state.settings.useClickMode;
    }

    // Délai de survol
    const delaySlider = document.getElementById('hoverDelay');
    const delayValue = document.getElementById('hoverDelayValue');
    if (delaySlider && delayValue) {
      delaySlider.value = state.settings.hoverDelay;
      delayValue.textContent = state.settings.hoverDelay;
    }

    // Sites exclus
    const excludedTextarea = document.getElementById('excludedSites');
    if (excludedTextarea) {
      excludedTextarea.value = state.settings.excludedSites.join('\n');
    }

    // Position de la barre de favoris
    const barPositionRadio = document.querySelector(`input[name="bookmarksBarPosition"][value="${state.settings.bookmarksBarPosition}"]`);
    if (barPositionRadio) {
      barPositionRadio.checked = true;
    }

    // Animation des icônes
    const iconAnimationCheckbox = document.getElementById('iconAnimationEnabled');
    if (iconAnimationCheckbox) {
      iconAnimationCheckbox.checked = state.settings.iconAnimationEnabled;
    }

    // Recherche sensible à la casse
    const searchCaseSensitiveCheckbox = document.getElementById('searchCaseSensitive');
    if (searchCaseSensitiveCheckbox) {
      searchCaseSensitiveCheckbox.checked = state.settings.searchCaseSensitive;
    }

    // Taille des icônes
    const iconSizeSlider = document.getElementById('iconSize');
    const iconSizeValue = document.getElementById('iconSizeValue');
    if (iconSizeSlider && iconSizeValue) {
      iconSizeSlider.value = state.settings.iconSize;
      iconSizeValue.textContent = state.settings.iconSize;
    }

    // Taille de la police
    const fontSizeSlider = document.getElementById('fontSize');
    const fontSizeValue = document.getElementById('fontSizeValue');
    if (fontSizeSlider && fontSizeValue) {
      fontSizeSlider.value = state.settings.fontSize;
      fontSizeValue.textContent = state.settings.fontSize;
    }

    // Opacité du panneau
    const panelOpacitySlider = document.getElementById('panelOpacity');
    const panelOpacityValue = document.getElementById('panelOpacityValue');
    if (panelOpacitySlider && panelOpacityValue) {
      panelOpacitySlider.value = state.settings.panelOpacity;
      panelOpacityValue.textContent = Math.round(state.settings.panelOpacity * 100);
    }

    // Style du panneau
    const panelStyleRadio = document.querySelector(`input[name="panelStyle"][value="${state.settings.panelStyle}"]`);
    if (panelStyleRadio) {
      panelStyleRadio.checked = true;
    }

    // Nouveau onglet - Moteur de recherche
    const newTabEngineRadio = document.querySelector(`input[name="newTabSearchEngine"][value="${state.settings.newTabSearchEngine}"]`);
    if (newTabEngineRadio) {
      newTabEngineRadio.checked = true;
    }
    
    // Nouveau onglet - URL personnalisée
    const customNewTabUrlInput = document.getElementById('customNewTabUrl');
    if (customNewTabUrlInput) {
      customNewTabUrlInput.value = state.settings.customNewTabUrl || '';
    }

    // Appliquer le thème à la page des options
    applyThemeToPage(state.settings.theme || 'ocean', state.settings.colorMode || 'light');
  }

  // ============================================================================
  // GESTION DES ÉVÉNEMENTS
  // ============================================================================

  /**
   * Configure les événements
   */
  function setupEvents() {
    // Sauvegarde des paramètres
    const saveButton = document.getElementById('saveSettings');
    if (saveButton) {
      saveButton.addEventListener('click', () => saveSettings());
    }

    // Réinitialisation
    const resetButton = document.getElementById('resetSettings');
    if (resetButton) {
      resetButton.addEventListener('click', () => resetSettings());
    }

    // Sliders avec mise à jour en temps réel
    const widthSlider = document.getElementById('panelWidth');
    const widthValue = document.getElementById('panelWidthValue');
    if (widthSlider && widthValue) {
      widthSlider.addEventListener('input', (e) => {
        widthValue.textContent = e.target.value;
        updatePreview();
      });
    }

    const delaySlider = document.getElementById('hoverDelay');
    const delayValue = document.getElementById('hoverDelayValue');
    if (delaySlider && delayValue) {
      delaySlider.addEventListener('input', (e) => {
        delayValue.textContent = e.target.value;
      });
    }

    const iconSizeSlider = document.getElementById('iconSize');
    const iconSizeValue = document.getElementById('iconSizeValue');
    if (iconSizeSlider && iconSizeValue) {
      iconSizeSlider.addEventListener('input', (e) => {
        iconSizeValue.textContent = e.target.value;
        updatePreview();
      });
    }

    const fontSizeSlider = document.getElementById('fontSize');
    const fontSizeValue = document.getElementById('fontSizeValue');
    if (fontSizeSlider && fontSizeValue) {
      fontSizeSlider.addEventListener('input', (e) => {
        fontSizeValue.textContent = e.target.value;
        updatePreview();
      });
    }

    const panelOpacitySlider = document.getElementById('panelOpacity');
    const panelOpacityValue = document.getElementById('panelOpacityValue');
    if (panelOpacitySlider && panelOpacityValue) {
      panelOpacitySlider.addEventListener('input', (e) => {
        panelOpacityValue.textContent = Math.round(parseFloat(e.target.value) * 100);
        updatePreview();
      });
    }

    // Radio buttons et checkboxes avec mise à jour de l'aperçu
    const inputs = document.querySelectorAll('input[type="radio"], input[type="checkbox"]');
    inputs.forEach(input => {
      input.addEventListener('change', () => {
        // Si c'est un changement de colorMode ou de theme, appliquer immédiatement
        if (input.name === 'colorMode' || input.name === 'theme') {
          const themeRadio = document.querySelector('input[name="theme"]:checked');
          const colorModeRadio = document.querySelector('input[name="colorMode"]:checked');
          if (themeRadio && colorModeRadio) {
            applyThemeToPage(themeRadio.value, colorModeRadio.value);
          }
        }
        updatePreview();
      });
    });

    // Textarea avec mise à jour de l'aperçu
    const excludedTextarea = document.getElementById('excludedSites');
    if (excludedTextarea) {
      excludedTextarea.addEventListener('input', () => updatePreview());
    }

    // Gestionnaires pour les options de thème
    const themeOptions = document.querySelectorAll('.theme-option');
    themeOptions.forEach(option => {
      option.addEventListener('click', () => {
        const themeValue = option.getAttribute('data-theme');
        const themeRadio = option.querySelector('input[type="radio"]');
        if (themeRadio) {
          themeRadio.checked = true;
          // Récupérer le colorMode actuel
          const colorModeRadio = document.querySelector('input[name="colorMode"]:checked');
          const colorMode = colorModeRadio ? colorModeRadio.value : 'light';
          applyThemeToPage(themeValue, colorMode);
          updatePreview();
        }
      });
    });

    // Gestionnaires pour les options de style de panneau
    const panelStyleOptions = document.querySelectorAll('.panel-style-option');
    panelStyleOptions.forEach(option => {
      option.addEventListener('click', () => {
        const styleValue = option.getAttribute('data-style');
        const styleRadio = option.querySelector('input[type="radio"]');
        if (styleRadio) {
          styleRadio.checked = true;
          updatePreview();
        }
      });
    });
  }

  /**
   * Configure la navigation par onglets
   */
  function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const categoryPanels = document.querySelectorAll('.category-panel');
    const heroDescription = document.getElementById('activeCategoryDescription');

    if (!tabButtons.length || !categoryPanels.length) {
      return;
    }

    const activateCategory = (categoryId) => {
      categoryPanels.forEach(panel => {
        const isActive = panel.getAttribute('data-category') === categoryId;
        panel.classList.toggle('active', isActive);
      });

      tabButtons.forEach(button => {
        const isActive = button.getAttribute('data-category-target') === categoryId;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-selected', String(isActive));
      });

      if (heroDescription) {
        const category = categories.find(cat => cat.id === categoryId);
        heroDescription.textContent = category?.description ?? '';
      }
    };

    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const target = button.getAttribute('data-category-target');
        if (target) {
          activateCategory(target);
        }
      });
    });

    const defaultCategory = categories[0]?.id ?? tabButtons[0]?.getAttribute('data-category-target');
    if (defaultCategory) {
      activateCategory(defaultCategory);
    }
  }

  /**
   * Positionne l'aside et la carte hero de façon fixe et centrée
   */
  function setupFixedNavColumn() {
    const navColumn = document.querySelector('.options-nav-column');
    const sidebar = document.querySelector('.options-sidebar');
    const sidebarSpacer = document.querySelector('.options-sidebar-placeholder');
    const hero = document.querySelector('.page-hero');
    const heroSpacer = document.querySelector('.page-hero-placeholder');
    if (!navColumn || !sidebar || !hero || !sidebarSpacer || !heroSpacer) {
      return;
    }

    const GAP = 16;
    let ticking = false;

    const resetStyles = () => {
      [sidebar, hero].forEach(el => {
        el.style.position = '';
        el.style.left = '';
        el.style.top = '';
        el.style.width = '';
      });
      sidebarSpacer.style.height = '';
      heroSpacer.style.height = '';
    };

    const updatePosition = () => {
      ticking = false;

      if (window.innerWidth <= 1024) {
        resetStyles();
        return;
      }

      const navRect = navColumn.getBoundingClientRect();
      const width = navRect.width;
      const left = navRect.left;
      const sidebarHeight = sidebar.offsetHeight;
      const heroHeight = hero.offsetHeight;
      const totalHeight = sidebarHeight + GAP + heroHeight;
      const viewportHeight = window.innerHeight;

      const baseTop = Math.max(32, (viewportHeight - totalHeight) / 2 - 40);

      sidebar.style.position = 'fixed';
      sidebar.style.left = `${left}px`;
      sidebar.style.top = `${baseTop}px`;
      sidebar.style.width = `${width}px`;

      hero.style.position = 'fixed';
      hero.style.left = `${left}px`;
      hero.style.top = `${baseTop + sidebarHeight + GAP}px`;
      hero.style.width = `${width}px`;

      sidebarSpacer.style.height = `${sidebarHeight}px`;
      heroSpacer.style.height = `${heroHeight}px`;
    };

    const requestUpdate = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updatePosition);
    };

    updatePosition();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
  }

  // ============================================================================
  // GESTION DU THÈME
  // ============================================================================

  /**
   * Applique le thème à la page des options
   * @param {string} theme - Nom du thème
   * @param {string} colorMode - Mode de couleur (light/dark/auto)
   */
  function applyThemeToPage(theme, colorMode) {
    const body = document.body;
    if (body) {
      // Récupérer le thème actuel si non fourni
      if (!theme) {
        const themeRadio = document.querySelector('input[name="theme"]:checked');
        theme = themeRadio ? themeRadio.value : (state.settings.theme || 'ocean');
      }
      
      body.setAttribute('data-theme', theme);
      
      // Récupérer le mode de couleur actuel si non fourni
      if (!colorMode) {
        const colorModeRadio = document.querySelector('input[name="colorMode"]:checked');
        colorMode = colorModeRadio ? colorModeRadio.value : (state.settings.colorMode || 'light');
      }
      
      // Déterminer le mode de couleur
      let mode = colorMode || 'light';
      if (mode === 'auto') {
        // Mode automatique : détecter la préférence système
        mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      body.setAttribute('data-color-mode', mode);
      updatePreviewModeBadge(mode);
      
      // Appliquer la taille de police
      const fontSize = state.settings.fontSize || 14;
      body.style.setProperty('--font-size', `${fontSize}px`);
    }
  }

  /**
   * Met à jour le badge du mode d'aperçu
   * @param {string} mode - light ou dark
   */
  function updatePreviewModeBadge(mode) {
    const badge = document.getElementById('previewModeBadge');
    if (!badge) return;
    badge.textContent = mode === 'dark' ? 'Dark' : 'Light';
  }

  // ============================================================================
  // SAUVEGARDE ET GESTION DES PARAMÈTRES
  // ============================================================================

  /**
   * Sauvegarde les paramètres
   */
  async function saveSettings() {
    try {
      // Collecte les valeurs du formulaire
      const formData = collectFormData();
      
      // Valide les données
      if (!validateSettings(formData)) {
        return;
      }

      // Sauvegarde
      await chrome.storage.sync.set(formData);
      
      // Met à jour les paramètres locaux
      state.settings = { ...state.settings, ...formData };
      
      showNotification('Paramètres sauvegardés avec succès', 'success');
      
      // Notifie les content scripts du changement
      notifyContentScripts();
      
    } catch (error) {
      console.error('LikeThat: Erreur lors de la sauvegarde:', error);
      showNotification('Erreur lors de la sauvegarde', 'error');
    }
  }

  /**
   * Collecte les données du formulaire
   * @returns {Object} Données du formulaire
   */
  function collectFormData() {
    const data = {};

    // Position du panneau
    const positionRadio = document.querySelector('input[name="panelPosition"]:checked');
    if (positionRadio) {
      data.panelPosition = positionRadio.value;
    }

    // Largeur du panneau
    const widthSlider = document.getElementById('panelWidth');
    if (widthSlider) {
      data.panelWidth = parseInt(widthSlider.value);
    }

    // Comportement du clic
    const clickRadio = document.querySelector('input[name="clickBehavior"]:checked');
    if (clickRadio) {
      data.clickBehavior = clickRadio.value;
    }

    // Mode de couleur
    const colorModeRadio = document.querySelector('input[name="colorMode"]:checked');
    if (colorModeRadio) {
      data.colorMode = colorModeRadio.value;
    }

    // Thème
    const themeRadio = document.querySelector('input[name="theme"]:checked');
    if (themeRadio) {
      data.theme = themeRadio.value;
    }

    // Mode clic
    const clickModeCheckbox = document.getElementById('useClickMode');
    if (clickModeCheckbox) {
      data.useClickMode = clickModeCheckbox.checked;
    }

    // Délai de survol
    const delaySlider = document.getElementById('hoverDelay');
    if (delaySlider) {
      data.hoverDelay = parseInt(delaySlider.value);
    }

    // Sites exclus
    const excludedTextarea = document.getElementById('excludedSites');
    if (excludedTextarea) {
      const sites = excludedTextarea.value
        .split('\n')
        .map(site => site.trim())
        .filter(site => site.length > 0);
      data.excludedSites = sites;
    }

    // Position de la barre de favoris
    const barPositionRadio = document.querySelector('input[name="bookmarksBarPosition"]:checked');
    if (barPositionRadio) {
      data.bookmarksBarPosition = barPositionRadio.value;
    }

    // Animation des icônes
    const iconAnimationCheckbox = document.getElementById('iconAnimationEnabled');
    if (iconAnimationCheckbox) {
      data.iconAnimationEnabled = iconAnimationCheckbox.checked;
    }

    // Recherche sensible à la casse
    const searchCaseSensitiveCheckbox = document.getElementById('searchCaseSensitive');
    if (searchCaseSensitiveCheckbox) {
      data.searchCaseSensitive = searchCaseSensitiveCheckbox.checked;
    }

    // Taille des icônes
    const iconSizeSlider = document.getElementById('iconSize');
    if (iconSizeSlider) {
      data.iconSize = parseInt(iconSizeSlider.value);
    }

    // Taille de la police
    const fontSizeSlider = document.getElementById('fontSize');
    if (fontSizeSlider) {
      data.fontSize = parseInt(fontSizeSlider.value);
    }

    // Opacité du panneau
    const panelOpacitySlider = document.getElementById('panelOpacity');
    if (panelOpacitySlider) {
      data.panelOpacity = parseFloat(panelOpacitySlider.value);
    }

    // Style du panneau
    const panelStyleRadio = document.querySelector('input[name="panelStyle"]:checked');
    if (panelStyleRadio) {
      data.panelStyle = panelStyleRadio.value;
    }

    // Nouveau onglet - Moteur de recherche
    const newTabEngineRadio = document.querySelector('input[name="newTabSearchEngine"]:checked');
    if (newTabEngineRadio) {
      data.newTabSearchEngine = newTabEngineRadio.value;
    }
    
    // Nouveau onglet - URL personnalisée
    const customNewTabUrlInput = document.getElementById('customNewTabUrl');
    if (customNewTabUrlInput) {
      data.customNewTabUrl = customNewTabUrlInput.value.trim();
    }

    return data;
  }

  /**
   * Valide les paramètres
   * @param {Object} data - Données à valider
   * @returns {boolean} True si valide
   */
  function validateSettings(data) {
    // Validation de la largeur
    if (data.panelWidth && (data.panelWidth < 200 || data.panelWidth > 500)) {
      showNotification('La largeur doit être entre 200 et 500 pixels', 'error');
      return false;
    }

    // Validation du délai
    if (data.hoverDelay && (data.hoverDelay < 100 || data.hoverDelay > 2000)) {
      showNotification('Le délai doit être entre 100 et 2000 millisecondes', 'error');
      return false;
    }

    // Validation de la taille des icônes
    if (data.fontSize && (data.fontSize < 12 || data.fontSize > 20)) {
      showNotification('La taille de la police doit être entre 12 et 20 pixels', 'warning');
      return false;
    }

    if (data.panelOpacity && (data.panelOpacity < 0.5 || data.panelOpacity > 1.0)) {
      showNotification('L\'opacité du panneau doit être entre 50% et 100%', 'warning');
      return false;
    }

    if (data.iconSize && (data.iconSize < 12 || data.iconSize > 32)) {
      showNotification('La taille des icônes doit être entre 12 et 32 pixels', 'error');
      return false;
    }

    // Validation des sites exclus
    if (data.excludedSites) {
      for (const site of data.excludedSites) {
        if (site.includes(' ')) {
          showNotification('Les domaines ne doivent pas contenir d\'espaces', 'error');
          return false;
        }
      }
    }

    // Validation de l'URL personnalisée pour le nouvel onglet
    if (data.customNewTabUrl && data.customNewTabUrl.trim()) {
      const url = data.customNewTabUrl.trim();
      try {
        const urlObj = new URL(url);
        // Vérifier que c'est http ou https
        if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
          showNotification('L\'URL personnalisée doit commencer par http:// ou https://', 'error');
          return false;
        }
      } catch {
        showNotification('L\'URL personnalisée n\'est pas valide', 'error');
        return false;
      }
    }

    return true;
  }

  /**
   * Réinitialise les paramètres
   */
  async function resetSettings() {
    if (confirm('Êtes-vous sûr de vouloir réinitialiser tous les paramètres ?')) {
      try {
        await chrome.storage.sync.clear();
        state.settings = { ...state.defaultSettings };
        updateUI();
        updatePreview();
        showNotification('Paramètres réinitialisés', 'success');
        notifyContentScripts();
      } catch (error) {
        console.error('LikeThat: Erreur lors de la réinitialisation:', error);
        showNotification('Erreur lors de la réinitialisation', 'error');
      }
    }
  }

  // ============================================================================
  // APERÇU ET NOTIFICATIONS
  // ============================================================================

  /**
   * Convertit une couleur hex en RGB
   * @param {string} hex - Couleur hex (ex: #0ea5e9)
   * @returns {Object|null} Objet avec r, g, b ou null
   */
  function hexToRgb(hex) {
    if (!hex) return null;
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  /**
   * Met à jour l'aperçu
   */
  function updatePreview() {
    const previewPanel = document.getElementById('previewPanel');
    if (!previewPanel) return;

    // Position
    const positionRadio = document.querySelector('input[name="panelPosition"]:checked');
    if (positionRadio) {
      previewPanel.className = previewPanel.className.replace(/\b(left|right)\b/g, '');
      previewPanel.classList.add(positionRadio.value);
    }

    // Largeur
    const widthSlider = document.getElementById('panelWidth');
    if (widthSlider) {
      previewPanel.style.width = `${widthSlider.value}px`;
    }

    // Mode de couleur et thème
    const colorModeRadio = document.querySelector('input[name="colorMode"]:checked');
    const themeRadio = document.querySelector('input[name="theme"]:checked');
    if (themeRadio && colorModeRadio) {
      previewPanel.setAttribute('data-theme', themeRadio.value);
      
      let mode = colorModeRadio.value;
      if (mode === 'auto') {
        mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      previewPanel.setAttribute('data-color-mode', mode);
      
      applyThemeToPage(themeRadio.value, colorModeRadio.value);
    }

    // Style du panneau
    const panelStyleRadio = document.querySelector('input[name="panelStyle"]:checked');
    if (panelStyleRadio) {
      previewPanel.classList.remove('panel-flat', 'panel-elevated', 'panel-strong-elevated', 'panel-fade', 'panel-glow');
      previewPanel.classList.add(`panel-${panelStyleRadio.value}`);
      
      // Appliquer le style glow avec la couleur primaire
      if (panelStyleRadio.value === 'glow') {
        const computedStyle = getComputedStyle(document.documentElement);
        const primaryColor = computedStyle.getPropertyValue('--primary-color').trim();
        if (primaryColor) {
          // Convertir la couleur hex en rgba pour l'opacité
          const rgb = hexToRgb(primaryColor);
          if (rgb) {
            previewPanel.style.boxShadow = `0 0 20px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3), 0 4px 12px rgba(0, 0, 0, 0.1)`;
          }
        }
      } else {
        previewPanel.style.boxShadow = '';
      }
    }

    // Opacité du panneau (sauf pour fade qui a sa propre opacité)
    const panelOpacitySlider = document.getElementById('panelOpacity');
    if (panelOpacitySlider) {
      const opacity = parseFloat(panelOpacitySlider.value);
      const currentPanelStyle = panelStyleRadio ? panelStyleRadio.value : 'elevated';
      if (currentPanelStyle !== 'fade') {
        previewPanel.style.opacity = opacity.toString();
      } else {
        previewPanel.style.opacity = (opacity * 0.9).toString();
      }
    }

    // Taille de la police
    const fontSizeSlider = document.getElementById('fontSize');
    if (fontSizeSlider) {
      const fontSize = parseInt(fontSizeSlider.value);
      previewPanel.style.fontSize = `${fontSize}px`;
    }

    // Taille des icônes
    const iconSizeSlider = document.getElementById('iconSize');
    if (iconSizeSlider) {
      const iconSize = parseInt(iconSizeSlider.value);
      const favicons = previewPanel.querySelectorAll('.preview-favicon');
      favicons.forEach(favicon => {
        favicon.style.width = `${iconSize}px`;
        favicon.style.height = `${iconSize}px`;
        favicon.style.fontSize = `${iconSize * 0.8}px`;
      });
    }
  }

  /**
   * Notifie les content scripts des changements
   */
  function notifyContentScripts() {
    // Envoie un message à tous les onglets
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
          chrome.tabs.sendMessage(tab.id, { action: 'settingsChanged' }).catch(() => {
            // Ignore les erreurs (onglet fermé, pas de content script, etc.)
          });
        }
      });
    });
  }

  /**
   * Affiche une notification
   * @param {string} message - Message à afficher
   * @param {string} type - Type de notification (success, error, warning)
   */
  function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    
    if (!notification || !notificationText) return;

    notificationText.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.remove('hidden');
    notification.classList.add('show');

    // Cache la notification après 3 secondes
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        notification.classList.add('hidden');
      }, 300);
    }, 3000);
  }
  // Retourne l'objet state pour accès externe si nécessaire
  return state;
}

// ============================================================================
// INITIALISATION
// ============================================================================

// Initialise la page d'options quand le DOM est prêt
document.addEventListener('DOMContentLoaded', () => {
  createLikeThatOptions();
});