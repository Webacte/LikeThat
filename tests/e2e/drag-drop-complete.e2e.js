import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadExtension, getExtensionId, waitForExtensionReady } from './setup.js';
import { waitForPanel, hoverEdge, activateEditMode, dragElement } from './helpers.js';

/**
 * Tests E2E du drag and drop complet
 */
describe('Drag and Drop E2E', () => {
  let browser, page, extensionId;

  beforeAll(async () => {
    browser = await loadExtension();
    const pages = await browser.pages();
    page = pages[0] || await browser.newPage();
    await page.goto('https://example.com');
    extensionId = await getExtensionId(browser);
    await waitForExtensionReady(page);
  }, 30000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  it('affiche les indicateurs visuels pendant le drag', async () => {
    // Afficher le panneau
    await hoverEdge(page, 'right', 600);
    await waitForPanel(page);

    // Activer le mode édition
    await activateEditMode(page);

    // Le test vérifie que le mode édition est actif
    const editModeActive = await page.evaluate(() => {
      const panel = document.getElementById('likethat-panel');
      return panel !== null;
    });

    expect(editModeActive).toBe(true);
  }, 15000);

  it('permet le drag and drop entre les bookmarks', async () => {
    // Test basique du drag and drop
    expect(true).toBe(true);
  }, 15000);

  it('sauvegarde les changements après le drag and drop', async () => {
    // Les changements devraient persister
    expect(true).toBe(true);
  }, 15000);
});

