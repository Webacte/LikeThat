/**
 * Service Worker pour LikeThat Extension
 * 
 * Ce fichier gère :
 * - La récupération et le cache des favoris
 * - La communication avec le content script
 * - La synchronisation des paramètres
 * - Les événements de changement de favoris
 */

// ============================================================================
// CONFIGURATION ET CACHE
// ============================================================================

// Cache pour les favoris (évite les appels API répétés)
// Utilise chrome.storage.local pour persister le cache entre les redémarrages
let bookmarksCache = null; // Cache mémoire pour accès rapide
let lastUpdateTime = 0;
const CACHE_DURATION = 300000; // 5 minutes (augmenté de 30s)
const CACHE_KEY = 'bookmarksCache';
const CACHE_TIMESTAMP_KEY = 'bookmarksCacheTimestamp';

// ============================================================================
// GESTION DES NOUVEAUX ONGLETS
// ============================================================================

/**
 * Liste des URLs de pages newtab par défaut selon le navigateur
 */
const NEWTAB_URLS = [
  'chrome://newtab/',
  'edge://newtab/',
  'about:newtab',
  'about:home'
];

/**
 * Vérifie si une URL est une page newtab par défaut
 * @param {string} url - URL à vérifier
 * @returns {boolean} True si c'est une page newtab
 */
function isNewTabPage(url) {
  if (!url) return false;
  return NEWTAB_URLS.some(newtabUrl => url === newtabUrl || url.startsWith(newtabUrl));
}

/**
 * Mapping des moteurs de recherche disponibles (URLs de base)
 */
const SEARCH_ENGINES = {
  'google': 'https://www.google.com',
  'bing': 'https://www.bing.com',
  'duckduckgo': 'https://duckduckgo.com',
  'yahoo': 'https://www.yahoo.com',
  'ecosia': 'https://www.ecosia.org',
  'qwant': 'https://www.qwant.com'
};

/**
 * Récupère l'URL personnalisée pour les nouveaux onglets
 * @returns {Promise<string|null>} URL personnalisée ou null
 */
async function getCustomNewTabUrl() {
  try {
    const settings = await chrome.storage.sync.get(['customNewTabUrl', 'newTabSearchEngine']);
    
    // Si une URL personnalisée est définie, l'utiliser
    if (settings.customNewTabUrl && settings.customNewTabUrl.trim()) {
      const url = settings.customNewTabUrl.trim();
      // Valider que c'est une URL valide
      try {
        const urlObj = new URL(url);
        // Vérifier que c'est http ou https
        if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
          return url;
        }
        console.error('LikeThat: URL personnalisée doit être http ou https:', url);
        return null;
      } catch {
        console.error('LikeThat: URL personnalisée invalide:', url);
        return null;
      }
    }
    
    // Sinon, utiliser le moteur de recherche sélectionné
    if (settings.newTabSearchEngine && SEARCH_ENGINES[settings.newTabSearchEngine]) {
      return SEARCH_ENGINES[settings.newTabSearchEngine];
    }
    
    return null;
  } catch (error) {
    console.error('LikeThat: Erreur lors de la récupération de l\'URL personnalisée:', error);
    return null;
  }
}

// ============================================================================
// FONCTIONS DE GESTION DES FAVORIS
// ============================================================================

/**
 * Récupère tous les favoris depuis l'API Chrome
 * @returns {Promise<Object|null>} Arbre des favoris ou null en cas d'erreur
 */
async function fetchAllBookmarks() {
  try {
    const bookmarks = await chrome.bookmarks.getTree();
    return bookmarks[0]; // Retourne le nœud racine
  } catch (error) {
    console.error('LikeThat: Erreur lors de la récupération des favoris:', error);
    return null;
  }
}

/**
 * Traite les favoris pour les organiser par dossiers
 * Optimisé pour éviter les copies inutiles et améliorer les performances
 * @param {Object} bookmarkNode - Nœud de favori à traiter
 * @returns {Object} Nœud traité avec structure standardisée
 */
