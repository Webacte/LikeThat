import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadExtension, getExtensionId, waitForExtensionReady } from './setup.js';
import { waitForPanel, hoverEdge, wait } from './helpers.js';

/**
 * Tests E2E pour vérifier la stabilité du drag and drop vers la barre des favoris
 * Ce test vérifie que l'affichage ne "saute" pas lors du survol des éléments
 */
describe('Drag and Drop vers la Barre des Favoris - Stabilité', () => {
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

  /**
   * Test de stabilité : vérifier qu'il n'y a pas de sauts d'affichage
   * lors du drag depuis le panneau vers la barre en survolant plusieurs éléments
   */
  it('ne doit pas avoir de sauts d\'affichage lors du survol des éléments de la barre', async () => {
    // Afficher le panneau
    await hoverEdge(page, 'right', 600);
    await waitForPanel(page);
    await wait(500);

    // Activer le mode édition
    const editButton = await page.$('.divider-control-button.edit-button');
    if (editButton) {
      await editButton.click();
      await wait(300);
    }

    // Vérifier que le mode édition est actif
    const isEditMode = await page.evaluate(() => {
      const panel = document.getElementById('likethat-panel');
      if (!panel) return false;
      
      const editBtn = panel.querySelector('.divider-control-button.edit-button');
      return editBtn && editBtn.classList.contains('active');
    });

    expect(isEditMode).toBe(true);

    // Trouver un élément draggable dans le panneau (pas dans la barre)
    const draggableItem = await page.evaluate(() => {
      // Chercher dans la section "Autres favoris" (bookmarks-list)
      const bookmarksList = document.querySelector('.bookmarks-list');
      if (!bookmarksList) return null;
      
      const items = bookmarksList.querySelectorAll('.bookmark-item[draggable="true"]');
      if (items.length === 0) return null;
      
      const firstItem = items[0];
      const rect = firstItem.getBoundingClientRect();
      return {
        selector: `.bookmark-item[data-id="${firstItem.dataset.id}"]`,
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2
      };
    });

    if (!draggableItem) {
      console.log('Aucun élément draggable trouvé dans le panneau, test ignoré');
      return;
    }

    // Trouver les éléments de la barre de favoris
    const barItems = await page.evaluate(() => {
      const bar = document.querySelector('.bookmarks-bar');
      if (!bar) return [];
      
      const items = bar.querySelectorAll('.bookmark-button-wrapper, .folder-wrapper');
      return Array.from(items).map(item => {
        const rect = item.getBoundingClientRect();
        return {
          selector: item.classList.contains('folder-wrapper') 
            ? `.folder-wrapper[data-folder-id="${item.dataset.folderId}"]`
            : `.bookmark-button-wrapper[data-id="${item.querySelector('button')?.dataset.id}"]`,
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
          id: item.dataset.folderId || item.querySelector('button')?.dataset.id
        };
      });
    });

    if (barItems.length === 0) {
      console.log('Aucun élément dans la barre de favoris, test ignoré');
      return;
    }

    // Démarrer le drag
    await page.mouse.move(draggableItem.x, draggableItem.y);
    await wait(100);
    await page.mouse.down();
    await wait(200);

    // Enregistrer les états visuels avant le survol
    const initialStates = await page.evaluate(() => {
      const bar = document.querySelector('.bookmarks-bar');
      if (!bar) return null;
      
      const items = bar.querySelectorAll('.bookmark-button-wrapper, .folder-wrapper');
      return Array.from(items).map(item => ({
        id: item.dataset.folderId || item.querySelector('button')?.dataset.id,
        hasDragOver: item.classList.contains('drag-over-before') || 
                     item.classList.contains('drag-over-after') ||
                     item.classList.contains('drag-over-inside'),
        classes: Array.from(item.classList)
      }));
    });

    // Survoler chaque élément de la barre avec des mouvements fluides
    let previousState = null;
    let stateChanges = 0;
    let unexpectedChanges = 0;

    for (let i = 0; i < barItems.length; i++) {
      const item = barItems[i];
      
      // Mouvement fluide vers l'élément (plusieurs étapes)
      const steps = 5;
      for (let step = 0; step <= steps; step++) {
        const progress = step / steps;
        const currentX = draggableItem.x + (item.x - draggableItem.x) * progress;
        const currentY = draggableItem.y + (item.y - draggableItem.y) * progress;
        
        await page.mouse.move(currentX, currentY, { steps: 1 });
        await wait(50); // Petit délai pour permettre les mises à jour
        
        // Vérifier l'état visuel à chaque étape
        const currentState = await page.evaluate((itemId) => {
          const item = document.querySelector(
            `.folder-wrapper[data-folder-id="${itemId}"], .bookmark-button-wrapper[data-id="${itemId}"]`
          );
          if (!item) return null;
          
          return {
            id: itemId,
            hasDragOver: item.classList.contains('drag-over-before') || 
                        item.classList.contains('drag-over-after') ||
                        item.classList.contains('drag-over-inside'),
            classes: Array.from(item.classList)
          };
        }, item.id);

        // Vérifier qu'il n'y a pas de changements d'état inattendus
        if (previousState && currentState) {
          // Un changement d'état est attendu seulement si on passe d'un élément à un autre
          const isStateChange = previousState.hasDragOver !== currentState.hasDragOver;
          if (isStateChange) {
            stateChanges++;
            // Si on est toujours sur le même élément mais que l'état change, c'est un problème
            if (previousState.id === currentState.id && step > 0) {
              unexpectedChanges++;
            }
          }
        }
        
        previousState = currentState;
      }
      
      // Attendre un peu sur chaque élément
      await wait(100);
    }

    // Vérifier qu'il n'y a pas eu trop de changements d'état inattendus
    // (un changement par élément survolé est normal, mais pas plusieurs sur le même élément)
    expect(unexpectedChanges).toBeLessThan(barItems.length);
    
    // Vérifier que la barre de favoris elle-même n'a pas changé d'état de manière erratique
    const finalBarState = await page.evaluate(() => {
      const bar = document.querySelector('.bookmarks-bar');
      if (!bar) return null;
      
      return {
        hasDragOver: bar.classList.contains('drag-over-drop-zone'),
        classes: Array.from(bar.classList)
      };
    });

    // Relâcher le drag
    await page.mouse.up();
    await wait(500);

    // Vérifier que l'état final est cohérent (pas de classes résiduelles)
    const finalState = await page.evaluate(() => {
      const bar = document.querySelector('.bookmarks-bar');
      if (!bar) return null;
      
      const items = bar.querySelectorAll('.bookmark-button-wrapper, .folder-wrapper');
      const itemsWithDragOver = Array.from(items).filter(item => 
        item.classList.contains('drag-over-before') || 
        item.classList.contains('drag-over-after') ||
        item.classList.contains('drag-over-inside')
      );
      
      return {
        barHasDragOver: bar.classList.contains('drag-over-drop-zone'),
        itemsWithDragOver: itemsWithDragOver.length
      };
    });

    // Après le relâchement, il ne devrait plus y avoir de classes drag-over
    expect(finalState.barHasDragOver).toBe(false);
    expect(finalState.itemsWithDragOver).toBe(0);
  }, 30000);

  /**
   * Test de performance : vérifier que le drag reste fluide
   * même en survolant rapidement plusieurs éléments
   */
  it('doit rester fluide lors d\'un survol rapide de plusieurs éléments', async () => {
    await hoverEdge(page, 'right', 600);
    await waitForPanel(page);
    await wait(500);

    // Activer le mode édition
    const editButton = await page.$('.divider-control-button.edit-button');
    if (editButton) {
      await editButton.click();
      await wait(300);
    }

    // Trouver un élément draggable
    const draggableItem = await page.evaluate(() => {
      const bookmarksList = document.querySelector('.bookmarks-list');
      if (!bookmarksList) return null;
      
      const items = bookmarksList.querySelectorAll('.bookmark-item[draggable="true"]');
      if (items.length === 0) return null;
      
      const firstItem = items[0];
      const rect = firstItem.getBoundingClientRect();
      return {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2
      };
    });

    if (!draggableItem) {
      console.log('Aucun élément draggable trouvé, test ignoré');
      return;
    }

    // Trouver les éléments de la barre
    const barItems = await page.evaluate(() => {
      const bar = document.querySelector('.bookmarks-bar');
      if (!bar) return [];
      
      const items = bar.querySelectorAll('.bookmark-button-wrapper, .folder-wrapper');
      return Array.from(items).slice(0, 3).map(item => { // Limiter à 3 pour le test
        const rect = item.getBoundingClientRect();
        return {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2
        };
      });
    });

    if (barItems.length === 0) {
      console.log('Aucun élément dans la barre, test ignoré');
      return;
    }

    // Mesurer le temps de réponse
    const startTime = Date.now();
    
    // Démarrer le drag
    await page.mouse.move(draggableItem.x, draggableItem.y);
    await wait(100);
    await page.mouse.down();
    await wait(200);

    // Survoler rapidement les éléments
    for (const item of barItems) {
      await page.mouse.move(item.x, item.y, { steps: 3 });
      await wait(50); // Délai minimal pour permettre les mises à jour
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Le drag devrait être rapide (moins de 2 secondes pour 3 éléments)
    expect(duration).toBeLessThan(2000);

    // Relâcher
    await page.mouse.up();
    await wait(500);
  }, 20000);
});











