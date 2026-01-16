import React, { useState, useRef, useEffect } from 'react';
import BookmarkButton from './BookmarkButton';
import BookmarkBarFolder from './BookmarkBarFolder';
import FolderSelectorTooltip from './FolderSelectorTooltip';
import { useContextMenu } from '../../context/ContextMenuContext';
import { useBookmarks } from '../../context/BookmarksContext';
import { useSettings } from '../../context/SettingsContext';

/**
 * Fonction helper pour détecter si le contexte de l'extension est invalide
 * @param {Error|string|object} error - L'erreur à vérifier (peut être chrome.runtime.lastError)
 * @returns {boolean} - true si le contexte est invalide
 */
const isContextInvalidatedError = (error) => {
  if (!error) return false;
  
  // Vérifier error.message
  if (error.message) {
    const errorMsg = String(error.message);
    if (errorMsg.includes('Extension context invalidated') ||
        errorMsg.includes('message port closed') ||
        errorMsg.includes('Receiving end does not exist')) {
      return true;
    }
  }
  
  // Vérifier si l'erreur est une chaîne
  if (typeof error === 'string') {
    if (error.includes('Extension context invalidated') ||
        error.includes('message port closed') ||
        error.includes('Receiving end does not exist')) {
      return true;
    }
  }
  
  // Vérifier error.toString()
  try {
    const errorString = String(error);
    if (errorString.includes('Extension context invalidated') ||
        errorString.includes('message port closed') ||
        errorString.includes('Receiving end does not exist')) {
      return true;
    }
  } catch (e) {
    // Ignorer les erreurs de conversion
  }
  
  return false;
};

