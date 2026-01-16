import { vi } from 'vitest';

// Données de test pour les bookmarks
export const mockBookmarksData = {
  id: '0',
  title: '',
  children: [
    {
      id: '1',
      title: 'Barre de favoris',
      children: [
        {
          id: '11',
          title: 'Google',
          url: 'https://www.google.com'
        },
        {
          id: '12',
          title: 'Dossier Test',
          children: [
            {
              id: '121',
              title: 'GitHub',
              url: 'https://github.com'
            },
            {
              id: '122',
              title: 'Sous-dossier',
              children: [
                {
                  id: '1221',
                  title: 'Stack Overflow',
                  url: 'https://stackoverflow.com'
                }
              ]
            }
          ]
        },
        {
          id: '13',
          title: 'YouTube',
          url: 'https://www.youtube.com'
        }
      ]
    },
    {
      id: '2',
      title: 'Autres favoris',
      children: [
        {
          id: '21',
          title: 'MDN',
          url: 'https://developer.mozilla.org'
        },
        {
          id: '22',
          title: 'Dossier Autres',
          children: [
            {
              id: '221',
              title: 'Wikipedia',
              url: 'https://wikipedia.org'
            }
          ]
        }
      ]
    }
  ]
};

// Settings par défaut
export const mockDefaultSettings = {
  panelPosition: 'left',
  panelWidth: 300,
  theme: 'ocean',
  colorMode: 'light',
  hoverDelay: 500,
  hoverMode: true,
  useClickMode: false,
  bookmarksBarPosition: 'bottom',
  iconSize: 16,
  fontSize: 14,
  panelOpacity: 1.0,
  panelStyle: 'elevated',
  iconAnimationEnabled: true,
  excludedSites: [],
  clickBehavior: 'current'
};

// Mock de chrome.bookmarks
const bookmarksMock = {
  getTree: vi.fn(() => {
    return Promise.resolve([mockBookmarksData]);
  }),
  
  get: vi.fn((id) => {
    const findById = (node, targetId) => {
      if (node.id === targetId) return [node];
      if (node.children) {
        for (const child of node.children) {
          const found = findById(child, targetId);
          if (found) return found;
        }
      }
      return null;
    };
    
    const result = findById(mockBookmarksData, id);
    return Promise.resolve(result);
  }),
  
  create: vi.fn((bookmark) => {
    const newBookmark = {
      id: String(Date.now()),
      title: bookmark.title || 'New Bookmark',
      url: bookmark.url,
      parentId: bookmark.parentId || '1',
      index: bookmark.index !== undefined ? bookmark.index : 0
    };
    
    return Promise.resolve(newBookmark);
  }),
  
  update: vi.fn((id, changes) => {
    const result = { id, ...changes };
    return Promise.resolve(result);
  }),
  
  remove: vi.fn(() => {
    return Promise.resolve();
  }),
  
  removeTree: vi.fn(() => {
    return Promise.resolve();
  }),
  
  move: vi.fn((id, destination) => {
    const result = {
      id,
      parentId: destination.parentId,
      index: destination.index
    };
    return Promise.resolve(result);
  }),
  
  onCreated: {
    addListener: vi.fn(),
    removeListener: vi.fn()
  },
  
  onRemoved: {
    addListener: vi.fn(),
    removeListener: vi.fn()
  },
  
  onChanged: {
    addListener: vi.fn(),
    removeListener: vi.fn()
  },
  
  onMoved: {
    addListener: vi.fn(),
    removeListener: vi.fn()
  }
};

// Mock de chrome.storage
// Stockage en mémoire pour les tests
const mockStorage = {
  ...mockDefaultSettings,
  folderIcons: {}
};

