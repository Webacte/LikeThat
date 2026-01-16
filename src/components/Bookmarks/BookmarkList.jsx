import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import BookmarkItem from './BookmarkItem';
import BookmarkBar from './BookmarkBar';
import FolderSelectorTooltip from './FolderSelectorTooltip';
import { useBookmarks } from '../../context/BookmarksContext';
import { useSettings } from '../../context/SettingsContext';
import { useContextMenu } from '../../context/ContextMenuContext';

const BookmarkList = ({ bookmarks }) => {
  const { 
    moveBookmark,
    draggedItem,
    setDraggedItem,
    setDragOverItem,
    isEditMode,
    setIsEditMode
  } = useBookmarks();
  
  const { settings } = useSettings();
  const { openContextMenu } = useContextMenu();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTabValid, setCurrentTabValid] = useState(true);
  const [allTabsValid, setAllTabsValid] = useState(true);
  const [currentTabData, setCurrentTabData] = useState(null);
  const [isMultipleTabs, setIsMultipleTabs] = useState(false);
  const [showFolderSelector, setShowFolderSelector] = useState(false);
  const [folderSelectorPosition, setFolderSelectorPosition] = useState({ top: 0, left: 0 });
  const [showAddFolderTooltip, setShowAddFolderTooltip] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderError, setFolderError] = useState('');
  const [addFolderTooltipPosition, setAddFolderTooltipPosition] = useState({ top: 0, left: 0 });
  const searchInputRef = useRef(null);
  
  // Séparer les deux sections
  const bookmarksBar = bookmarks.children.find(node => node.id === '1');
  const bookmarksList = bookmarks.children.find(node => node.id === '2');

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  useEffect(() => {
    const panel = document.querySelector('.likethat-panel');
    if (!panel) return;
    if (isSearchOpen) {
      panel.setAttribute('data-search-open', 'true');
    } else {
      panel.removeAttribute('data-search-open');
    }
  }, [isSearchOpen]);

  const toggleSearch = useCallback((nextState) => {
    setIsSearchOpen(prev => {
      const finalState = typeof nextState === 'boolean' ? nextState : !prev;
      if (!finalState) {
        setSearchQuery('');
      }
      return finalState;
    });
  }, []);

  const basePath = bookmarksList?.title || 'Autres favoris';
  const bookmarksBarTitle = bookmarksBar?.title || 'Barre de favoris';
  const trimmedQuery = searchQuery.trim();
  const isCaseSensitive = settings.searchCaseSensitive || false;
  const normalizedQuery = isCaseSensitive ? trimmedQuery : trimmedQuery.toLowerCase();
  const hasActiveSearch = isSearchOpen && normalizedQuery.length > 0;

  const filterNodes = useCallback((nodes, baseLabel, rootParentId) => {
    if (!nodes) return [];

    const walk = (items, ancestors, parentId) => {
      return items.reduce((acc, node) => {
        const safeTitle = node.title || 'Sans titre';
        const pathLabel = ancestors.join(' / ') || baseLabel;
        const titleMatch = isCaseSensitive 
          ? safeTitle.includes(normalizedQuery)
          : safeTitle.toLowerCase().includes(normalizedQuery);
        const pathMatch = isCaseSensitive
          ? pathLabel.includes(normalizedQuery)
          : pathLabel.toLowerCase().includes(normalizedQuery);

        let filteredChildren = [];
        if (node.children && node.children.length > 0) {
          filteredChildren = walk(node.children, [...ancestors, safeTitle], node.id);
        }

        if (titleMatch || pathMatch || filteredChildren.length > 0) {
          const clonedNode = {
            ...node,
            __searchPath: pathLabel,
            __parentId: parentId
          };

          if (node.children) {
            clonedNode.children = filteredChildren;
            clonedNode.expanded = true;
          }

          acc.push(clonedNode);
        }

        return acc;
      }, []);
    };

    return walk(nodes, [baseLabel], rootParentId);
  }, [normalizedQuery, isCaseSensitive]);

  const searchResults = useMemo(() => {
    if (!hasActiveSearch) {
      return [];
    }

    const otherResults = bookmarksList?.children
      ? filterNodes(bookmarksList.children, basePath, bookmarksList.id)
      : [];

    const barResults = bookmarksBar?.children
      ? filterNodes(bookmarksBar.children, bookmarksBarTitle, bookmarksBar.id)
      : [];

    return [...otherResults, ...barResults];
  }, [hasActiveSearch, bookmarksList, bookmarksBar, filterNodes, basePath, bookmarksBarTitle]);

  const displayedChildren = hasActiveSearch
    ? searchResults
    : (bookmarksList?.children || []);

  const hasSearchResults = hasActiveSearch ? displayedChildren.length > 0 : true;

  const handleSearchInputChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const closeSearchAndReset = useCallback(() => {
    setSearchQuery('');
    toggleSearch(false);
  }, [toggleSearch]);

  // Fonction helper pour détecter si le contexte de l'extension est invalide
  const isContextInvalidatedError = (error) => {
    if (!error) return false;
    
    if (error.message) {
      const errorMsg = String(error.message);
      if (errorMsg.includes('Extension context invalidated') ||
          errorMsg.includes('message port closed') ||
          errorMsg.includes('Receiving end does not exist')) {
        return true;
      }
    }
    
    if (typeof error === 'string') {
      if (error.includes('Extension context invalidated') ||
          error.includes('message port closed') ||
          error.includes('Receiving end does not exist')) {
        return true;
      }
    }
    
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

  const handleSettingsClick = () => {
    chrome.runtime.sendMessage({ action: 'openOptions' });
  };

  const handleEditModeToggle = () => {
    setIsEditMode(!isEditMode);
  };

  const handleSearchToggle = () => {
    // Si la recherche est déjà ouverte, la fermer, sinon l'ouvrir
    toggleSearch(!isSearchOpen);
  };

  const handleAddFolderFromMenu = () => {
    // Créer un nouveau dossier dans les "autres favoris" (ID '2')
    const folderName = prompt('Nom du nouveau dossier:');
    if (!folderName || !folderName.trim()) {
      return;
    }

    const trimmedName = folderName.trim();
    
    // Vérifier les caractères interdits
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(trimmedName)) {
      alert('Caractère spécial interdit. Évitez : < > : " / \\ | ? *');
      return;
    }

    try {
      chrome.runtime.sendMessage({
        action: 'createBookmark',
        data: {
          parentId: '2',
          title: trimmedName
        }
      }, (response) => {
        if (response && response.success) {
          console.log('Nouveau dossier créé:', response.data);
          // Forcer le rechargement des bookmarks pour mettre à jour l'affichage
          window.location.reload();
        } else {
          console.error('Erreur lors de la création du dossier:', response?.error);
          alert(response?.error || 'Impossible de créer le dossier. Vérifiez les permissions de l\'extension.');
        }
      });
    } catch (error) {
      console.error('Erreur lors de la création du dossier:', error);
      alert('Impossible de créer le dossier. Vérifiez les permissions de l\'extension.');
    }
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

  const handleEmptyZoneContextMenu = (e) => {
    // Ne pas afficher le menu si on clique sur un élément interactif
    const target = e.target;
    if (target.closest('.bookmark-item') || 
        target.closest('.bookmark-button') || 
        target.closest('.folder-tooltip') ||
        target.closest('.context-menu') ||
        target.closest('input') ||
        target.closest('button')) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const menuItems = [
      {
        id: 'search',
        label: isSearchOpen ? 'Fermer la recherche' : 'Rechercher',
        icon: isSearchOpen ? '✕' : '🔍',
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
      'bookmark-list-empty-zone',
      { top: e.clientY, left: e.clientX },
      menuItems,
      null,
      settings?.panelPosition || 'left'
    );
  };

  useEffect(() => {
    if (isSearchOpen) {
      setIsDragOver(false);
    }
  }, [isSearchOpen]);
  
  const handleDragOver = (e) => {
    if (!draggedItem) return;
    
    // Permettre le drag depuis le tooltip même si pas en mode édition
    if (!isEditMode && !draggedItem.isFromTooltip) return;
    
    // Vérifier que l'événement vient bien de la zone .bookmarks-list et pas d'un enfant bookmark
    const target = e.target;
    
    // Si on survole le tooltip ou ses éléments (scrollbar, etc.), ne pas activer la zone de drop
    const isOverTooltip = target.closest('.folder-tooltip');
    if (isOverTooltip) return;
    
    // Si on survole un bookmark-item ou un de ses enfants, ne pas activer la zone de drop
    const isOverBookmark = target.closest('.bookmark-item');
    if (isOverBookmark) return;
    
    // Vérifier que c'est bien la zone .bookmarks-list ou empty-drop-zone UNIQUEMENT
    const isValidDropZone = target.classList.contains('bookmarks-list') || 
                            target.classList.contains('empty-drop-zone');
    if (!isValidDropZone) return;
    
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
    
    // Calculer l'index de destination (à la fin de la liste)
    const targetIndex = bookmarksList.children?.length || 0;
    setDragOverItem({ node: bookmarksList, parentId: '2', index: targetIndex });
  };

  const handleDragLeave = (e) => {
    // Vérifier que l'événement vient bien de la zone .bookmarks-list
    const target = e.target;
    
    // Si on survole le tooltip, ne pas gérer le leave
    const isOverTooltip = target.closest('.folder-tooltip');
    if (isOverTooltip) return;
    
    // Si on survole un bookmark-item, ne pas gérer le leave
    const isOverBookmark = target.closest('.bookmark-item');
    if (isOverBookmark) return;
    
    const isValidDropZone = target.classList.contains('bookmarks-list') || 
                            target.classList.contains('empty-drop-zone');
    if (!isValidDropZone) return;
    
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    if (!draggedItem) return;
    
    // Permettre le drop depuis le tooltip même si pas en mode édition
    if (!isEditMode && !draggedItem.isFromTooltip) return;
    
    // Vérifier que l'événement vient bien de la zone .bookmarks-list et pas d'un enfant bookmark
    const target = e.target;
    
    // Si on drop sur le tooltip, ne pas gérer ici
    const isOverTooltip = target.closest('.folder-tooltip');
    if (isOverTooltip) return;
    
    // Si on drop sur un bookmark-item, ne pas gérer ici
    const isOverBookmark = target.closest('.bookmark-item');
    if (isOverBookmark) return;
    
    const isValidDropZone = target.classList.contains('bookmarks-list') || 
                            target.classList.contains('empty-drop-zone');
    if (!isValidDropZone) return;
    
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    // Placer l'élément à la fin de la liste "Autres favoris"
    const targetIndex = bookmarksList.children?.length || 0;
    
    moveBookmark(draggedItem.node.id, {
      parentId: '2', // ID de "Autres favoris"
      index: targetIndex
    });

    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
    setIsDragOver(false);
  };
  
  const renderBookmarkItems = (children, parentId) =>
    children.map((child, idx) => (
      <BookmarkItem
        key={child.id}
        node={child}
        level={1}
        parentId={child.__parentId || parentId}
        index={idx}
      />
    ));

  // Composants à afficher
  // Toujours inclure onContextMenu même quand la recherche est ouverte
  const listHandlers = isSearchOpen ? {
    onContextMenu: handleEmptyZoneContextMenu
  } : {
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
    onDragEnd: handleDragEnd,
    onContextMenu: handleEmptyZoneContextMenu
  };

  const otherBookmarksSection = bookmarksList && (
    <div 
      className={`bookmarks-list ${isDragOver ? 'drag-over-drop-zone' : ''} ${bookmarksList.children?.length === 0 ? 'empty-list' : ''}`}
      {...listHandlers}
    >
      {isSearchOpen && (
        <div className="bookmarks-search-bar">
          <div className="bookmarks-search-input-wrapper">
            <span className="bookmarks-search-icon" aria-hidden="true">🔍</span>
            <input
              ref={searchInputRef}
              type="text"
              className="bookmarks-search-input"
              placeholder="Rechercher dans vos favoris..."
              value={searchQuery}
              onChange={handleSearchInputChange}
              aria-label="Champ de recherche des favoris"
            />
            {searchQuery && (
              <button
                className="bookmarks-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Effacer la recherche"
                type="button"
              >
                ✕
              </button>
            )}
          </div>
          <button
            className="tooltip-close-btn bookmarks-search-close-btn"
            onClick={closeSearchAndReset}
            aria-label="Fermer la recherche"
            type="button"
          >
            ✕
          </button>
        </div>
      )}

      {hasActiveSearch && !hasSearchResults && (
        <div className="bookmarks-search-empty">
          Aucun favori ne correspond à votre recherche
        </div>
      )}

      {(!hasActiveSearch || hasSearchResults) && displayedChildren?.length > 0 ? (
        renderBookmarkItems(displayedChildren, bookmarksList.id)
      ) : (
        !hasActiveSearch && isEditMode && (
          <div 
            className="empty-drop-zone" 
            data-i18n="panel.emptyDropZone"
            onContextMenu={handleEmptyZoneContextMenu}
          >
            Glissez un favori ici
          </div>
        )
      )}
    </div>
  );

  const bookmarksBarSection = bookmarksBar && (
    <BookmarkBar 
      bookmarks={bookmarksBar} 
      onToggleSearch={toggleSearch}
      isSearchActive={isSearchOpen}
    />
  );

  return (
    <div className="bookmark-list-container">
      {settings.bookmarksBarPosition === 'top' ? (
        <>
          {bookmarksBarSection}
          {otherBookmarksSection}
        </>
      ) : (
        <>
          {otherBookmarksSection}
          {bookmarksBarSection}
        </>
      )}
      
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

export default BookmarkList;
