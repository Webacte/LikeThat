import React, { useState, useRef, useEffect } from 'react';
import { useBookmarks } from '../../context/BookmarksContext';
import { useSettings } from '../../context/SettingsContext';
import { useFolderIcons } from '../../context/FolderIconsContext';
import { useContextMenu } from '../../context/ContextMenuContext';
import IconSelector from './IconSelector';
import ScrollingText from '../ScrollingText';

// Helper pour obtenir l'URL de manière sécurisée
const safeGetURL = (path) => {
  try {
    if (chrome.runtime && chrome.runtime.id) {
      return chrome.runtime.getURL(path);
    }
  } catch (e) {
    // Extension context invalidated
    setTimeout(() => window.location.reload(), 500);
  }
  return '';
};

const BookmarkBarFolder = ({ folder, parentId, index, isBookmarksBar = false }) => {
  
  const { 
    openBookmark, 
    isEditMode,
    deleteBookmark,
    moveBookmark,
    openAllBookmarksInFolder,
    draggedItem,
    setDraggedItem,
    dragOverItem,
    setDragOverItem
  } = useBookmarks();
  const { settings } = useSettings();
  const { getFolderIcon, setFolderIcon, removeFolderIcon } = useFolderIcons();
  
  const [isDragOver, setIsDragOver] = useState(false);
  const [headerDragOver, setHeaderDragOver] = useState(false);
  
  // Fonction helper pour calculer la hauteur optimale de la tooltip
  const calculateTooltipHeight = (items) => {
    if (!items || items.length === 0) return 200; // hauteur minimale plus grande
    
    const headerHeight = 40; // hauteur du header (padding + border)
    const itemHeight = 32; // hauteur par élément légèrement augmentée
    const contentPadding = 8; // padding du contenu (4px top + 4px bottom)
    const maxHeight = window.innerHeight * 0.85; // max 85% de la hauteur d'écran
    const minHeight = 200; // hauteur minimale plus grande
    
    const calculatedHeight = headerHeight + contentPadding + (items.length * itemHeight);
    
    return Math.min(Math.max(calculatedHeight, minHeight), maxHeight);
  };

  // Fonction helper pour calculer la position de la tooltip
  const calculateTooltipPosition = () => {
    if (!buttonRef.current) return { top: 0, left: 0 };
    
    const rect = buttonRef.current.getBoundingClientRect();
    const tooltipWidth = 300; // max-width de la tooltip
    const tooltipHeight = calculateTooltipHeight(currentFolder.children);
    
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
  const [dropPosition, setDropPosition] = useState(null);
  const [isTooltipOpen, setIsTooltipOpenState] = useState(false);
  
  // Wrapper pour sauvegarder dans sessionStorage
  const setIsTooltipOpen = (value) => {
    console.log('[SETITOOLTIPOPEN] value:', value, 'pour', folder.title);
    
    // Nettoyer sessionStorage AVANT de changer le state pour éviter la restauration
    if (!value) {
      console.log('[SETITOOLTIPOPEN] Nettoyage sessionStorage AVANT setState');
      sessionStorage.removeItem('likethat-tooltip-state');
      hasRestoredFromSession.current = true; // Bloquer toute restauration future
    }
    
    setIsTooltipOpenState(value);
    
    // Si on ouvre le tooltip, sauvegarder APRÈS
    if (value) {
      hasRestoredFromSession.current = false; // Permettre la restauration
      const state = {
        folderId: folder.id,
        isOpen: true,
        editMode: false,
        currentFolderId: folder.id,
        folderStackIds: [],
        timestamp: Date.now()
      };
      sessionStorage.setItem('likethat-tooltip-state', JSON.stringify(state));
    }
  };
  
  const [currentFolder, setCurrentFolder] = useState(folder);
  const [folderStack, setFolderStack] = useState([]);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [isIconSelectorOpen, setIsIconSelectorOpen] = useState(false);
  const [iconSelectorPosition, setIconSelectorPosition] = useState({ top: 0, left: 0 });
  const [isTooltipEditMode, setIsTooltipEditModeState] = useState(false);
  const [isEditingFolderName, setIsEditingFolderName] = useState(false);
  const [editingFolderName, setEditingFolderName] = useState('');
  
  // Wrapper pour sauvegarder le mode édition dans sessionStorage
  const setIsTooltipEditMode = (value) => {
    setIsTooltipEditModeState(value);
    
    // Si on désactive le mode édition, retirer data-dragging
    if (!value) {
      const panel = document.getElementById('likethat-panel');
      if (panel && panel.hasAttribute('data-dragging')) {
        panel.removeAttribute('data-dragging');
      }
      // Annuler tous les timeouts en cours
      dragAttributeRemovalTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
      dragAttributeRemovalTimeouts.current = [];
    }
    
    // Mettre à jour le sessionStorage si le tooltip est ouvert
    const savedState = sessionStorage.getItem('likethat-tooltip-state');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        state.editMode = value;
        state.timestamp = Date.now(); // Mettre à jour le timestamp
        sessionStorage.setItem('likethat-tooltip-state', JSON.stringify(state));
      } catch (e) {
        // Erreur silencieuse
      }
    }
  };
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingItemName, setEditingItemName] = useState('');
  const [contextMenuItem, setContextMenuItem] = useState(null);
  const { openContextMenu } = useContextMenu();
  const tooltipRef = useRef(null);
  const buttonRef = useRef(null);
  const iconButtonRef = useRef(null);
  const currentIconItemRef = useRef(null); // Référence pour l'item en cours de modification d'icône
  const shouldKeepTooltipOpen = useRef(false); // Persiste entre les re-renders
  const savedTooltipEditMode = useRef(false); // Sauvegarder le mode édition du tooltip
  const savedCurrentFolder = useRef(null); // Sauvegarder le dossier courant
  const savedFolderStack = useRef([]); // Sauvegarder la pile de navigation
  const customIconRef = useRef(null);
  const dragAttributeRemovalTimeouts = useRef([]); // Liste de tous les timeouts de retrait
  const isDragActive = useRef(false); // Flag pour protéger contre les fins prématurées
  const currentDraggedItemRef = useRef(null); // Référence pour persister draggedItem pendant le drag
  const hasRestoredFromSession = useRef(false); // Flag pour éviter les restaurations multiples
  const isTogglingTooltip = useRef(false); // Flag pour bloquer les clics multiples pendant le toggle
  const openingClickEvent = useRef(null); // Stocker l'événement qui a ouvert le tooltip
  const lastClickTimestamp = useRef(0); // Timestamp du dernier clic sur le bouton
  const folderNameInputRef = useRef(null); // Référence pour l'input de renommage du dossier parent
  const lastDropPositionRef = useRef(null); // Dernière position de drop calculée pour éviter les changements répétés

  // Recalculer la position de la tooltip quand les settings changent ou quand le contenu change
  useEffect(() => {
    if (isTooltipOpen && buttonRef.current && !shouldKeepTooltipOpen.current && !draggedItem) {
      setTimeout(() => {
        setTooltipPosition(calculateTooltipPosition());
      }, 0);
    }
  }, [settings.panelPosition, settings.bookmarksBarPosition, isTooltipOpen, currentFolder, draggedItem]);

  // Réinitialiser quand le folder change, SAUF si le tooltip est ouvert
  useEffect(() => {
    // Ne pas réinitialiser si le tooltip est ouvert (permet de garder l'état pendant le renommage)
    if (!isTooltipOpen) {
      setCurrentFolder(folder);
      setFolderStack([]);
    }
  }, [folder, isTooltipOpen]);

  // Synchroniser currentFolder avec folder quand le tooltip se ferme
  useEffect(() => {
    if (!isTooltipOpen) {
      setCurrentFolder(folder);
      setFolderStack([]);
    }
  }, [isTooltipOpen, folder]);

  // Sélectionner automatiquement tout le texte dans l'input de renommage quand il apparaît
  useEffect(() => {
    if (isEditingFolderName && folderNameInputRef.current) {
      // Utiliser un petit délai pour s'assurer que l'input est bien rendu
      setTimeout(() => {
        if (folderNameInputRef.current) {
          folderNameInputRef.current.select();
        }
      }, 0);
    }
  }, [isEditingFolderName]);

  // Restaurer l'état du tooltip depuis sessionStorage au montage du composant
  useEffect(() => {
    // Ne restaurer qu'une seule fois par instance du composant
    if (hasRestoredFromSession.current) {
      return;
    }
    
    const savedState = sessionStorage.getItem('likethat-tooltip-state');
    if (!savedState) {
      return;
    }
    
    // Ne restaurer que si le tooltip n'est pas déjà ouvert (évite les boucles)
    if (isTooltipOpen) {
      return;
    }
    
    try {
      const state = JSON.parse(savedState);
      // Vérifier que c'est bien pour ce dossier et que l'état est récent (moins de 10 secondes)
      // Délai augmenté pour couvrir la durée du drag and drop
      const isRecent = (Date.now() - state.timestamp) < 10000;
      
      if (state.folderId === folder.id && state.isOpen && isRecent) {
        // Marquer comme restauré pour éviter les restaurations multiples
        hasRestoredFromSession.current = true;
        
        // Fonction helper pour trouver un dossier par ID
        const findFolderById = (searchFolder, id) => {
          if (searchFolder.id === id) return searchFolder;
          if (searchFolder.children) {
            for (const child of searchFolder.children) {
              const found = findFolderById(child, id);
              if (found) return found;
            }
          }
          return null;
        };
        
        // Restaurer le dossier courant
        const restoredFolder = findFolderById(folder, state.currentFolderId);
        if (restoredFolder) {
          setCurrentFolder(restoredFolder);
          
          // Restaurer la pile de navigation
          const stack = [];
          for (const folderId of state.folderStackIds) {
            const foundFolder = findFolderById(folder, folderId);
            if (foundFolder) stack.push(foundFolder);
          }
          setFolderStack(stack);
        }
        
        // Restaurer les états du tooltip
        setIsTooltipOpenState(true); // Utiliser directement setIsTooltipOpenState pour éviter de re-sauvegarder
        setIsTooltipEditModeState(state.editMode); // Utiliser directement le state sans sauvegarder à nouveau
        
        // Recalculer la position
        setTimeout(() => {
          if (buttonRef.current) {
            setTooltipPosition(calculateTooltipPosition());
          }
        }, 100);
        
        // NE PAS nettoyer le sessionStorage ici - il sera nettoyé à la fermeture explicite du tooltip
        // Cela permet de restaurer l'état à chaque re-render pendant le drag
      } else if (state.folderId === folder.id) {
        // État trop ancien POUR CE DOSSIER PRÉCISÉMENT, le supprimer
        sessionStorage.removeItem('likethat-tooltip-state');
      }
      // Sinon, c'est pour un autre dossier, ne rien faire (laisser l'état en place)
    } catch (e) {
      sessionStorage.removeItem('likethat-tooltip-state');
    }
  }, [folder]); // Retirer isTooltipOpen des dépendances pour éviter les boucles

  // Écouter l'événement de fermeture des autres tooltips
  useEffect(() => {
    const handleCloseOthers = (event) => {
      // Si l'événement concerne un autre dossier et que ce tooltip est ouvert, le fermer
      if (event.detail.folderId !== folder.id && isTooltipOpen) {
        console.log('[CLOSE-OTHERS] Fermeture de', folder.title, 'car autre tooltip ouvert:', event.detail.folderId);
        setIsTooltipOpen(false);
        setIsTooltipEditMode(false);
        setEditingItemId(null);
      }
    };

    window.addEventListener('likethat-close-other-tooltips', handleCloseOthers);
    return () => {
      window.removeEventListener('likethat-close-other-tooltips', handleCloseOthers);
    };
  }, [folder.id, isTooltipOpen]);

  // Fermer la tooltip si on clique à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event) => {
      // PREMIÈRE vérification : si le clic est dans le tooltip ou le bouton, ne rien faire
      if (tooltipRef.current && tooltipRef.current.contains(event.target)) {
        return;
      }
      
      if (buttonRef.current && buttonRef.current.contains(event.target)) {
        return;
      }
      
      // Ne pas fermer si on clique sur le sélecteur d'icônes (qui est en dehors du tooltip)
      if (event.target.closest('.icon-selector-tooltip')) {
        return;
      }
      
      // Ne pas fermer si on est en train de faire du drag and drop
      if (shouldKeepTooltipOpen.current) {
        return;
      }
      
      // Ne pas fermer si on est en train de faire du drag and drop (vérification supplémentaire)
      if (draggedItem) {
        return;
      }
      
      // Ne pas fermer si l'événement vient d'un drop (dataTransfer existe)
      if (event.dataTransfer) {
        return;
      }
      
      // Ne pas fermer si l'événement vient d'un drag and drop
      if (event.type === 'mousedown' && event.detail === 0) {
        // Vérifier si c'est un événement de drag
        const isDragEvent = event.target.closest('[draggable="true"]');
        if (isDragEvent) {
          return;
        }
      }
      
      // Ne pas fermer si data-dragging est présent
      const panelElement = document.getElementById('likethat-panel');
      if (panelElement && panelElement.hasAttribute('data-dragging')) {
        return;
      }
      
      // Ne pas fermer si on clique sur le FolderSelectorTooltip
      if (event.target.closest('.folder-selector-tooltip')) {
        return;
      }
      
      // Si on arrive ici, c'est un clic à l'extérieur, fermer le tooltip
      
      // Annuler tous les timeouts de data-dragging
      dragAttributeRemovalTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
      dragAttributeRemovalTimeouts.current = [];
      
      // Nettoyer l'attribut data-dragging immédiatement
      const panelToClean = document.getElementById('likethat-panel');
      if (panelToClean && panelToClean.hasAttribute('data-dragging')) {
        panelToClean.removeAttribute('data-dragging');
      }
      
      // Réinitialiser les flags
      shouldKeepTooltipOpen.current = false;
      isDragActive.current = false;
      
      setIsTooltipOpen(false);
      setIsTooltipEditMode(false);
      setEditingItemId(null);
    };

    if (isTooltipOpen) {
      // Délai de 50ms pour ne pas capturer le mousedown qui a ouvert le tooltip
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 50);
      
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isTooltipOpen, folder, draggedItem]);

  // Fermer le sélecteur d'icônes si on clique à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Ne pas fermer si on clique sur le sélecteur d'icônes ou ses enfants
      if (event.target.closest('.icon-selector-tooltip')) {
        return;
      }
      
      // Ne pas fermer si on clique sur un bouton d'icône (principal ou dans tooltip)
      if (event.target.closest('.bookmark-button-icon') || 
          event.target.closest('.tooltip-action-btn.tooltip-icon-btn')) {
        return;
      }
      
      // Fermer dans tous les autres cas et réinitialiser la référence
      setIsIconSelectorOpen(false);
      currentIconItemRef.current = null;
    };

    if (isIconSelectorOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isIconSelectorOpen]);

  // Forcer les styles des icônes personnalisées après le rendu
  useEffect(() => {
    const iconSize = settings.iconSize || 16;
    const forceIconStyles = () => {
      const customIcons = document.querySelectorAll('img[data-custom-icon="true"]');
      customIcons.forEach(img => {
        img.style.setProperty('width', `${iconSize}px`, 'important');
        img.style.setProperty('height', `${iconSize}px`, 'important');
        img.style.setProperty('max-width', `${iconSize}px`, 'important');
        img.style.setProperty('max-height', `${iconSize}px`, 'important');
        img.style.setProperty('min-width', `${iconSize}px`, 'important');
        img.style.setProperty('min-height', `${iconSize}px`, 'important');
        // Ne pas écraser le filtre de couleur - juste ajouter une ombre pour la visibilité
        img.style.setProperty('object-fit', 'contain', 'important');
        img.style.setProperty('display', 'inline-block', 'important');
        img.style.setProperty('vertical-align', 'middle', 'important');
      });
    };

    // Appliquer immédiatement
    forceIconStyles();
    
    // Observer les changements DOM pour réappliquer si nécessaire
    const observer = new MutationObserver(forceIconStyles);
    observer.observe(document.body, { childList: true, subtree: true });
    
    return () => observer.disconnect();
  }, [settings.iconSize]);

  // Forcer les styles sur l'icône personnalisée spécifique
  useEffect(() => {
    const iconSize = settings.iconSize || 16;
    if (customIconRef.current) {
      const img = customIconRef.current;
      img.style.setProperty('width', `${iconSize}px`, 'important');
      img.style.setProperty('height', `${iconSize}px`, 'important');
      img.style.setProperty('max-width', `${iconSize}px`, 'important');
      img.style.setProperty('max-height', `${iconSize}px`, 'important');
      img.style.setProperty('min-width', `${iconSize}px`, 'important');
      img.style.setProperty('min-height', `${iconSize}px`, 'important');
      // Ne pas écraser le filtre de couleur neon
      img.style.setProperty('object-fit', 'contain', 'important');
      img.style.setProperty('display', 'inline-block', 'important');
      img.style.setProperty('vertical-align', 'middle', 'important');
    }
  }, [settings.iconSize]);

  const handleClick = (e) => {
    // Ignorer les clics droits (bouton 2) et le bouton du milieu (bouton 1)
    if (e && (e.button === 2 || e.button === 1)) {
      return;
    }
    // Vérifier aussi via les propriétés de l'événement
    if (e && (e.which === 3 || e.which === 2)) {
      return;
    }
    
    if (!isEditMode) {
      e.preventDefault();
      e.stopPropagation();
      if (e.nativeEvent) {
        e.nativeEvent.stopImmediatePropagation();
      }
      
      console.log('[HANDLECLICK] MouseDown sur dossier', folder.title, '- isTooltipOpen:', isTooltipOpen);
      
      // Toggle simple sans complexité
      if (isTooltipOpen) {
        console.log('[HANDLECLICK] Tooltip ouvert → FERMETURE');
        setIsTooltipOpen(false);
      } else {
        console.log('[HANDLECLICK] Tooltip fermé → OUVERTURE');
        
        // Envoyer un événement global pour fermer les autres tooltips
        const closeOthersEvent = new CustomEvent('likethat-close-other-tooltips', {
          detail: { folderId: folder.id }
        });
        window.dispatchEvent(closeOthersEvent);
        
        // Calculer la position
        const newPosition = calculateTooltipPosition();
        setTooltipPosition(newPosition);
        
        // Réinitialiser l'état si nécessaire
        if (currentFolder.id !== folder.id) {
          setCurrentFolder(folder);
        }
        if (folderStack.length > 0) {
          setFolderStack([]);
        }
        
        setIsTooltipOpen(true);
      }
    }
  };

  const handleDelete = () => {
    if (confirm(`Supprimer "${folder.title}" et son contenu ?`)) {
      deleteBookmark(folder.id);
    }
  };

  const handleRename = async () => {
    try {
      const newName = prompt('Nouveau nom du dossier :', folder.title);
      if (newName && newName.trim() && newName.trim() !== folder.title) {
        chrome.runtime.sendMessage({
          action: 'updateBookmark',
          data: {
            bookmarkId: folder.id,
            changes: { title: newName.trim() }
          }
        }, (response) => {
          if (response && response.success) {
          } else {
            // Erreur lors du renommage
          }
        });
      }
    } catch (error) {
      // Erreur lors du renommage du dossier
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuItem(null);
    
    const menuItems = [
      ...(currentFolder.children && currentFolder.children.length > 0 ? [{
        id: 'open-all',
        label: 'Ouvrir tous',
        icon: '📂',
        onClick: handleOpenAllInFolder
      }] : []),
      {
        id: 'rename',
        label: 'Renommer',
        icon: '✏️',
        onClick: handleRename
      },
      {
        id: 'change-icon',
        label: "Changer l'icône",
        icon: '🎨',
        onClick: () => {
          currentIconItemRef.current = folder;
          handleIconClick();
        }
      },
      { separator: true },
      {
        id: 'delete',
        label: 'Supprimer',
        icon: '🗑️',
        onClick: handleDelete
      }
    ];
    
    openContextMenu(
      `bookmark-bar-folder-${folder.id}`,
      { top: e.clientY, left: e.clientX },
      menuItems,
      null,
      settings?.panelPosition || 'left'
    );
  };

  const handleItemContextMenu = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuItem(item);
    
    const menuItems = [
      ...(!item.url ? [{
        id: 'change-icon',
        label: "Changer l'icône",
        icon: '🎨',
        onClick: () => handleChangeIcon(item)
      }] : []),
      {
        id: 'rename',
        label: 'Renommer',
        icon: '✏️',
        onClick: () => handleStartRename(item)
      },
      { separator: true },
      {
        id: 'delete',
        label: 'Supprimer',
        icon: '🗑️',
        onClick: () => handleDeleteItem(item)
      }
    ];
    
    openContextMenu(
      `tooltip-item-${item.id}`,
      { top: e.clientY, left: e.clientX },
      menuItems,
      null,
      settings?.panelPosition || 'left'
    );
  };

  const handleTooltipHeaderContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuItem(null);
    
    const menuItems = [
      ...(currentFolder.children && currentFolder.children.length > 0 ? [{
        id: 'open-all',
        label: 'Ouvrir tous',
        icon: '📂',
        onClick: handleOpenAllInFolder
      }] : []),
      {
        id: 'rename',
        label: 'Renommer',
        icon: '✏️',
        onClick: handleStartRenamingFolder
      },
      {
        id: 'edit-mode',
        label: isTooltipEditMode ? 'Quitter le mode édition' : 'Mode édition',
        icon: isTooltipEditMode ? '✓' : '📝',
        onClick: () => {
          setIsTooltipEditMode(!isTooltipEditMode);
          setEditingItemId(null);
        }
      }
    ];
    
    openContextMenu(
      `tooltip-header-${currentFolder.id}`,
      { top: e.clientY, left: e.clientX },
      menuItems,
      null,
      settings?.panelPosition || 'left'
    );
  };

  // Fonction helper pour calculer la position du sélecteur d'icônes (même logique que la tooltip de dossier)
  const calculateIconSelectorPosition = () => {
    if (!iconButtonRef.current) return { top: 0, left: 0 };
    
    const rect = iconButtonRef.current.getBoundingClientRect();
    const tooltipWidth = 300; // max-width de la tooltip
    const tooltipHeight = 400; // hauteur estimée de la tooltip (plus haute pour les icônes)
    
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

  const handleIconClick = () => {
    // Calculer la position en utilisant la fonction helper
    const position = calculateIconSelectorPosition();
    setIconSelectorPosition(position);
    
    // Stocker la référence du folder
    currentIconItemRef.current = contextMenuItem || folder;
    
    setIsIconSelectorOpen(true);
  };

  const handleIconSelect = (iconName, color) => {
    // Si currentIconItemRef.current contient un item, c'est pour un item du tooltip
    const targetFolder = currentIconItemRef.current?.id ? currentIconItemRef.current : folder;
    
    if (iconName === 'default') {
      // Supprimer l'icône personnalisée pour revenir au défaut
      removeFolderIcon(targetFolder.id);
    } else {
      setFolderIcon(targetFolder.id, iconName, color.class);
    }
    setIsIconSelectorOpen(false);
    currentIconItemRef.current = null; // Réinitialiser
  };

  const handleIconSelectorClose = () => {
    setIsIconSelectorOpen(false);
    currentIconItemRef.current = null;
  };

  // Gestionnaires pour les actions d'édition dans le tooltip
  const handleStartRename = (item) => {
    setEditingItemId(item.id);
    setEditingItemName(item.title);
  };

  const handleRenameKeyDown = (e, item) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleValidateRename(item);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      handleCancelRename();
    }
  };

  const handleValidateRename = (item) => {
    if (editingItemName.trim() && editingItemName !== item.title) {
      // Sauvegarder l'état dans sessionStorage pour persister à travers les re-renders
      sessionStorage.setItem('likethat-tooltip-state', JSON.stringify({
        folderId: folder.id,
        isOpen: true,
        editMode: isTooltipEditMode,
        currentFolderId: currentFolder.id,
        folderStackIds: folderStack.map(f => f.id),
        timestamp: Date.now()
      }));
      
      chrome.runtime.sendMessage({
        action: 'updateBookmark',
        data: {
          bookmarkId: item.id,
          changes: { title: editingItemName.trim() }
        }
      }, (response) => {
        if (response && response.success) {
          
          // Mettre à jour le nom dans currentFolder si c'est le dossier courant
          if (currentFolder.id === item.id) {
            setCurrentFolder({ ...currentFolder, title: editingItemName.trim() });
          } else {
            // Mettre à jour le nom dans les enfants de currentFolder
            const updatedChildren = currentFolder.children.map(child => 
              child.id === item.id ? { ...child, title: editingItemName.trim() } : child
            );
            setCurrentFolder({ ...currentFolder, children: updatedChildren });
          }
          
          // Rester en mode édition, juste quitter le mode renommage
          setEditingItemId(null);
          setEditingItemName('');
          // Le contexte BookmarksContext se rafraîchira automatiquement via le listener
        } else {
          // Erreur lors du renommage
          // Annuler la sauvegarde si erreur
          sessionStorage.removeItem('likethat-tooltip-state');
        }
      });
    } else {
      // Pas de changement, juste fermer le mode renommage
      setEditingItemId(null);
      setEditingItemName('');
    }
  };

  const handleCancelRename = () => {
    setEditingItemId(null);
    setEditingItemName('');
  };

  const handleRenameBlur = (item) => {
    // Ne rien faire sur blur, laisser les boutons Valider/Annuler gérer
    // Cela évite que le clic sur les boutons ne soit ignoré
  };

  const handleChangeIcon = (item) => {
    // Stocker temporairement l'item pour lequel on change l'icône
    currentIconItemRef.current = item;
    
    // Calculer la position en utilisant la même logique que le tooltip principal
    const rect = buttonRef.current?.getBoundingClientRect() || { right: 0, top: 0 };
      const tooltipWidth = 300; // max-width de la tooltip
      const tooltipHeight = 400; // hauteur estimée de la tooltip (plus haute pour les icônes)
      
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
      
      setIconSelectorPosition({
        top: Math.max(0, top),
        left: Math.max(0, left)
      });
      setIsIconSelectorOpen(true);
  };

  const handleDeleteItem = (item) => {
    if (confirm(`Êtes-vous sûr de vouloir supprimer "${item.title}" ?`)) {
      deleteBookmark(item.id);
      // Si c'était un dossier avec une icône personnalisée, la supprimer aussi
      if (item.children && !item.url) {
        removeFolderIcon(item.id);
      }
    }
  };

  const handleItemClick = (item, e) => {
    e.preventDefault();
    e.stopPropagation();
    const isFolder = !item.url && item.children;
    
    if (isFolder) {
      // C'est un sous-dossier
      setFolderStack([...folderStack, currentFolder]);
      setCurrentFolder(item);
      // Recalculer la position de la tooltip avec un petit délai pour s'assurer que le state est mis à jour
      // Mais seulement si on n'est pas en train de faire du drag and drop
      if (!shouldKeepTooltipOpen.current && !draggedItem) {
      setTimeout(() => {
        setTooltipPosition(calculateTooltipPosition());
      }, 0);
      }
    } else {
      // C'est un lien
      openBookmark(item.url);
      
      // Retirer data-dragging avant de fermer
      const panel = document.getElementById('likethat-panel');
      if (panel && panel.hasAttribute('data-dragging')) {
        panel.removeAttribute('data-dragging');
      }
      
      setIsTooltipOpen(false); // Le wrapper nettoiera le sessionStorage
      // Ne pas réinitialiser currentFolder et folderStack ici
      // Le useEffect s'en chargera quand isTooltipOpen devient false
    }
  };

  const handleBackClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (folderStack.length > 0) {
      const newStack = [...folderStack];
      const previousFolder = newStack.pop();
      setFolderStack(newStack);
      setCurrentFolder(previousFolder);
      // Recalculer la position de la tooltip avec un petit délai pour s'assurer que le state est mis à jour
      // Mais seulement si on n'est pas en train de faire du drag and drop
      if (!shouldKeepTooltipOpen.current && !draggedItem) {
      setTimeout(() => {
        setTooltipPosition(calculateTooltipPosition());
      }, 0);
      }
    }
  };

  const handleOpenAllInFolder = () => {
    const count = openAllBookmarksInFolder(currentFolder);
    if (count > 0) {
      console.log(`Ouverture de ${count} onglets depuis ${currentFolder.title}`);
    }
  };

  const handleStartRenamingFolder = (e) => {
    e.stopPropagation();
    setIsEditingFolderName(true);
    setEditingFolderName(currentFolder.title);
  };

  const handleValidateRenamingFolder = async (e) => {
    if (e) e.stopPropagation();
    
    const trimmedName = editingFolderName.trim();
    if (trimmedName && trimmedName !== currentFolder.title) {
      try {
        chrome.runtime.sendMessage({
          action: 'updateBookmark',
          data: {
            bookmarkId: currentFolder.id,
            changes: { title: trimmedName }
          }
        }, (response) => {
          if (response && response.success) {
            setCurrentFolder({ ...currentFolder, title: trimmedName });
            setIsEditingFolderName(false);
          } else {
            console.error('Erreur lors du renommage:', response?.error);
          }
        });
      } catch (error) {
        console.error('Erreur lors du renommage du dossier:', error);
      }
    } else {
      setIsEditingFolderName(false);
    }
  };

  const handleCancelRenamingFolder = (e) => {
    if (e) e.stopPropagation();
    setIsEditingFolderName(false);
    setEditingFolderName('');
  };

  const handleFolderNameKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleValidateRenamingFolder(e);
    } else if (e.key === 'Escape') {
      handleCancelRenamingFolder(e);
    }
  };

  // Gestionnaires de drag and drop pour le dossier principal
  const handleDragStart = (e) => {
    if (!isEditMode) return;
    e.stopPropagation();
    setDraggedItem({ node: folder, parentId, index });
    e.dataTransfer.effectAllowed = 'move';
  };

  // Gestionnaires de drag and drop pour les éléments dans la tooltip
  const handleTooltipItemDragStart = (e, item, itemIndex) => {
    
    if (!isTooltipEditMode) return;
    e.stopPropagation();
    
    // Marquer le drag comme actif
    isDragActive.current = true;
    
    // Marquer le panneau comme étant en drag (s'assurer qu'il est bien présent)
    const panel = document.getElementById('likethat-panel');
    if (panel) {
      panel.setAttribute('data-dragging', 'true');
    }
    
    // Empêcher la fermeture du tooltip pendant le drag
    shouldKeepTooltipOpen.current = true;
    
    // Définir l'item dragué
    const draggedItemData = { 
      node: item, 
      parentId: currentFolder.id, 
      index: itemIndex,
      isFromTooltip: true,
      startTime: Date.now() // Timestamp de début
    };
    
    // Sauvegarder dans la référence pour persister pendant les re-renders
    currentDraggedItemRef.current = draggedItemData;
    setDraggedItem(draggedItemData);
    
    // NOUVELLE APPROCHE : Forcer le drag à continuer
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'drag-from-tooltip');
    
  };

  const handleDragOver = (e) => {
    if (!draggedItem) return;
    
    // Pour les drags depuis le tooltip, on n'a pas besoin que le dossier soit en mode édition
    // La condition correcte : permettre si c'est un drag depuis le tooltip OU si on est en mode édition
    if (!draggedItem.isFromTooltip && !isEditMode) return;
    
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const elementWidth = rect.width;
    const relativePosition = mouseX / elementWidth;
    
    // 3 zones pour les dossiers : avant, dedans, après
    let position;
    if (relativePosition < 0.33) {
      position = 'before';
    } else if (relativePosition < 0.67) {
      position = 'inside';
    } else {
      position = 'after';
    }
    
    // Ne mettre à jour l'état que si la position a vraiment changé
    // Cela évite les re-renders inutiles qui causent les "sauts" d'affichage
    if (lastDropPositionRef.current !== position) {
      lastDropPositionRef.current = position;
      setIsDragOver(true);
      setDropPosition(position);
      setDragOverItem({ node: folder, parentId, index, relativePosition });
    } else if (!isDragOver) {
      // Si la position n'a pas changé mais qu'on n'est pas encore en dragOver, activer
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e) => {
    // Vérifier relatedTarget pour s'assurer qu'on quitte vraiment l'élément et pas juste un enfant
    const relatedTarget = e.relatedTarget;
    const currentTarget = e.currentTarget;
    
    // Si relatedTarget est null, c'est qu'on quitte vraiment l'élément
    // Si relatedTarget est un enfant de currentTarget, on est toujours dans l'élément
    if (relatedTarget && currentTarget.contains(relatedTarget)) {
      return; // On est toujours dans l'élément, ne pas retirer le style
    }
    
    e.stopPropagation();
    setIsDragOver(false);
    setDropPosition(null);
    lastDropPositionRef.current = null; // Réinitialiser la référence
  };

  const handleDrop = (e) => {
    if (!isEditMode || !draggedItem) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setDropPosition(null);
    lastDropPositionRef.current = null; // Réinitialiser la référence

    if (draggedItem.node.id === folder.id) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const elementWidth = rect.width;
    const relativePosition = mouseX / elementWidth;

    let targetParentId;
    let targetIndex;

    if (relativePosition < 0.33) {
      // Avant
      targetParentId = parentId || '1';
      targetIndex = index !== undefined ? index : 0;
    } else if (relativePosition < 0.67) {
      // Dedans
      targetParentId = folder.id;
      targetIndex = 0;
    } else {
      // Après
      targetParentId = parentId || '1';
      targetIndex = index !== undefined ? index + 1 : 0;
    }
    
    moveBookmark(draggedItem.node.id, {
      parentId: targetParentId,
      index: targetIndex
    });

    setDraggedItem(null);
    setDragOverItem(null);
  };

  // Gestionnaire pour le drag end du dossier principal
  const handleDragEnd = () => {
    // Éviter les appels multiples
    if (!draggedItem) {
      return;
    }
    
    // Ne traiter que si c'est un drag du dossier principal (pas du tooltip)
    if (draggedItem.isFromTooltip) {
      return;
    }
    
    // Retirer data-dragging immédiatement après un court délai
    const panel = document.getElementById('likethat-panel');
    if (panel && panel.hasAttribute('data-dragging')) {
      // Annuler tous les timeouts existants pour éviter les conflits
      dragAttributeRemovalTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
      dragAttributeRemovalTimeouts.current = [];
      
      const timeoutId = setTimeout(() => {
        const panelCheck = document.getElementById('likethat-panel');
        if (panelCheck && panelCheck.hasAttribute('data-dragging')) {
          panelCheck.removeAttribute('data-dragging');
        }
      }, 150);
      dragAttributeRemovalTimeouts.current.push(timeoutId);
    }
    
    // Nettoyer les états après un délai - SEULEMENT si ce n'est pas un drag depuis le tooltip
    setTimeout(() => {
      // Vérifier si c'est un drag depuis le tooltip
      if (draggedItem && draggedItem.isFromTooltip) {
        return;
      }
      
      setDraggedItem(null);
      setDragOverItem(null);
      setIsDragOver(false);
      setDropPosition(null);
      lastDropPositionRef.current = null; // Réinitialiser la référence
      
      // Réinitialiser le flag après un délai plus long
      setTimeout(() => {
        shouldKeepTooltipOpen.current = false;
      }, 1000);
    }, 200);
  };

  // Gestionnaire pour le drag end des items du tooltip
  const handleTooltipItemDragEnd = (e) => {
    
    // Vérifier si le drag est vraiment actif
    if (!isDragActive.current) {
      return;
    }
    
    // Utiliser la référence si draggedItem est null (re-render)
    const draggedItemToUse = draggedItem || currentDraggedItemRef.current;
    
    // Vérifier si c'est vraiment la fin du drag ou un appel prématuré
    if (!draggedItemToUse) {
      return;
    }
    
    // Vérifier si c'est un drag depuis le tooltip
    if (!draggedItemToUse.isFromTooltip) {
      return;
    }
    
    // NOUVELLE VÉRIFICATION : Vérifier que c'est bien l'élément actuellement dragué
    // qui se termine (pas un autre élément du tooltip)
    if (draggedItemToUse.node && draggedItemToUse.node.id !== e.target.id) {
      return;
    }
    
    
    // Désactiver le flag de drag
    isDragActive.current = false;
    
    // Nettoyer TOUJOURS les états, peu importe draggedItem
    setDraggedItem(null);
    setDragOverItem(null);
    setIsDragOver(false);
    setDropPosition(null);
    currentDraggedItemRef.current = null; // Nettoyer la référence
    
    // NE PAS retirer data-dragging ici
    // Il doit rester tant que le tooltip est en mode édition pour permettre des drags successifs
    // Il sera retiré uniquement lors de la fermeture du tooltip ou de la désactivation du mode édition
    
    // Retirer la classe drag-from-tooltip de tous les dossiers
    const folderWrappers = document.querySelectorAll('.folder-wrapper');
    folderWrappers.forEach(wrapper => {
      wrapper.classList.remove('drag-from-tooltip');
    });
    
    // NE PAS réinitialiser shouldKeepTooltipOpen immédiatement
    // Le garder actif pour permettre des drags successifs
    // Il sera réinitialisé seulement si on clique en dehors du tooltip
  };

  // Gestionnaires globaux pour le drag and drop en dehors du tooltip
  useEffect(() => {
    const handleGlobalDragOver = (e) => {
      if (draggedItem && draggedItem.isFromTooltip) {
        // Ne pas interférer si on est dans la tooltip
        if (e.target.closest('.folder-tooltip')) {
          return;
        }
        
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        // Trouver l'élément cible le plus proche
        const targetElement = e.target.closest('.bookmark-button-wrapper, .bookmark-item, .bookmarks-bar, .bookmarks-list, .bookmark-list-container');
        
        if (targetElement) {
          // Si c'est un dossier parent, ajouter la classe directement
          if (targetElement.classList.contains('folder-wrapper')) {
            targetElement.classList.add('drag-from-tooltip');
          }
          
          // Déclencher l'événement de dragover sur l'élément cible
          const dragOverEvent = new DragEvent('dragover', {
            bubbles: true,
            cancelable: true,
            dataTransfer: e.dataTransfer,
            clientX: e.clientX,
            clientY: e.clientY
          });
          targetElement.dispatchEvent(dragOverEvent);
        }
      }
    };

    const handleGlobalDragLeave = (e) => {
      if (draggedItem && draggedItem.isFromTooltip) {
        // Retirer la classe de tous les dossiers parents
        const folderWrappers = document.querySelectorAll('.folder-wrapper');
        folderWrappers.forEach(wrapper => {
          wrapper.classList.remove('drag-from-tooltip');
        });
      }
    };

    const handleGlobalDrop = (e) => {
      if (draggedItem && draggedItem.isFromTooltip) {
        // Ne pas interférer si on est dans la tooltip
        if (e.target.closest('.folder-tooltip')) {
          return;
        }
        
        // Vérifier aussi si on est dans le contenu du tooltip
        if (e.target.closest('.tooltip-content')) {
          return;
        }
        
        // Vérifier si on drop sur le panneau principal (pas sur un élément spécifique)
        // MAIS PAS dans le tooltip (même en bas)
        if (e.target.closest('#likethat-panel') && 
            !e.target.closest('.bookmark-button-wrapper, .bookmark-item, .bookmarks-bar, .bookmarks-list, .folder-tooltip, .tooltip-content, .tooltip-item')) {
          
          // Vérifier si le tooltip est ouvert - si oui, ne pas traiter comme un drop sur le panneau
          if (isTooltipOpen) {
            return;
          }
          
          // Déplacer vers la barre de favoris
          moveBookmark(draggedItem.node.id, {
            parentId: '1',
            index: 0
          });
          
          // Empêcher la fermeture du tooltip
          shouldKeepTooltipOpen.current = true;
          
          // Réinitialiser après un délai
          setTimeout(() => {
            setDraggedItem(null);
            setDragOverItem(null);
            // Ne pas réinitialiser shouldKeepTooltipOpen si le tooltip est encore ouvert
            if (!isTooltipOpen) {
              shouldKeepTooltipOpen.current = false;
            }
          }, 2000);
          return;
        }
        
        // Si on est dans le tooltip, ne pas traiter ici
        if (e.target.closest('.folder-tooltip, .tooltip-content, .tooltip-item')) {
          return;
        }
        
        e.preventDefault();
        e.stopPropagation();
        
        // Vérifier si on drop sur un élément de la barre de favoris
        const folderElement = e.target.closest('.folder-wrapper');
        const bookmarkElement = e.target.closest('.bookmark-item');
        const bookmarksBar = e.target.closest('.bookmarks-bar');
        const bookmarksList = e.target.closest('.bookmarks-list');
        
        if (folderElement) {
          // Drop sur un dossier - déplacer dedans
          const folderId = folderElement.dataset.folderId || folderElement.getAttribute('data-id');
          
          if (folderId) {
            moveBookmark(draggedItem.node.id, {
              parentId: folderId,
              index: 0
            });
          } else {
            moveBookmark(draggedItem.node.id, {
              parentId: '1',
              index: 0
            });
          }
        } else if (bookmarkElement) {
          // Drop sur un bookmark - déplacer vers la barre de favoris à côté
          moveBookmark(draggedItem.node.id, {
            parentId: '1',
            index: 0
          });
        } else if (bookmarksBar) {
          // Drop sur la barre de favoris - déplacer dedans
          moveBookmark(draggedItem.node.id, {
            parentId: '1',
            index: 0
          });
        } else if (bookmarksList) {
          // Drop sur la section "Autres favoris" - déplacer dedans
          moveBookmark(draggedItem.node.id, {
            parentId: '2',
            index: 0
          });
        } else {
          // Drop sur une zone vide - déplacer vers la barre de favoris
          moveBookmark(draggedItem.node.id, {
            parentId: '1',
            index: 0
          });
        }
        
        // Empêcher la fermeture du tooltip
        shouldKeepTooltipOpen.current = true;
        
        // Réinitialiser après un délai - SEULEMENT si ce n'est pas un drag depuis le tooltip
        setTimeout(() => {
          // Vérifier si c'est un drag depuis le tooltip
          if (draggedItem && draggedItem.isFromTooltip) {
            return;
          }
          
          setDraggedItem(null);
          setDragOverItem(null);
          // Ne pas réinitialiser shouldKeepTooltipOpen si le tooltip est encore ouvert
          if (!isTooltipOpen) {
            shouldKeepTooltipOpen.current = false;
          }
        }, 2000);
      }
    };

    if (isTooltipOpen) {
      document.addEventListener('dragover', handleGlobalDragOver, true);
      document.addEventListener('dragleave', handleGlobalDragLeave, true);
      document.addEventListener('drop', handleGlobalDrop, true);
      
      return () => {
        document.removeEventListener('dragover', handleGlobalDragOver, true);
        document.removeEventListener('dragleave', handleGlobalDragLeave, true);
        document.removeEventListener('drop', handleGlobalDrop, true);
      };
    }
  }, [isTooltipOpen, isTooltipEditMode, draggedItem, moveBookmark]);

  // Gestionnaires de drag and drop pour les éléments dans la tooltip
  const handleTooltipItemDragOver = (e, item, itemIndex) => {
    if (!isTooltipEditMode || !draggedItem) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    const elementHeight = rect.height;
    const relativePosition = mouseY / elementHeight;
    
    // 3 zones : avant, dedans (pour les dossiers), après
    let position;
    if (relativePosition < 0.33) {
      position = 'before';
    } else if (relativePosition < 0.67 && !item.url) {
      // Zone "dedans" seulement pour les dossiers
      position = 'inside';
    } else {
      position = 'after';
    }
    
    
    const newDragOverItem = { 
      node: item, 
      parentId: currentFolder.id, 
      index: itemIndex, 
      relativePosition,
      position 
    };
    
      setDragOverItem(newDragOverItem);
  };

  const handleTooltipItemDragLeave = (e) => {
    // Vérifier relatedTarget pour s'assurer qu'on quitte vraiment l'élément et pas juste un enfant
    const relatedTarget = e.relatedTarget;
    const currentTarget = e.currentTarget;
    
    // Si relatedTarget est null, c'est qu'on quitte vraiment l'élément
    // Si relatedTarget est un enfant de currentTarget, on est toujours dans l'élément
    if (relatedTarget && currentTarget.contains(relatedTarget)) {
      return; // On est toujours dans l'élément, ne pas retirer le style
    }
    
    e.stopPropagation();
    setDragOverItem(null);
  };

  const handleTooltipItemDrop = (e, item, itemIndex) => {
    if (!isTooltipEditMode || !draggedItem) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (e.nativeEvent && e.nativeEvent.stopImmediatePropagation) {
      e.nativeEvent.stopImmediatePropagation();
    }


    if (draggedItem.node.id === item.id) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    const elementHeight = rect.height;
    const relativePosition = mouseY / elementHeight;

    let targetParentId;
    let targetIndex;

    if (relativePosition < 0.33) {
      // Avant l'élément
      targetParentId = currentFolder.id;
      targetIndex = itemIndex;
    } else if (relativePosition < 0.67 && !item.url) {
      // Dans le dossier (seulement si c'est un dossier)
      targetParentId = item.id;
      targetIndex = 0;
    } else {
      // Après l'élément
      targetParentId = currentFolder.id;
      targetIndex = itemIndex + 1;
    }
    
    // Empêcher la fermeture du tooltip après le drop
    shouldKeepTooltipOpen.current = true;
    
    // NE PAS retirer data-dragging ici
    // On le laisse en place tant que le tooltip est en mode édition
    // pour empêcher le panneau de se fermer pendant les re-renders
    // Il sera retiré seulement lors de la fermeture du tooltip
    
    // IMPORTANT : Mettre à jour le timestamp AVANT moveBookmark
    // Car moveBookmark déclenche un rechargement immédiat qui cause un re-render
    const savedState = sessionStorage.getItem('likethat-tooltip-state');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        state.timestamp = Date.now();
        sessionStorage.setItem('likethat-tooltip-state', JSON.stringify(state));
      } catch (e) {
        // Erreur mise à jour timestamp
      }
    }
    
    // Appeler moveBookmark APRÈS avoir mis à jour le timestamp
    moveBookmark(draggedItem.node.id, {
      parentId: targetParentId,
      index: targetIndex
    });
    
    // NE PAS réinitialiser shouldKeepTooltipOpen après un drop
    // Il doit rester actif tant que le tooltip est en mode édition
    // pour permettre des drags successifs sans délai
    // Il sera réinitialisé uniquement lors de la fermeture du tooltip ou désactivation du mode édition
  };

  // Gestionnaire pour déposer sur la zone vide de la tooltip
  const handleTooltipEmptyDrop = (e) => {
    // Vérifier si c'est un fichier externe (depuis l'explorateur)
    const hasExternalFiles = e.dataTransfer.files && e.dataTransfer.files.length > 0;
    
    // Si c'est un fichier externe, traiter différemment
    if (hasExternalFiles) {
      handleTooltipFileDrop(e);
      return;
    }
    
    // Sinon, traiter comme un favori interne
    if (!isTooltipEditMode || !draggedItem) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.nativeEvent && e.nativeEvent.stopImmediatePropagation) {
      e.nativeEvent.stopImmediatePropagation();
    }


    // Empêcher la fermeture du tooltip après le drop
    shouldKeepTooltipOpen.current = true;
    
    // NE PAS retirer data-dragging ici
    // On le laisse en place tant que le tooltip est en mode édition
    // pour empêcher le panneau de se fermer pendant les re-renders
    
    // IMPORTANT : Mettre à jour le timestamp AVANT moveBookmark
    const savedState = sessionStorage.getItem('likethat-tooltip-state');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        state.timestamp = Date.now();
        sessionStorage.setItem('likethat-tooltip-state', JSON.stringify(state));
      } catch (e) {
        // Erreur mise à jour timestamp
      }
    }
    
    // Déplacer à la fin du dossier courant - APRÈS mise à jour timestamp
    moveBookmark(draggedItem.node.id, {
      parentId: currentFolder.id,
      index: currentFolder.children ? currentFolder.children.length : 0
    });
    
    // NE PAS réinitialiser shouldKeepTooltipOpen après un drop
    // Il doit rester actif tant que le tooltip est en mode édition
  };

  // Gestionnaire pour les fichiers externes glissés vers le tooltip
  const handleTooltipFileDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.nativeEvent && e.nativeEvent.stopImmediatePropagation) {
      e.nativeEvent.stopImmediatePropagation();
    }

    const files = Array.from(e.dataTransfer.files);
    const targetIndex = currentFolder.children ? currentFolder.children.length : 0;

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
              
              // Créer un favori avec l'URL extraite dans le dossier courant
              const requestPromise = new Promise((resolve) => {
                chrome.runtime.sendMessage({
                  action: 'createBookmarkFromFile',
                  data: {
                    parentId: currentFolder.id,
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

  // Gestionnaire pour déposer sur le header de la tooltip (retour au dossier parent)
  const handleTooltipHeaderDrop = (e) => {
    if (!isTooltipEditMode || !draggedItem) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.nativeEvent && e.nativeEvent.stopImmediatePropagation) {
      e.nativeEvent.stopImmediatePropagation();
    }


    // Empêcher la fermeture du tooltip après le drop
    shouldKeepTooltipOpen.current = true;
    
    // NE PAS retirer data-dragging ici
    // On le laisse en place tant que le tooltip est en mode édition
    // pour empêcher le panneau de se fermer pendant les re-renders
    
    // IMPORTANT : Mettre à jour le timestamp AVANT moveBookmark
    const savedState = sessionStorage.getItem('likethat-tooltip-state');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        state.timestamp = Date.now();
        sessionStorage.setItem('likethat-tooltip-state', JSON.stringify(state));
      } catch (e) {
        // Erreur mise à jour timestamp
      }
    }
    
    // Si on est dans un sous-dossier, déplacer vers le dossier parent - APRÈS mise à jour timestamp
    if (folderStack.length > 0) {
      const parentFolder = folderStack[folderStack.length - 1];
      moveBookmark(draggedItem.node.id, {
        parentId: parentFolder.id,
        index: parentFolder.children ? parentFolder.children.length : 0
      });
    } else {
      // Sinon, déplacer vers la barre de favoris (ID '1')
      moveBookmark(draggedItem.node.id, {
        parentId: '1',
        index: 0
      });
    }
    
    // NE PAS réinitialiser shouldKeepTooltipOpen après un drop
    // Il doit rester actif tant que le tooltip est en mode édition
  };

  const getFaviconUrl = (url) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
    } catch {
      return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23ccc"/></svg>';
    }
  };

  return (
    <div 
      className={`bookmark-button-wrapper folder-wrapper ${isDragOver && dropPosition ? `drag-over-${dropPosition}` : ''} ${draggedItem?.node.id === folder.id ? 'dragging' : ''} ${isDragOver && draggedItem?.isFromTooltip ? 'drag-from-tooltip' : ''}`}
      data-folder-id={folder.id}
      draggable={isEditMode}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
    >
      <button 
        ref={buttonRef}
        className="bookmark-button folder-button" 
        onMouseDown={(e) => {
          // Ignorer les clics droits (bouton 2) et le bouton du milieu (bouton 1)
          if (e.button === 2 || e.button === 1) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          // Vérifier aussi via les propriétés de l'événement
          if (e.which === 3 || e.which === 2) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          handleClick(e);
        }}
        onContextMenu={handleContextMenu}
        title={folder.title}
      >
        <span className={`drag-handle-icon ${isEditMode ? '' : 'hidden'}`}>⋮⋮</span>
        {(() => {
          const customIcon = getFolderIcon(folder.id);
          if (customIcon) {
            return (
              <img 
                ref={customIconRef}
                src={safeGetURL(`assets/icons/${customIcon.icon}.png`)}
                alt={customIcon.icon}
                className={`folder-custom-icon ${customIcon.color} icon-neon`}
                data-custom-icon="true"
                width={settings.iconSize || 16}
                height={settings.iconSize || 16}
                style={{ 
                  width: `${settings.iconSize || 16}px !important`, 
                  height: `${settings.iconSize || 16}px !important`, 
                  maxWidth: `${settings.iconSize || 16}px !important`, 
                  maxHeight: `${settings.iconSize || 16}px !important`,
                  minWidth: `${settings.iconSize || 16}px !important`,
                  minHeight: `${settings.iconSize || 16}px !important`,
                  transform: 'scale(1) !important',
                  objectFit: 'contain !important',
                  display: 'inline-block !important',
                  verticalAlign: 'middle !important'
                }}
              />
            );
          }
          return <span style={{ fontSize: `${settings.iconSize || 16}px`, lineHeight: '1' }}>📁</span>;
        })()}
      </button>

      {/* Tooltip menu */}
      {isTooltipOpen && (
        <div 
          ref={tooltipRef} 
          className="folder-tooltip"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
            height: `${calculateTooltipHeight(currentFolder.children)}px`
          }}
          onMouseDown={(e) => {
            // Empêcher la propagation au document pour éviter la fermeture
            e.stopPropagation();
          }}
          onDragOver={(e) => {
            // Vérifier si c'est un fichier externe - si oui, permettre la propagation vers tooltip-content
            const hasExternalFiles = e.dataTransfer.files && e.dataTransfer.files.length > 0;
            if (!hasExternalFiles) {
              // Bloquer la propagation seulement pour les favoris internes
              e.stopPropagation();
            }
          }}
          onDragLeave={(e) => {
            // Ne pas bloquer pour les fichiers externes
            const hasExternalFiles = e.dataTransfer.files && e.dataTransfer.files.length > 0;
            if (!hasExternalFiles) {
              // Bloquer la propagation seulement pour les favoris internes
              e.stopPropagation();
            }
          }}
          onDrop={(e) => {
            // Vérifier si c'est un fichier externe - si oui, permettre la propagation vers tooltip-content
            const hasExternalFiles = e.dataTransfer.files && e.dataTransfer.files.length > 0;
            if (!hasExternalFiles) {
              // Bloquer la propagation seulement pour les favoris internes
              e.stopPropagation();
            }
          }}
        >
          <div 
            className={`tooltip-header ${headerDragOver ? 'drag-over-inside' : ''}`}
            style={headerDragOver ? {
              backgroundColor: 'rgba(0, 123, 255, 0.25)',
              boxShadow: '0 0 0 3px #007bff inset, 0 0 12px rgba(0, 123, 255, 0.4)',
              transition: 'all 0.2s ease',
              position: 'relative',
              zIndex: 100
            } : {}}
            onContextMenu={handleTooltipHeaderContextMenu}
            onDragOver={(e) => {
              if (!draggedItem) return;
              if (!isTooltipEditMode && !draggedItem.isFromTooltip) return;
              
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = 'move';
              setHeaderDragOver(true);
            }}
            onDragLeave={(e) => {
              if (!draggedItem) return;
              if (!isTooltipEditMode && !draggedItem.isFromTooltip) return;
              
              // Vérifier que l'on quitte vraiment le header et pas juste vers un enfant
              const relatedTarget = e.relatedTarget;
              if (relatedTarget && e.currentTarget.contains(relatedTarget)) {
                return; // On est toujours dans le header, ne pas retirer le style
              }
              
              e.stopPropagation();
              setHeaderDragOver(false);
            }}
            onDrop={handleTooltipHeaderDrop}
            title={draggedItem ? "Déposer ici pour remonter au dossier parent" : ""}
          >
            {headerDragOver && (
              <div style={{
                position: 'absolute',
                bottom: '0',
                left: 0,
                right: 0,
                height: '3px',
                background: 'repeating-linear-gradient(90deg, #007bff 0, #007bff 10px, transparent 10px, transparent 20px)',
                pointerEvents: 'none',
                zIndex: 200
              }} />
            )}
            {folderStack.length > 0 && (
              <button className="tooltip-back-btn" onMouseDown={handleBackClick}>
                ← 
              </button>
            )}
            {isEditingFolderName ? (
              <div className="tooltip-title-editing">
                <input
                  ref={folderNameInputRef}
                  type="text"
                  value={editingFolderName}
                  onChange={(e) => setEditingFolderName(e.target.value)}
                  onKeyDown={handleFolderNameKeyDown}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="tooltip-title-input"
                  autoFocus
                />
                <button 
                  className="tooltip-validate-rename-btn"
                  onMouseDown={handleValidateRenamingFolder}
                  title="Valider"
                >
                  ✓
                </button>
                <button 
                  className="tooltip-cancel-rename-btn"
                  onMouseDown={handleCancelRenamingFolder}
                  title="Annuler"
                >
                  ✗
                </button>
              </div>
            ) : (
              <div className={`tooltip-title ${isDragOver && draggedItem?.isFromTooltip ? 'drag-from-tooltip' : ''}`}>
                {(() => {
                  const customIcon = getFolderIcon(currentFolder.id);
                  if (customIcon) {
                    return (
                      <img 
                        src={safeGetURL(`assets/icons/${customIcon.icon}.png`)}
                        alt={customIcon.icon}
                        className={`tooltip-folder-icon ${customIcon.color}`}
                      />
                    );
                  }
                  return <span style={{ marginRight: '6px', fontSize: '12px' }}>📁</span>;
                })()}
                <ScrollingText style={{ flex: 1, minWidth: 0 }}>
                  {currentFolder.title}
                </ScrollingText>
              </div>
            )}
            <div className="tooltip-header-actions">
              <button 
                className="tooltip-close-btn"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  
                  // Annuler tous les timeouts de data-dragging
                  dragAttributeRemovalTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
                  dragAttributeRemovalTimeouts.current = [];
                  
                  // Nettoyer l'attribut data-dragging immédiatement
                  const panel = document.getElementById('likethat-panel');
                  if (panel && panel.hasAttribute('data-dragging')) {
                    panel.removeAttribute('data-dragging');
                  }
                  
                  // Réinitialiser les flags
                  shouldKeepTooltipOpen.current = false;
                  isDragActive.current = false;
                  
                  // Fermer le tooltip
                  setIsTooltipOpen(false); // Le wrapper nettoiera le sessionStorage
                  // Ne pas réinitialiser currentFolder et folderStack ici
                  // Le useEffect s'en chargera quand isTooltipOpen devient false
                  setIsTooltipEditMode(false);
                  setEditingItemId(null);
                  setIsIconSelectorOpen(false);
                }}
                title="Fermer"
              >
                ✕
              </button>
            </div>
          </div>

          <div 
            className="tooltip-content"
            onDragOver={(e) => {
              // Vérifier si c'est un fichier externe (depuis l'explorateur)
              const hasExternalFiles = e.dataTransfer.files && e.dataTransfer.files.length > 0;
              
              // Pour les fichiers externes, accepter même sans mode édition
              // Pour les favoris internes, nécessiter le mode édition
              if (hasExternalFiles || (isTooltipEditMode && draggedItem)) {
                e.preventDefault();
                e.dataTransfer.dropEffect = hasExternalFiles ? 'copy' : 'move';
              }
            }}
            onDrop={handleTooltipEmptyDrop}
          >
            {currentFolder.children && currentFolder.children.length > 0 ? (
              currentFolder.children.map((item, itemIndex) => (
                <div 
                  key={item.id}
                  id={item.id}
                  className={`tooltip-item ${isTooltipEditMode ? 'edit-mode' : ''} ${
                    draggedItem?.node.id === item.id ? 'dragging' : ''
                  } ${
                    dragOverItem?.node.id === item.id ? `drag-over-${dragOverItem.position}` : ''
                  }`}
                  onContextMenu={(e) => handleItemContextMenu(e, item)}
                  style={{
                    // Debug: forcer les styles visuels
                    ...(dragOverItem?.node.id === item.id && dragOverItem.position === 'before' ? {
                      boxShadow: '0 -3px 0 0 #007bff inset, 0 -2px 8px rgba(0, 123, 255, 0.3)',
                      backgroundColor: 'rgba(0, 123, 255, 0.15)'
                    } : {}),
                    ...(dragOverItem?.node.id === item.id && dragOverItem.position === 'inside' ? {
                      backgroundColor: 'rgba(0, 123, 255, 0.25)',
                      boxShadow: '0 0 0 3px #007bff inset, 0 0 12px rgba(0, 123, 255, 0.4)'
                    } : {}),
                    ...(dragOverItem?.node.id === item.id && dragOverItem.position === 'after' ? {
                      boxShadow: '0 3px 0 0 #007bff inset, 0 2px 8px rgba(0, 123, 255, 0.3)',
                      backgroundColor: 'rgba(0, 123, 255, 0.15)'
                    } : {})
                  }}
                  draggable={isTooltipEditMode}
                  onDragStart={(e) => handleTooltipItemDragStart(e, item, itemIndex)}
                  onDragOver={(e) => handleTooltipItemDragOver(e, item, itemIndex)}
                  onDragLeave={handleTooltipItemDragLeave}
                  onDrop={(e) => handleTooltipItemDrop(e, item, itemIndex)}
                  onDragEnd={handleTooltipItemDragEnd}
                >
                  {isTooltipEditMode && (
                    <span 
                      className="tooltip-drag-handle"
                      draggable={true}
                      onDragStart={(e) => {
                        e.stopPropagation();
                        handleTooltipItemDragStart(e, item, itemIndex);
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                    >
                      ⋮⋮
                    </span>
                  )}
                  <div 
                    className="tooltip-item-content"
                    onMouseDown={(e) => {
                      // Ne pas gérer le clic si on est en mode édition ou en mode renommage
                      if (!isTooltipEditMode && editingItemId !== item.id) {
                        handleItemClick(item, e);
                      }
                    }}
                  >
                    {!item.url ? (
                      <>
                        {(() => {
                          const subfoldercustomIcon = getFolderIcon(item.id);
                          if (subfoldercustomIcon) {
                            return (
                              <img 
                                src={safeGetURL(`assets/icons/${subfoldercustomIcon.icon}.png`)}
                                alt={subfoldercustomIcon.icon}
                                className={`tooltip-icon ${subfoldercustomIcon.color}`}
                              />
                            );
                          }
                          return <span className="tooltip-icon" style={{ fontSize: '12px' }}>📁</span>;
                        })()}
                        {editingItemId === item.id ? (
                          <input
                            type="text"
                            className="tooltip-rename-input"
                            value={editingItemName}
                            onChange={(e) => setEditingItemName(e.target.value)}
                            onKeyDown={(e) => handleRenameKeyDown(e, item)}
                            onBlur={() => handleRenameBlur(item)}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <ScrollingText className="tooltip-text" title={item.title} style={{ flex: 1, minWidth: 0 }}>
                            {item.title}
                          </ScrollingText>
                        )}
                        {!isTooltipEditMode && item.children && item.children.length > 0 && <span className="tooltip-arrow">→</span>}
                      </>
                    ) : (
                      <>
                        <img 
                          className="tooltip-favicon" 
                          src={getFaviconUrl(item.url)} 
                          alt="" 
                          onError={(e) => e.target.style.display = 'none'}
                        />
                        {editingItemId === item.id ? (
                          <input
                            type="text"
                            className="tooltip-rename-input"
                            value={editingItemName}
                            onChange={(e) => setEditingItemName(e.target.value)}
                            onKeyDown={(e) => handleRenameKeyDown(e, item)}
                            onBlur={() => handleRenameBlur(item)}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <ScrollingText className="tooltip-text" title={item.title} style={{ flex: 1, minWidth: 0 }}>
                            {item.title}
                          </ScrollingText>
                        )}
                      </>
                    )}
                  </div>
                  
                  {isTooltipEditMode && editingItemId === item.id && (
                    <div className="tooltip-item-actions">
                      <button
                        className="tooltip-action-btn tooltip-validate-btn"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleValidateRename(item);
                        }}
                        title="Valider"
                      >
                        ✅
                      </button>
                      <button
                        className="tooltip-action-btn tooltip-cancel-btn"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleCancelRename();
                        }}
                        title="Annuler"
                      >
                        ❌
                      </button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="tooltip-empty">Dossier vide</div>
            )}
          </div>
        </div>
      )}

      {/* Icon Selector */}
      {isIconSelectorOpen && (
        <IconSelector
          onIconSelect={handleIconSelect}
          onClose={handleIconSelectorClose}
          position={iconSelectorPosition}
        />
      )}

    </div>
  );
};

export default BookmarkBarFolder;