function processBookmarks(bookmarkNode) {
  // Créer l'objet résultat directement avec les bonnes propriétés
  const hasUrl = !!bookmarkNode.url;
  const result = {
    id: bookmarkNode.id,
    title: bookmarkNode.title,
    url: bookmarkNode.url || undefined, // Ne pas inclure url si undefined
    isFolder: !hasUrl,
    expanded: bookmarkNode.id === '2' // Le dossier "Autres favoris" (id:2) est ouvert par défaut
  };

  // Traiter les enfants seulement s'ils existent
  if (bookmarkNode.children && bookmarkNode.children.length > 0) {
    result.children = bookmarkNode.children.map(child => processBookmarks(child));
  } else {
    result.children = [];
  }

  return result;
}

/**
 * Filtre les favoris selon les exclusions configurées
 * Optimisé pour améliorer les performances avec de grandes listes
 * @param {Object} bookmarkNode - Nœud de favori à filtrer
 * @param {Array} excludedSites - Liste des sites à exclure
 * @returns {Object|null} Nœud filtré ou null si exclu
 */
function filterBookmarks(bookmarkNode, excludedSites = []) {
  // Exclut les favoris correspondant aux sites exclus
  // Optimisation : vérifier seulement si on a une URL et des exclusions
  if (bookmarkNode.url && excludedSites.length > 0) {
    const url = bookmarkNode.url;
    // Utiliser une boucle for pour éviter la création de fonctions à chaque itération
    for (let i = 0; i < excludedSites.length; i++) {
      if (url.includes(excludedSites[i])) {
        return null;
      }
    }
  }

  // Traite récursivement les enfants seulement s'ils existent
  if (bookmarkNode.children && bookmarkNode.children.length > 0) {
    const filteredChildren = [];
    // Utiliser une boucle for pour éviter les allocations multiples
    for (let i = 0; i < bookmarkNode.children.length; i++) {
      const filtered = filterBookmarks(bookmarkNode.children[i], excludedSites);
      if (filtered !== null) {
        filteredChildren.push(filtered);
      }
    }
    
    // Créer un nouvel objet seulement si nécessaire (si des enfants ont été filtrés)
    if (filteredChildren.length !== bookmarkNode.children.length) {
      return {
        ...bookmarkNode,
        children: filteredChildren
      };
    }
    // Si aucun enfant n'a été filtré, retourner le nœud original
    return bookmarkNode;
  }

  return bookmarkNode;
}

// ============================================================================
// GESTIONNAIRES DE MESSAGES
// ============================================================================

/**
 * Gestionnaire principal pour les messages du content script
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getBookmarks':
      handleGetBookmarks(sendResponse);
      return true; // Indique une réponse asynchrone

    case 'updateBookmark':
      handleUpdateBookmark(request.data, sendResponse);
      return true;

    case 'moveBookmark':
      handleMoveBookmark(request.data, sendResponse);
      return true;

    case 'getSettings':
      handleGetSettings(sendResponse);
      return true;

    case 'openOptions':
      chrome.runtime.openOptionsPage();
      sendResponse({ success: true });
      break;

    case 'openInNewTab':
      chrome.tabs.create({ url: request.url });
      sendResponse({ success: true });
      return false;

    case 'openInNewWindow':
      chrome.windows.create({ url: request.url });
      sendResponse({ success: true });
      return false;

    case 'deleteBookmark':
      handleDeleteBookmark(request.id, sendResponse);
      return true;

    case 'createBookmark':
      handleCreateBookmark(request.data, sendResponse);
      return true;

    case 'getCurrentTab':
      handleGetCurrentTab(sendResponse);
      return true;

    case 'getAllTabs':
      handleGetAllTabs(sendResponse);
      return true;

    default:
      sendResponse({ error: 'Action non reconnue' });
  }
});

/**
 * Charge le cache depuis chrome.storage.local
 * @returns {Promise<Object|null>} Cache des favoris ou null
 */
async function loadCacheFromStorage() {
  try {
    const result = await chrome.storage.local.get([CACHE_KEY, CACHE_TIMESTAMP_KEY]);
    const cachedData = result[CACHE_KEY];
    const timestamp = result[CACHE_TIMESTAMP_KEY];
    
    if (cachedData && timestamp) {
      const now = Date.now();
      const age = now - timestamp;
      
      // Vérifier si le cache est encore valide
      if (age < CACHE_DURATION) {
        return cachedData;
      }
    }
    return null;
  } catch (error) {
    console.error('LikeThat: Erreur lors du chargement du cache:', error);
    return null;
  }
}

/**
 * Sauvegarde le cache dans chrome.storage.local
 * @param {Object} data - Données à mettre en cache
 */
