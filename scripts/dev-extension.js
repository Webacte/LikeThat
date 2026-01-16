import { spawn } from 'child_process';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

let viteProcess = null;

// Fonction pour copier les fichiers nécessaires
function copyRequiredFiles() {
  try {
    console.log('📄 Copie des fichiers requis...');
    
    // Copier le manifest
    if (fs.existsSync('manifest.json')) {
      execSync('copy manifest.json dist\\', { stdio: 'inherit' });
    }
    
    // Copier les assets
    if (fs.existsSync('src/assets')) {
      execSync('xcopy /E /I src\\assets dist\\assets', { stdio: 'inherit' });
    }
    
    // Corriger le manifest
    execSync('node scripts/fix-manifest.js', { stdio: 'inherit' });
    
    console.log('✅ Fichiers copiés avec succès');
  } catch (error) {
    console.error('❌ Erreur lors de la copie:', error.message);
  }
}

// Fonction pour démarrer Vite en mode watch
function startVite() {
  console.log('🚀 Démarrage de Vite en mode watch...');
  
  viteProcess = spawn('npx', ['vite', 'build', '--watch'], {
    stdio: 'inherit',
    shell: true
  });

  viteProcess.on('error', (error) => {
    console.error('❌ Erreur Vite:', error);
  });

  viteProcess.on('exit', (code) => {
    console.log(`📦 Vite terminé avec le code ${code}`);
  });

  // Écouter les événements de compilation
  viteProcess.stdout?.on('data', (data) => {
    const output = data.toString();
    if (output.includes('built in') || output.includes('transformed')) {
      console.log('🔄 Recompilation détectée, copie des fichiers...');
      setTimeout(() => {
        copyRequiredFiles();
      }, 1000);
    }
  });
}

// Fonction principale
async function startDevMode() {
  console.log('🎯 Mode développement LikeThat React');
  console.log('=====================================');
  
  try {
    // Nettoyer le dossier dist
    if (fs.existsSync('dist')) {
      console.log('🧹 Nettoyage du dossier dist...');
      fs.rmSync('dist', { recursive: true, force: true });
    }

    // Démarrer Vite
    startVite();
    
    // Attendre un peu pour que Vite compile
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Copier les fichiers initiaux
    copyRequiredFiles();
    
    console.log('✅ Mode développement démarré !');
    console.log('📝 Modifiez vos fichiers React dans src/');
    console.log('🔄 Les changements seront automatiquement compilés et copiés');
    console.log('');
    console.log('💡 Pour arrêter: Ctrl+C');

    // Gestion de l'arrêt propre
    process.on('SIGINT', () => {
      console.log('\n🛑 Arrêt du mode développement...');
      if (viteProcess) {
        viteProcess.kill();
      }
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Erreur lors du démarrage du mode développement:', error);
    process.exit(1);
  }
}

startDevMode();