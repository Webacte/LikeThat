import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';

const FolderIconsContext = createContext();

export const useFolderIcons = () => {
  const context = useContext(FolderIconsContext);
  if (!context) {
    throw new Error('useFolderIcons must be used within a FolderIconsProvider');
  }
  return context;
};

export const FolderIconsProvider = ({ children }) => {
  const [folderIcons, setFolderIcons] = useState({});
  const [loading, setLoading] = useState(false);

  // Charger les icônes personnalisées depuis le stockage
  const loadFolderIcons = useCallback(async () => {
    setLoading(true);
    try {
      const result = await chrome.storage.local.get(['folderIcons']);
      if (result.folderIcons) {
        setFolderIcons(result.folderIcons);
      }
    } catch (error) {
      console.error('LikeThat: Erreur lors du chargement des icônes de dossiers:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Sauvegarder les icônes personnalisées
  const saveFolderIcons = useCallback(async (newFolderIcons) => {
    try {
      await chrome.storage.local.set({ folderIcons: newFolderIcons });
      setFolderIcons(newFolderIcons);
    } catch (error) {
      console.error('LikeThat: Erreur lors de la sauvegarde des icônes de dossiers:', error);
    }
  }, []);

  // Définir une icône personnalisée pour un dossier
  const setFolderIcon = useCallback((folderId, iconName, colorClass) => {
    const newFolderIcons = {
      ...folderIcons,
      [folderId]: {
        icon: iconName,
        color: colorClass
      }
    };
    saveFolderIcons(newFolderIcons);
  }, [folderIcons, saveFolderIcons]);

  // Supprimer une icône personnalisée
  const removeFolderIcon = useCallback((folderId) => {
    const newFolderIcons = { ...folderIcons };
    delete newFolderIcons[folderId];
    saveFolderIcons(newFolderIcons);
  }, [folderIcons, saveFolderIcons]);

  // Obtenir l'icône personnalisée d'un dossier
  const getFolderIcon = useCallback((folderId) => {
    return folderIcons[folderId] || null;
  }, [folderIcons]);

  // Charger les icônes au montage du composant
  // Utiliser requestIdleCallback avec un timeout long car les icônes peuvent attendre
  // Les icônes peuvent attendre 1000ms sans impact visuel majeur
  useEffect(() => {
    const load = () => {
      loadFolderIcons().catch(() => {
        // Erreur silencieuse
      });
    };
    
    // Utiliser requestIdleCallback avec timeout de 1000ms pour différer le chargement
    if (window.requestIdleCallback) {
      const id = requestIdleCallback(load, { timeout: 1000 });
      return () => cancelIdleCallback(id);
    } else {
      // Fallback : utiliser setTimeout avec un délai de 1000ms
      const timer = setTimeout(load, 1000);
      return () => clearTimeout(timer);
    }
  }, [loadFolderIcons]);

  const value = {
    folderIcons,
    loading,
    setFolderIcon,
    removeFolderIcon,
    getFolderIcon,
    loadFolderIcons
  };

  return (
    <FolderIconsContext.Provider value={value}>
      {children}
    </FolderIconsContext.Provider>
  );
};
