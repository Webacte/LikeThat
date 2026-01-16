import React, { useState, useRef } from 'react';
import { useBookmarks } from '../../context/BookmarksContext';
import { useSettings } from '../../context/SettingsContext';
import { useContextMenu } from '../../context/ContextMenuContext';

const BookmarkButton = ({ bookmark, parentId, index }) => {
  const { 
    openBookmark, 
    isEditMode,
    deleteBookmark,
    moveBookmark,
    draggedItem,
    setDraggedItem,
    setDragOverItem
  } = useBookmarks();
  const { settings } = useSettings();
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropPosition, setDropPosition] = useState(null);
  const { openContextMenu } = useContextMenu();
  const [showRenameTooltip, setShowRenameTooltip] = useState(false);
  const [newName, setNewName] = useState('');
  const renameTooltipRef = useRef(null);

  const handleClick = (e) => {
    if (!isEditMode) {
      e.preventDefault();
      openBookmark(bookmark.url);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!isEditMode) {
        openBookmark(bookmark.url);
      }
    }
  };

  const handleDelete = () => {
    if (confirm(`Supprimer "${bookmark.title}" ?`)) {
      deleteBookmark(bookmark.id);
    }
  };

  const handleRenameClick = () => {
    setShowRenameTooltip(true);
    setNewName(bookmark.title);
  };

  const handleRenameSubmit = async () => {
    if (newName && newName.trim() && newName.trim() !== bookmark.title) {
      try {
        chrome.runtime.sendMessage({
          action: 'updateBookmark',
          data: {
            bookmarkId: bookmark.id,
            changes: { title: newName.trim() }
          }
        }, (response) => {
          if (response && response.success) {
            setShowRenameTooltip(false);
            setNewName('');
            window.location.reload();
          } else {
            console.error('Erreur lors du renommage:', response?.error);
          }
        });
      } catch (error) {
        console.error('Erreur lors du renommage:', error);
      }
    }
  };

  const handleRenameCancel = () => {
    setShowRenameTooltip(false);
    setNewName('');
  };

  const handleRenameKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const menuItems = [
      {
        id: 'rename',
        label: 'Renommer',
        icon: '✏️',
        onClick: handleRenameClick
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
      `bookmark-button-${bookmark.id}`,
      { top: e.clientY, left: e.clientX },
      menuItems,
      null,
      settings?.panelPosition || 'left'
    );
  };

  // Fermer le tooltip de renommage si on clique à l'extérieur
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (renameTooltipRef.current && !renameTooltipRef.current.contains(event.target)) {
        setShowRenameTooltip(false);
        setNewName('');
      }
    };

    if (showRenameTooltip) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showRenameTooltip]);

  // Gestionnaires de drag and drop
  const handleDragStart = (e) => {
    if (!isEditMode) return;
    e.stopPropagation();
    setDraggedItem({ node: bookmark, parentId, index });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    if (!draggedItem) return;
    
    // Permettre le drag depuis le tooltip même si pas en mode édition
    if (!isEditMode && !draggedItem.isFromTooltip) return;
    
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const elementWidth = rect.width;
    const relativePosition = mouseX / elementWidth;
    
    setIsDragOver(true);
    // Inverser la logique pour corriger l'affichage : 
    // partie gauche (< 0.5) doit afficher 'after' (trait à droite) car on place après
    // partie droite (>= 0.5) doit afficher 'before' (trait à gauche) car on place avant
    const position = relativePosition < 0.5 ? 'after' : 'before';
    setDropPosition(position);
    setDragOverItem({ node: bookmark, parentId, index, relativePosition });
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
  };

  const handleDrop = (e) => {
    if (!draggedItem) return;
    
    // Permettre le drop depuis le tooltip même si pas en mode édition
    if (!isEditMode && !draggedItem.isFromTooltip) return;
    
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setDropPosition(null);

    if (draggedItem.node.id === bookmark.id) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const elementWidth = rect.width;
    const relativePosition = mouseX / elementWidth;

    let targetParentId = parentId || '1'; // '1' est l'ID de la barre de favoris
    let targetIndex;

    if (relativePosition < 0.5) {
      targetIndex = index !== undefined ? index : 0;
    } else {
      targetIndex = index !== undefined ? index + 1 : 0;
    }
    
    moveBookmark(draggedItem.node.id, {
      parentId: targetParentId,
      index: targetIndex
    });

    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
    setIsDragOver(false);
    setDropPosition(null);
  };

  const getFaviconUrl = (url) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
    } catch {
      return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23ccc"/></svg>';
    }
  };

  const calculateRenameTooltipPosition = () => {
    // Position par défaut au centre de l'écran
    return {
      top: window.innerHeight / 2,
      left: window.innerWidth / 2
    };
  };

  return (
    <>
      <div 
        className={`bookmark-button-wrapper ${isDragOver && dropPosition ? `drag-over-${dropPosition}` : ''} ${draggedItem?.node.id === bookmark.id ? 'dragging' : ''}`}
        draggable={isEditMode}
        onContextMenu={handleContextMenu}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
      >
        <button 
          className="bookmark-button" 
          data-id={bookmark.id} 
          data-url={bookmark.url}
          role="button"
          tabIndex="0"
          title={bookmark.title}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
        >
          <span className={`drag-handle-icon ${isEditMode ? '' : 'hidden'}`}>⋮⋮</span>
          <img 
            className="bookmark-button-favicon" 
            src={getFaviconUrl(bookmark.url)} 
            alt="" 
            onError={(e) => e.target.style.display = 'none'}
        />
      </button>
    </div>
      {showRenameTooltip && (
        <div 
          ref={renameTooltipRef}
          className="rename-folder-tooltip"
          style={{
            position: 'fixed',
            top: `${calculateRenameTooltipPosition().top}px`,
            left: `${calculateRenameTooltipPosition().left}px`,
            zIndex: 2147483649,
            maxWidth: `${Math.min(300, window.innerWidth * 0.3)}px`,
            width: 'auto'
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="rename-folder-header">
            <div className="rename-folder-title">Renommer le lien</div>
            <button 
              className="tooltip-close-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleRenameCancel();
              }}
              title="Fermer"
            >
              ✕
            </button>
          </div>
          <div className="rename-folder-content">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleRenameKeyPress}
              placeholder="Nom du lien"
              className="rename-folder-input"
              autoFocus
            />
            <div className="rename-folder-buttons">
              <button 
                className="rename-folder-btn rename-folder-btn-cancel"
                onClick={handleRenameCancel}
              >
                Annuler
              </button>
              <button 
                className="rename-folder-btn rename-folder-btn-submit"
                onClick={handleRenameSubmit}
                disabled={!newName.trim() || newName.trim() === bookmark.title}
              >
                Renommer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BookmarkButton;