const storageMock = {
  local: {
    get: vi.fn((keys) => {
      const result = {};
      if (typeof keys === 'string') {
        if (keys === 'folderIcons') {
          result[keys] = mockStorage[keys] || {};
        } else {
          result[keys] = mockStorage[keys] !== undefined ? mockStorage[keys] : null;
        }
      } else if (Array.isArray(keys)) {
        keys.forEach(key => {
          if (key === 'folderIcons') {
            result[key] = mockStorage[key] || {};
          } else {
            result[key] = mockStorage[key] !== undefined ? mockStorage[key] : null;
          }
        });
      } else if (keys === null || keys === undefined) {
        Object.assign(result, mockStorage);
        // S'assurer que folderIcons existe
        if (!result.folderIcons) {
          result.folderIcons = {};
        }
      } else {
        Object.assign(result, keys);
      }
      
      return Promise.resolve(result);
    }),
    
    set: vi.fn((items) => {
      Object.assign(mockStorage, items);
      return Promise.resolve();
    }),
    
    remove: vi.fn((keys) => {
      if (typeof keys === 'string') {
        delete mockStorage[keys];
      } else if (Array.isArray(keys)) {
        keys.forEach(key => delete mockStorage[key]);
      }
      return Promise.resolve();
    }),
    
    clear: vi.fn(() => {
      Object.keys(mockStorage).forEach(key => {
        delete mockStorage[key];
      });
      // Réinitialiser avec les valeurs par défaut
      Object.assign(mockStorage, mockDefaultSettings);
      mockStorage.folderIcons = {};
      return Promise.resolve();
    })
  },
  
  sync: {
    get: vi.fn((keys) => {
      // Même comportement que local pour les tests
      return storageMock.local.get(keys);
    }),
    
    set: vi.fn((items) => {
      return storageMock.local.set(items);
    })
  },
  
  onChanged: {
    addListener: vi.fn(),
    removeListener: vi.fn()
  }
};

// Mock de chrome.runtime
const runtimeMock = {
  id: 'test-extension-id',
  
  getURL: vi.fn((path) => {
    return `chrome-extension://test-extension-id/${path}`;
  }),
  
  sendMessage: vi.fn((message, callback) => {
    // Simuler des réponses en fonction du type de message
    let response = { success: true };
    
    if (message.action === 'getBookmarks') {
      response = { success: true, data: mockBookmarksData };
    } else if (message.action === 'openBookmark') {
      response = { success: true };
    } else if (message.action === 'updateBookmark') {
      response = { success: true };
    } else if (message.action === 'deleteBookmark') {
      response = { success: true };
    } else if (message.action === 'moveBookmark') {
      response = { success: true };
    }
    
    // Supporter à la fois callback et Promise
    if (callback && typeof callback === 'function') {
      // Utiliser queueMicrotask au lieu de setTimeout pour éviter l'accumulation de timers
      queueMicrotask(() => callback(response));
    }
    
    return Promise.resolve(response);
  }),
  
  lastError: null,
  
  onMessage: {
    addListener: vi.fn(),
    removeListener: vi.fn()
  }
};

// Mock de chrome.tabs
const tabsMock = {
  create: vi.fn((createProperties) => {
    const tab = {
      id: Date.now(),
      url: createProperties.url,
      active: createProperties.active !== false
    };
    return Promise.resolve(tab);
  }),
  
  update: vi.fn((tabId, updateProperties) => {
    const tab = {
      id: tabId,
      ...updateProperties
    };
    return Promise.resolve(tab);
  }),
  
  get: vi.fn((tabId) => {
    const tab = {
      id: tabId,
      url: 'chrome://newtab/',
      active: true
    };
    return Promise.resolve(tab);
  }),
  
  query: vi.fn(() => {
    const tabs = [];
    return Promise.resolve(tabs);
  }),
  
  onCreated: {
    addListener: vi.fn(),
    removeListener: vi.fn()
  },
  
  onUpdated: {
    addListener: vi.fn(),
    removeListener: vi.fn()
  }
};

// Export du mock Chrome complet
export const chromeMock = {
  bookmarks: bookmarksMock,
  storage: storageMock,
  runtime: runtimeMock,
  tabs: tabsMock
};

// Helpers pour les tests
export const resetMocks = () => {
  Object.values(bookmarksMock).forEach(mock => {
    if (mock && typeof mock.mockClear === 'function') {
      mock.mockClear();
    }
  });
  
  Object.values(storageMock.local).forEach(mock => {
    if (mock && typeof mock.mockClear === 'function') {
      mock.mockClear();
    }
  });
  
  runtimeMock.sendMessage.mockClear();
  runtimeMock.getURL.mockClear();
};

export const simulateBookmarkCreated = (bookmark) => {
  const listeners = bookmarksMock.onCreated.addListener.mock.calls;
  listeners.forEach(([callback]) => {
    callback(bookmark.id, bookmark);
  });
};

export const simulateBookmarkRemoved = (id, removeInfo) => {
  const listeners = bookmarksMock.onRemoved.addListener.mock.calls;
  listeners.forEach(([callback]) => {
    callback(id, removeInfo);
  });
};

export const simulateBookmarkChanged = (id, changeInfo) => {
  const listeners = bookmarksMock.onChanged.addListener.mock.calls;
  listeners.forEach(([callback]) => {
    callback(id, changeInfo);
  });
};

export const simulateBookmarkMoved = (id, moveInfo) => {
  const listeners = bookmarksMock.onMoved.addListener.mock.calls;
  listeners.forEach(([callback]) => {
    callback(id, moveInfo);
  });
};

