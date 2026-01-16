import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Charge l'extension Chrome dans Puppeteer
 * @returns {Promise<Browser>} Instance du navigateur avec l'extension chargée
 */
export async function loadExtension() {
  const extensionPath = path.resolve(__dirname, '../../dist');

  const browser = await puppeteer.launch({
    headless: false, // Les extensions nécessitent le mode avec interface
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security'
    ],
    defaultViewport: {
      width: 1280,
      height: 720
    }
  });

  return browser;
}

/**
 * Trouve l'ID de l'extension dans les pages d'extension
 * @param {Browser} browser - Instance du navigateur
 * @returns {Promise<string>} ID de l'extension
 */
export async function getExtensionId(browser) {
  const targets = await browser.targets();
  const extensionTarget = targets.find(target => 
    target.type() === 'service_worker' && 
    target.url().includes('chrome-extension://')
  );

  if (!extensionTarget) {
    throw new Error('Extension non trouvée');
  }

  const url = extensionTarget.url();
  const matches = url.match(/chrome-extension:\/\/([a-z]+)\//);
  
  if (!matches || !matches[1]) {
    throw new Error('Impossible de trouver l\'ID de l\'extension');
  }

  return matches[1];
}

/**
 * Attend que l'extension soit prête
 * @param {Page} page - Page Puppeteer
 * @param {number} timeout - Timeout en ms
 */
export async function waitForExtensionReady(page, timeout = 5000) {
  await page.waitForFunction(
    () => document.getElementById('likethat-root') !== null,
    { timeout }
  );
}

/**
 * Build l'extension avant les tests E2E
 * @returns {Promise<void>}
 */
export async function buildExtension() {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execPromise = promisify(exec);

  console.log('Building extension...');
  await execPromise('npm run build:extension');
  console.log('Extension built successfully');
}

/**
 * Configuration de base pour les tests E2E
 */
export const E2E_CONFIG = {
  timeout: 30000,
  slowMo: 50, // Ralentir les actions pour les rendre visibles
  devtools: false // Ouvrir DevTools automatiquement
};

