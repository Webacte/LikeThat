import { execSync } from 'child_process';
import fs from 'fs';

function buildAndCopy() {
  try {
    console.log('🔄 Build en cours...');
    
    // 1. Build Vite
    execSync('npm run build', { stdio: 'inherit' });
    
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
    
    console.log('✅ Build terminé avec succès !');
    console.log('📁 Extension prête dans le dossier dist/');
    console.log('');
    
  } catch (error) {
    console.error('❌ Erreur lors du build:', error.message);
  }
}

function main() {
  console.log('🎯 Mode développement simple - LikeThat React');
  console.log('==============================================');
  console.log('💡 Ce script fait un build complet à chaque exécution');
  console.log('🔄 Utilisez-le quand vous voulez recompiler après des modifications');
  console.log('');
  
  buildAndCopy();
  
  console.log('📋 Prochaines étapes :');
  console.log('1. Ouvrir chrome://extensions/');
  console.log('2. Activer le "Mode développeur"');
  console.log('3. Cliquer sur "Charger l\'extension non empaquetée"');
  console.log('4. Sélectionner le dossier dist/');
  console.log('');
  console.log('🔄 Pour recompiler après modifications, relancez ce script');
}

main();
