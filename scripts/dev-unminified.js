import { execSync } from 'child_process';
import fs from 'fs';

function buildUnminified() {
  try {
    console.log('🔄 Build non-minifié en cours...');
    
    // 1. Build Vite en mode développement (non-minifié)
    execSync('npx vite build --mode development', { stdio: 'inherit' });
    
    // 2. Copier le manifest
    if (fs.existsSync('manifest.json')) {
      execSync('copy manifest.json dist\\', { stdio: 'inherit' });
    }
    
    // 3. Copier les assets
    if (fs.existsSync('src/assets')) {
      execSync('xcopy /E /I src\\assets dist\\assets', { stdio: 'inherit' });
    }
    
    // 4. Corriger le manifest
    execSync('node scripts/fix-manifest.js', { stdio: 'inherit' });
    
    console.log('✅ Build non-minifié terminé avec succès !');
    console.log('📁 Extension prête dans le dossier dist/');
    console.log('🔍 Code non-minifié pour faciliter le débogage');
    console.log('');
    
  } catch (error) {
    console.error('❌ Erreur lors du build:', error.message);
  }
}

function main() {
  console.log('🎯 Mode développement non-minifié - LikeThat React');
  console.log('==================================================');
  console.log('💡 Ce script génère du code non-minifié pour faciliter le débogage');
  console.log('🔄 Utilisez-le quand vous voulez déboguer ou inspecter le code');
  console.log('');
  
  buildUnminified();
  
  console.log('📋 Prochaines étapes :');
  console.log('1. Ouvrir chrome://extensions/');
  console.log('2. Activer le "Mode développeur"');
  console.log('3. Cliquer sur "Charger l\'extension non empaquetée"');
  console.log('4. Sélectionner le dossier dist/');
  console.log('');
  console.log('🔍 Le code sera lisible dans les DevTools de Chrome');
  console.log('🔄 Pour recompiler après modifications, relancez ce script');
}

main();
