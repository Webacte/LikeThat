# 🚀 LikeThat - Extension Chrome

**Panneau latéral personnalisable pour vos favoris**

LikeThat est une extension Chrome qui ajoute un panneau latéral élégant et personnalisable pour accéder rapidement à vos favoris. Le panneau apparaît au survol du bord de l'écran et se cache automatiquement quand vous n'en avez plus besoin.

## ✨ Fonctionnalités

### 🎯 **Panneau Intelligent**
- **Survol automatique** : Apparaît au survol du bord de l'écran
- **Position configurable** : Gauche ou droite
- **Largeur ajustable** : 200px à 500px
- **Thèmes** : Clair, sombre ou automatique

### 📚 **Gestion des Favoris**
- **Affichage hiérarchique** : Dossiers et sous-dossiers
- **Favicons** : Icônes des sites pour identification rapide
- **Drag & Drop** : Réorganisation par glisser-déposer
- **Sites exclus** : Exclure des domaines du panneau

### ⚙️ **Personnalisation**
- **Comportement du clic** : Onglet courant, nouvel onglet, nouvelle fenêtre
- **Délai de survol** : 100ms à 2000ms
- **Mode clic** : Désactiver le survol pour un contrôle manuel
- **Export/Import** : Sauvegarder et restaurer vos paramètres

### ♿ **Accessibilité**
- **Navigation clavier** : Tab, Entrée, flèches
- **ARIA** : Support des lecteurs d'écran
- **Contraste** : Respect des standards d'accessibilité

## 🚀 Installation

### 1. Téléchargement
```bash
git clone https://github.com/Webacte/LikeThat.git
cd LikeThat
npm install
```

### 2. Installation dans Chrome
1. **Ouvrez Chrome** et allez à `chrome://extensions/`
2. **Activez** le "Mode développeur" (en haut à droite)
3. **Cliquez** sur "Charger l'extension non empaquetée"
4. **Sélectionnez** le dossier `LikeThat`
5. **Vérifiez** que l'extension apparaît dans la liste

### 3. Vérification
- L'icône LikeThat devrait apparaître dans la barre d'outils
- Survolez le bord droit de l'écran sur une page web
- Le panneau devrait apparaître après 0.5 seconde

## 📖 Utilisation

### 🖱️ **Survol (par défaut)**
1. **Survolez** le bord de l'écran (gauche ou droite)
2. **Attendez** 0.5 seconde (configurable)
3. **Le panneau** apparaît avec vos favoris
4. **Sortez** la souris pour le masquer

### 🖱️ **Mode Clic**
1. **Activez** le mode clic dans les options
2. **Cliquez** sur l'icône LikeThat dans la barre d'outils
3. **Le panneau** s'affiche et reste visible
4. **Cliquez** à nouveau pour le masquer

### ⌨️ **Navigation Clavier**
- **Tab** : Naviguer dans le panneau
- **Entrée** : Ouvrir un favori
- **Clic** : Basculer un dossier
- **Glisser** : Réorganiser les favoris

## ⚙️ Configuration

### 🎨 **Options Visuelles**
- **Position** : Gauche ou droite
- **Largeur** : 200px à 500px
- **Thème** : Clair, sombre ou automatique

### 🖱️ **Comportement**
- **Clic** : Onglet courant, nouvel onglet, nouvelle fenêtre
- **Survol** : Délai de 100ms à 2000ms
- **Mode** : Survol automatique ou clic manuel

### 🚫 **Exclusions**
- **Sites exclus** : Domaines à ne pas afficher
- **Format** : Un domaine par ligne
- **Exemple** : `exemple.com`

### 📑 **Nouvel Onglet**
- **Configuration** : Choisissez l'URL à ouvrir lorsque vous créez un nouvel onglet
- **Moteurs disponibles** : Google, Bing, DuckDuckGo, Yahoo, Ecosia, Qwant
- **URL personnalisée** : Option pour utiliser une URL personnalisée pour les nouveaux onglets
- **Note** : Cette configuration affecte uniquement les nouveaux onglets, pas le moteur de recherche par défaut de Chrome dans la barre d'adresse

## 🏗️ Architecture

