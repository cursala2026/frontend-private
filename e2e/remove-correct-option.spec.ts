/**
 * E2E – Eliminación de opciones en el editor de cuestionarios
 *
 * Cubre el bug: al hacer click en "Eliminar" sobre la opción marcada como
 * correcta, el sistema eliminaba la ÚLTIMA opción de la lista en lugar de
 * la opción seleccionada. Causa: `track option` en el @for del template
 * causaba que Angular reutilizara nodos DOM por identidad de objeto, no por
 * posición, produciendo una eliminación visual incorrecta.
 *
 * Fix aplicado: cambiar `track option` → `track $index`.
 */
import { test, expect, Page, Route } from '@playwright/test';
import { injectProfesorAuth } from './helpers/auth';

const API = 'http://localhost:8081/api/v1';
const QID = 'remove-option-test-000000000';
const COURSE_ID = 'remove-option-course-0000000';

// ── Helper: montar mocks de API ──────────────────────────────────────────────

async function setupMocks(page: Page, hasSubmissions = false) {
  const questionnaire = {
    _id: QID,
    courseId: COURSE_ID,
    title: 'Test eliminar opción correcta',
    status: 'ACTIVE',
    position: { type: 'FINAL_EXAM' },
    passingScore: 60,
    allowRetries: false,
    showCorrectAnswers: true,
    questions: [
      {
        _id: 'q1',
        type: 'MULTIPLE_CHOICE',
        questionText: '¿Cuál es la respuesta correcta?',
        order: 0,
        points: 10,
        required: true,
        options: [
          { _id: 'o1', text: 'Alpha', order: 0 },
          { _id: 'o2', text: 'Beta',  order: 1 },
          { _id: 'o3', text: 'Gamma', order: 2 },
          { _id: 'o4', text: 'Delta', order: 3 },
        ],
        correctOptionId: 'o2', // Beta es la correcta
      },
    ],
  };

  await page.route(`${API}/questionnaires/${QID}`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: questionnaire }),
    })
  );

  await page.route(`${API}/questionnaires/${QID}/has-submissions`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { hasSubmissions } }),
    })
  );

  await page.route(`${API}/class/course/${COURSE_ID}/classes`, (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
  );

  await page.route(`${API}/questionnaires/course/${COURSE_ID}`, (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
  );

  // Mock PATCH para que guardar no falle
  await page.route(`${API}/questionnaires/${QID}`, (route: Route) => {
    if (route.request().method() === 'PATCH') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: questionnaire }) });
      return;
    }
    route.continue();
  });
}

// ── Helper: obtener textos visibles de las opciones ──────────────────────────

async function getOptionTexts(page: Page): Promise<string[]> {
  const firstQuestion = page.locator('app-question-item').first();
  const inputs = firstQuestion.locator('input[formcontrolname="text"]');
  const count = await inputs.count();
  const texts: string[] = [];
  for (let i = 0; i < count; i++) {
    texts.push(await inputs.nth(i).inputValue());
  }
  return texts;
}

// ── Helper: navegar y esperar formulario ─────────────────────────────────────

