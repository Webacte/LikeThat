import '@testing-library/jest-dom';
import { chromeMock } from './mocks/chrome';

// Mock de l'API Chrome globale
global.chrome = chromeMock;

// Mock de matchMedia pour les tests de thème
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // Deprecated
    removeListener: () => {}, // Deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {}
  })
});

// Mock de window.confirm pour happy-dom
global.confirm = (message) => true;

// Mock de window.alert pour happy-dom
global.alert = (message) => {};

// Mock de sessionStorage
const sessionStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock
});

// Mock de localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Reset des mocks avant chaque test
beforeEach(() => {
  sessionStorageMock.clear();
  localStorageMock.clear();
  
  // Reset tous les mocks Chrome si disponibles
  if (global.chrome?.runtime?.sendMessage?.mockClear) {
    global.chrome.runtime.sendMessage.mockClear();
  }
  if (global.chrome?.storage?.local?.get?.mockClear) {
    global.chrome.storage.local.get.mockClear();
  }
  if (global.chrome?.storage?.local?.set?.mockClear) {
    global.chrome.storage.local.set.mockClear();
  }
  if (global.chrome?.bookmarks?.getTree?.mockClear) {
    global.chrome.bookmarks.getTree.mockClear();
  }
  
  // Réinitialiser le stockage mock pour folderIcons
  if (global.chrome?.storage?.local) {
    // Réinitialiser folderIcons à un objet vide
    global.chrome.storage.local.set({ folderIcons: {} });
  }
});