### 📁 **Structure du Projet**
```
LikeThat/
├── manifest.json          # Configuration de l'extension
├── src/                   # Code source de l'extension
│   ├── components/        # Composants React
│   │   ├── Bookmarks/     # Composants de favoris
│   │   └── Panel/         # Composants du panneau
│   ├── context/           # Contextes React
│   │   ├── BookmarksContext.jsx  # Gestion des favoris
│   │   └── SettingsContext.jsx   # Gestion des paramètres
│   ├── scripts/           # Scripts JavaScript
│   │   ├── background.js  # Service worker (gestion des favoris)
│   │   ├── popup.js       # Script du popup
│   │   ├── options.js     # Script de la page d'options
│   │   └── i18n.js        # Système d'internationalisation
│   ├── styles/            # Feuilles de style
│   │   ├── popup.css      # Styles du popup
│   │   └── options.css    # Styles de la page d'options
│   ├── content.jsx        # Script principal (panneau React)
│   ├── pages/             # Pages HTML
│   │   ├── popup.html     # Interface du popup
│   │   └── options.html   # Page de configuration
│   └── assets/            # Ressources
│       └── icons/         # Icônes personnalisables pour les dossiers
│           ├── art.png, bag.png, ballon.png, etc.
│           └── (33 icônes au total)
├── scripts/               # Scripts de build
│   ├── build-extension.js # Build de production
│   ├── dev-simple.js      # Build de développement
│   └── fix-manifest.js    # Correction du manifest
├── README.md              # Documentation principale
├── package.json           # Configuration du projet
├── .eslintrc.js           # Configuration ESLint
├── .gitignore             # Fichiers à ignorer
└── LICENSE                # Licence MIT
```

### 🔧 **Technologies**
- **Manifest V3** : Dernière version des extensions Chrome
- **React 18** : Interface utilisateur moderne avec hooks et contextes
- **Shadow DOM** : Isolation des styles
- **Vite** : Build rapide et optimisé avec HMR (Hot Module Replacement)
- **Vitest** : Framework de test moderne et rapide
- **Chrome APIs** : bookmarks, storage, scripting, tabs
- **ES6+** : JavaScript moderne avec modules ES
- **CSS3** : Animations et transitions

### 🎯 **Composants React Principaux**
- **Panel** : Composant principal du panneau latéral
- **BookmarksContext** : Gestion centralisée des favoris
- **SettingsContext** : Gestion des paramètres de l'extension
- **BookmarkList** : Liste hiérarchique des favoris
- **BookmarkItem** : Élément de favori récursif
- **BookmarkBar** : Barre de favoris avec drag & drop
- **IconSelector** : Sélecteur d'icônes personnalisées pour les dossiers

### 🌐 **APIs Utilisées**
- `chrome.bookmarks` : Gestion des favoris
- `chrome.storage` : Sauvegarde des paramètres
- `chrome.scripting` : Injection de scripts
- `chrome.runtime` : Communication entre scripts

## 🧪 Tests Automatisés

### ✅ **Infrastructure de Test**
LikeThat dispose d'une suite complète de **114 tests automatisés** avec **100% de réussite**.

#### Couverture de Code
- **Contexts** : 70%+ (objectif atteint)
  - FolderIconsContext : **100%** 🎯
  - BookmarksContext : **74.31%** ✅
  - SettingsContext : **73.68%** ✅
- **IconSelector** : **92.5%** ✅
- **Global** : 33.35%

#### Commandes
```bash
# Exécuter les tests
npm test                # Mode watch
npm run test:run        # Exécution unique
npm run test:ui         # Interface graphique
npm run test:coverage   # Rapport de couverture
npm run test:e2e        # Tests End-to-End
```

#### Documentation
- **TESTING.md** : Guide complet d'utilisation des tests

## 🔧 Débogage

### 🚨 **Problèmes Courants**

#### Le panneau n'apparaît pas
1. **Vérifiez** que l'extension est installée
2. **Rechargez** l'extension dans `chrome://extensions/`
3. **Testez** sur une page `http://` ou `https://`

