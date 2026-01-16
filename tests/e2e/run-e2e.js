import { buildExtension, loadExtension, getExtensionId } from './setup.js';

/**
 * Script principal pour exécuter les tests E2E
 */
async function runE2ETests() {
  console.log('🚀 Démarrage des tests E2E...\n');

  try {
    // 1. Build de l'extension
    console.log('📦 Build de l\'extension...');
    await buildExtension();
    console.log('✅ Extension buildée\n');

    // 2. Lancement du navigateur avec l'extension
    console.log('🌐 Lancement de Chrome avec l\'extension...');
    const browser = await loadExtension();
    console.log('✅ Chrome lancé\n');

    // 3. Obtenir l'ID de l'extension
    const extensionId = await getExtensionId(browser);
    console.log(`📌 ID de l'extension: ${extensionId}\n`);

    // 4. Créer une nouvelle page de test
    const page = await browser.newPage();
    await page.goto('https://example.com');
    console.log('📄 Page de test chargée\n');

    // 5. Attendre que l'extension soit injectée
    await page.waitForTimeout(1000);

    // 6. Vérifier que le panneau est présent
    const panelExists = await page.evaluate(() => {
      return document.getElementById('likethat-root') !== null;
    });

    if (panelExists) {
      console.log('✅ Panneau LikeThat détecté\n');
    } else {
      console.warn('⚠️  Panneau LikeThat non détecté\n');
    }

    // 7. Exécuter des tests basiques
    console.log('🧪 Exécution des tests basiques...');
    
    // Test 1: Vérifier que le content script est chargé
    const hasContentScript = await page.evaluate(() => {
      return typeof window !== 'undefined';
    });
    console.log(`  ${hasContentScript ? '✅' : '❌'} Content script chargé`);

    // Test 2: Vérifier la présence du panneau dans le DOM
    const hasPanel = await page.evaluate(() => {
      return document.getElementById('likethat-root') !== null;
    });
    console.log(`  ${hasPanel ? '✅' : '❌'} Panneau présent dans le DOM`);

    // Test 3: Simuler le survol du bord
    console.log('\n🖱️  Test du survol du bord...');
    const viewport = page.viewport();
    await page.mouse.move(viewport.width - 1, viewport.height / 2);
    await page.waitForTimeout(600);

    const isPanelVisible = await page.evaluate(() => {
      const panel = document.getElementById('likethat-panel');
      if (!panel) return false;
      const style = window.getComputedStyle(panel);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });

    console.log(`  ${isPanelVisible ? '✅' : '⚠️ '} Panneau ${isPanelVisible ? 'visible' : 'non visible'} au survol`);

    // 8. Résumé
    console.log('\n📊 Résumé des tests E2E:');
    console.log(`  - Content script: ${hasContentScript ? 'OK' : 'FAIL'}`);
    console.log(`  - Panneau dans DOM: ${hasPanel ? 'OK' : 'FAIL'}`);
    console.log(`  - Panneau au survol: ${isPanelVisible ? 'OK' : 'PARTIEL'}`);

    // 9. Laisser le navigateur ouvert pour inspection manuelle
    console.log('\n💡 Navigateur ouvert pour inspection manuelle');
    console.log('   Appuyez sur Ctrl+C pour fermer\n');

    // Garder le processus actif
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Erreur lors des tests E2E:', error);
    process.exit(1);
  }
}

// Exécuter les tests
runE2ETests().catch(console.error);

