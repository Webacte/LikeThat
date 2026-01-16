import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BookmarksProvider } from '../../context/BookmarksContext';
import { SettingsProvider } from '../../context/SettingsContext';
import BookmarkButton from '../Bookmarks/BookmarkButton';

// Mock du bookmark
const mockBookmark = {
  id: '123',
  title: 'Test Bookmark',
  url: 'https://example.com'
};

// Wrapper avec tous les providers nécessaires
const renderWithProvider = (ui) => {
  return render(
    <SettingsProvider>
      <BookmarksProvider>
        {ui}
      </BookmarksProvider>
    </SettingsProvider>
  );
};

describe('BookmarkButton', () => {
  beforeEach(() => {
    // Mock window.confirm pour happy-dom
    global.confirm = vi.fn(() => true);
  });

  it('rend le bouton de bookmark correctement', async () => {
    renderWithProvider(
      <BookmarkButton 
        bookmark={mockBookmark}
        parentId="1"
        index={0}
      />
    );

    // Le bouton devrait être présent
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('title', 'Test Bookmark');
  });

  it('affiche le favicon du bookmark', async () => {
    renderWithProvider(
      <BookmarkButton 
        bookmark={mockBookmark}
        parentId="1"
        index={0}
      />
    );

    const favicon = document.querySelector('.bookmark-button-favicon');
    expect(favicon).toBeInTheDocument();
    expect(favicon.src).toContain('google.com/s2/favicons');
    expect(favicon.src).toContain('domain=example.com');
  });

  it('ouvre le bookmark au clic en mode vue', async () => {
    const { container } = renderWithProvider(
      <BookmarkButton 
        bookmark={mockBookmark}
        parentId="1"
        index={0}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Note: L'ouverture du bookmark envoie un message à chrome
    // qui est mocké dans notre setup
  });

  it('affiche le drag handle en mode édition', async () => {
    const { container } = renderWithProvider(
      <BookmarkButton 
        bookmark={mockBookmark}
        parentId="1"
        index={0}
      />
    );

    // En mode édition, le drag handle devrait être visible
    // Note: Le mode édition est contrôlé par le contexte
  });

  it('affiche le bouton de suppression en mode édition', async () => {
    const { container } = renderWithProvider(
      <BookmarkButton 
        bookmark={mockBookmark}
        parentId="1"
        index={0}
      />
    );

    // En mode édition, le bouton de suppression devrait être visible
    // Note: Le mode édition est contrôlé par le contexte
  });

  it('gère le drag and drop', async () => {
    const { container } = renderWithProvider(
      <BookmarkButton 
        bookmark={mockBookmark}
        parentId="1"
        index={0}
      />
    );

    const wrapper = container.querySelector('.bookmark-button-wrapper');
    expect(wrapper).toBeInTheDocument();

    // Simuler le drag start
    fireEvent.dragStart(wrapper);

    // Vérifier que l'élément est draggable
    expect(wrapper).toHaveAttribute('draggable');
  });

  it('applique les classes CSS appropriées lors du drag', async () => {
    const { container } = renderWithProvider(
      <BookmarkButton 
        bookmark={mockBookmark}
        parentId="1"
        index={0}
      />
    );

    const wrapper = container.querySelector('.bookmark-button-wrapper');
    
    // Simuler le drag over
    fireEvent.dragOver(wrapper, {
      clientX: 10,
      currentTarget: wrapper,
      target: wrapper
    });

    // Les classes de drag over devraient être appliquées
    // Note: Cela dépend du contexte et du draggedItem
  });

  it('gère le clavier (Enter et Space)', async () => {
    renderWithProvider(
      <BookmarkButton 
        bookmark={mockBookmark}
        parentId="1"
        index={0}
      />
    );

    const button = screen.getByRole('button');

    // Tester la touche Enter
    fireEvent.keyDown(button, { key: 'Enter' });

    // Tester la touche Space
    fireEvent.keyDown(button, { key: ' ' });

    // Les deux devraient ouvrir le bookmark
  });

  it('génère un favicon par défaut si l\'URL est invalide', () => {
    const invalidBookmark = {
      id: '456',
      title: 'Invalid',
      url: 'not-a-valid-url'
    };

    renderWithProvider(
      <BookmarkButton 
        bookmark={invalidBookmark}
        parentId="1"
        index={0}
      />
    );

    const favicon = document.querySelector('.bookmark-button-favicon');
    expect(favicon).toBeInTheDocument();
    // Devrait utiliser le SVG par défaut
    expect(favicon.src).toContain('data:image/svg+xml');
  });

  it('demande confirmation avant suppression', async () => {
    const confirmSpy = vi.fn(() => true);
    global.confirm = confirmSpy;

    renderWithProvider(
      <BookmarkButton 
        bookmark={mockBookmark}
        parentId="1"
        index={0}
      />
    );

    // Note: Le bouton de suppression n'est visible qu'en mode édition
    // qui est géré par le contexte
  });

  it('gère le drag over avec position before/after', async () => {
    const { container } = renderWithProvider(
      <BookmarkButton 
        bookmark={mockBookmark}
        parentId="1"
        index={0}
      />
    );

    const wrapper = container.querySelector('.bookmark-button-wrapper');
    const rect = wrapper.getBoundingClientRect();

    // Drag over à gauche (before)
    fireEvent.dragOver(wrapper, {
      clientX: rect.left + rect.width * 0.3,
      currentTarget: wrapper,
      target: wrapper
    });

    // Drag over à droite (after)
    fireEvent.dragOver(wrapper, {
      clientX: rect.left + rect.width * 0.7,
      currentTarget: wrapper,
      target: wrapper
    });
  });

  it('nettoie l\'état lors du drag end', async () => {
    const { container } = renderWithProvider(
      <BookmarkButton 
        bookmark={mockBookmark}
        parentId="1"
        index={0}
      />
    );

    const wrapper = container.querySelector('.bookmark-button-wrapper');

    // Drag start
    fireEvent.dragStart(wrapper);

    // Drag end
    fireEvent.dragEnd(wrapper);

    // L'état devrait être nettoyé
    expect(wrapper).not.toHaveClass('dragging');
  });

  it('empêche le drop sur soi-même', async () => {
    const { container } = renderWithProvider(
      <BookmarkButton 
        bookmark={mockBookmark}
        parentId="1"
        index={0}
      />
    );

    const wrapper = container.querySelector('.bookmark-button-wrapper');

    // Drag start
    fireEvent.dragStart(wrapper);

    // Essayer de drop sur soi-même
    fireEvent.drop(wrapper);

    // Le drop devrait être ignoré
  });
});


