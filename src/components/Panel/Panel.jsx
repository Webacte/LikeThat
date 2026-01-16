import React, { useState, useEffect } from 'react';
import { BookmarksProvider } from '../../context/BookmarksContext';
import { SettingsProvider } from '../../context/SettingsContext';
import { FolderIconsProvider } from '../../context/FolderIconsContext';
import { ContextMenuProvider } from '../../context/ContextMenuContext';
import ContextMenuContainer from '../ContextMenu/ContextMenuContainer';
import PanelContent from './PanelContent';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('LikeThat Error:', error, errorInfo);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    
    // Vérifier si c'est une erreur de contexte d'extension invalide
    if (error.message && error.message.includes('Extension context invalidated')) {
      console.log('Extension rechargée, rechargement de la page dans 1 seconde...');
      // Recharger la page après 1 seconde pour laisser le temps à l'extension de se réinitialiser
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }

  render() {
    if (this.state.hasError) {
      const error = this.state.error;
      // Afficher l'erreur réelle pour le débogage
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
          <p style={{ fontWeight: 'bold', marginBottom: '10px' }}>Erreur dans LikeThat</p>
          <p style={{ fontSize: '12px', color: '#999', marginBottom: '10px' }}>
            {error?.message || 'Erreur inconnue'}
          </p>
          {error?.message && error.message.includes('Extension context invalidated') ? (
            <>
              <p>L'extension a été rechargée.</p>
              <p>La page va se recharger automatiquement...</p>
            </>
          ) : (
            <p style={{ fontSize: '11px', color: '#aaa' }}>
              Vérifiez la console pour plus de détails
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Tous les providers sont montés immédiatement pour éviter les erreurs
 * Le chargement différé des données est géré dans chaque provider individuellement
 */
const LazyProviders = ({ children }) => {
  // Tous les providers sont montés immédiatement
  // Le chargement différé est géré dans chaque context (BookmarksContext, FolderIconsContext)
  return (
    <SettingsProvider>
      <BookmarksProvider>
        <FolderIconsProvider>
          <ContextMenuProvider>
            {children}
          </ContextMenuProvider>
        </FolderIconsProvider>
      </BookmarksProvider>
    </SettingsProvider>
  );
};

const Panel = () => {
  return (
    <ErrorBoundary>
      <LazyProviders>
        <div className="likethat-panel">
          <PanelContent />
          <ContextMenuContainer />
        </div>
      </LazyProviders>
    </ErrorBoundary>
  );
};

export default Panel;
