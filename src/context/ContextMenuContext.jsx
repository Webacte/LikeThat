import React, { createContext, useState, useContext } from 'react';

const ContextMenuContext = createContext();

export const useContextMenu = () => {
  const context = useContext(ContextMenuContext);
  if (!context) {
    throw new Error('useContextMenu must be used within a ContextMenuProvider');
  }
  return context;
};

export const ContextMenuProvider = ({ children }) => {
  const [openMenu, setOpenMenu] = useState(null);

  const openContextMenu = (menuId, position, items, onClose, panelPosition) => {
    // Fermer le menu précédent s'il existe
    if (openMenu && openMenu.onClose) {
      openMenu.onClose();
    }
    // Ouvrir le nouveau menu
    setOpenMenu({
      id: menuId,
      position,
      items,
      onClose: () => {
        setOpenMenu(null);
        if (onClose) {
          onClose();
        }
      },
      panelPosition
    });
  };

  const closeContextMenu = () => {
    if (openMenu && openMenu.onClose) {
      openMenu.onClose();
    }
    setOpenMenu(null);
  };

  const isMenuOpen = () => {
    return openMenu !== null;
  };

  const value = {
    openMenu,
    openContextMenu,
    closeContextMenu,
    isMenuOpen
  };

  return (
    <ContextMenuContext.Provider value={value}>
      {children}
    </ContextMenuContext.Provider>
  );
};
