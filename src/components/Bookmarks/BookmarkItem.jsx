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
    console.error('Extension context invalidated, rechargement...');
    setTimeout(() => window.location.reload(), 500);
  }
  return '';
};

const BookmarkItem = ({ node, level, parentId, index }) => {
  const { 
    toggleFolder, 
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
  const isFolder = !node.url; // Un dossier n'a pas d'URL, même s'il est vide
  const hasChildren = node.children && node.children.length > 0;
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropPosition, setDropPosition] = useState(null); // 'before' ou 'after'
  const [isIconSelectorOpen, setIsIconSelectorOpen] = useState(false);
  const [iconSelectorPosition, setIconSelectorPosition] = useState({ top: 0, left: 0 });
  const [showRenameTooltip, setShowRenameTooltip] = useState(false);
  const [newName, setNewName] = useState('');
  const { openContextMenu } = useContextMenu();
  const iconButtonRef = useRef(null);
  const renameButtonRef = useRef(null);
  const renameTooltipRef = useRef(null);

  // Fermer le sélecteur d'icônes si on clique à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Ne pas fermer si on clique sur le sélecteur d'icônes ou ses enfants
      if (event.target.closest('.icon-selector-tooltip')) {
        return;
      }
      
      // Ne pas fermer si on clique sur un bouton d'icône
      if (event.target.closest('.edit-btn.icon')) {
        return;
      }
      
      // Fermer dans tous les autres cas
      setIsIconSelectorOpen(false);
    };

    if (isIconSelectorOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isIconSelectorOpen]);

  // Fermer le tooltip de renommage si on clique à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (renameTooltipRef.current && !renameTooltipRef.current.contains(event.target) &&
          renameButtonRef.current && !renameButtonRef.current.contains(event.target)) {
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
        img.style.setProperty('filter', 'brightness(1.2) contrast(1.4) drop-shadow(0 0 2px rgba(0,0,0,0.6)) saturate(1.3)', 'important');
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
      if (isFolder) {
        toggleFolder(node.id);
      } else {
        openBookmark(node.url);
      }
    }
  };

  const handleToggleClick = (e) => {
    e.stopPropagation();
    toggleFolder(node.id);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!isEditMode) {
        if (isFolder) {
          toggleFolder(node.id);
        } else {
          openBookmark(node.url);
        }
      }
    }
  };

  // Gestionnaires pour le mode édition
  const handleDelete = () => {
    if (confirm(`Supprimer "${node.title}" ?`)) {
      deleteBookmark(node.id);
    }
  };

  const handleOpenAll = () => {
    const count = openAllBookmarksInFolder(node);
    if (count > 0) {
      console.log(`Ouverture de ${count} onglets`);
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
      {
        id: 'change-icon',
        label: "Changer l'icône",
        icon: '🎨',
        onClick: handleIconClick
      },
      { separator: true },
      {
        id: 'delete',
        label: 'Supprimer',
        icon: '🗑️',
        onClick: handleDelete
      }
    ];

    if (isFolder) {
      const hasChildren = node.children && node.children.length > 0;
      if (hasChildren) {
        menuItems.splice(2, 0, {
          id: 'open-all',
          label: 'Ouvrir tous',
          icon: '📂',
          onClick: handleOpenAll
        });
      }
    } else {
      // Pour les liens, pas de changement d'icône
      menuItems.splice(1, 1);
    }
    
    openContextMenu(
      `bookmark-item-${node.id}`,
      { top: e.clientY, left: e.clientX },
      menuItems,
      null,
      settings?.panelPosition || 'left'
    );
  };

  // Fonction helper pour calculer la position du tooltip de renommage
  const calculateRenameTooltipPosition = () => {
    if (!renameButtonRef.current) return { top: 0, left: 0 };
    
    const rect = renameButtonRef.current.getBoundingClientRect();
    const tooltipWidth = Math.min(300, Math.max(200, window.innerWidth * 0.3)); // Largeur adaptative
    const tooltipHeight = 120; // hauteur estimée de la tooltip
    
    // Déterminer la position du panneau (gauche ou droite)
    const panelPosition = settings?.panelPosition || 'left';
    
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
    
    // Position verticale - essayer d'abord au-dessus
    top = rect.top - tooltipHeight - 8;
    // Vérifier si la tooltip dépasse en haut et ajuster si nécessaire
    if (top < 0) {
      top = rect.bottom + 8;
      // Si maintenant elle dépasse en bas, la centrer verticalement
      if (top + tooltipHeight > window.innerHeight) {
        top = Math.max(8, (window.innerHeight - tooltipHeight) / 2);
      }
    }
    
    return {
      top: Math.max(0, top),
      left: Math.max(0, left)
    };
  };

  const handleRenameClick = () => {
    setShowRenameTooltip(true);
    setNewName(node.title);
  };

  const handleRenameSubmit = async () => {
    if (newName && newName.trim() && newName.trim() !== node.title) {
      try {
        chrome.runtime.sendMessage({
          action: 'updateBookmark',
          data: {
            bookmarkId: node.id,
            changes: { title: newName.trim() }
          }
        }, (response) => {
          if (response && response.success) {
            console.log('Dossier renommé:', newName.trim());
            setShowRenameTooltip(false);
            setNewName('');
            // Forcer le rechargement des bookmarks pour mettre à jour l'affichage
            window.location.reload();
          } else {
            console.error('Erreur lors du renommage:', response?.error);
          }
        });
      } catch (error) {
        console.error('Erreur lors du renommage du dossier:', error);
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

  // Fonction helper pour calculer la position de la tooltip d'icônes (même logique que BookmarkBarFolder)
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
    setIconSelectorPosition(calculateIconSelectorPosition());
    setIsIconSelectorOpen(true);
  };

  const handleIconSelect = (iconName, color) => {
    if (iconName === 'default') {
      // Supprimer l'icône personnalisée pour revenir au défaut
      removeFolderIcon(node.id);
    } else {
      setFolderIcon(node.id, iconName, color.class);
    }
    setIsIconSelectorOpen(false);
  };

  const handleIconSelectorClose = () => {
    setIsIconSelectorOpen(false);
  };

  // Gestionnaires de drag and drop
  const handleDragStart = (e) => {
    if (!isEditMode) return;
    e.stopPropagation();
    setDraggedItem({ node, parentId, index });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget);
  };

  const handleDragOver = (e) => {
    if (!draggedItem) return;
    
    // Permettre le drag depuis le tooltip même si pas en mode édition
    if (!isEditMode && !draggedItem.isFromTooltip) return;
    
    // Empêcher la propagation dès le début pour éviter que l'événement remonte au parent
    e.preventDefault();
    e.stopPropagation();
    
    // Pour les dossiers ouverts, ignorer si on survole la zone des enfants
    if (isFolder && node.expanded) {
      const target = e.target;
      const currentTarget = e.currentTarget;
      // Si l'événement vient d'un enfant (pas directement du header), on l'ignore
      if (target !== currentTarget && !target.closest('.bookmark-folder-toggle-title-container')) {
        return;
      }
    }
    e.dataTransfer.dropEffect = 'move';
    
    // Calculer la position relative de la souris dans l'élément
    // Pour les dossiers ouverts, utiliser uniquement le header, pas toute la div
    let rect, mouseY, elementHeight, relativePosition;
    
    if (isFolder && node.expanded) {
      // Pour un dossier ouvert, calculer par rapport au header uniquement
      const headerElement = e.currentTarget.querySelector('.bookmark-folder-toggle-title-container');
      if (headerElement) {
        rect = headerElement.getBoundingClientRect();
        mouseY = e.clientY - rect.top;
        elementHeight = rect.height;
        relativePosition = mouseY / elementHeight;
      } else {
        return; // Pas de header trouvé, ignorer
      }
    } else {
      // Pour les dossiers fermés et les liens, utiliser l'élément complet
      rect = e.currentTarget.getBoundingClientRect();
      mouseY = e.clientY - rect.top;
      elementHeight = rect.height;
      relativePosition = mouseY / elementHeight;
    }
    
    setIsDragOver(true);
    
    // Pour les dossiers fermés : 3 zones (avant, dedans, après)
    // Pour les dossiers ouverts : 2 zones (avant, après) - pas de "dedans"
    // Pour les liens : 2 zones (avant, après)
    let position;
    if (isFolder && !node.expanded) {
      // Dossier fermé : on peut placer dedans
      if (relativePosition < 0.33) {
        position = 'before';
      } else if (relativePosition < 0.67) {
        position = 'inside';
      } else {
        position = 'after';
      }
    } else {
      // Dossier ouvert ou lien : seulement avant/après
      position = relativePosition < 0.5 ? 'before' : 'after';
    }
    
    setDropPosition(position);
    setDragOverItem({ node, parentId, index, relativePosition });
  };

  const handleDragLeave = (e) => {
    // Empêcher la propagation pour éviter que l'événement remonte au parent
    e.stopPropagation();
    setIsDragOver(false);
    setDropPosition(null);
  };

  const handleDrop = (e) => {
    if (!draggedItem) return;
    
    // Permettre le drop depuis le tooltip même si pas en mode édition
    if (!isEditMode && !draggedItem.isFromTooltip) return;
    
    // Empêcher la propagation dès le début pour éviter que l'événement remonte au parent
    e.preventDefault();
    e.stopPropagation();
    
    // Pour les dossiers ouverts, ignorer si on drop sur la zone des enfants
    if (isFolder && node.expanded) {
      const target = e.target;
      const currentTarget = e.currentTarget;
      // Si l'événement vient d'un enfant (pas directement du header), on l'ignore
      if (target !== currentTarget && !target.closest('.bookmark-folder-toggle-title-container')) {
        setIsDragOver(false);
        setDropPosition(null);
        return;
      }
    }
    
    setIsDragOver(false);
    setDropPosition(null);

    // Ne rien faire si on dépose sur soi-même
    if (draggedItem.node.id === node.id) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    // Calculer la position relative de la souris dans l'élément
    // Pour les dossiers ouverts, utiliser uniquement le header, pas toute la div
    let rect, mouseY, elementHeight, relativePosition;
    
    if (isFolder && node.expanded) {
      // Pour un dossier ouvert, calculer par rapport au header uniquement
      const headerElement = e.currentTarget.querySelector('.bookmark-folder-toggle-title-container');
      if (headerElement) {
        rect = headerElement.getBoundingClientRect();
        mouseY = e.clientY - rect.top;
        elementHeight = rect.height;
        relativePosition = mouseY / elementHeight;
      } else {
        setDraggedItem(null);
        setDragOverItem(null);
        return; // Pas de header trouvé, ignorer
      }
    } else {
      // Pour les dossiers fermés et les liens, utiliser l'élément complet
      rect = e.currentTarget.getBoundingClientRect();
      mouseY = e.clientY - rect.top;
      elementHeight = rect.height;
      relativePosition = mouseY / elementHeight;
    }

    let targetParentId;
    let targetIndex;

    // Logique pour les dossiers fermés : 3 zones
    // Pour les dossiers ouverts et liens : 2 zones
    if (isFolder && !node.expanded) {
      // Dossier fermé : 3 zones (avant, dedans, après)
      if (relativePosition < 0.33) {
        // Placer AVANT le dossier (même parent, même index)
        targetParentId = parentId || '0';
        targetIndex = index !== undefined ? index : 0;
      } else if (relativePosition < 0.67) {
        // Placer DEDANS le dossier (en premier enfant)
        targetParentId = node.id;
        targetIndex = 0;
      } else {
        // Placer APRÈS le dossier (même parent, index + 1)
        targetParentId = parentId || '0';
        targetIndex = index !== undefined ? index + 1 : 0;
      }
    } else {
      // Dossier ouvert ou lien : 2 zones (avant, après)
      if (relativePosition < 0.5) {
        // Placer AVANT (même parent, même index)
        targetParentId = parentId || '0';
        targetIndex = index !== undefined ? index : 0;
      } else {
        // Placer APRÈS (même parent, index + 1)
        targetParentId = parentId || '0';
        targetIndex = index !== undefined ? index + 1 : 0;
      }
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

  if (isFolder) {
    return (
      <>
        <div 
          className={`bookmark-item folder ${isDragOver && dropPosition ? `drag-over-${dropPosition}` : ''} ${draggedItem?.node.id === node.id ? 'dragging' : ''}`}
          data-id={node.id} 
          data-level={level}
          role="treeitem"
          aria-expanded={node.expanded ? 'true' : 'false'}
          tabIndex="0"
          draggable={isEditMode}
          onClick={(e) => {
            // Vérifier que ce n'est pas un clic droit
            if (e.button === 2 || e.button === 1 || e.which === 3 || e.which === 2) {
              return;
            }
            handleClick(e);
          }}
          onMouseDown={(e) => {
            // Empêcher le clic si c'est un clic droit
            if (e.button === 2 || e.button === 1) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
          }}
          onKeyDown={handleKeyDown}
          onContextMenu={handleContextMenu}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
        >
        <div className="bookmark-folder-toggle-title-container flex items-center justify-between"
          onClick={handleToggleClick}
        >
          <div className="flex items-center">
            <span className={`drag-handle mr-2 ${isEditMode ? '' : 'hidden'}`} title="Glisser pour déplacer">⋮⋮</span>
            <div 
              className={`bookmark-folder-toggle ${node.expanded ? 'expanded' : ''}`}
            />
            <div className="bookmark-title" title={node.title}>
              {(() => {
                const customIcon = getFolderIcon(node.id);
                if (customIcon) {
                  return (
                    <img 
                      src={safeGetURL(`assets/icons/${customIcon.icon}.png`)}
                      alt={customIcon.icon}
                      className={`folder-custom-icon ${customIcon.color} icon-neon`}
                      data-custom-icon="true"
                      width={settings.iconSize || 16}
                      height={settings.iconSize || 16}
                      style={{ 
                        width: `${settings.iconSize || 16}px !important`, 
                        height: `${settings.iconSize || 16}px !important`, 
                        marginRight: '4px',
                        maxWidth: `${settings.iconSize || 16}px !important`, 
                        maxHeight: `${settings.iconSize || 16}px !important`,
                        minWidth: `${settings.iconSize || 16}px !important`,
                        minHeight: `${settings.iconSize || 16}px !important`,
                        filter: 'brightness(1.2) contrast(1.4) drop-shadow(0 0 2px rgba(0,0,0,0.6)) saturate(1.3) !important',
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
              <ScrollingText style={{ flex: 1, minWidth: 0 }}>
                {node.title}
              </ScrollingText>
            </div>
          </div>

        </div>
        
        {node.expanded && (
          <div className="bookmark-children expanded">
            {hasChildren ? (
              node.children.map((child, idx) => (
                <BookmarkItem 
                  key={child.id} 
                  node={child} 
                  level={level + 1}
                  parentId={node.id}
                  index={idx}
                />
              ))
            ) : (
              <div style={{ 
                paddingLeft: `${(level + 1) * 16 + 12}px`,
                padding: '8px 12px', 
                color: '#999', 
                fontSize: '12px',
                fontStyle: 'italic'
              }}>
                Dossier vide
              </div>
            )}
          </div>
        )}

        {/* Sélecteur d'icônes pour les dossiers */}
        {isIconSelectorOpen && (
          <IconSelector
            position={iconSelectorPosition}
            onIconSelect={handleIconSelect}
            onClose={handleIconSelectorClose}
          />
        )}

        {/* Tooltip de renommage pour les dossiers */}
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
              <div className="rename-folder-title">Renommer le dossier</div>
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
                placeholder="Nom du dossier"
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
                  disabled={!newName.trim() || newName.trim() === node.title}
                >
                  Renommer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </>
    );
  }

  // Favori normal avec favicon
  const getFaviconUrl = (url) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
    } catch {
      return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23ccc"/></svg>';
    }
  };

  return (
    <>
      <div 
        className={`bookmark-item ${isDragOver && dropPosition ? `drag-over-${dropPosition}` : ''} ${draggedItem?.node.id === node.id ? 'dragging' : ''}`}
        data-id={node.id} 
        data-url={node.url}
        data-level={level}
        role="treeitem"
        tabIndex="0"
        draggable={isEditMode}
        onClick={(e) => {
          // Vérifier que ce n'est pas un clic droit
          if (e.button === 2 || e.button === 1 || e.which === 3 || e.which === 2) {
            return;
          }
          handleClick(e);
        }}
        onMouseDown={(e) => {
          // Empêcher le clic si c'est un clic droit
          if (e.button === 2 || e.button === 1) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }}
        onKeyDown={handleKeyDown}
        onContextMenu={handleContextMenu}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
      >
      <div className="flex items-center justify-between">
        <div className="bookmark-title flex items-center" title={node.title}>
          <span className={`drag-handle mr-2 ${isEditMode ? '' : 'hidden'}`} title="Glisser pour déplacer">⋮⋮</span>
          <img 
            className="bookmark-favicon" 
            src={getFaviconUrl(node.url)} 
            alt="" 
            onError={(e) => e.target.style.display = 'none'}
          />
          <ScrollingText style={{ flex: 1, minWidth: 0 }}>
            {node.title}
          </ScrollingText>
        </div>

      </div>

      {/* Tooltip de renommage pour les liens */}
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
                disabled={!newName.trim() || newName.trim() === node.title}
              >
                Renommer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default BookmarkItem;