async function navigateToEdit(page: Page) {
  await page.goto(`/profesor/questionnaires/${QID}/edit`);
  await page.waitForSelector('button:has-text("Actualizar Cuestionario")', { timeout: 20000 });
  await page.waitForSelector('app-question-item', { timeout: 10000 });
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('Eliminación de opciones en editor de cuestionario', () => {

  /**
   * Caso 1 (Bug principal): eliminar la opción CORRECTA
   * Debe desaparecer la opción marcada, no la última.
   */
  test('eliminar la opción correcta elimina la opción seleccionada, no la última', async ({ page }) => {
    await injectProfesorAuth(page);
    await setupMocks(page, false);
    await navigateToEdit(page);

    // Verificar estado inicial: 4 opciones con textos esperados
    const before = await getOptionTexts(page);
    expect(before).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta']);

    // Localizar el botón "Eliminar" de la segunda opción (índice 1 = "Beta", la correcta)
    const firstQuestion = page.locator('app-question-item').first();
    const deleteButtons = firstQuestion.locator('button:has-text("Eliminar")');
    await expect(deleteButtons).toHaveCount(4);

    // Hacer click en "Eliminar" de la segunda opción (Beta, que es la correcta)
    await deleteButtons.nth(1).click();
    await page.waitForTimeout(300);

    // Debe haber quedado exactamente 3 opciones
    const after = await getOptionTexts(page);
    expect(after).toHaveLength(3);

    // "Beta" debe haberse ido; el resto debe estar en orden
    expect(after).not.toContain('Beta');
    expect(after[0]).toBe('Alpha');
    expect(after[1]).toBe('Gamma');
    expect(after[2]).toBe('Delta');

    // "Delta" (la última) debe seguir presente — esto fallaba con el bug
    expect(after).toContain('Delta');
  });

  /**
   * Caso 2: eliminar la primera opción cuando hay 4
   */
  test('eliminar la primera opción deja las 3 restantes en orden correcto', async ({ page }) => {
    await injectProfesorAuth(page);
    await setupMocks(page, false);
    await navigateToEdit(page);

    const firstQuestion = page.locator('app-question-item').first();
    const deleteButtons = firstQuestion.locator('button:has-text("Eliminar")');

    await deleteButtons.nth(0).click(); // eliminar "Alpha"
    await page.waitForTimeout(300);

    const after = await getOptionTexts(page);
    expect(after).toHaveLength(3);
    expect(after[0]).toBe('Beta');
    expect(after[1]).toBe('Gamma');
    expect(after[2]).toBe('Delta');
  });

  /**
   * Caso 3: eliminar la última opción
   */
  test('eliminar la última opción deja las 3 primeras en orden correcto', async ({ page }) => {
    await injectProfesorAuth(page);
    await setupMocks(page, false);
    await navigateToEdit(page);

    const firstQuestion = page.locator('app-question-item').first();
    const deleteButtons = firstQuestion.locator('button:has-text("Eliminar")');

    await deleteButtons.nth(3).click(); // eliminar "Delta"
    await page.waitForTimeout(300);

    const after = await getOptionTexts(page);
    expect(after).toHaveLength(3);
    expect(after[0]).toBe('Alpha');
    expect(after[1]).toBe('Beta');
    expect(after[2]).toBe('Gamma');
  });

  /**
   * Caso 4: eliminar del medio (opción 2 = "Gamma")
   */
  test('eliminar una opción del medio deja el orden correcto', async ({ page }) => {
    await injectProfesorAuth(page);
    await setupMocks(page, false);
    await navigateToEdit(page);

    const firstQuestion = page.locator('app-question-item').first();
    const deleteButtons = firstQuestion.locator('button:has-text("Eliminar")');

    await deleteButtons.nth(2).click(); // eliminar "Gamma"
    await page.waitForTimeout(300);

    const after = await getOptionTexts(page);
    expect(after).toHaveLength(3);
    expect(after[0]).toBe('Alpha');
    expect(after[1]).toBe('Beta');
    expect(after[2]).toBe('Delta');
  });

  /**
   * Caso 5: eliminaciones múltiples consecutivas mantienen el orden
   */
  test('dos eliminaciones consecutivas mantienen el orden correcto', async ({ page }) => {
    await injectProfesorAuth(page);
    await setupMocks(page, false);
    await navigateToEdit(page);

    const firstQuestion = page.locator('app-question-item').first();

    // Primera eliminación: quitar "Beta" (índice 1)
    let deleteButtons = firstQuestion.locator('button:has-text("Eliminar")');
    await deleteButtons.nth(1).click();
    await page.waitForTimeout(300);

    // Estado intermedio: [Alpha, Gamma, Delta]
    const mid = await getOptionTexts(page);
    expect(mid).toEqual(['Alpha', 'Gamma', 'Delta']);

    // Segunda eliminación: quitar "Gamma" (ahora en índice 1)
    deleteButtons = firstQuestion.locator('button:has-text("Eliminar")');
    await deleteButtons.nth(1).click();
    await page.waitForTimeout(300);

    // Estado final: [Alpha, Delta] — botones Eliminar deben ocultarse (solo 2 opciones)
    const after = await getOptionTexts(page);
    expect(after).toHaveLength(2);
    expect(after[0]).toBe('Alpha');
    expect(after[1]).toBe('Delta');

    // Con 2 opciones, los botones Eliminar deben desaparecer
    const remainingDeleteBtns = await firstQuestion.locator('button:has-text("Eliminar")').count();
    expect(remainingDeleteBtns).toBe(0);
  });

  /**
   * Caso 6: con hasSubmissions=true, el botón Eliminar no existe (bloqueado)
   */
  test('con cuestionario que tiene envíos, no se muestran botones Eliminar', async ({ page }) => {
    await injectProfesorAuth(page);
    await setupMocks(page, true); // hasSubmissions = true
    await navigateToEdit(page);

    const firstQuestion = page.locator('app-question-item').first();
    const deleteButtons = firstQuestion.locator('button:has-text("Eliminar")');

    // No debe haber botones de eliminar cuando el cuestionario tiene envíos
    await expect(deleteButtons).toHaveCount(0);
  });

});
