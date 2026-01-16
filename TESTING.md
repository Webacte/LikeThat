# Guide de Tests - LikeThat Extension Chrome

## 📋 Table des Matières

- [Introduction](#introduction)
- [Infrastructure de Test](#infrastructure-de-test)
- [Exécution des Tests](#exécution-des-tests)
- [Structure des Tests](#structure-des-tests)
- [Exemples de Tests](#exemples-de-tests)
- [Mocks et Helpers](#mocks-et-helpers)
- [Tests E2E](#tests-e2e)
- [Couverture de Code](#couverture-de-code)
- [Best Practices](#best-practices)
- [Dépannage](#dépannage)

---

## Introduction

L'extension LikeThat utilise **Vitest** comme framework de test, avec **React Testing Library** pour tester les composants React et **Puppeteer** pour les tests E2E (End-to-End).

### Technologies Utilisées

- **Vitest** : Framework de test rapide et moderne, compatible avec Vite
- **@testing-library/react** : Utilitaires pour tester les composants React
- **@testing-library/jest-dom** : Matchers personnalisés pour les assertions DOM
- **@testing-library/user-event** : Simulation d'interactions utilisateur
- **jsdom** : Environnement DOM pour les tests Node.js
- **Puppeteer** : Automatisation de Chrome pour les tests E2E
- **@vitest/coverage-v8** : Génération de rapports de couverture

---

## Infrastructure de Test

### Configuration

La configuration principale se trouve dans `vitest.config.js` :

```javascript
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.js'],
    coverage: {
      provider: 'v8',
      thresholds: {
        branches: 70,
        functions: 70,
        lines: 70,
        statements: 70
      }
    }
  }
});
```

### Fichiers Importants

- `vitest.config.js` : Configuration de Vitest
- `src/tests/setup.js` : Configuration globale des tests (mocks, polyfills)
- `src/tests/mocks/chrome.js` : Mocks de l'API Chrome
- `src/context/__tests__/` : Tests des contexts React
- `src/components/__tests__/` : Tests des composants React
- `src/tests/integration/` : Tests d'intégration
- `tests/e2e/` : Tests End-to-End avec Puppeteer

---

## Exécution des Tests

### Commandes Disponibles

```bash
# Mode watch interactif (recommandé pour le développement)
npm test

# Exécution unique de tous les tests
npm run test:run

# Interface graphique pour explorer les tests
npm run test:ui

# Générer un rapport de couverture
npm run test:coverage

# Tests End-to-End avec Puppeteer
npm run test:e2e
```

### Exécuter des Tests Spécifiques

```bash
# Un seul fichier de test
npm test -- src/context/__tests__/SettingsContext.test.jsx

# Tous les tests d'un dossier
npm test -- src/context/__tests__/

# Tests correspondant à un pattern
npm test -- --grep "BookmarkBar"
```

---

## Structure des Tests

### Organisation des Fichiers

```
LikeThat/
├── src/
│   ├── components/
│   │   └── __tests__/
│   │       ├── Panel.test.jsx
│   │       ├── IconSelector.test.jsx
│   │       └── ...
│   ├── context/
│   │   └── __tests__/
│   │       ├── BookmarksContext.test.jsx
│   │       ├── SettingsContext.test.jsx
│   │       └── FolderIconsContext.test.jsx
│   └── tests/
│       ├── setup.js
│       ├── mocks/
│       │   └── chrome.js
│       └── integration/
│           ├── drag-and-drop.test.jsx
│           └── ...
└── tests/
    └── e2e/
        ├── setup.js
        ├── helpers.js
        └── user-workflow.e2e.js
```

### Conventions de Nommage

- Fichiers de test : `*.test.jsx` ou `*.spec.jsx`
- Tests unitaires : `ComponentName.test.jsx`
- Tests d'intégration : `feature-name.test.jsx`
- Tests E2E : `scenario-name.e2e.js`

---

## Exemples de Tests

### Test d'un Context React

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { SettingsProvider, useSettings } from '../SettingsContext';

const TestComponent = () => {
  const { settings, updateSettings } = useSettings();
  return (
    <div>
      <div data-testid="theme">{settings.theme}</div>
      <button onClick={() => updateSettings({ theme: 'dark' })}>
        Change Theme
      </button>
    </div>
  );
};

describe('SettingsContext', () => {
  it('charge et met à jour les settings', async () => {
    render(
      <SettingsProvider>
        <TestComponent />
      </SettingsProvider>
    );

    // Attendre le chargement
    await waitFor(() => {
      expect(screen.getByTestId('theme')).toHaveTextContent('ocean');
    });

    // Mettre à jour
    act(() => {
      screen.getByRole('button').click();
    });

    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
  });
});
```

### Test d'un Composant React

```javascript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import IconSelector from '../IconSelector';

describe('IconSelector', () => {
  const mockOnSelect = vi.fn();
  const mockOnClose = vi.fn();

  it('sélectionne une icône et une couleur', () => {
    render(
      <IconSelector
        onIconSelect={mockOnSelect}
        onClose={mockOnClose}
        position={{ top: 100, left: 200 }}
      />
    );

    // Cliquer sur une icône
    fireEvent.mouseDown(screen.getByTitle('art'));

    // Sélectionner une couleur
    fireEvent.mouseDown(screen.getByText('Bleu'));

    // Vérifier les appels
    expect(mockOnSelect).toHaveBeenCalledWith('art', {
      name: 'Bleu',
      value: '#00BFFF',
      class: 'neon-blue'
    });
    expect(mockOnClose).toHaveBeenCalled();
  });
});
```

### Test avec Mock de l'API Chrome

```javascript
import { chromeMock } from '../../tests/mocks/chrome';

describe('BookmarksContext', () => {
  it('charge les bookmarks depuis Chrome', async () => {
    // Configurer le mock
    chromeMock.runtime.sendMessage.mockImplementationOnce((message, callback) => {
      callback({ success: true, data: mockBookmarksData });
      return Promise.resolve({ success: true, data: mockBookmarksData });
    });

    render(
      <BookmarksProvider>
        <TestComponent />
      </BookmarksProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('bookmarks-count')).toHaveTextContent('2');
    });
  });
});
```

### Test d'Intégration

```javascript
describe('Drag and Drop Integration', () => {
  it('déplace un bookmark depuis le tooltip vers la barre', async () => {
    render(
      <SettingsProvider>
        <BookmarksProvider>
          <FolderIconsProvider>
            <Panel />
          </FolderIconsProvider>
        </BookmarksProvider>
      </SettingsProvider>
    );

    // Ouvrir un dossier
    const folder = screen.getByTitle('Dossier Test');
    fireEvent.click(folder);

    // Activer le mode édition du tooltip
    const editButton = screen.getByTitle('Mode édition');
    fireEvent.mouseDown(editButton);

    // Simuler le drag and drop
    const item = screen.getByText('GitHub');
    fireEvent.dragStart(item);

    const dropZone = screen.getByTestId('bookmarks-bar');
    fireEvent.dragOver(dropZone);
    fireEvent.drop(dropZone);

    // Vérifier que moveBookmark a été appelé
    await waitFor(() => {
      expect(chromeMock.bookmarks.move).toHaveBeenCalled();
    });
  });
});
```

---

## Mocks et Helpers

### API Chrome Mockée

Le fichier `src/tests/mocks/chrome.js` fournit des mocks complets de l'API Chrome :

```javascript
import { chromeMock, mockBookmarksData } from '../../tests/mocks/chrome';

// Utiliser les mocks
describe('Mon Test', () => {
  it('utilise l\'API Chrome', () => {
    // chromeMock.bookmarks, chromeMock.storage, etc. sont déjà mockés
    chromeMock.runtime.sendMessage({ action: 'test' });
    expect(chromeMock.runtime.sendMessage).toHaveBeenCalled();
  });
});
```

### Données de Test

```javascript
// mockBookmarksData contient une structure hiérarchique de bookmarks
const mockBookmarksData = {
  id: '0',
  children: [
    {
      id: '1',
      title: 'Barre de favoris',
      children: [
        { id: '11', title: 'Google', url: 'https://www.google.com' },
        { id: '12', title: 'Dossier Test', children: [...] }
      ]
    }
  ]
};
```

### Helpers pour Simuler les Événements

```javascript
import {
  simulateBookmarkCreated,
  simulateBookmarkRemoved,
  resetMocks
} from '../../tests/mocks/chrome';

// Simuler un événement Chrome
simulateBookmarkCreated({ id: '123', title: 'New Bookmark' });

// Réinitialiser tous les mocks
resetMocks();
```

---

## Tests E2E

### Configuration

Les tests E2E utilisent Puppeteer pour tester l'extension dans un vrai navigateur Chrome.

```javascript
// tests/e2e/setup.js
export async function loadExtension() {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });
  return browser;
}
```

### Exemple de Test E2E

```javascript
// tests/e2e/user-workflow.e2e.js
describe('User Workflow E2E', () => {
  let browser, page;

  beforeAll(async () => {
    browser = await loadExtension();
    page = await browser.newPage();
    await page.goto('https://example.com');
  });

  afterAll(async () => {
    await browser.close();
  });

  it('ouvre le panneau au survol du bord', async () => {
    // Survoler le bord droit
    await page.mouse.move(page.viewport().width - 1, 300);
    await page.waitForTimeout(600); // hoverDelay

    // Vérifier que le panneau est visible
    const panel = await page.$('#likethat-panel');
    expect(panel).toBeTruthy();

    const isVisible = await panel.isVisible();
    expect(isVisible).toBe(true);
  });
});
```

---

## Couverture de Code

### Objectifs de Couverture

Le projet vise une couverture de **70-80%** pour les composants critiques :

- **Contexts** : 80%+
- **Composants principaux** : 70%+
- **Utilitaires** : 60%+

### Générer un Rapport

```bash
npm run test:coverage
```

Le rapport est généré dans `coverage/` :
- `coverage/index.html` : Rapport HTML interactif
- `coverage/coverage-summary.json` : Résumé JSON

### Interpréter les Résultats

```
------------|---------|----------|---------|---------|
File        | % Stmts | % Branch | % Funcs | % Lines |
------------|---------|----------|---------|---------|
All files   |   75.23 |    68.45 |   72.11 |   74.89 |
contexts/   |   82.15 |    75.30 |   80.00 |   81.95 |
components/ |   71.42 |    64.20 |   68.50 |   70.88 |
------------|---------|----------|---------|---------|
```

- **% Stmts** : Pourcentage de statements exécutés
- **% Branch** : Pourcentage de branches (if/else) testées
- **% Funcs** : Pourcentage de fonctions appelées
- **% Lines** : Pourcentage de lignes de code couvertes

---

## Best Practices

### 1. Organisation des Tests

```javascript
describe('ComponentName', () => {
  // Setup commun
  beforeEach(() => {
    // Réinitialiser les mocks
  });

  // Grouper les tests par fonctionnalité
  describe('rendering', () => {
    it('rend le composant correctement', () => {});
  });

  describe('user interactions', () => {
    it('répond aux clics', () => {});
  });

  describe('edge cases', () => {
    it('gère les erreurs', () => {});
  });
});
```

### 2. Tests Asynchrones

```javascript
// ✅ BON : Utiliser waitFor pour les opérations async
await waitFor(() => {
  expect(screen.getByTestId('result')).toHaveTextContent('Success');
});

// ❌ MAUVAIS : Ne pas utiliser des timeouts arbitraires
await new Promise(resolve => setTimeout(resolve, 1000));
```

### 3. Sélecteurs

```javascript
// ✅ BON : Utiliser des attributs data-testid ou des rôles
screen.getByTestId('submit-button');
screen.getByRole('button', { name: /submit/i });

// ❌ MAUVAIS : Utiliser des classes CSS (fragiles)
container.querySelector('.btn-primary');
```

### 4. Mocks

```javascript
// ✅ BON : Nettoyer les mocks entre les tests
beforeEach(() => {
  chromeMock.runtime.sendMessage.mockClear();
});

// ✅ BON : Vérifier les appels de mock avec des matchers
expect(mockFunction).toHaveBeenCalledWith(
  expect.objectContaining({ id: '123' })
);
```

### 5. Isolation des Tests

```javascript
// ✅ BON : Chaque test est indépendant
it('test A', () => {
  const result = functionA();
  expect(result).toBe('A');
});

it('test B', () => {
  const result = functionB();
  expect(result).toBe('B');
});

// ❌ MAUVAIS : Tests dépendant les uns des autres
let sharedState;
it('test A', () => {
  sharedState = 'modified';
});
it('test B', () => {
  expect(sharedState).toBe('modified'); // Fragile !
});
```

---

## Dépannage

### Problème : Les Tests Échouent Aléatoirement

**Solution** : Utiliser `waitFor` pour les opérations asynchrones

```javascript
// Au lieu de :
screen.getByText('Loading...');

// Utiliser :
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument();
});
```

### Problème : "chrome is not defined"

**Solution** : Vérifier que `src/tests/setup.js` est bien chargé dans `vitest.config.js`

```javascript
// vitest.config.js
export default defineConfig({
  test: {
    setupFiles: ['./src/tests/setup.js'] // ✅
  }
});
```

### Problème : Couverture Trop Faible

**Solution** : Identifier les fichiers non couverts

```bash
npm run test:coverage

# Ouvrir le rapport HTML
open coverage/index.html
```

Les lignes rouges dans le rapport indiquent le code non testé.

### Problème : Tests E2E Lents

**Solution** : Exécuter en mode headless et optimiser les attentes

```javascript
const browser = await puppeteer.launch({
  headless: true, // Plus rapide
  args: ['--no-sandbox']
});

// Utiliser des sélecteurs efficaces
await page.waitForSelector('#panel', { timeout: 5000 });
```

---

## Ressources

- [Documentation Vitest](https://vitest.dev/)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Puppeteer](https://pptr.dev/)
- [Chrome Extension Testing](https://developer.chrome.com/docs/extensions/mv3/testing/)

---

## Contribuer

Pour ajouter de nouveaux tests :

1. Créer un fichier `*.test.jsx` dans le dossier `__tests__` approprié
2. Importer les utilitaires nécessaires
3. Écrire les tests en suivant les best practices
4. Exécuter `npm run test:coverage` pour vérifier la couverture
5. S'assurer que les tests passent avec `npm run test:run`

---

## Tests Restants à Implémenter

Les tests suivants sont prévus mais non encore implémentés :

### Tests Unitaires
- [ ] `BookmarkButton.test.jsx`
- [ ] `BookmarkItem.test.jsx`
- [ ] `BookmarkBarFolder.test.jsx` (complexe - drag & drop, tooltips)
- [ ] `i18n.test.js`

### Tests d'Intégration
- [ ] `drag-and-drop.test.jsx` - Tests complets du drag & drop
- [ ] `folder-navigation.test.jsx` - Navigation dans les sous-dossiers
- [ ] `icon-management.test.jsx` - Workflow de gestion d'icônes
- [ ] `edit-mode.test.jsx` - Mode édition et modifications

### Tests E2E
- [ ] `user-workflow.e2e.js` - Parcours utilisateur complet
- [ ] `drag-drop-complete.e2e.js` - Drag & drop dans le navigateur réel
- [ ] `icon-customization.e2e.js` - Personnalisation d'icônes E2E
- [ ] `edit-operations.e2e.js` - Opérations d'édition E2E

Consultez le plan détaillé dans `tests-automatises.plan.md` pour plus d'informations.