#### Le survol ne fonctionne pas
1. **Vérifiez** que le mode clic est désactivé
2. **Ajustez** le délai de survol
3. **Survolez** dans les 20 derniers pixels du bord

#### Les favoris ne se chargent pas
1. **Vérifiez** les permissions de l'extension
2. **Rechargez** l'extension
3. **Vérifiez** qu'il y a des favoris dans Chrome

### 🛠️ **Outils de Débogage**
- **Console** : `F12` pour voir les logs (erreurs uniquement)
- **Service Worker** : `chrome://extensions/` → Inspecter
- **React DevTools** : Installer l'extension React DevTools pour inspecter les composants React
- **Paramètres** : Vérifier le stockage des données dans `chrome.storage`

#### 🧪 **Forcer l'affichage du panneau (Debug)**
Pour tester le panneau sans avoir à survoler le bord de l'écran et le garder ouvert, ouvrez la console (`F12` → Console) et injectez ce code :

```javascript
// Forcer l'affichage du panneau et bloquer la fermeture
const panel = document.querySelector('#likethat-panel');
if (panel) {
  // Empêcher le panneau de se fermer
  panel.addEventListener('mouseleave', (e) => {
    e.stopImmediatePropagation();
  }, true);
  
  // Forcer l'ouverture
  panel.classList.add('expanded');
  panel.style.width = '300px';
  panel.style.opacity = '1';
  panel.style.pointerEvents = 'auto';
  
  console.log('✅ Panneau forcé en mode ouvert et bloqué');
}
```

## 🌍 Internationalisation

### 🇫🇷 **Français (par défaut)**
- Interface complète en français
- Messages d'erreur traduits
- Support des caractères spéciaux

### 🇬🇧 **Anglais**
- Interface complète en anglais
- Fallback automatique si français non disponible
- Compatible avec tous les navigateurs

## 🔒 Sécurité et Confidentialité

### 🛡️ **Permissions Minimales**
- `bookmarks` : Lecture et modification des favoris
- `storage` : Sauvegarde des paramètres
- `activeTab` : Interaction avec l'onglet actuel
- `scripting` : Injection de scripts si nécessaire

### 🔐 **Données**
- **Aucune collecte** de données personnelles
- **Stockage local** uniquement (Chrome sync)
- **Pas de communication** avec des serveurs externes
- **Code open source** entièrement auditable

## 🚀 Développement

### 📋 **Prérequis**
- Chrome 88+ (Manifest V3)
- Node.js (optionnel, pour les outils de développement)

### 🔧 **Scripts de Développement**

#### Installation
```bash
# Installer les dépendances
npm install
```

#### Build
```bash
# Build de développement (rapide)
npm run dev

# Build de production
npm run build

# Build non minifié (debug)
npm run dev:unminified

# Mode watch (recompilation automatique)
npm run watch
```

#### Tests
```bash
# Mode watch interactif
npm test

# Exécution unique
npm run test:run

# Interface graphique
npm run test:ui

# Rapport de couverture
npm run test:coverage

# Tests End-to-End
npm run test:e2e
```

### 📝 **Contribution**
1. **Fork** le projet
2. **Créez** une branche pour votre fonctionnalité
3. **Commitez** vos changements
4. **Poussez** vers la branche
5. **Ouvrez** une Pull Request

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 🙏 Remerciements

- **Chrome Extensions Team** pour l'API Manifest V3
- **Communauté open source** pour les contributions
- **Utilisateurs** pour les retours et suggestions

## 📞 Support

### 🐛 **Signaler un Bug**
1. **Recherchez** dans les issues existantes
2. **Créez** une nouvelle issue avec :
   - Description du problème
   - Étapes pour reproduire
   - Logs de la console
   - Version de Chrome

### 💡 **Suggérer une Fonctionnalité**
1. **Vérifiez** que la fonctionnalité n'existe pas déjà
2. **Créez** une issue avec le label "enhancement"
3. **Décrivez** clairement votre idée
4. **Expliquez** pourquoi elle serait utile

### 📧 **Contact**
- **GitHub Issues** : Pour les bugs et suggestions

---

**⭐ Si vous aimez LikeThat, n'hésitez pas à donner une étoile sur GitHub !**