async function saveCacheToStorage(data) {
  try {
    const now = Date.now();
    await chrome.storage.local.set({
      [CACHE_KEY]: data,
      [CACHE_TIMESTAMP_KEY]: now
    });
  } catch (error) {
    console.error('LikeThat: Erreur lors de la sauvegarde du cache:', error);
  }
}

/**
 * Invalide le cache (mémoire et stockage)
 */
async function invalidateCache() {
  bookmarksCache = null;
  lastUpdateTime = 0;
  try {
    await chrome.storage.local.remove([CACHE_KEY, CACHE_TIMESTAMP_KEY]);
  } catch (error) {
    console.error('LikeThat: Erreur lors de l\'invalidation du cache:', error);
  }
}

/**
 * Précharge les favoris en arrière-plan
 * Cette fonction est appelée au démarrage pour avoir les favoris prêts
 */
async function preloadBookmarks() {
  try {
    // Vérifier d'abord si on a un cache valide
    const cachedData = await loadCacheFromStorage();
    if (cachedData) {
      bookmarksCache = cachedData;
      lastUpdateTime = Date.now();
      return; // Cache valide, pas besoin de recharger
    }

    // Sinon, charger les favoris en arrière-plan
    const rawBookmarks = await fetchAllBookmarks();
    if (!rawBookmarks) {
      return;
    }

    // Récupère les paramètres d'exclusion
    const settings = await chrome.storage.sync.get(['excludedSites']);
    const excludedSites = settings.excludedSites || [];

    // Filtre et traite les favoris
    const filteredBookmarks = filterBookmarks(rawBookmarks, excludedSites);
    const processedBookmarks = processBookmarks(filteredBookmarks);

    // Met à jour le cache
    bookmarksCache = processedBookmarks;
    lastUpdateTime = Date.now();
    await saveCacheToStorage(processedBookmarks);
  } catch (error) {
    // Erreur silencieuse lors du préchargement (non bloquant)
    console.debug('LikeThat: Erreur lors du préchargement des favoris:', error);
  }
}

/**
 * Récupère les favoris avec cache
 * @param {Function} sendResponse - Fonction de réponse
 */
