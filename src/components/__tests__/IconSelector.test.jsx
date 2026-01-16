import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import IconSelector from '../Bookmarks/IconSelector';

describe('IconSelector', () => {
  const mockOnIconSelect = vi.fn();
  const mockOnClose = vi.fn();
  const defaultPosition = { top: 100, left: 200 };

  beforeEach(() => {
    mockOnIconSelect.mockClear();
    mockOnClose.mockClear();
  });

  it('rend le sélecteur d\'icônes avec la grille d\'icônes', () => {
    render(
      <IconSelector
        onIconSelect={mockOnIconSelect}
        onClose={mockOnClose}
        position={defaultPosition}
      />
    );

    // Vérifier le titre
    expect(screen.getByText('Choisir une icône')).toBeInTheDocument();

    // Vérifier que la grille d'icônes est affichée
    const iconGrid = document.querySelector('.icon-grid');
    expect(iconGrid).toBeInTheDocument();

    // Vérifier que l'option dossier par défaut est présente
    expect(screen.getByTitle('Dossier par défaut')).toBeInTheDocument();
  });

  it('positionne le tooltip selon les coordonnées fournies', () => {
    const { container } = render(
      <IconSelector
        onIconSelect={mockOnIconSelect}
        onClose={mockOnClose}
        position={{ top: 150, left: 250 }}
      />
    );

    const tooltip = container.querySelector('.icon-selector-tooltip');
    expect(tooltip).toHaveStyle({ top: '150px', left: '250px' });
  });

  it('affiche le bouton de fermeture', () => {
    render(
      <IconSelector
        onIconSelect={mockOnIconSelect}
        onClose={mockOnClose}
        position={defaultPosition}
      />
    );

    const closeButton = screen.getByTitle('Fermer');
    expect(closeButton).toBeInTheDocument();
    expect(closeButton).toHaveTextContent('✕');
  });

  it('ferme le sélecteur quand on clique sur le bouton de fermeture', () => {
    render(
      <IconSelector
        onIconSelect={mockOnIconSelect}
        onClose={mockOnClose}
        position={defaultPosition}
      />
    );

    const closeButton = screen.getByTitle('Fermer');
    fireEvent.mouseDown(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('sélectionne le dossier par défaut directement', () => {
    render(
      <IconSelector
        onIconSelect={mockOnIconSelect}
        onClose={mockOnClose}
        position={defaultPosition}
      />
    );

    const defaultOption = screen.getByTitle('Dossier par défaut');
    fireEvent.mouseDown(defaultOption);

    // Devrait appeler onIconSelect avec 'default' et null
    expect(mockOnIconSelect).toHaveBeenCalledWith('default', null);
    // Devrait fermer le sélecteur
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('affiche le sélecteur de couleur après avoir cliqué sur une icône', () => {
    render(
      <IconSelector
        onIconSelect={mockOnIconSelect}
        onClose={mockOnClose}
        position={defaultPosition}
      />
    );

    // Cliquer sur une icône (par exemple 'art')
    const artIcon = screen.getByTitle('art');
    fireEvent.mouseDown(artIcon);

    // Le sélecteur de couleur devrait être affiché
    expect(screen.getByText(/Choisir une couleur pour art/i)).toBeInTheDocument();

    // Le bouton retour devrait être visible
    expect(screen.getByTitle('Retour aux icônes')).toBeInTheDocument();

    // La grille de couleurs devrait être affichée
    const colorGrid = document.querySelector('.color-grid');
    expect(colorGrid).toBeInTheDocument();
  });

  it('affiche toutes les couleurs néon disponibles', () => {
    render(
      <IconSelector
        onIconSelect={mockOnIconSelect}
        onClose={mockOnClose}
        position={defaultPosition}
      />
    );

    // Sélectionner une icône d'abord
    const artIcon = screen.getByTitle('art');
    fireEvent.mouseDown(artIcon);

    // Vérifier que toutes les couleurs sont présentes
    expect(screen.getByText('Bleu')).toBeInTheDocument();
    expect(screen.getByText('Vert')).toBeInTheDocument();
    expect(screen.getByText('Rouge')).toBeInTheDocument();
    expect(screen.getByText('Violet')).toBeInTheDocument();
    expect(screen.getByText('Orange')).toBeInTheDocument();
    expect(screen.getByText('Rose')).toBeInTheDocument();
  });

  it('sélectionne une couleur et appelle onIconSelect', () => {
    render(
      <IconSelector
        onIconSelect={mockOnIconSelect}
        onClose={mockOnClose}
        position={defaultPosition}
      />
    );

    // Sélectionner une icône
    const bookIcon = screen.getByTitle('book');
    fireEvent.mouseDown(bookIcon);

    // Sélectionner une couleur
    const blueColor = screen.getByText('Bleu');
    fireEvent.mouseDown(blueColor);

    // Vérifier que onIconSelect a été appelé avec les bons paramètres
    expect(mockOnIconSelect).toHaveBeenCalledWith('book', {
      name: 'Bleu',
      value: '#00BFFF',
      class: 'neon-blue'
    });

    // Le sélecteur devrait se fermer
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('retourne à la grille d\'icônes avec le bouton retour', () => {
    render(
      <IconSelector
        onIconSelect={mockOnIconSelect}
        onClose={mockOnClose}
        position={defaultPosition}
      />
    );

    // Sélectionner une icône
    const catIcon = screen.getByTitle('cat');
    fireEvent.mouseDown(catIcon);

    // Vérifier qu'on est dans le sélecteur de couleur
    expect(screen.getByText(/Choisir une couleur pour cat/i)).toBeInTheDocument();

    // Cliquer sur le bouton retour
    const backButton = screen.getByTitle('Retour aux icônes');
    fireEvent.mouseDown(backButton);

    // On devrait être de retour à la grille d'icônes
    expect(screen.getByText('Choisir une icône')).toBeInTheDocument();
    expect(document.querySelector('.icon-grid')).toBeInTheDocument();
  });

  it('affiche toutes les icônes disponibles', () => {
    render(
      <IconSelector
        onIconSelect={mockOnIconSelect}
        onClose={mockOnClose}
        position={defaultPosition}
      />
    );

    // Vérifier quelques icônes
    expect(screen.getByTitle('art')).toBeInTheDocument();
    expect(screen.getByTitle('book')).toBeInTheDocument();
    expect(screen.getByTitle('cat')).toBeInTheDocument();
    expect(screen.getByTitle('work')).toBeInTheDocument();
    expect(screen.getByTitle('photo')).toBeInTheDocument();
  });

  it('gère la position par défaut si position n\'est pas fournie', () => {
    const { container } = render(
      <IconSelector
        onIconSelect={mockOnIconSelect}
        onClose={mockOnClose}
        position={null}
      />
    );

    const tooltip = container.querySelector('.icon-selector-tooltip');
    expect(tooltip).toHaveStyle({ top: '0px', left: '0px' });
  });

  it('empêche la propagation des événements mouseDown', () => {
    const parentClickHandler = vi.fn();

    render(
      <div onMouseDown={parentClickHandler}>
        <IconSelector
          onIconSelect={mockOnIconSelect}
          onClose={mockOnClose}
          position={defaultPosition}
        />
      </div>
    );

    // Cliquer sur une icône
    const artIcon = screen.getByTitle('art');
    fireEvent.mouseDown(artIcon);

    // Le gestionnaire parent ne devrait pas être appelé
    expect(parentClickHandler).not.toHaveBeenCalled();
  });

  it('workflow complet : sélectionner une icône puis une couleur', () => {
    render(
      <IconSelector
        onIconSelect={mockOnIconSelect}
        onClose={mockOnClose}
        position={defaultPosition}
      />
    );

    // 1. Vérifier l'état initial
    expect(screen.getByText('Choisir une icône')).toBeInTheDocument();

    // 2. Cliquer sur une icône
    const movieIcon = screen.getByTitle('movie');
    fireEvent.mouseDown(movieIcon);

    // 3. Vérifier que le sélecteur de couleur s'affiche
    expect(screen.getByText(/Choisir une couleur pour movie/i)).toBeInTheDocument();

    // 4. Sélectionner une couleur rouge
    const redColor = screen.getByText('Rouge');
    fireEvent.mouseDown(redColor);

    // 5. Vérifier les appels
    expect(mockOnIconSelect).toHaveBeenCalledWith('movie', {
      name: 'Rouge',
      value: '#FF1744',
      class: 'neon-red'
    });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('affiche les images avec les URLs chrome-extension correctes', () => {
    render(
      <IconSelector
        onIconSelect={mockOnIconSelect}
        onClose={mockOnClose}
        position={defaultPosition}
      />
    );

    // Vérifier qu'une image a une URL chrome-extension
    const artImage = document.querySelector('img[alt="art"]');
    expect(artImage).toBeInTheDocument();
    expect(artImage.src).toContain('chrome-extension://');
    expect(artImage.src).toContain('assets/icons/art.png');
  });
});


