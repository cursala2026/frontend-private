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
import path from 'path';
import { injectProfesorAuth } from './helpers/auth';

const API = 'http://localhost:8081/api/v1';
const QID = 'remove-option-test-000000000';
const COURSE_ID = 'remove-option-course-0000000';

// Cuestionario de prueba reutilizable (usado por el mock y por el intercept global)
const TEST_QUESTIONNAIRE = {
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
      correctOptionId: 'o2',
    },
  ],
};

// ── Helper: montar mocks de API ──────────────────────────────────────────────

async function setupMocks(page: Page, hasSubmissions = false) {
  const questionnaire = TEST_QUESTIONNAIRE;

  // 1. Mock de la carga del cuestionario
  await page.route(`${API}/questionnaires/${QID}`, (route: Route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: questionnaire }),
      });
    }
    return route.continue();
  });

  // 2. Mock de subcomprobación de envíos
  await page.route(`${API}/questionnaires/${QID}/has-submissions`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { hasSubmissions } }),
    })
  );

  // 3. Mocks de servicios necesarios para salir del estado "loading"
  await page.route(`${API}/class/course/${COURSE_ID}/classes`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    })
  );

  await page.route(`${API}/questionnaires/course/${COURSE_ID}`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    })
  );

  // 4. Mock global FALLBACK - Registrado al FINAL para evaluarse PRIMERO
  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url();
    
    // Si la ruta coincide con una de las específicas de arriba, delegamos (continue)
    if (url.includes(`/questionnaires/${QID}`) || 
        url.includes('/has-submissions') ||
        url.includes(`/class/course/${COURSE_ID}/classes`) ||
        url.includes(`/questionnaires/course/${COURSE_ID}`)) {
       return route.continue();
    }
    
    // Fallback para cualquier otra cosa (evita 401s y cuelgues)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    });
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