const BookmarkBar = ({ bookmarks, onToggleSearch, isSearchActive }) => {
  const { isEditMode, setIsEditMode, draggedItem, setDraggedItem, setDragOverItem, moveBookmark } = useBookmarks();
  const { settings } = useSettings();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isHoveringDivider, setIsHoveringDivider] = useState(false);
  const [showAddFolderTooltip, setShowAddFolderTooltip] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderError, setFolderError] = useState('');
  const [addFolderTooltipPosition, setAddFolderTooltipPosition] = useState({ top: 0, left: 0 });
  const addFolderTooltipRef = useRef(null);
  
  // États pour les nouveaux boutons "Ajouter onglet(s)"
  const [showFolderSelector, setShowFolderSelector] = useState(false);
  const [folderSelectorPosition, setFolderSelectorPosition] = useState({ top: 0, left: 0 });
  const [currentTabData, setCurrentTabData] = useState(null);
  const [isMultipleTabs, setIsMultipleTabs] = useState(false);
  const [currentTabValid, setCurrentTabValid] = useState(true);
  const [allTabsValid, setAllTabsValid] = useState(true);

  if (!bookmarks) {
    return null;
  }

  const hasChildren = bookmarks.children && bookmarks.children.length > 0;

  // Gestionnaires pour la zone de drop de la barre de favoris
  const handleDragOver = (e) => {
    // Vérifier si c'est un fichier externe (depuis l'explorateur)
    const hasExternalFiles = e.dataTransfer.files && e.dataTransfer.files.length > 0;
    
    // Pour les fichiers externes, accepter même sans mode édition
    // Pour les favoris internes, nécessiter le mode édition
    if (!hasExternalFiles && (!isEditMode || !draggedItem)) return;
    
    // Utiliser currentTarget pour une détection plus fiable
    const currentTarget = e.currentTarget;
    const target = e.target;
    
    // Si on survole le tooltip ou ses éléments (scrollbar, etc.), ne pas activer la zone de drop
    const isOverTooltip = target.closest('.folder-tooltip');
    if (isOverTooltip) return;
    
    // Si on survole un bookmark-button-wrapper, folder-wrapper ou un de ses enfants, ne pas activer la zone de drop
    const isOverBookmark = target.closest('.bookmark-button-wrapper');
    const isOverFolder = target.closest('.folder-wrapper');
    if (isOverBookmark || isOverFolder) return;
    
    // Vérifier que c'est bien la zone .bookmarks-bar-drop-zone (zone vide spécifique) ou le message
    const isDropZone = target.classList.contains('bookmarks-bar-drop-zone');
    const isEmptyBarMessage = target.classList.contains('empty-bar-message');
    
    // Accepter SEULEMENT si c'est la zone de drop explicite ou le message de barre vide
    if (!isDropZone && !isEmptyBarMessage) return;
    
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = hasExternalFiles ? 'copy' : 'move';
    
    // Éviter les changements d'état répétés si déjà en dragOver
    if (!isDragOver) {
      setIsDragOver(true);
    }
    
    // Calculer l'index de destination (à la fin de la barre)
    const targetIndex = bookmarks.children?.length || 0;
    setDragOverItem({ node: { id: bookmarks.id }, parentId: bookmarks.id, index: targetIndex });
  };

  const handleDragLeave = (e) => {
    // Vérifier que l'événement vient bien de la zone de drop
    const target = e.target;
    
    // Si on survole le tooltip, ne pas gérer le leave
    const isOverTooltip = target.closest('.folder-tooltip');
    if (isOverTooltip) return;
    
    // Vérifier si on quitte la zone de drop vide spécifiquement
    const isDropZone = target.classList.contains('bookmarks-bar-drop-zone');
    const isEmptyBarMessage = target.classList.contains('empty-bar-message');
    
    // Si ce n'est pas la zone de drop vide, ne pas gérer
    if (!isDropZone && !isEmptyBarMessage) return;
    
    // Vérifier relatedTarget pour savoir où on va
    const relatedTarget = e.relatedTarget;
    
    // Si relatedTarget est null, on quitte vraiment la zone
    if (!relatedTarget) {
      e.stopPropagation();
      setIsDragOver(false);
      return;
    }
    
    // Si on va vers un élément interactif (bookmark-button, folder), ne pas réinitialiser
    // car ces éléments gèrent leur propre drag over
    const isGoingToBookmark = relatedTarget.closest('.bookmark-button-wrapper');
    const isGoingToFolder = relatedTarget.closest('.folder-wrapper');
    if (isGoingToBookmark || isGoingToFolder) {
      // On quitte la zone de drop vide pour aller vers un élément interactif
      e.stopPropagation();
      setIsDragOver(false);
      return;
    }
    
    // Si relatedTarget est toujours dans la barre mais pas dans un élément interactif,
    // vérifier si c'est encore la zone de drop
    const currentTarget = e.currentTarget;
    if (currentTarget.contains(relatedTarget)) {
      // Si on va vers un autre élément de la barre qui n'est pas la zone de drop
      const isStillInDropZone = relatedTarget.classList.contains('bookmarks-bar-drop-zone') ||
                                 relatedTarget.classList.contains('empty-bar-message') ||
                                 relatedTarget.closest('.bookmarks-bar-drop-zone') ||
                                 relatedTarget.closest('.empty-bar-message');
      
      if (!isStillInDropZone) {
        // On quitte la zone de drop pour aller ailleurs dans la barre
        e.stopPropagation();
        setIsDragOver(false);
        return;
      }
      // Sinon, on reste dans la zone de drop, ne rien faire
      return;
    }
    
    // On quitte complètement la barre
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    // Vérifier si c'est un fichier externe (depuis l'explorateur)
    const hasExternalFiles = e.dataTransfer.files && e.dataTransfer.files.length > 0;
    
    // Si c'est un fichier externe, traiter différemment
    if (hasExternalFiles) {
      handleFileDrop(e);
      return;
    }
    
    // Sinon, traiter comme un favori interne
    if (!isEditMode || !draggedItem) return;
    
    // Vérifier que l'événement vient bien de la zone de drop
    const target = e.target;
    
    // Si on drop sur le tooltip, ne pas gérer ici
    const isOverTooltip = target.closest('.folder-tooltip');
    if (isOverTooltip) return;
    
    // Si on drop sur un bookmark-button-wrapper ou folder-wrapper, ne pas gérer ici
    const isOverBookmark = target.closest('.bookmark-button-wrapper');
    const isOverFolder = target.closest('.folder-wrapper');
    if (isOverBookmark || isOverFolder) return;
    
    const isDropZone = target.classList.contains('bookmarks-bar-drop-zone');
    const isEmptyBarMessage = target.classList.contains('empty-bar-message');
    
    if (!isDropZone && !isEmptyBarMessage) return;
    
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    // Déplacer vers la barre de favoris en dernière position
    const targetIndex = bookmarks.children?.length || 0;
    moveBookmark(draggedItem.node.id, {
      parentId: bookmarks.id,
      index: targetIndex
    });

    setDraggedItem(null);
    setDragOverItem(null);
  };

  // Gestionnaire pour les fichiers externes glissés depuis l'explorateur
  const handleFileDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const target = e.target;
    
    // Vérifier que c'est bien la zone de drop
    const isOverTooltip = target.closest('.folder-tooltip');
    if (isOverTooltip) return;
    
    const isOverBookmark = target.closest('.bookmark-button-wrapper');
    const isOverFolder = target.closest('.folder-wrapper');
    if (isOverBookmark || isOverFolder) return;
    
    const isDropZone = target.classList.contains('bookmarks-bar-drop-zone');
    const isEmptyBarMessage = target.classList.contains('empty-bar-message');
    
    if (!isDropZone && !isEmptyBarMessage) {
      // Si ce n'est pas la zone de drop, vérifier si c'est la barre elle-même
      const isBookmarksBar = target.closest('.bookmarks-bar');
      if (!isBookmarksBar) return;
    }

    const files = Array.from(e.dataTransfer.files);
    const targetIndex = bookmarks.children?.length || 0;

    // Traiter chaque fichier
    const errors = [];
    const pendingRequests = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        // Vérifier si c'est un fichier .url Windows
        if (file.name.toLowerCase().endsWith('.url')) {
          try {
            // Lire le contenu du fichier .url
            const text = await file.text();
            
            // Extraire l'URL depuis le fichier .url (format INI)
            // Format typique: [InternetShortcut]\nURL=https://example.com
            const urlMatch = text.match(/URL=(.+)/i);
            if (urlMatch && urlMatch[1]) {
              const url = urlMatch[1].trim();
              
              // Vérifier que l'URL est valide
              if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
                errors.push(`Le fichier "${file.name}" contient une URL invalide: ${url}`);
                continue;
              }
              
              // Créer un favori avec l'URL extraite
              const requestPromise = new Promise((resolve) => {
                chrome.runtime.sendMessage({
                  action: 'createBookmarkFromFile',
                  data: {
                    parentId: bookmarks.id,
                    title: file.name.replace(/\.url$/i, ''),
                    url: url,
                    index: targetIndex + i
                  }
                }, (response) => {
                  if (!response || !response.success) {
                    const errorMsg = response?.error || 'Erreur inconnue';
                    console.error('Erreur lors de la création du favori depuis le fichier .url:', errorMsg);
                    errors.push(`Erreur pour "${file.name}": ${errorMsg}`);
                  }
                  resolve(response);
                });
              });
              pendingRequests.push(requestPromise);
            } else {
              const errorMsg = `Impossible d'extraire l'URL du fichier "${file.name}". Le fichier .url doit contenir une ligne "URL=..." avec une URL valide.`;
              console.warn(errorMsg);
              errors.push(errorMsg);
            }
          } catch (readError) {
            const errorMsg = `Impossible de lire le fichier "${file.name}": ${readError.message}`;
            console.error(errorMsg);
            errors.push(errorMsg);
          }
        } else {
          // Pour les autres fichiers, on ne peut pas créer de favori file://
          // car Chrome ne permet pas les favoris vers des fichiers locaux pour des raisons de sécurité
          const errorMsg = `Impossible de créer un favori pour le fichier "${file.name}". Chrome ne permet pas les favoris vers des fichiers locaux (file://) pour des raisons de sécurité. Utilisez un fichier .url Windows qui contient une URL web.`;
          console.warn(errorMsg);
          errors.push(errorMsg);
        }
      } catch (error) {
        const errorMsg = `Erreur lors du traitement du fichier "${file.name}": ${error.message}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Attendre que toutes les requêtes asynchrones soient terminées
    if (pendingRequests.length > 0) {
      await Promise.allSettled(pendingRequests);
    }

    // Afficher un résumé des erreurs si nécessaire
    if (errors.length > 0) {
      const errorMessage = errors.length === 1 
        ? errors[0]
        : `${errors.length} erreur(s) lors du traitement des fichiers:\n\n${errors.slice(0, 5).join('\n\n')}${errors.length > 5 ? `\n\n... et ${errors.length - 5} autre(s) erreur(s)` : ''}`;
      alert(errorMessage);
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
    setIsDragOver(false);
  };

  const handleSettingsClick = () => {
    chrome.runtime.sendMessage({ action: 'openOptions' });
  };

  const handleEditModeToggle = () => {
    setIsEditMode(!isEditMode);
  };

  const handleSearchToggle = () => {
    // Si la recherche est déjà ouverte, la fermer, sinon l'ouvrir
    if (typeof onToggleSearch === 'function') {
      onToggleSearch(!isSearchActive);
    }
  };

  const handleAddFolderFromMenu = () => {
    setAddFolderTooltipPosition(calculateAddFolderTooltipPosition());
    setShowAddFolderTooltip(true);
    setFolderName('');
    setFolderError('');
  };

  const handleAddCurrentTabFromMenu = async () => {
    if (!currentTabValid) return;
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getCurrentTab' });
      if (chrome.runtime.lastError && isContextInvalidatedError(chrome.runtime.lastError)) {
        setCurrentTabValid(false);
        return;
      }
      if (response && response.success && response.data.isValid) {
        setCurrentTabData(response.data);
        setIsMultipleTabs(false);
        setFolderSelectorPosition({ top: window.innerHeight / 2, left: window.innerWidth / 2 });
        setShowFolderSelector(true);
      }
    } catch (error) {
      if (isContextInvalidatedError(error)) {
        setCurrentTabValid(false);
        return;
      }
      console.error('Erreur lors de la récupération de l\'onglet actuel:', error);
    }
  };

  const handleAddAllTabsFromMenu = async () => {
    if (!allTabsValid) return;
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getAllTabs' });
      if (chrome.runtime.lastError && isContextInvalidatedError(chrome.runtime.lastError)) {
        setAllTabsValid(false);
        return;
      }
      if (response && response.success && response.hasValidTabs) {
        const validTabs = response.data.filter(tab => tab.isValid);
        if (validTabs.length > 0) {
          setCurrentTabData(validTabs);
          setIsMultipleTabs(true);
          setFolderSelectorPosition({ top: window.innerHeight / 2, left: window.innerWidth / 2 });
          setShowFolderSelector(true);
        }
      }
    } catch (error) {
      if (isContextInvalidatedError(error)) {
        setAllTabsValid(false);
        return;
      }
      console.error('Erreur lors de la récupération des onglets:', error);
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const menuItems = [
      {
        id: 'search',
        label: isSearchActive ? 'Fermer la recherche' : 'Rechercher',
        icon: isSearchActive ? '✕' : '🔍',
        onClick: handleSearchToggle
      },
      {
        id: 'add-current-tab',
        label: "Ajouter l'onglet actuel",
        icon: '🔖',
        onClick: handleAddCurrentTabFromMenu,
        disabled: !currentTabValid
      },
      {
        id: 'add-all-tabs',
        label: 'Ajouter tous les onglets',
        icon: '📚',
        onClick: handleAddAllTabsFromMenu,
        disabled: !allTabsValid
      },
      {
        id: 'add-folder',
        label: 'Créer un nouveau dossier',
        icon: '📁',
        onClick: handleAddFolderFromMenu
      },
      { separator: true },
      {
        id: 'settings',
        label: 'Paramètres',
        icon: '⚙️',
        onClick: handleSettingsClick
      },
      {
        id: 'edit-mode',
        label: isEditMode ? 'Désactiver le mode édition' : 'Activer le mode édition',
        icon: isEditMode ? '✅' : '📝',
        onClick: handleEditModeToggle
      }
    ];
    
    openContextMenu(
      'bookmark-bar',
      { top: e.clientY, left: e.clientX },
      menuItems,
      null,
      settings?.panelPosition || 'left'
    );
  };

  // Fonction helper pour calculer la position du tooltip d'ajout de dossier
  const calculateAddFolderTooltipPosition = () => {
    // Position par défaut au centre de l'écran
    return {
      top: window.innerHeight / 2,
      left: window.innerWidth / 2
    };
    const tooltipWidth = 250; // min-width de la tooltip
    const tooltipHeight = 120; // hauteur estimée de la tooltip
    
    // Déterminer la position du panneau (gauche ou droite)
    const panelPosition = settings?.panelPosition || 'left';
    // Déterminer la position de la barre de favoris (haut ou bas)
    const barPosition = settings?.bookmarksBarPosition || 'bottom';
    
    let left, top;
    
    // Position horizontale selon la position du panneau
    if (panelPosition === 'left') {
      // Panneau à gauche : tooltip à droite du bouton
      left = rect.right + 8;
      if (left + tooltipWidth > window.innerWidth) {
        left = rect.left - tooltipWidth - 8;
      }
    } else {
      // Panneau à droite : tooltip à gauche du bouton
      left = rect.left - tooltipWidth - 8;
      if (left < 0) {
        left = rect.right + 8;
      }
    }
    
    // Position verticale selon la position de la barre de favoris
    if (barPosition === 'bottom') {
      // Barre en bas : tooltip au-dessus
      top = rect.top - tooltipHeight - 8;
      // Vérifier si la tooltip dépasse en haut et ajuster si nécessaire
      if (top < 0) {
        top = rect.bottom + 8;
        // Si maintenant elle dépasse en bas, la centrer verticalement
        if (top + tooltipHeight > window.innerHeight) {
          top = Math.max(8, (window.innerHeight - tooltipHeight) / 2);
        }
      }
    } else {
      // Barre en haut : tooltip en-dessous
      top = rect.bottom + 8;
      // Vérifier si la tooltip dépasse en bas et ajuster si nécessaire
      if (top + tooltipHeight > window.innerHeight) {
        top = rect.top - tooltipHeight - 8;
        // Si maintenant elle dépasse en haut, la centrer verticalement
        if (top < 0) {
          top = Math.max(8, (window.innerHeight - tooltipHeight) / 2);
        }
      }
    }
    
    return {
      top: Math.max(0, top),
      left: Math.max(0, left)
    };
  };


  const handleCreateFolder = async () => {
    const trimmedName = folderName.trim();
    
    // Validation
    if (!trimmedName) {
      setFolderError('Le nom du dossier ne peut pas être vide');
      return;
    }
    
    if (trimmedName.length > 100) {
      setFolderError(`Le nom est trop long : ${trimmedName.length}/100 caractères maximum`);
      return;
    }
    
    // Caractères interdits dans les noms de favoris Chrome
    const invalidChars = /[<>:"/\\|?*\x00-\x1F]/;
    if (invalidChars.test(trimmedName)) {
      // Trouver le premier caractère interdit pour être spécifique
      const forbidden = trimmedName.match(invalidChars);
      const charName = forbidden ? `"${forbidden[0]}"` : 'spécial';
      setFolderError(`Caractère ${charName} interdit. Évitez : < > : " / \\ | ? *`);
      return;
    }

    try {
      // Créer un nouveau dossier dans les "autres favoris" (ID '2') via le background script
      chrome.runtime.sendMessage({
        action: 'createBookmark',
        data: {
          parentId: '2',
          title: trimmedName
        }
      }, (response) => {
        if (response && response.success) {
          console.log('Nouveau dossier créé dans les autres favoris:', response.data);
          setShowAddFolderTooltip(false);
          setFolderName('');
          setFolderError('');
          // Forcer le rechargement des bookmarks pour mettre à jour l'affichage
          window.location.reload();
        } else {
          console.error('Erreur lors de la création du dossier:', response?.error);
          setFolderError(response?.error || 'Impossible de créer le dossier. Vérifiez les permissions de l\'extension.');
        }
      });
    } catch (error) {
      console.error('Erreur lors de la création du dossier:', error);
      // Essayer de donner plus de détails sur l'erreur
      if (error.message) {
        setFolderError(`Erreur : ${error.message}`);
      } else {
        setFolderError('Impossible de créer le dossier. Vérifiez les permissions de l\'extension.');
      }
    }
  };

  const handleCancelAddFolder = () => {
    setShowAddFolderTooltip(false);
    setFolderName('');
    setFolderError('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleCreateFolder();
    } else if (e.key === 'Escape') {
      handleCancelAddFolder();
    }
  };



  // Vérifier la validité de l'onglet actuel et de tous les onglets
  useEffect(() => {
    let interval = null;
    let isContextValid = true;
    
    const checkTabsValidity = async () => {
      // Ne pas continuer si le contexte est invalide
      if (!isContextValid) {
        return;
      }
      
      try {
        // Vérifier l'onglet actuel
        const currentTabResponse = await chrome.runtime.sendMessage({ action: 'getCurrentTab' });
        
        // Vérifier chrome.runtime.lastError après l'appel
        if (chrome.runtime.lastError) {
          const lastError = chrome.runtime.lastError;
          if (isContextInvalidatedError(lastError)) {
            isContextValid = false;
            if (interval) {
              clearInterval(interval);
              interval = null;
            }
            setCurrentTabValid(false);
            setAllTabsValid(false);
            return;
          }
        }
        
        if (currentTabResponse && currentTabResponse.success) {
          setCurrentTabValid(currentTabResponse.data.isValid || false);
        }
        
        // Vérifier tous les onglets
        const allTabsResponse = await chrome.runtime.sendMessage({ action: 'getAllTabs' });
        
        // Vérifier chrome.runtime.lastError après le deuxième appel
        if (chrome.runtime.lastError) {
          const lastError = chrome.runtime.lastError;
          if (isContextInvalidatedError(lastError)) {
            isContextValid = false;
            if (interval) {
              clearInterval(interval);
              interval = null;
            }
            setCurrentTabValid(false);
            setAllTabsValid(false);
            return;
          }
        }
        
        if (allTabsResponse && allTabsResponse.success) {
          setAllTabsValid(allTabsResponse.hasValidTabs || false);
        }
      } catch (error) {
        // Détecter si le contexte de l'extension est invalide
        if (isContextInvalidatedError(error)) {
          isContextValid = false;
          // Arrêter l'intervalle si le contexte est invalide
          if (interval) {
            clearInterval(interval);
            interval = null;
          }
          // Désactiver les boutons car l'extension n'est plus disponible
          setCurrentTabValid(false);
          setAllTabsValid(false);
          // Ne pas logger l'erreur car c'est une situation normale lors du rechargement de l'extension
          return;
        }
        // Pour les autres erreurs, continuer à logger
        console.error('Erreur lors de la vérification de la validité des onglets:', error);
      }
    };
    
    checkTabsValidity();
    
    // Vérifier périodiquement (toutes les 2 secondes) pour détecter les changements d'onglet
    // Seulement si le contexte est toujours valide
    if (isContextValid) {
      interval = setInterval(() => {
        // Vérifier à nouveau avant chaque exécution de l'intervalle
        if (isContextValid) {
          checkTabsValidity();
        } else {
          // Nettoyer l'intervalle si le contexte est devenu invalide
          if (interval) {
            clearInterval(interval);
            interval = null;
          }
        }
      }, 2000);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, []);

  // Fermer le tooltip si on clique à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (addFolderTooltipRef.current && !addFolderTooltipRef.current.contains(event.target) &&
          addFolderButtonRef.current && !addFolderButtonRef.current.contains(event.target)) {
        setShowAddFolderTooltip(false);
        setFolderName('');
      }
    };

    if (showAddFolderTooltip) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showAddFolderTooltip]);

  // Composant divider avec contrôles
  const panelPosition = settings?.panelPosition || 'left';
  

  const dividerWithControls = (
    <div 
      className="bookmarks-divider-with-controls"
      onContextMenu={handleContextMenu}
    >
      <div className="bookmarks-divider" />
    </div>
  );

  // Tooltip pour ajouter un dossier (maintenant déclenché depuis le menu contextuel)
  const addFolderTooltip = showAddFolderTooltip && (
    <div 
      ref={addFolderTooltipRef}
      className="add-folder-tooltip"
      style={{
        position: 'fixed',
        top: `${addFolderTooltipPosition.top}px`,
        left: `${addFolderTooltipPosition.left}px`,
        zIndex: 2147483649
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="add-folder-header">
        <div className="add-folder-title">Nouveau dossier</div>
        <button 
          className="tooltip-close-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleCancelAddFolder();
          }}
          title="Fermer"
        >
          ✕
        </button>
      </div>
      <div className="add-folder-content">
        <input
          type="text"
          value={folderName}
          onChange={(e) => {
            setFolderName(e.target.value);
            setFolderError('');
          }}
          onKeyDown={handleKeyPress}
          placeholder="Nom du dossier"
          className={`add-folder-input ${folderError ? 'error' : ''}`}
          autoFocus
        />
        {folderError && (
          <div className="add-folder-error">{folderError}</div>
        )}
        <div className="add-folder-buttons">
          <button 
            className="add-folder-btn add-folder-btn-cancel"
            onMouseDown={(e) => {
              e.stopPropagation();
              handleCancelAddFolder();
            }}
          >
            Annuler
          </button>
          <button 
            className="add-folder-btn add-folder-btn-create"
            onMouseDown={(e) => {
              e.stopPropagation();
              handleCreateFolder();
            }}
            disabled={!folderName.trim()}
          >
            Créer
          </button>
        </div>
      </div>
    </div>
  );

  // Barre de favoris
  const bookmarksBarContent = (
    <div 
      className={`bookmarks-bar ${!hasChildren && isEditMode ? 'empty-drop-zone' : ''} ${isDragOver ? 'drag-over-drop-zone' : ''} ${hasChildren && isEditMode ? 'has-drop-zone' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
    >
      {!hasChildren && isEditMode ? (
        <div 
          className="empty-bar-message"
          onContextMenu={handleContextMenu}
          onDragLeave={(e) => {
            // Vérifier qu'on quitte vraiment la zone de drop
            const relatedTarget = e.relatedTarget;
            
            // Si relatedTarget est null, on quitte complètement
            if (!relatedTarget) {
              e.stopPropagation();
              setIsDragOver(false);
              return;
            }
            
            // Si on va vers un élément interactif (bookmark-button, folder), réinitialiser
            const isGoingToBookmark = relatedTarget.closest('.bookmark-button-wrapper');
            const isGoingToFolder = relatedTarget.closest('.folder-wrapper');
            if (isGoingToBookmark || isGoingToFolder) {
              e.stopPropagation();
              setIsDragOver(false);
              return;
            }
            
            // Si relatedTarget n'est pas dans le message vide, réinitialiser
            const isStillInMessage = relatedTarget.classList.contains('empty-bar-message') ||
                                    relatedTarget.closest('.empty-bar-message');
            if (!isStillInMessage) {
              e.stopPropagation();
              setIsDragOver(false);
            }
          }}
        >
          Glissez des favoris ici
        </div>
      ) : (
        <>
          {bookmarks.children.map((child, idx) => {
            // Vérifier si c'est un dossier (pas d'URL) ou un favori (avec URL)
            const isFolder = !child.url; // Un dossier n'a pas d'URL, même s'il est vide
            
            if (isFolder) {
              // C'est un dossier
              return (
                <BookmarkBarFolder
                  key={child.id}
                  folder={child}
                  parentId={bookmarks.id}
                  index={idx}
                  isBookmarksBar={true}
                />
              );
            } else {
              // C'est un favori
              return (
                <BookmarkButton 
                  key={child.id} 
                  bookmark={child} 
                  parentId={bookmarks.id}
                  index={idx}
                />
              );
            }
          })}
          {/* Zone de drop invisible pour la partie vide de la barre en mode édition */}
          {isEditMode && hasChildren && (
            <div 
              className={`bookmarks-bar-drop-zone ${isDragOver ? 'active' : ''}`}
              onContextMenu={handleContextMenu}
              onDragLeave={(e) => {
                // Vérifier qu'on quitte vraiment la zone de drop
                const relatedTarget = e.relatedTarget;
                
                // Si relatedTarget est null, on quitte complètement
                if (!relatedTarget) {
                  e.stopPropagation();
                  setIsDragOver(false);
                  return;
                }
                
                // Si on va vers un élément interactif (bookmark-button, folder), réinitialiser
                const isGoingToBookmark = relatedTarget.closest('.bookmark-button-wrapper');
                const isGoingToFolder = relatedTarget.closest('.folder-wrapper');
                if (isGoingToBookmark || isGoingToFolder) {
                  e.stopPropagation();
                  setIsDragOver(false);
                  return;
                }
                
                // Si relatedTarget n'est pas dans la zone de drop, réinitialiser
                const isStillInDropZone = relatedTarget.classList.contains('bookmarks-bar-drop-zone') ||
                                         relatedTarget.closest('.bookmarks-bar-drop-zone');
                if (!isStillInDropZone) {
                  e.stopPropagation();
                  setIsDragOver(false);
                }
              }}
            />
          )}
        </>
      )}
    </div>
  );

  // Si la barre est vide et qu'on n'est pas en mode édition, afficher seulement les contrôles
  if (!isEditMode && !hasChildren) {
    const barPosition = settings?.bookmarksBarPosition || 'bottom';
    return (
      <div className={`bookmarks-bar-container empty-bar-controls-only empty-bar-position-${barPosition}`}>
        <div 
          className="bookmarks-divider-with-controls empty-bar-divider"
          onMouseEnter={() => setIsHoveringDivider(true)}
          onMouseLeave={() => setIsHoveringDivider(false)}
        >
          <div className={`divider-controls ${(isHoveringDivider || isSearchActive) ? 'visible' : ''}`}>
            {panelPosition === 'left' ? (
              <>
                {existingButtons}
                {newButtons}
              </>
            ) : (
              <>
                {newButtons}
                {existingButtons}
              </>
            )}
          </div>
        </div>
        {addFolderTooltip}
        
        {/* Folder Selector Tooltip */}
        {showFolderSelector && currentTabData && (
          <FolderSelectorTooltip
            position={folderSelectorPosition}
            onClose={() => {
              setShowFolderSelector(false);
              setCurrentTabData(null);
            }}
            onSelectFolder={() => {
              setShowFolderSelector(false);
              setCurrentTabData(null);
            }}
            tabData={currentTabData}
            isMultipleTabs={isMultipleTabs}
          />
        )}
      </div>
    );
  }

  return (
    <div className="bookmarks-bar-container">
      {settings.bookmarksBarPosition === 'top' ? (
        <>
          {bookmarksBarContent}
          {dividerWithControls}
        </>
      ) : (
        <>
          {dividerWithControls}
          {bookmarksBarContent}
        </>
      )}
      {addFolderTooltip}
      
      {/* Folder Selector Tooltip */}
      {showFolderSelector && currentTabData && (
        <FolderSelectorTooltip
          position={folderSelectorPosition}
          onClose={() => {
            setShowFolderSelector(false);
            setCurrentTabData(null);
          }}
          onSelectFolder={() => {
            setShowFolderSelector(false);
            setCurrentTabData(null);
          }}
          tabData={currentTabData}
          isMultipleTabs={isMultipleTabs}
        />
      )}

    </div>
  );
};

export default BookmarkBar;
