import React, { useState, useRef, useEffect } from 'react';
import { useBookmarks } from '../../context/BookmarksContext';
import { useSettings } from '../../context/SettingsContext';
import { useFolderIcons } from '../../context/FolderIconsContext';

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

const FolderSelectorTooltip = ({ 
  position, 
  onClose, 
  onSelectFolder, 
  tabData, // { url, title, favIconUrl } ou [{ url, title, favIconUrl }, ...]
  isMultipleTabs = false 
}) => {
  const { bookmarks } = useBookmarks();
  const { settings } = useSettings();
  const { getFolderIcon } = useFolderIcons();
  const [currentFolder, setCurrentFolder] = useState(null);
  const [folderStack, setFolderStack] = useState([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [folderError, setFolderError] = useState('');
  const [folderNameForTabs, setFolderNameForTabs] = useState('');
  const [folderNameError, setFolderNameError] = useState('');
  const [showFolderNameInput, setShowFolderNameInput] = useState(isMultipleTabs);
  const tooltipRef = useRef(null);

  // Initialiser avec la racine des favoris
  useEffect(() => {
    if (bookmarks) {
      // Commencer par "Autres favoris" (ID '2')
      const otherBookmarks = bookmarks.children?.find(node => node.id === '2');
      if (otherBookmarks) {
        setCurrentFolder(otherBookmarks);
      }
    }
  }, [bookmarks]);

  // Fermer si clic à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleFolderClick = async (folder) => {
    // Si c'est un dossier, naviguer dedans
    if (folder.children) {
      setFolderStack([...folderStack, currentFolder]);
      setCurrentFolder(folder);
    }
  };

  const handleBackClick = () => {
    if (folderStack.length > 0) {
      const newStack = [...folderStack];
      const previousFolder = newStack.pop();
      setFolderStack(newStack);
      setCurrentFolder(previousFolder);
    }
  };

  const handleSelectFolder = async (folder) => {
    try {
      if (isMultipleTabs && Array.isArray(tabData)) {
        // Créer d'abord un nouveau dossier avec le nom fourni
        if (!folderNameForTabs.trim()) {
          setFolderNameError('Le nom du dossier est requis');
          return;
        }
        
        // Créer le dossier
        const createFolderResponse = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: 'createBookmark',
            data: {
              parentId: folder.id,
              title: folderNameForTabs.trim()
            }
          }, resolve);
        });
        
        if (!createFolderResponse || !createFolderResponse.success) {
          setFolderNameError(createFolderResponse?.error || 'Impossible de créer le dossier');
          return;
        }
        
        const newFolderId = createFolderResponse.data.id;
        
        // Ajouter tous les onglets valides dans le nouveau dossier
        let addedCount = 0;
        for (const tab of tabData) {
          // Ne créer le favori que si l'URL est valide
          if (tab.isValid && tab.url) {
            await chrome.runtime.sendMessage({
              action: 'createBookmark',
              data: {
                parentId: newFolderId,
                title: tab.title,
                url: tab.url
              }
            });
            addedCount++;
          }
        }
        
        // Si aucun onglet valide n'a été ajouté, supprimer le dossier vide
        if (addedCount === 0) {
          console.log('Aucun onglet valide à ajouter, suppression du dossier vide');
          await chrome.runtime.sendMessage({
            action: 'deleteBookmark',
            id: newFolderId
          });
          onClose();
          return;
        }
      } else {
        // Ajouter un seul onglet (uniquement si valide)
        if (!tabData.isValid || !tabData.url) {
          console.log('L\'onglet ne peut pas être enregistré');
          onClose();
          return;
        }
        
        await chrome.runtime.sendMessage({
          action: 'createBookmark',
          data: {
            parentId: folder.id,
            title: tabData.title,
            url: tabData.url
          }
        });
      }
      onClose();
    } catch (error) {
      console.error('Erreur lors de l\'ajout du favori:', error);
      setFolderNameError(`Erreur : ${error.message}`);
    }
  };
  
  const handleFolderNameSubmit = () => {
    const trimmedName = folderNameForTabs.trim();
    
    // Validation
    if (!trimmedName) {
      setFolderNameError('Le nom du dossier ne peut pas être vide');
      return;
    }
    
    if (trimmedName.length > 100) {
      setFolderNameError(`Le nom est trop long : ${trimmedName.length}/100 caractères maximum`);
      return;
    }
    
    // Caractères interdits
    const invalidChars = /[<>:"/\\|?*\x00-\x1F]/;
    if (invalidChars.test(trimmedName)) {
      const forbidden = trimmedName.match(invalidChars);
      const charName = forbidden ? `"${forbidden[0]}"` : 'spécial';
      setFolderNameError(`Caractère ${charName} interdit. Évitez : < > : " / \\ | ? *`);
      return;
    }
    
    // Nom valide, passer à la sélection du dossier parent
    setShowFolderNameInput(false);
    setFolderNameError('');
  };
  
  const handleFolderNameKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleFolderNameSubmit();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleCreateNewFolder = async () => {
    const trimmedName = newFolderName.trim();
    
    // Validation
    if (!trimmedName) {
      setFolderError('Le nom du dossier ne peut pas être vide');
      return;
    }
    
    if (trimmedName.length > 100) {
      setFolderError(`Le nom est trop long : ${trimmedName.length}/100 caractères maximum`);
      return;
    }
    
    // Caractères interdits
    const invalidChars = /[<>:"/\\|?*\x00-\x1F]/;
    if (invalidChars.test(trimmedName)) {
      const forbidden = trimmedName.match(invalidChars);
      const charName = forbidden ? `"${forbidden[0]}"` : 'spécial';
      setFolderError(`Caractère ${charName} interdit. Évitez : < > : " / \\ | ? *`);
      return;
    }

    try {
      chrome.runtime.sendMessage({
        action: 'createBookmark',
        data: {
          parentId: currentFolder.id,
          title: trimmedName
        }
      }, (response) => {
        if (response && response.success) {
          setShowCreateFolder(false);
          setNewFolderName('');
          setFolderError('');
          // Recharger pour afficher le nouveau dossier
          window.location.reload();
        } else {
          setFolderError(response?.error || 'Impossible de créer le dossier');
        }
      });
    } catch (error) {
      setFolderError(`Erreur : ${error.message}`);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleCreateNewFolder();
    } else if (e.key === 'Escape') {
      setShowCreateFolder(false);
      setNewFolderName('');
      setFolderError('');
    }
  };

  if (!currentFolder) return null;

  const folders = currentFolder.children?.filter(child => !child.url) || [];

  return (
    <div 
      ref={tooltipRef}
      className="folder-selector-tooltip"
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 2147483649
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="folder-selector-header">
        {folderStack.length > 0 && (
          <button className="folder-selector-back-btn" onClick={handleBackClick}>
            ← 
          </button>
        )}
        <div className="folder-selector-title">
          {(() => {
            const customIcon = getFolderIcon(currentFolder.id);
            if (customIcon) {
              return (
                <img 
                  src={safeGetURL(`assets/icons/${customIcon.icon}.png`)}
                  alt={customIcon.icon}
                  className={`folder-selector-icon ${customIcon.color}`}
                />
              );
            }
            return <span style={{ marginRight: '6px', fontSize: '12px' }}>📁</span>;
          })()}
          {isMultipleTabs && !showFolderNameInput 
            ? `Créer le dossier "${folderNameForTabs}" dans : ${currentFolder.title}`
            : currentFolder.title}
        </div>
        <button 
          className="folder-selector-close-btn"
          onClick={onClose}
          title="Fermer"
        >
          ✕
        </button>
      </div>

      <div className="folder-selector-content">
        {/* Si on ajoute tous les onglets, demander d'abord le nom du dossier */}
        {showFolderNameInput && isMultipleTabs ? (
          <div className="folder-selector-create-form">
            <div style={{ marginBottom: '12px', fontSize: '0.93em', color: 'var(--text-color)' }}>
              Nommez le dossier qui contiendra {Array.isArray(tabData) ? tabData.length : 1} onglet{Array.isArray(tabData) && tabData.length > 1 ? 's' : ''}
            </div>
            <input
              type="text"
              value={folderNameForTabs}
              onChange={(e) => {
                setFolderNameForTabs(e.target.value);
                setFolderNameError('');
              }}
              onKeyDown={handleFolderNameKeyPress}
              placeholder="Nom du dossier"
              className={`folder-selector-input ${folderNameError ? 'error' : ''}`}
              autoFocus
            />
            {folderNameError && (
              <div className="folder-selector-error">{folderNameError}</div>
            )}
            <div className="folder-selector-buttons">
              <button 
                className="folder-selector-btn folder-selector-btn-cancel"
                onClick={onClose}
              >
                Annuler
              </button>
              <button 
                className="folder-selector-btn folder-selector-btn-create"
                onClick={handleFolderNameSubmit}
                disabled={!folderNameForTabs.trim()}
              >
                Suivant
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Option pour ajouter au dossier actuel */}
            {!isMultipleTabs && (
              <div 
                className="folder-selector-item folder-selector-current"
                onClick={() => handleSelectFolder(currentFolder)}
              >
                <span className="folder-selector-icon">📌</span>
                <span className="folder-selector-text">
                  Ajouter ici
                </span>
              </div>
            )}
            
            {/* Si on ajoute tous les onglets, afficher où créer le dossier */}
            {isMultipleTabs && (
              <div 
                className="folder-selector-item folder-selector-current"
                onClick={() => handleSelectFolder(currentFolder)}
              >
                <span className="folder-selector-icon">📌</span>
                <span className="folder-selector-text">
                  Créer le dossier "{folderNameForTabs}" ici
                </span>
              </div>
            )}

        {/* Liste des sous-dossiers */}
        {folders.length > 0 ? (
          folders.map((folder) => (
            <div 
              key={folder.id}
              className="folder-selector-item"
            >
              <div 
                className="folder-selector-item-content"
                onClick={() => handleFolderClick(folder)}
              >
                {(() => {
                  const customIcon = getFolderIcon(folder.id);
                  if (customIcon) {
                    return (
                      <img 
                        src={safeGetURL(`assets/icons/${customIcon.icon}.png`)}
                        alt={customIcon.icon}
                        className={`folder-selector-icon ${customIcon.color}`}
                      />
                    );
                  }
                  return <span className="folder-selector-icon">📁</span>;
                })()}
                <span className="folder-selector-text" title={folder.title}>{folder.title}</span>
              </div>
              {isMultipleTabs ? (
                <button 
                  className="folder-selector-add-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectFolder(folder);
                  }}
                  title={`Créer le dossier "${folderNameForTabs}" dans ce dossier`}
                >
                  +
                </button>
              ) : (
                <button 
                  className="folder-selector-add-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectFolder(folder);
                  }}
                  title="Ajouter dans ce dossier"
                >
                  +
                </button>
              )}
            </div>
          ))
        ) : (
          !showCreateFolder && !isMultipleTabs && (
            <div className="folder-selector-empty">Aucun sous-dossier</div>
          )
        )}

            {/* Formulaire de création de dossier (seulement si pas en mode ajout tous les onglets) */}
            {!isMultipleTabs && (
              showCreateFolder ? (
                <div className="folder-selector-create-form">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => {
                      setNewFolderName(e.target.value);
                      setFolderError('');
                    }}
                    onKeyDown={handleKeyPress}
                    placeholder="Nom du nouveau dossier"
                    className={`folder-selector-input ${folderError ? 'error' : ''}`}
                    autoFocus
                  />
                  {folderError && (
                    <div className="folder-selector-error">{folderError}</div>
                  )}
                  <div className="folder-selector-buttons">
                    <button 
                      className="folder-selector-btn folder-selector-btn-cancel"
                      onClick={() => {
                        setShowCreateFolder(false);
                        setNewFolderName('');
                        setFolderError('');
                      }}
                    >
                      Annuler
                    </button>
                    <button 
                      className="folder-selector-btn folder-selector-btn-create"
                      onClick={handleCreateNewFolder}
                      disabled={!newFolderName.trim()}
                    >
                      Créer
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  className="folder-selector-new-folder-btn"
                  onClick={() => setShowCreateFolder(true)}
                >
                  📁 Nouveau dossier
                </button>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default FolderSelectorTooltip;


