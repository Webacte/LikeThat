import fs from 'fs';
import path from 'path';

const manifestPath = path.join('dist', 'manifest.json');

if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  // Corriger les chemins pour le build
  manifest.background.service_worker = 'background.js';
  manifest.content_scripts[0].js = ['i18n.js', 'content.js'];
  delete manifest.content_scripts[0].css; // Les styles sont maintenant dans le content script React
  
  // Supprimer la section icons (non utilisée par l'extension)
  delete manifest.icons;
  
  // Corriger les ressources web accessibles
  manifest.web_accessible_resources[0].resources = ['assets/icons/*'];
  
  // Vérifier que les fichiers essentiels existent
  const requiredFiles = [
    'dist/background.js',
    'dist/i18n.js', 
    'dist/content.js'
  ];
  
  const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
  if (missingFiles.length > 0) {
    console.warn('⚠️ Fichiers essentiels manquants:', missingFiles);
  }
  
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('✅ Manifest corrigé pour le build');
  console.log('📁 Fichiers vérifiés:', requiredFiles.length - missingFiles.length, '/', requiredFiles.length);
} else {
  console.error('❌ Fichier manifest.json non trouvé dans dist/');
}
