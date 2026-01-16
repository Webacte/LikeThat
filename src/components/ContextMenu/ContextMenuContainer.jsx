import React from 'react';
import { useContextMenu } from '../../context/ContextMenuContext';
import ContextMenu from './ContextMenu';

const ContextMenuContainer = () => {
  const { openMenu } = useContextMenu();

  if (!openMenu) {
    return null;
  }

  return (
    <ContextMenu
      position={openMenu.position}
      items={openMenu.items}
      onClose={openMenu.onClose}
      panelPosition={openMenu.panelPosition}
      menuId={openMenu.id}
    />
  );
};

export default ContextMenuContainer;
