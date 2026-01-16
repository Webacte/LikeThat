import React, { useEffect, useRef } from 'react';

const ContextMenu = ({ 
  position, 
  items, 
  onClose,
  panelPosition = 'left',
  menuId
}) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      // Ne pas fermer si on clique sur le menu ou ses enfants
      if (menuRef.current && menuRef.current.contains(event.target)) {
        return;
      }
      onClose();
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    // Utiliser 'click' en phase de bubbling (pas de capture) pour ne pas intercepter les clics sur les items
    // Ajouter les listeners après un court délai pour éviter la fermeture immédiate
    const timeoutId = setTimeout(() => {
      // Utiliser click sans capture pour laisser les clics sur les items se propager normalement
      document.addEventListener('click', handleClickOutside, false);
      document.addEventListener('contextmenu', handleClickOutside, false);
      document.addEventListener('keydown', handleEscape);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside, false);
      document.removeEventListener('contextmenu', handleClickOutside, false);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Ajuster la position pour éviter les débordements
  useEffect(() => {
    if (!menuRef.current || !position) return;

    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let { top, left } = position;

    // Ajuster horizontalement
    if (left + rect.width > viewportWidth) {
      left = viewportWidth - rect.width - 8;
    }
    if (left < 0) {
      left = 8;
    }

    // Ajuster verticalement
    if (top + rect.height > viewportHeight) {
      top = viewportHeight - rect.height - 8;
    }
    if (top < 0) {
      top = 8;
    }

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
  }, [position]);

  if (!position || !items || items.length === 0) {
    return null;
  }

  const handleItemClick = (item, event) => {
    // Empêcher la propagation pour éviter que le listener de fermeture ne se déclenche
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    
    // Fermer le menu d'abord pour éviter les conflits
    onClose();
    
    // Exécuter la fonction onClick après un court délai pour s'assurer que le menu est fermé
    if (item.onClick) {
      setTimeout(() => {
        try {
          item.onClick();
        } catch (error) {
          console.error('Erreur lors de l\'exécution de l\'action du menu:', error);
        }
      }, 50);
    }
  };

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 2147483650
      }}
      role="menu"
      aria-label="Menu contextuel"
    >
      {items.map((item, index) => {
        if (item.separator) {
          return <div key={`separator-${index}`} className="context-menu-separator" />;
        }

        if (item.disabled) {
          return (
            <div
              key={item.id || index}
              className="context-menu-item context-menu-item-disabled"
              role="menuitem"
            >
              {item.icon && <span className="context-menu-item-icon">{item.icon}</span>}
              <span className="context-menu-item-label">{item.label}</span>
            </div>
          );
        }

        return (
          <div
            key={item.id || index}
            className="context-menu-item"
            role="menuitem"
            style={{ cursor: 'pointer', backgroundColor: 'transparent' }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleItemClick(item, e);
            }}
            onMouseDown={(e) => {
              // Ne pas empêcher le comportement par défaut pour permettre le clic
              e.stopPropagation();
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.cursor = 'pointer';
              // Forcer le background au survol via inline style
              if (!e.currentTarget.classList.contains('context-menu-item-disabled')) {
                // Le pseudo-élément ::before gère le background, mais on peut aussi forcer ici
                const isDark = document.body.getAttribute('data-color-mode') === 'dark' || 
                               document.body.hasAttribute('data-theme') && 
                               document.body.getAttribute('data-color-mode') === 'dark';
                e.currentTarget.style.backgroundColor = isDark 
                  ? 'rgba(255, 255, 255, 0.15)' 
                  : 'rgba(0, 123, 255, 0.12)';
              }
            }}
            onMouseLeave={(e) => {
              // Réinitialiser le background quand on quitte
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                handleItemClick(item, e);
              }
            }}
          >
            {item.icon && <span className="context-menu-item-icon" style={{ cursor: 'pointer' }}>{item.icon}</span>}
            <span className="context-menu-item-label" style={{ cursor: 'pointer' }}>{item.label}</span>
            {item.shortcut && (
              <span className="context-menu-item-shortcut" style={{ cursor: 'pointer' }}>{item.shortcut}</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ContextMenu;
