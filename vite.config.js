import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';
import { transform } from 'esbuild';

// Plugin pour convertir content.js en format IIFE
const convertContentToIIFE = () => {
  return {
    name: 'convert-content-to-iife',
    async writeBundle(options, bundle) {
      const contentFile = bundle['content.js'];
      if (contentFile) {
        const contentPath = resolve(options.dir, 'content.js');
        if (fs.existsSync(contentPath)) {
          console.log('🔄 Conversion de content.js en format IIFE...');
          const content = fs.readFileSync(contentPath, 'utf8');
          
          // Utiliser esbuild pour convertir en IIFE
          try {
            const result = await transform(content, {
              format: 'iife',
              target: 'es2020',
              loader: 'js',
              globalName: 'LikeThatContent'
            });
            
            fs.writeFileSync(contentPath, result.code, 'utf8');
            console.log('✅ content.js converti en format IIFE');
          } catch (error) {
            console.error('❌ Erreur lors de la conversion:', error);
            // Fallback: wrapper simple
            if (!content.trim().startsWith('(function')) {
              const wrapped = `(function() {\n'use strict';\n${content}\n})();`;
              fs.writeFileSync(contentPath, wrapped, 'utf8');
            }
          }
        }
      }
    }
  };
};

export default defineConfig(({ command }) => ({
  plugins: [react(), convertContentToIIFE()],
  build: {
    outDir: 'dist',
    minify: command === 'build' ? 'esbuild' : false, // Minifier en production uniquement
    sourcemap: command === 'build' ? false : true, // Pas de sourcemap en production pour réduire la taille
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content.jsx'),
        background: resolve(__dirname, 'src/scripts/background.js'),
        i18n: resolve(__dirname, 'src/scripts/i18n.js'),
        options: resolve(__dirname, 'src/scripts/options.js'),
        popup: resolve(__dirname, 'src/scripts/popup.js'),
        'popup-html': resolve(__dirname, 'src/pages/popup.html'),
        'options-html': resolve(__dirname, 'src/pages/options.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        format: 'es', // Format ES module (tous les imports seront résolus dans le bundle)
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith('.html')) {
            return '[name].[ext]';
          }
          return 'assets/[name].[ext]';
        }
      }
    },
    // Optimiser les chunks pour réduire la taille
    chunkSizeWarningLimit: 1000,
    // Activer la compression et l'optimisation
    target: 'es2020', // Target compatible avec les extensions Chrome
    cssCodeSplit: false // Pas de split CSS pour les extensions (tout dans un seul fichier)
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
}));