// Registrar rutas directamente en el context para garantizar intercepción temprana
async function registerContextFallback(ctx: any, hasSubmissions = false) {
  // Keep an in-memory mutable questionnaire per context so updates persist.
  const mutableQuestionnaire = JSON.parse(JSON.stringify(TEST_QUESTIONNAIRE));

  await ctx.route('**/api/v1/**', async (route: any) => {
    const url = route.request().url();
    const method = route.request().method();

    // Special: has-submissions must be handled before the generic questionnaire path
    if (url.includes(`/questionnaires/${QID}/has-submissions`)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { hasSubmissions } }) });
    }

    // GET questionnaire
    if (url.includes(`/questionnaires/${QID}`) && method === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: mutableQuestionnaire }) });
    }

    // Update questionnaire (PUT/PATCH/POST) - accept body and persist
    if (url.includes(`/questionnaires/${QID}`) && method !== 'GET') {
      try {
        const postData = route.request().postData();
        console.log('[MOCK] questionnaire update payload:', postData);
        if (postData) {
          const parsed = JSON.parse(postData);
          const incoming = parsed.data || parsed;
          // If full questions array is present, replace it so deletions persist
          if (Array.isArray(incoming.questions)) {
            mutableQuestionnaire.questions = incoming.questions;
          } else if (incoming.questions && incoming.questions._id) {
            // single question payload
            const idx = mutableQuestionnaire.questions.findIndex((q: any) => q._id === incoming.questions._id);
            if (idx >= 0) mutableQuestionnaire.questions[idx] = incoming.questions;
          } else if (incoming.questions && Array.isArray(incoming.questions)) {
            mutableQuestionnaire.questions = incoming.questions;
          } else {
            // shallow merge for other top-level fields
            Object.assign(mutableQuestionnaire, incoming);
          }
        }
      } catch (e) {
        console.log('[MOCK] failed to parse update payload', e);
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: mutableQuestionnaire }) });
    }

    if (url.includes(`/questionnaires/${QID}/has-submissions`)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { hasSubmissions } }) });
    }
    if (url.includes(`/class/course/${COURSE_ID}/classes`)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    }
    if (url.includes(`/questionnaires/course/${COURSE_ID}`)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    }
    if (url.includes('/auth') || url.endsWith('/me') || url.includes('/users/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {} }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('Eliminación de opciones en editor de cuestionario', () => {
  // Tests will create their own context+page with storageState and context-level routes

  /**
   * Caso 1 (Bug principal): eliminar la opción CORRECTA
   * Debe desaparecer la opción marcada, no la última.
   */
  test('eliminar la opción correcta elimina la opción seleccionada, no la última', async ({ page }) => {
    const browser = page.context().browser();
    if (!browser) throw new Error('No browser available');
    const ctx = await browser.newContext({ storageState: path.join(__dirname, '.auth-profesor.json'), baseURL: 'http://localhost:4200' });
    const p = await ctx.newPage();

    // Debug logging
    p.on('console', msg => console.log('[PAGE][console]', msg.type(), msg.text()));
    p.on('response', resp => { try { if (resp.status() >= 400) console.log('[PAGE][response]', resp.status(), resp.url()); } catch (e) {} });

    await registerContextFallback(ctx, false);
    await navigateToEdit(p);

    // Verificar estado inicial: 4 opciones con textos esperados
    const before = await getOptionTexts(p);
    expect(before).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta']);

    // Localizar el botón "Eliminar" de la segunda opción (índice 1 = "Beta", la correcta)
    const firstQuestion = p.locator('app-question-item').first();
    const deleteButtons = firstQuestion.locator('button:has-text("Eliminar")');
    await expect(deleteButtons).toHaveCount(4);

    // Hacer click en "Eliminar" de la segunda opción (Beta, que es la correcta)
    await p.evaluate((t) => {
      const inputs = Array.from(document.querySelectorAll('input[formcontrolname="text"]')) as HTMLInputElement[];
      const idx = inputs.findIndex(i => i.value === t);
      if (idx >= 0) {
        let el: HTMLElement | null = inputs[idx];
        // ascend up to 5 levels looking for a button with text 'Eliminar'
        for (let i = 0; i < 5 && el; i++) {
          const btn = el.querySelector?.('button') as HTMLElement | null;
          if (btn && (btn.textContent || '').trim().includes('Eliminar')) {
            btn.click();
            break;
          }
          el = el.parentElement;
        }
      }
    }, 'Beta');
    await p.waitForTimeout(600);

    // Debe haber quedado exactamente 3 opciones
    const after = await getOptionTexts(p);
    expect(after).toHaveLength(3);

    // "Beta" debe haberse ido; el resto debe estar en orden
    expect(after).not.toContain('Beta');
    expect(after[0]).toBe('Alpha');
    expect(after[1]).toBe('Gamma');
    expect(after[2]).toBe('Delta');

    // "Delta" (la última) debe seguir presente — esto fallaba con el bug
    expect(after).toContain('Delta');

    await ctx.close();
  });

  /**
   * Caso 2: eliminar la primera opción cuando hay 4
   */
  test('eliminar la primera opción deja las 3 restantes en orden correcto', async ({ page }) => {
    const browser = page.context().browser();
    if (!browser) throw new Error('No browser available');
    const ctx = await browser.newContext({ storageState: path.join(__dirname, '.auth-profesor.json'), baseURL: 'http://localhost:4200' });
    const p = await ctx.newPage();

    p.on('console', msg => console.log('[PAGE][console]', msg.type(), msg.text()));
    p.on('response', resp => { try { if (resp.status() >= 400) console.log('[PAGE][response]', resp.status(), resp.url()); } catch (e) {} });

    await registerContextFallback(ctx, false);
    await navigateToEdit(p);

    const firstQuestion = p.locator('app-question-item').first();
    const deleteButtons = firstQuestion.locator('button:has-text("Eliminar")');

    await p.evaluate((t) => {
      const inputs = Array.from(document.querySelectorAll('input[formcontrolname="text"]')) as HTMLInputElement[];
      const idx = inputs.findIndex(i => i.value === t);
      if (idx >= 0) {
        const btn = inputs[idx].closest('div')?.querySelector('button:where(:is(button, [type=button]))');
        if (btn) (btn as HTMLElement).click();
      }
    }, 'Alpha');
    await p.waitForTimeout(600);

    const after = await getOptionTexts(p);
    expect(after).toHaveLength(3);
    expect(after[0]).toBe('Beta');
    expect(after[1]).toBe('Gamma');
    expect(after[2]).toBe('Delta');

    await ctx.close();
  });

  /**
   * Caso 3: eliminar la última opción
   */
  test('eliminar la última opción deja las 3 primeras en orden correcto', async ({ page }) => {
    const browser = page.context().browser();
    if (!browser) throw new Error('No browser available');
    const ctx = await browser.newContext({ storageState: path.join(__dirname, '.auth-profesor.json'), baseURL: 'http://localhost:4200' });
    const p = await ctx.newPage();

    p.on('console', msg => console.log('[PAGE][console]', msg.type(), msg.text()));
    p.on('response', resp => { try { if (resp.status() >= 400) console.log('[PAGE][response]', resp.status(), resp.url()); } catch (e) {} });

    await registerContextFallback(ctx, false);
    await navigateToEdit(p);

    const firstQuestion = p.locator('app-question-item').first();
    const deleteButtons = firstQuestion.locator('button:has-text("Eliminar")');

    await p.evaluate((t) => {
      const inputs = Array.from(document.querySelectorAll('input[formcontrolname="text"]')) as HTMLInputElement[];
      const idx = inputs.findIndex(i => i.value === t);
      if (idx >= 0) {
        const btn = inputs[idx].closest('div')?.querySelector('button:where(:is(button, [type=button]))');
        if (btn) (btn as HTMLElement).click();
      }
    }, 'Delta');
    await p.waitForTimeout(600);

    const after = await getOptionTexts(p);
    expect(after).toHaveLength(3);
    expect(after[0]).toBe('Alpha');
    expect(after[1]).toBe('Beta');
    expect(after[2]).toBe('Gamma');

    await ctx.close();
  });

  /**
   * Caso 4: eliminar del medio (opción 2 = "Gamma")
   */
  test('eliminar una opción del medio deja el orden correcto', async ({ page }) => {
    const browser = page.context().browser();
    if (!browser) throw new Error('No browser available');
    const ctx = await browser.newContext({ storageState: path.join(__dirname, '.auth-profesor.json'), baseURL: 'http://localhost:4200' });
    const p = await ctx.newPage();

    p.on('console', msg => console.log('[PAGE][console]', msg.type(), msg.text()));
    p.on('response', resp => { try { if (resp.status() >= 400) console.log('[PAGE][response]', resp.status(), resp.url()); } catch (e) {} });

    await registerContextFallback(ctx, false);
    await navigateToEdit(p);

    const firstQuestion = p.locator('app-question-item').first();
    const deleteButtons = firstQuestion.locator('button:has-text("Eliminar")');

    await p.evaluate((t) => {
      const inputs = Array.from(document.querySelectorAll('input[formcontrolname="text"]')) as HTMLInputElement[];
      const idx = inputs.findIndex(i => i.value === t);
      if (idx >= 0) {
        const btn = inputs[idx].closest('div')?.querySelector('button:where(:is(button, [type=button]))');
        if (btn) (btn as HTMLElement).click();
      }
    }, 'Gamma');
    await p.waitForTimeout(600);

    const after = await getOptionTexts(p);
    expect(after).toHaveLength(3);
    expect(after[0]).toBe('Alpha');
    expect(after[1]).toBe('Beta');
    expect(after[2]).toBe('Delta');

    await ctx.close();
  });

  /**
   * Caso 5: eliminaciones múltiples consecutivas mantienen el orden
   */
  test('dos eliminaciones consecutivas mantienen el orden correcto', async ({ page }) => {
    const browser = page.context().browser();
    if (!browser) throw new Error('No browser available');
    const ctx = await browser.newContext({ storageState: path.join(__dirname, '.auth-profesor.json'), baseURL: 'http://localhost:4200' });
    const p = await ctx.newPage();

    p.on('console', msg => console.log('[PAGE][console]', msg.type(), msg.text()));
    p.on('response', resp => { try { if (resp.status() >= 400) console.log('[PAGE][response]', resp.status(), resp.url()); } catch (e) {} });

    await registerContextFallback(ctx, false);
    await navigateToEdit(p);

    const firstQuestion = p.locator('app-question-item').first();

    // Primera eliminación: quitar "Beta" (índice 1)
    let deleteButtons = firstQuestion.locator('button:has-text("Eliminar")');
    await p.evaluate((t) => {
      const inputs = Array.from(document.querySelectorAll('input[formcontrolname="text"]')) as HTMLInputElement[];
      const idx = inputs.findIndex(i => i.value === t);
      if (idx >= 0) {
        const btn = inputs[idx].closest('div')?.querySelector('button:where(:is(button, [type=button]))');
        if (btn) (btn as HTMLElement).click();
      }
    }, 'Beta');
    await p.waitForTimeout(600);

    // Estado intermedio: [Alpha, Gamma, Delta]
    const mid = await getOptionTexts(p);
    expect(mid).toEqual(['Alpha', 'Gamma', 'Delta']);

    // Segunda eliminación: quitar "Gamma" (ahora en índice 1)
    deleteButtons = firstQuestion.locator('button:has-text("Eliminar")');
    await p.evaluate((t) => {
      const inputs = Array.from(document.querySelectorAll('input[formcontrolname="text"]')) as HTMLInputElement[];
      const idx = inputs.findIndex(i => i.value === t);
      if (idx >= 0) {
        const btn = inputs[idx].closest('div')?.querySelector('button:where(:is(button, [type=button]))');
        if (btn) (btn as HTMLElement).click();
      }
    }, 'Gamma');
    await p.waitForTimeout(600);

    // Estado final: [Alpha, Delta] — botones Eliminar deben ocultarse (solo 2 opciones)
    const after = await getOptionTexts(p);
    expect(after).toHaveLength(2);
    expect(after[0]).toBe('Alpha');
    expect(after[1]).toBe('Delta');

    // Con 2 opciones, los botones Eliminar deben desaparecer
    const remainingDeleteBtns = await firstQuestion.locator('button:has-text("Eliminar")').count();
    expect(remainingDeleteBtns).toBe(0);

    await ctx.close();
  });

  /**
   * Caso 6: con hasSubmissions=true, el botón Eliminar está deshabilitado
   */
  test('con cuestionario que tiene envíos, los botones Eliminar están deshabilitados', async ({ page }) => {
    const browser = page.context().browser();
    if (!browser) throw new Error('No browser available');
    const ctx = await browser.newContext({ storageState: path.join(__dirname, '.auth-profesor.json'), baseURL: 'http://localhost:4200' });
    const p = await ctx.newPage();

    p.on('console', msg => console.log('[PAGE][console]', msg.type(), msg.text()));
    p.on('response', resp => { try { if (resp.status() >= 400) console.log('[PAGE][response]', resp.status(), resp.url()); } catch (e) {} });

    await registerContextFallback(ctx, true); // hasSubmissions = true
    await navigateToEdit(p);

    const firstQuestion = p.locator('app-question-item').first();
    const deleteButtons = firstQuestion.locator('button:has-text("Eliminar")');

    // Deben existir pero estar deshabilitados
    const count = await deleteButtons.count();
    expect(count).toBeGreaterThan(0);
    
    for (let i = 0; i < count; i++) {
        await expect(deleteButtons.nth(i)).toBeDisabled();
    }

    await ctx.close();
  });

});
