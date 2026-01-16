/**
 * Helpers pour les tests E2E
 */

/**
 * Attend que le panneau soit visible
 * @param {Page} page - Page Puppeteer
 * @param {number} timeout - Timeout en ms
 */
export async function waitForPanel(page, timeout = 5000) {
  await page.waitForSelector('#likethat-panel', { 
    visible: true,
    timeout 
  });
}

/**
 * Survole le bord de l'écran pour déclencher le panneau
 * @param {Page} page - Page Puppeteer
 * @param {string} side - 'left' ou 'right'
 * @param {number} delay - Délai en ms
 */
export async function hoverEdge(page, side = 'right', delay = 600) {
  const viewport = page.viewport();
  const x = side === 'right' ? viewport.width - 1 : 1;
  const y = viewport.height / 2;

  await page.mouse.move(x, y);
  await page.waitForTimeout(delay);
}

/**
 * Active le mode édition
 * @param {Page} page - Page Puppeteer
 */
export async function activateEditMode(page) {
  await waitForPanel(page);
  
  const editButton = await page.$('.panel-edit-toggle');
  if (editButton) {
    await editButton.click();
    await page.waitForTimeout(200);
  }
}

/**
 * Ouvre un dossier dans le panneau
 * @param {Page} page - Page Puppeteer
 * @param {string} folderTitle - Titre du dossier
 */
export async function openFolder(page, folderTitle) {
  await waitForPanel(page);
  
  const folderButton = await page.$(`button[title="${folderTitle}"]`);
  if (folderButton) {
    await folderButton.click();
    await page.waitForTimeout(300);
  }
}

/**
 * Drag un élément vers une cible
 * @param {Page} page - Page Puppeteer
 * @param {string} sourceSelector - Sélecteur de la source
 * @param {string} targetSelector - Sélecteur de la cible
 */
export async function dragElement(page, sourceSelector, targetSelector) {
  const source = await page.$(sourceSelector);
  const target = await page.$(targetSelector);

  if (!source || !target) {
    throw new Error('Source ou cible non trouvée');
  }

  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();

  // Démarrer le drag
  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2
  );
  await page.mouse.down();
  await page.waitForTimeout(100);

  // Déplacer vers la cible
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 10 }
  );
  await page.waitForTimeout(100);

  // Drop
  await page.mouse.up();
  await page.waitForTimeout(500);
}

/**
 * Vérifie que le panneau est visible
 * @param {Page} page - Page Puppeteer
 * @returns {Promise<boolean>}
 */
export async function isPanelVisible(page) {
  const panel = await page.$('#likethat-panel');
  if (!panel) return false;

  const isVisible = await panel.isVisible();
  return isVisible;
}

/**
 * Vérifie que le panneau est caché
 * @param {Page} page - Page Puppeteer
 * @returns {Promise<boolean>}
 */
export async function isPanelHidden(page) {
  const panel = await page.$('#likethat-panel');
  if (!panel) return true;

  const isVisible = await panel.isVisible();
  return !isVisible;
}

/**
 * Clique sur l'icône de l'extension
 * @param {Page} page - Page Puppeteer
 * @param {string} extensionId - ID de l'extension
 */
export async function clickExtensionIcon(page, extensionId) {
  // Navigation vers la popup de l'extension
  await page.goto(`chrome-extension://${extensionId}/src/pages/popup.html`);
  await page.waitForTimeout(500);
}

/**
 * Prend un screenshot pour debug
 * @param {Page} page - Page Puppeteer
 * @param {string} name - Nom du fichier
 */
export async function takeScreenshot(page, name) {
  await page.screenshot({ 
    path: `tests/e2e/screenshots/${name}.png`,
    fullPage: true
  });
}

/**
 * Attend un délai
 * @param {number} ms - Délai en millisecondes
 */
export async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Obtient le nombre de bookmarks dans le panneau
 * @param {Page} page - Page Puppeteer
 * @returns {Promise<number>}
 */
export async function getBookmarkCount(page) {
  await waitForPanel(page);
  
  const bookmarks = await page.$$('.bookmark-button, .bookmark-item');
  return bookmarks.length;
}

/**
 * Vérifie qu'un bookmark existe
 * @param {Page} page - Page Puppeteer
 * @param {string} title - Titre du bookmark
 * @returns {Promise<boolean>}
 */
export async function bookmarkExists(page, title) {
  await waitForPanel(page);
  
  const bookmark = await page.$(`button[title="${title}"], .bookmark-item[title="${title}"]`);
  return bookmark !== null;
}

