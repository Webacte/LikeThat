import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';

const BookmarksContext = createContext();

export const useBookmarks = () => {
  const context = useContext(BookmarksContext);
  if (!context) {
    throw new Error('useBookmarks must be used within a BookmarksProvider');
  }
  return context;
};

export const BookmarksProvider = ({ children }) => {
  const [bookmarks, setBookmarks] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false); // Nouveau : mode édition
  const [draggedItem, setDraggedItem] = useState(null); // Pour le drag and drop
  const [dragOverItem, setDragOverItem] = useState(null); // Pour l'indicateur visuel
  const [expandedFolders, setExpandedFolders] = useState(new Set()); // Pour préserver l'état expanded
  const [clickBehavior, setClickBehavior] = useState('current'); // Comportement du clic

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

  const loadBookmarks = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await sendMessage({ action: 'getBookmarks' });
      
      if (response.success) {
        // Appliquer l'état expanded aux nœuds
        const applyExpandedState = (node) => {
          if (node.children) {
            return {
              ...node,
              expanded: expandedFolders.has(node.id) || node.expanded,
              children: node.children.map(applyExpandedState)
            };
          }
          return node;
        };
        setBookmarks(applyExpandedState(response.data));
      } else {
        setError(response.error);
      }
    } catch (err) {
      console.error('LikeThat: Erreur lors du chargement des favoris:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [expandedFolders]);

  // Précharger les favoris dès le montage du provider
  // Utiliser requestIdleCallback avec un timeout plus long pour ne pas bloquer le rendu initial
  // Les favoris peuvent attendre 500ms sans impact visuel
  useEffect(() => {
    const load = () => {
      loadBookmarks().catch(() => {
        // Erreur silencieuse, le chargement se fera à la demande
      });
    };
    
    // Utiliser requestIdleCallback avec timeout de 500ms pour différer le chargement
    if (window.requestIdleCallback) {
      const id = requestIdleCallback(load, { timeout: 500 });
      return () => cancelIdleCallback(id);
    } else {
      // Fallback : utiliser setTimeout avec un délai de 500ms
      const timer = setTimeout(load, 500);
      return () => clearTimeout(timer);
    }
  }, []); // Exécuter une seule fois au montage

  // Écoute les changements de favoris depuis le background script
  useEffect(() => {
    const handleMessage = (message) => {
      if (message && message.action === 'bookmarksChanged') {
        loadBookmarks();
      }
    };

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

    return () => {
      if (messageListenerAdded && isExtensionContextValid()) {
        try {
          chrome.runtime.onMessage.removeListener(handleMessage);
        } catch (error) {
          // Ignorer les erreurs lors du nettoyage
        }
      }
    };
  }, [loadBookmarks, isExtensionContextValid]);

  const toggleFolder = (folderId) => {
    setBookmarks(prevBookmarks => {
      const updateNode = (node) => {
        if (node.id === folderId) {
          const newExpanded = !node.expanded;
          // Mettre à jour le Set des dossiers expanded
          setExpandedFolders(prev => {
            const newSet = new Set(prev);
            if (newExpanded) {
              newSet.add(folderId);
            } else {
              newSet.delete(folderId);
            }
            return newSet;
          });
          return { ...node, expanded: newExpanded };
        }
        if (node.children) {
          return {
            ...node,
            children: node.children.map(updateNode)
          };
        }
        return node;
      };
      return updateNode(prevBookmarks);
    });
  };

  const openBookmark = (url) => {
    if (!url) return;

    switch (clickBehavior) {
      case 'new-tab':
        // Ouvrir dans un nouvel onglet
        if (isExtensionContextValid()) {
          try {
            chrome.runtime.sendMessage({
              action: 'openInNewTab',
              url: url
            });
          } catch (error) {
            if (error.message && error.message.includes('Extension context invalidated')) {
              console.log('LikeThat: Contexte d\'extension invalide, ouverture dans l\'onglet courant');
              window.location.href = url;
            }
          }
        } else {
          window.location.href = url;
        }
        break;
      case 'new-window':
        // Ouvrir dans une nouvelle fenêtre
        if (isExtensionContextValid()) {
          try {
            chrome.runtime.sendMessage({
              action: 'openInNewWindow',
              url: url
            });
          } catch (error) {
            if (error.message && error.message.includes('Extension context invalidated')) {
              console.log('LikeThat: Contexte d\'extension invalide, ouverture dans l\'onglet courant');
              window.location.href = url;
            }
          }
        } else {
          window.location.href = url;
        }
        break;
      case 'current':
      default:
        // Ouvrir dans l'onglet courant
        window.location.href = url;
        break;
    }
  };

  // Charger le comportement du clic depuis les settings
  useEffect(() => {
    const loadClickBehavior = async () => {
      try {
        if (!isExtensionContextValid()) {
          return;
        }
        const result = await chrome.storage.sync.get(['clickBehavior']);
        if (result.clickBehavior) {
          setClickBehavior(result.clickBehavior);
        }
      } catch (error) {
        if (error.message && error.message.includes('Extension context invalidated')) {
          console.log('LikeThat: Contexte d\'extension invalide lors du chargement du comportement du clic');
        } else {
          console.error('Erreur lors du chargement du comportement du clic:', error);
        }
      }
    };

    loadClickBehavior();

    // Écouter les changements
    const handleMessage = (message) => {
      if (message && message.action === 'settingsChanged') {
        loadClickBehavior();
      }
    };

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

    return () => {
      if (messageListenerAdded && isExtensionContextValid()) {
        try {
          chrome.runtime.onMessage.removeListener(handleMessage);
        } catch (error) {
          // Ignorer les erreurs lors du nettoyage
        }
      }
    };
  }, [isExtensionContextValid]);

  const findBookmarkNode = (node, id) => {
    if (node.id === id) {
      return node;
    }
    
    if (node.children) {
      for (const child of node.children) {
        const found = findBookmarkNode(child, id);
        if (found) return found;
      }
    }
    
    return null;
  };

  // Nouveau : Supprimer un bookmark
  const deleteBookmark = async (id) => {
    try {
      const response = await sendMessage({ 
        action: 'deleteBookmark', 
        id 
      });
      
      if (response.success) {
        // Les favoris seront rechargés automatiquement via le listener bookmarksChanged
      } else {
        setError(response.error);
      }
    } catch (err) {
      console.error('Erreur lors de la suppression:', err);
      setError(err.message);
    }
  };

  // Nouveau : Déplacer un bookmark
  const moveBookmark = async (bookmarkId, destination) => {
    try {
      const response = await sendMessage({ 
        action: 'moveBookmark', 
        data: {
          bookmarkId,
          destinationId: destination.parentId,
          index: destination.index
        }
      });
      
      if (response.success) {
        // Les favoris seront rechargés automatiquement via le listener bookmarksChanged
      } else {
        setError(response.error);
      }
    } catch (err) {
      console.error('Erreur lors du déplacement:', err);
      setError(err.message);
    }
  };

  // Nouveau : Ouvrir tous les favoris d'un dossier récursivement
  const openAllBookmarksInFolder = (folder) => {
    const urls = [];
    
    // Fonction récursive pour collecter toutes les URLs
    const collectUrls = (node) => {
      if (node.url) {
        // C'est un favori, ajouter l'URL
        urls.push(node.url);
      } else if (node.children) {
        // C'est un dossier, parcourir les enfants
        node.children.forEach(child => collectUrls(child));
      }
    };
    
    // Collecter toutes les URLs
    collectUrls(folder);
    
    // Ouvrir tous les onglets
    if (isExtensionContextValid()) {
      urls.forEach(url => {
        try {
          chrome.runtime.sendMessage({
            action: 'openInNewTab',
            url: url
          });
        } catch (error) {
          if (error.message && error.message.includes('Extension context invalidated')) {
            console.log('LikeThat: Contexte d\'extension invalide, ouverture dans l\'onglet courant');
            window.location.href = url;
          }
        }
      });
    } else {
      // Fallback : ouvrir dans l'onglet courant
      urls.forEach(url => {
        window.location.href = url;
      });
    }
    
    return urls.length;
  };

  const value = {
    bookmarks,
    setBookmarks,
    loading,
    error,
    loadBookmarks,
    toggleFolder,
    openBookmark,
    findBookmarkNode,
    isEditMode,              // Nouveau
    setIsEditMode,           // Nouveau
    deleteBookmark,          // Nouveau
    moveBookmark,            // Nouveau
    openAllBookmarksInFolder, // Nouveau
    draggedItem,             // Drag and drop
    setDraggedItem,          // Drag and drop
    dragOverItem,            // Drag and drop
    setDragOverItem          // Drag and drop
  };

  return (
    <BookmarksContext.Provider value={value}>
      {children}
    </BookmarksContext.Provider>
  );
};

// Fonction utilitaire pour vérifier le contexte d'extension
const isExtensionContextValid = () => {
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
};

// Fonction utilitaire pour envoyer des messages
const sendMessage = (message) => {
  return new Promise((resolve) => {
    try {
      // Vérifier le contexte avant d'envoyer le message
      if (!isExtensionContextValid()) {
        resolve({ success: false, error: 'Extension context invalidated' });
        return;
      }

      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          const errorMessage = chrome.runtime.lastError.message;
          // Vérifier si c'est l'erreur "Extension context invalidated"
          if (errorMessage && errorMessage.includes('Extension context invalidated')) {
            resolve({ success: false, error: 'Extension context invalidated' });
          } else {
            resolve({ success: false, error: errorMessage });
          }
          return;
        }
        resolve(response || { success: false, error: 'No response' });
      });
    } catch (error) {
      if (error.message && error.message.includes('Extension context invalidated')) {
        resolve({ success: false, error: 'Extension context invalidated' });
      } else {
        resolve({ success: false, error: error.message });
      }
    }
  });
};
