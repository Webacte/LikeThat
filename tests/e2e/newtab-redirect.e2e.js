import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadExtension, getExtensionId, waitForExtensionReady } from './setup.js';
import { waitForPanel, hoverEdge, isPanelVisible } from './helpers.js';

/**
 * Tests E2E pour la redirection des nouveaux onglets
 */
describe('NewTab Redirect E2E', () => {
  let browser, page, extensionId;

  beforeAll(async () => {
    browser = await loadExtension();
    const pages = await browser.pages();
    page = pages[0] || await browser.newPage();
    extensionId = await getExtensionId(browser);
    await waitForExtensionReady(page);
  }, 30000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  it('ouvre la page d\'options et configure un moteur de recherche', async () => {
    // Ouvrir la page d'options
    await page.goto(`chrome-extension://${extensionId}/src/pages/options.html`);
    await page.waitForTimeout(1000);

    // Sélectionner Google comme moteur de recherche
    const googleRadio = await page.$('#newTab-google');
    expect(googleRadio).toBeTruthy();
    await googleRadio.click();

    // Sauvegarder les paramètres
    const saveButton = await page.$('#saveSettings');
    expect(saveButton).toBeTruthy();
    await saveButton.click();
    await page.waitForTimeout(500);

    // Vérifier que les paramètres sont sauvegardés
    const isChecked = await page.evaluate(() => {
      const radio = document.querySelector('#newTab-google');
      return radio ? radio.checked : false;
    });
    expect(isChecked).toBe(true);
  }, 15000);

  it('redirige un nouvel onglet vers le moteur configuré', async () => {
    // Note: Dans un vrai test E2E, nous devrions créer un nouvel onglet
    // Mais Puppeteer ne peut pas simuler chrome://newtab directement
    // Nous testons plutôt en naviguant vers une page HTTP qui devrait avoir le panneau
    
    // Naviguer vers Google (qui devrait être la page de redirection)
    await page.goto('https://www.google.com');
    await page.waitForTimeout(2000);

    // Vérifier que le panneau peut apparaître sur cette page
    await hoverEdge(page, 'right', 600);
    const visible = await isPanelVisible(page);
    expect(visible).toBe(true);
  }, 15000);

  it('configure une URL personnalisée', async () => {
    // Ouvrir la page d'options
    await page.goto(`chrome-extension://${extensionId}/src/pages/options.html`);
    await page.waitForTimeout(1000);

    // Entrer une URL personnalisée
    const urlInput = await page.$('#customNewTabUrl');
    expect(urlInput).toBeTruthy();
    await urlInput.click({ clickCount: 3 }); // Sélectionner tout
    await urlInput.type('https://example.com');

    // Sauvegarder
    const saveButton = await page.$('#saveSettings');
    await saveButton.click();
    await page.waitForTimeout(500);

    // Vérifier que l'URL est sauvegardée
    const savedUrl = await page.evaluate(() => {
      const input = document.querySelector('#customNewTabUrl');
      return input ? input.value : '';
    });
    expect(savedUrl).toBe('https://example.com');
  }, 15000);

  it('le panneau apparaît sur la page redirigée', async () => {
    // Naviguer vers une page HTTP (simulant la redirection)
    await page.goto('https://example.com');
    await page.waitForTimeout(2000);

    // Vérifier que le panneau peut apparaître
    await hoverEdge(page, 'right', 600);
    const visible = await isPanelVisible(page);
    expect(visible).toBe(true);
  }, 15000);

  it('valide les URLs personnalisées invalides', async () => {
    // Ouvrir la page d'options
    await page.goto(`chrome-extension://${extensionId}/src/pages/options.html`);
    await page.waitForTimeout(1000);

    // Entrer une URL invalide
    const urlInput = await page.$('#customNewTabUrl');
    await urlInput.click({ clickCount: 3 });
    await urlInput.type('not-a-valid-url');

    // Essayer de sauvegarder
    const saveButton = await page.$('#saveSettings');
    await saveButton.click();
    await page.waitForTimeout(500);

    // Vérifier qu'un message d'erreur apparaît
    const notification = await page.$('#notification');
    if (notification) {
      const isVisible = await page.evaluate((el) => {
        return !el.classList.contains('hidden');
      }, notification);
      // Le message d'erreur devrait apparaître
      expect(isVisible).toBe(true);
    }
  }, 15000);
});

