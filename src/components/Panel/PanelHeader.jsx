import React from 'react';
import { useBookmarks } from '../../context/BookmarksContext';
import { useSettings } from '../../context/SettingsContext';
import { useContextMenu } from '../../context/ContextMenuContext';

const PanelHeader = ({ onToggle }) => {
  const { isEditMode, setIsEditMode } = useBookmarks();
  const { settings } = useSettings();
  const { openContextMenu } = useContextMenu();

  const handleClick = () => {
    if (onToggle) {
      onToggle();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  const handleSettingsClick = () => {
    chrome.runtime.sendMessage({ action: 'openOptions' });
  };

  const handleEditModeToggle = () => {
    setIsEditMode(!isEditMode);
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openContextMenu(
      'panel-header',
      { top: e.clientY, left: e.clientX },
      contextMenuItems,
      null,
      settings?.panelPosition || 'left'
    );
  };

  const contextMenuItems = [
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

  return (
    <div 
      className="panel-header flex items-center justify-between" 
      role="button" 
      tabIndex="0" 
      aria-label="Toggle LikeThat Panel"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
    >
      <div className="panel-toggle flex items-center justify-center" aria-label="Toggle panel">
        {/* Icône de toggle si nécessaire */}
      </div>
    </div>
  );
};

export default PanelHeader;
