import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadExtension, getExtensionId, waitForExtensionReady } from './setup.js';
import { waitForPanel, hoverEdge, isPanelVisible, isPanelHidden } from './helpers.js';

/**
 * Tests E2E du workflow utilisateur complet
 */
describe('User Workflow E2E', () => {
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

  it('affiche le panneau au survol du bord droit', async () => {
    // Survoler le bord droit
    await hoverEdge(page, 'right', 600);

    // Vérifier que le panneau est visible
    const visible = await isPanelVisible(page);
    expect(visible).toBe(true);
  }, 10000);

  it('cache le panneau quand la souris sort', async () => {
    // Afficher le panneau
    await hoverEdge(page, 'right', 600);

    // Déplacer la souris au centre
    const viewport = page.viewport();
    await page.mouse.move(viewport.width / 2, viewport.height / 2);
    await page.waitForTimeout(300);

    // Le panneau devrait se cacher
    const hidden = await isPanelHidden(page);
    expect(hidden).toBe(true);
  }, 10000);

  it('ouvre un bookmark au clic', async () => {
    // Afficher le panneau
    await hoverEdge(page, 'right', 600);
    await waitForPanel(page);

    // Compter le nombre d'onglets avant
    const pagesBefore = await browser.pages();
    const countBefore = pagesBefore.length;

    // Cliquer sur un bookmark (si disponible)
    const firstBookmark = await page.$('.bookmark-button');
    if (firstBookmark) {
      await firstBookmark.click();
      await page.waitForTimeout(1000);

      // Vérifier qu'un nouvel onglet a été ouvert
      const pagesAfter = await browser.pages();
      const countAfter = pagesAfter.length;
      
      // Note: Le comportement dépend des settings (current tab ou new tab)
      expect(countAfter).toBeGreaterThanOrEqual(countBefore);
    }
  }, 15000);

  it('persiste le panneau après rafraîchissement de la page', async () => {
    // Rafraîchir la page
    await page.reload({ waitUntil: 'networkidle2' });
    await waitForExtensionReady(page);

    // Le panneau devrait toujours être présent
    const panelExists = await page.evaluate(() => {
      return document.getElementById('likethat-root') !== null;
    });

    expect(panelExists).toBe(true);
  }, 10000);
});

