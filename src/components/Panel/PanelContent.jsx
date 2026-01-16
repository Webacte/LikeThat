import React from 'react';
import { useBookmarks } from '../../context/BookmarksContext';
import { useSettings } from '../../context/SettingsContext';
import { useContextMenu } from '../../context/ContextMenuContext';
import BookmarkList from '../Bookmarks/BookmarkList';

const PanelContent = () => {
  const { bookmarks, loading, error, isEditMode, setIsEditMode } = useBookmarks();
  const { settings } = useSettings();
  const { openContextMenu } = useContextMenu();

  // Le chargement est maintenant géré par BookmarksContext au montage

  if (loading) {
    return (
      <div className="panel-content flex flex-col">
        <div className="loading flex items-center justify-center" data-i18n="panel.loading">
          Chargement des favoris...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel-content flex flex-col">
        <div className="loading flex items-center justify-center">
          Erreur: {error}
        </div>
      </div>
    );
  }

  if (!bookmarks || !bookmarks.children) {
    return (
      <div className="panel-content flex flex-col">
        <div className="loading flex items-center justify-center" data-i18n="panel.noBookmarks">
          Aucun favori trouvé
        </div>
      </div>
    );
  }

  const handleContextMenu = (e) => {
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

    const handleSettingsClick = () => {
      chrome.runtime.sendMessage({ action: 'openOptions' });
    };

    const handleEditModeToggle = () => {
      setIsEditMode(!isEditMode);
    };

    const menuItems = [
      {
        id: 'edit-mode',
        label: isEditMode ? 'Désactiver le mode édition' : 'Activer le mode édition',
        icon: isEditMode ? '✅' : '📝',
        onClick: handleEditModeToggle
      },
      { separator: true },
      {
        id: 'settings',
        label: 'Ouvrir les options',
        icon: '⚙️',
        onClick: handleSettingsClick
      }
    ];

    openContextMenu(
      'panel-content',
      { top: e.clientY, left: e.clientX },
      menuItems,
      null,
      settings?.panelPosition || 'left'
    );
  };

  return (
    <div className="panel-content flex flex-col" onContextMenu={handleContextMenu}>
      <BookmarkList bookmarks={bookmarks} />
    </div>
  );
};

export default PanelContent;
