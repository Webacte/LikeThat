import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BookmarkBar from '../Bookmarks/BookmarkBar';

const mockBookmarksContext = {
  isEditMode: false,
  setIsEditMode: vi.fn(),
  draggedItem: null,
  setDraggedItem: vi.fn(),
  setDragOverItem: vi.fn(),
  moveBookmark: vi.fn()
};

vi.mock('../../context/BookmarksContext', () => ({
  useBookmarks: () => mockBookmarksContext
}));

vi.mock('../../context/SettingsContext', () => ({
  useSettings: () => ({
    settings: {
      panelPosition: 'left',
      bookmarksBarPosition: 'bottom'
    }
  })
}));

let defaultSendMessage = null;

describe('BookmarkBar - bouton de recherche', () => {
  const bookmarks = { id: '1', children: [] };

  beforeEach(() => {
    mockBookmarksContext.isEditMode = false;
    mockBookmarksContext.setIsEditMode.mockReset();
    mockBookmarksContext.setDraggedItem.mockReset();
    mockBookmarksContext.setDragOverItem.mockReset();
    mockBookmarksContext.moveBookmark.mockReset();

    defaultSendMessage =
      global.chrome?.runtime?.sendMessage?.getMockImplementation?.() || null;

    global.chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (message.action === 'getCurrentTab') {
        const response = { success: true, data: { isValid: true } };
        if (callback) queueMicrotask(() => callback(response));
        return Promise.resolve(response);
      }
      if (message.action === 'getAllTabs') {
        const response = { success: true, hasValidTabs: true, data: [{ isValid: true }] };
        if (callback) queueMicrotask(() => callback(response));
        return Promise.resolve(response);
      }
      if (defaultSendMessage) {
        return defaultSendMessage(message, callback);
      }
      const fallback = { success: true };
      if (callback) queueMicrotask(() => callback(fallback));
      return Promise.resolve(fallback);
    });
  });

  afterEach(() => {
    if (defaultSendMessage) {
      global.chrome.runtime.sendMessage.mockImplementation(defaultSendMessage);
    } else {
      global.chrome.runtime.sendMessage.mockReset();
    }
    defaultSendMessage = null;
  });

  it('appelle onToggleSearch lors du clic', () => {
    const onToggleSearch = vi.fn();

    render(
      <BookmarkBar
        bookmarks={bookmarks}
        onToggleSearch={onToggleSearch}
        isSearchActive={false}
      />
    );

    const searchButton = screen.getByLabelText('Rechercher dans les favoris');
    fireEvent.click(searchButton);

    expect(onToggleSearch).toHaveBeenCalledWith(true);
  });

  it('met le bouton en état actif lorsque la recherche est ouverte', () => {
    const onToggleSearch = vi.fn();

    render(
      <BookmarkBar
        bookmarks={bookmarks}
        onToggleSearch={onToggleSearch}
        isSearchActive={true}
      />
    );

    const searchButton = screen.getByLabelText('Rechercher dans les favoris');
    expect(searchButton).toHaveClass('active');
    expect(searchButton).toHaveAttribute('aria-pressed', 'true');
  });
});


