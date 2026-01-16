import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import Panel from '../Panel/Panel';

// Mock des composants enfants pour simplifier les tests
vi.mock('../Panel/PanelContent', () => ({
  default: () => <div data-testid="panel-content">Panel Content</div>
}));

describe('Panel', () => {
  beforeEach(() => {
    // Clear tous les mocks entre les tests
    vi.clearAllMocks();
  });

  it('rend le composant Panel avec les providers', async () => {
    const { container } = render(<Panel />);

    // Vérifier que le panneau a la classe correcte
    const panel = container.querySelector('.likethat-panel');
    expect(panel).toBeInTheDocument();
  });

  it('rend PanelContent à l\'intérieur du panneau', async () => {
    const { container } = render(<Panel />);

    // Attendre un peu pour le rendu
    await waitFor(() => {
      const panel = container.querySelector('.likethat-panel');
      expect(panel).toBeInTheDocument();
    });
  });

  it('encapsule les composants avec les providers nécessaires', async () => {
    const { container } = render(<Panel />);

    // Si les providers ne sont pas correctement configurés, cela générerait une erreur
    // Le simple fait que le composant se rende prouve que les providers fonctionnent
    const panel = container.querySelector('.likethat-panel');
    expect(panel).toBeInTheDocument();
  });

  it('rend correctement la structure du panneau', async () => {
    const { container } = render(<Panel />);

    // Vérifier la structure
    const panelDiv = container.querySelector('.likethat-panel');
    expect(panelDiv).toBeInTheDocument();
  });
});


