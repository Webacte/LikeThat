import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🚀 Début du build de l\'extension LikeThat React...\n');

try {
  // 1. Build Vite
  console.log('📦 Compilation avec Vite...');
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Compilation Vite terminée\n');

  // 2. Copie du manifest
  console.log('📄 Copie du manifest...');
  execSync('npm run copy:manifest', { stdio: 'inherit' });
  console.log('✅ Manifest copié\n');

  // 3. Copie des assets
  console.log('🎨 Copie des assets...');
  execSync('npm run copy:assets', { stdio: 'inherit' });
  console.log('✅ Assets copiés\n');

  // 4. Correction du manifest
  console.log('🔧 Correction du manifest...');
  execSync('npm run fix:manifest', { stdio: 'inherit' });
  console.log('✅ Manifest corrigé\n');

  // 5. Vérification finale
  console.log('🔍 Vérification finale...');
  const requiredFiles = [
    'dist/manifest.json',
    'dist/background.js',
    'dist/content.js',
    'dist/i18n.js'
  ];

  const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
  
  if (missingFiles.length === 0) {
    console.log('🎉 Build terminé avec succès !');
    console.log('📁 Extension prête dans le dossier dist/');
    console.log('\n📋 Prochaines étapes :');
    console.log('1. Ouvrir chrome://extensions/');
    console.log('2. Activer le "Mode développeur"');
    console.log('3. Cliquer sur "Charger l\'extension non empaquetée"');
    console.log('4. Sélectionner le dossier dist/');
  } else {
    console.error('❌ Fichiers manquants :', missingFiles);
    process.exit(1);
  }

} catch (error) {
  console.error('❌ Erreur lors du build:', error.message);
  process.exit(1);
}
