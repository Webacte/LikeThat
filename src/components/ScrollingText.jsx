import React, { useRef, useEffect, useState } from 'react';

/**
 * Composant qui fait défiler automatiquement le texte de droite à gauche
 * au survol si le texte est trop long pour être affiché en entier
 * Le texte fait une boucle continue : le début réapparaît à la fin
 */
const ScrollingText = ({ children, className = '', style = {}, ...props }) => {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [textWidth, setTextWidth] = useState(0);

  // Vérifier si le texte dépasse la largeur disponible
  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const currentTextWidth = textRef.current.scrollWidth;
        const overflowing = currentTextWidth > containerWidth;
        setIsOverflowing(overflowing);
        setTextWidth(currentTextWidth);
        
        if (overflowing && containerRef.current) {
          // Définir la variable CSS pour l'animation (distance = largeur du texte)
          containerRef.current.style.setProperty('--text-width', `${currentTextWidth}px`);
        }
      }
    };

    checkOverflow();
    
    // Réexaminer lors du redimensionnement
    const resizeObserver = new ResizeObserver(checkOverflow);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Réexaminer quand les enfants changent
    const mutationObserver = new MutationObserver(checkOverflow);
    if (textRef.current) {
      mutationObserver.observe(textRef.current, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [children]);

  const handleMouseEnter = () => {
    if (isOverflowing) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <div
      ref={containerRef}
      className={`scrolling-text-container ${className}`}
      style={{
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        ...style
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      <div
        className={`scrolling-text-wrapper ${isHovered && isOverflowing ? 'scrolling' : ''}`}
        style={{
          display: 'inline-flex',
          whiteSpace: 'nowrap'
        }}
      >
        <span
          ref={textRef}
          className="scrolling-text"
          style={{
            display: 'inline-block',
            whiteSpace: 'nowrap'
          }}
        >
          {children}
        </span>
        {isOverflowing && (
          <span
            className="scrolling-text scrolling-text-duplicate"
            style={{
              display: 'inline-block',
              whiteSpace: 'nowrap',
              marginLeft: '30px'
            }}
          >
            {children}
          </span>
        )}
      </div>
    </div>
  );
};

export default ScrollingText;