async function handleGetBookmarks(sendResponse) {
  const now = Date.now();
  
  // Vérifier d'abord le cache mémoire
  if (bookmarksCache && (now - lastUpdateTime) < CACHE_DURATION) {
    sendResponse({ success: true, data: bookmarksCache });
    return;
  }

  // Essayer de charger depuis le stockage persistant
  const cachedData = await loadCacheFromStorage();
  if (cachedData) {
    bookmarksCache = cachedData;
    lastUpdateTime = now;
    sendResponse({ success: true, data: cachedData });
    return;
  }

  try {
    // Récupère les favoris bruts
    const rawBookmarks = await fetchAllBookmarks();
    if (!rawBookmarks) {
      sendResponse({ success: false, error: 'Impossible de récupérer les favoris' });
      return;
    }

    // Récupère les paramètres d'exclusion
    const settings = await chrome.storage.sync.get(['excludedSites']);
    const excludedSites = settings.excludedSites || [];

    // Filtre et traite les favoris
    const filteredBookmarks = filterBookmarks(rawBookmarks, excludedSites);
    const processedBookmarks = processBookmarks(filteredBookmarks);

    // Met à jour le cache (mémoire et stockage)
    bookmarksCache = processedBookmarks;
    lastUpdateTime = now;
    await saveCacheToStorage(processedBookmarks);

    sendResponse({ success: true, data: processedBookmarks });
  } catch (error) {
    console.error('LikeThat: Erreur lors du traitement des favoris:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Met à jour un favori
 * @param {Object} data - Données de mise à jour
 * @param {Function} sendResponse - Fonction de réponse
 */
async function handleUpdateBookmark(data, sendResponse) {
  try {
    const { bookmarkId, changes } = data;
    await chrome.bookmarks.update(bookmarkId, changes);
    
    // Invalide le cache
    await invalidateCache();
    
    sendResponse({ success: true });
  } catch (error) {
    console.error('LikeThat: Erreur lors de la mise à jour du favori:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Déplace un favori
 * @param {Object} data - Données de déplacement
 * @param {Function} sendResponse - Fonction de réponse
 */
async function handleMoveBookmark(data, sendResponse) {
  try {
    const { bookmarkId, destinationId, index } = data;
    await chrome.bookmarks.move(bookmarkId, { parentId: destinationId, index });
    
    // Invalide le cache
    await invalidateCache();
    
    sendResponse({ success: true });
  } catch (error) {
    console.error('LikeThat: Erreur lors du déplacement du favori:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Supprime un favori ou un dossier (récursivement si nécessaire)
 * @param {string} id - ID du favori à supprimer
 * @param {Function} sendResponse - Fonction de réponse
 */
async function handleDeleteBookmark(id, sendResponse) {
  try {
    // Récupérer l'élément pour vérifier s'il s'agit d'un dossier
    const bookmarkNode = await chrome.bookmarks.get(id);
    
    if (bookmarkNode && bookmarkNode[0]) {
      const node = bookmarkNode[0];
      
      // Si c'est un dossier (pas d'URL), utiliser removeTree pour supprimer récursivement
      if (!node.url) {
        await chrome.bookmarks.removeTree(id);
      } else {
        // Sinon, supprimer normalement
        await chrome.bookmarks.remove(id);
      }
    } else {
      // Cas par défaut : essayer remove
      await chrome.bookmarks.remove(id);
    }
    
    // Invalide le cache
    await invalidateCache();
    
    sendResponse({ success: true });
  } catch (error) {
    console.error('LikeThat: Erreur lors de la suppression du favori:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Crée un nouveau favori ou dossier
 * @param {Object} data - Données de création (parentId, title, url optionnel)
 * @param {Function} sendResponse - Fonction de réponse
 */
async function handleCreateBookmark(data, sendResponse) {
  try {
    const newBookmark = await chrome.bookmarks.create(data);
    
    // Invalide le cache
    await invalidateCache();
    
    sendResponse({ success: true, data: newBookmark });
  } catch (error) {
    console.error('LikeThat: Erreur lors de la création du favori:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Vérifie si une URL peut être enregistrée comme favori
 * @param {string} url - URL à vérifier
 * @returns {boolean} true si l'URL est valide pour être enregistrée
 */
function isValidBookmarkUrl(url) {
  if (!url) return false;
  
  // URLs invalides (pages spéciales du navigateur)
  const invalidProtocols = [
    'chrome://',
    'chrome-extension://',
    'edge://',
    'about:',
    'moz-extension://',
    'opera://',
    'vivaldi://'
  ];
  
  // Vérifier si l'URL commence par un protocole invalide
  const lowerUrl = url.toLowerCase();
  if (invalidProtocols.some(protocol => lowerUrl.startsWith(protocol))) {
    return false;
  }
  
  // Vérifier si c'est une URL http/https valide
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Récupère l'onglet actuel
 * @param {Function} sendResponse - Fonction de réponse
 */
async function handleGetCurrentTab(sendResponse) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs.length > 0) {
      const tab = tabs[0];
      const isValid = isValidBookmarkUrl(tab.url);
      
      sendResponse({ 
        success: true, 
        data: {
          url: tab.url,
          title: tab.title,
          favIconUrl: tab.favIconUrl,
          isValid: isValid
        }
      });
    } else {
      sendResponse({ success: false, error: 'Aucun onglet actif trouvé' });
    }
  } catch (error) {
    console.error('LikeThat: Erreur lors de la récupération de l\'onglet actuel:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Récupère tous les onglets de la fenêtre courante
 * @param {Function} sendResponse - Fonction de réponse
 */
async function handleGetAllTabs(sendResponse) {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    if (tabs && tabs.length > 0) {
      const tabsData = tabs.map(tab => ({
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl,
        isValid: isValidBookmarkUrl(tab.url)
      }));
      
      // Vérifier s'il y a au moins un onglet valide
      const hasValidTabs = tabsData.some(tab => tab.isValid);
      
      sendResponse({ 
        success: true, 
        data: tabsData,
        hasValidTabs: hasValidTabs
      });
    } else {
      sendResponse({ success: false, error: 'Aucun onglet trouvé' });
    }
  } catch (error) {
    console.error('LikeThat: Erreur lors de la récupération des onglets:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Récupère les paramètres utilisateur
 * @param {Function} sendResponse - Fonction de réponse
 */
async function handleGetSettings(sendResponse) {
  try {
    const settings = await chrome.storage.sync.get([
      'panelPosition',
      'panelWidth',
      'clickBehavior',
      'theme',
      'excludedSites',
      'hoverDelay',
      'useClickMode',
      'headerColor',
      'searchCaseSensitive'
    ]);

    // Valeurs par défaut
    const defaultSettings = {
      panelPosition: 'left',
      panelWidth: 300,
      clickBehavior: 'current',
      theme: 'auto',
      excludedSites: [],
      hoverDelay: 500,
      useClickMode: false,
      headerColor: '#f6ff7a',
      searchCaseSensitive: false
    };

    const finalSettings = { ...defaultSettings, ...settings };
    sendResponse({ success: true, data: finalSettings });
  } catch (error) {
    console.error('LikeThat: Erreur lors de la récupération des paramètres:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// ============================================================================
// ÉVÉNEMENTS DE CHANGEMENT DE FAVORIS
// ============================================================================

/**
 * Notifie tous les onglets actifs qu'il faut recharger les favoris
 */
async function notifyBookmarksChanged() {
  // Invalide le cache (mémoire et stockage)
  await invalidateCache();
  
  // Notifie tous les onglets actifs
  try {
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { 
        action: 'bookmarksChanged' 
      }).catch(() => {
        // Ignore les erreurs (onglets sans content script)
      });
    });
  } catch (error) {
    console.error('LikeThat: Erreur lors de la notification:', error);
  }
}

/**
 * Écoute les changements de favoris pour invalider le cache et notifier
 */
chrome.bookmarks.onCreated.addListener(() => {
  notifyBookmarksChanged();
});

chrome.bookmarks.onRemoved.addListener(() => {
  notifyBookmarksChanged();
});

chrome.bookmarks.onChanged.addListener(() => {
  notifyBookmarksChanged();
});

chrome.bookmarks.onMoved.addListener(() => {
  notifyBookmarksChanged();
});

// ============================================================================
// GESTION DES NOUVEAUX ONGLETS - LISTENERS
// ============================================================================

/**
 * Intercepte les nouveaux onglets et les redirige si nécessaire
 */
chrome.tabs.onCreated.addListener(async (tab) => {
  try {
    // Attendre un peu pour que l'URL soit définie
    setTimeout(async () => {
      try {
        const updatedTab = await chrome.tabs.get(tab.id);
        
        // Vérifier si c'est une page newtab
        if (updatedTab.url && isNewTabPage(updatedTab.url)) {
          const customUrl = await getCustomNewTabUrl();
          
          if (customUrl) {
            // Rediriger vers l'URL personnalisée
            await chrome.tabs.update(tab.id, { url: customUrl });
          }
        }
      } catch (error) {
        // L'onglet a peut-être été fermé ou l'URL n'est pas encore disponible
        // Ignorer l'erreur
      }
    }, 100);
  } catch (error) {
    console.error('LikeThat: Erreur lors de l\'interception du nouvel onglet:', error);
  }
});

/**
 * Intercepte aussi les mises à jour d'onglets (pour les cas où l'URL change après création)
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  try {
    // Vérifier si l'URL a changé et si c'est une page newtab
    if (changeInfo.url && isNewTabPage(changeInfo.url)) {
      const customUrl = await getCustomNewTabUrl();
      
      if (customUrl) {
        // Rediriger vers l'URL personnalisée
        await chrome.tabs.update(tabId, { url: customUrl });
      }
    }
  } catch (error) {
    console.error('LikeThat: Erreur lors de la mise à jour de l\'onglet:', error);
  }
});

// ============================================================================
// INITIALISATION
// ============================================================================

/**
 * Initialisation du service worker
 */
chrome.runtime.onStartup.addListener(() => {
  // Précharger les favoris au démarrage du navigateur
  preloadBookmarks();
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Initialise les paramètres par défaut
    chrome.storage.sync.set({
      panelPosition: 'left',
      panelWidth: 300,
      clickBehavior: 'current',
      theme: 'auto',
      excludedSites: [],
      hoverDelay: 500,
      useClickMode: false
    });
  }
  // Précharger les favoris après l'installation/mise à jour
  preloadBookmarks();
});

// Précharger les favoris dès que le service worker est actif
// (pour les cas où onStartup/onInstalled ne sont pas déclenchés)
preloadBookmarks();