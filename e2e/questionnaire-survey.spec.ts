/**
 * E2E Tests — Fix: Encuestas de satisfacción no deben mostrar
 * configuración de nota mínima, reintentos ni respuestas correctas.
 */

import { test, expect, Page, Route } from '@playwright/test';
import {
  injectProfesorAuth,
  COURSE_ID,
  QUESTIONNAIRE_ID,
} from './helpers/auth';

const API = 'http://localhost:8081/api/v1';

async function mockCommonData(page: Page) {
  // Register a broad interceptor first to prevent real 401 responses from backend
  await page.context().route('**/api/v1/**', async (route) => {
    const url = route.request().url();
    // Specific handlers
    if (url.includes(`/class/course/${COURSE_ID}/classes`)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    }
    if (url.includes(`/questionnaires/course/${COURSE_ID}`)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    }
    // auth/me or users/me -> return empty user to avoid logout
    if (url.includes('/auth') || url.endsWith('/me') || url.includes('/users/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {} }) });
    }
    // Default fallback: success empty
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
  });
}

async function mockQuestionnairesListWithSurvey(page: Page) {
  await mockCommonData(page);
  await page.context().route(`${API}/questionnaires/course/${COURSE_ID}`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            _id: QUESTIONNAIRE_ID,
            courseId: COURSE_ID,
            title: 'Encuesta de Satisfacción',
            status: 'ACTIVE',
            isSurvey: true,
            passingScore: 70,
            allowRetries: false,
            showCorrectAnswers: false,
            position: { type: 'FINAL_EXAM' },
            questions: [],
          },
        ],
      }),
    })
  );
}

async function mockQuestionnairesListWithRegular(page: Page) {
  await mockCommonData(page);
  await page.context().route(`${API}/questionnaires/course/${COURSE_ID}`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            _id: QUESTIONNAIRE_ID,
            courseId: COURSE_ID,
            title: 'Examen Final',
            status: 'ACTIVE',
            isSurvey: false,
            passingScore: 70,
            allowRetries: false,
            showCorrectAnswers: false,
            position: { type: 'FINAL_EXAM' },
            questions: [],
          },
        ],
      }),
    })
  );
}

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Fix — Encuestas no muestran configuración de evaluación', () => {

  // Nota: los mocks se registran por test usando context-level routes.

  test('Card de encuesta muestra badge y NO muestra nota mínima, reintentos ni respuestas correctas', async ({ page }) => {
    const browser = page.context().browser();
    if (!browser) throw new Error('No browser available');
    const ctx = await browser.newContext({ storageState: 'F:/cursala/cursala-private/frontend-private/e2e/.auth-profesor.json', baseURL: 'http://localhost:4200' });
    const p = await ctx.newPage();

    await mockQuestionnairesListWithSurvey(p);

    await p.goto(`/profesor/questionnaires?courseId=${COURSE_ID}`);
    await p.waitForSelector('text=Encuesta de Satisfacción', { timeout: 10000 });

    await expect(p.locator('text=Encuesta de Satisfacción').nth(1)).toBeVisible(); // n=0 is title, n=1 is badge
    await expect(p.locator('text=Puntuación automática: 100%')).toBeVisible();
    await expect(p.locator('text=No evalúa respuestas correctas')).toBeVisible();
    await expect(p.locator('text=Nota mínima')).not.toBeVisible();
    await expect(p.locator('text=Sin reintentos')).not.toBeVisible();
    await expect(p.locator('text=Oculta respuestas correctas')).not.toBeVisible();

    await ctx.close();
  });

  test('Card de cuestionario normal NO muestra badge de encuesta y SÍ muestra configuración', async ({ page }) => {
    const browser = page.context().browser();
    if (!browser) throw new Error('No browser available');
    const ctx = await browser.newContext({ storageState: 'F:/cursala/cursala-private/frontend-private/e2e/.auth-profesor.json', baseURL: 'http://localhost:4200' });
    const p = await ctx.newPage();

    await mockQuestionnairesListWithRegular(p);

    await p.goto(`/profesor/questionnaires?courseId=${COURSE_ID}`);
    await p.waitForSelector('text=Examen Final', { timeout: 10000 });

    await expect(p.locator('text=📋 Encuesta de Satisfacción')).not.toBeVisible();
    await expect(p.locator('text=Nota mínima: 70%')).toBeVisible();
    await expect(p.locator('text=Sin reintentos')).toBeVisible();
    await expect(p.locator('text=Oculta respuestas correctas')).toBeVisible();

    await ctx.close();
  });

  test('Formulario de edición oculta sección Configuración al marcar isSurvey', async ({ page }) => {
    const browser = page.context().browser();
    if (!browser) throw new Error('No browser available');
    const ctx = await browser.newContext({ storageState: 'F:/cursala/cursala-private/frontend-private/e2e/.auth-profesor.json', baseURL: 'http://localhost:4200' });
    const p = await ctx.newPage();

    await mockCommonData(p);

    // Debug logging: capture console and failing responses
    p.on('console', msg => console.log('[PAGE][console]', msg.type(), msg.text()));
    p.on('response', resp => {
      try {
        const status = resp.status();
        if (status >= 400) console.log('[PAGE][response]', resp.url(), status);
      } catch (e) {
        /* ignore */
      }
    });

    await p.goto(`/profesor/questionnaires/new?courseId=${COURSE_ID}`);
    await p.waitForSelector('text=Información Básica', { timeout: 15000 });
    
    // Usar selector de atributo para mayor fiabilidad
    const isSurveyCheckbox = p.locator('input[formControlName="isSurvey"]');
    await isSurveyCheckbox.waitFor({ state: 'visible', timeout: 10000 });

    await expect(p.locator('h2:has-text("Configuración")')).toBeVisible();
    await isSurveyCheckbox.check();
    await expect(p.locator('h2:has-text("Configuración")')).not.toBeVisible();

    await ctx.close();
  });

  test('Formulario de edición muestra sección Configuración al desmarcar isSurvey', async ({ page }) => {
    const browser2 = page.context().browser();
    if (!browser2) throw new Error('No browser available');
    const ctx2 = await browser2.newContext({ storageState: 'F:/cursala/cursala-private/frontend-private/e2e/.auth-profesor.json', baseURL: 'http://localhost:4200' });
    const p2 = await ctx2.newPage();

    await mockCommonData(p2);

    // Debug logging: capture console and failing responses
    p2.on('console', msg => console.log('[PAGE][console]', msg.type(), msg.text()));
    p2.on('response', resp => {
      try {
        const status = resp.status();
        if (status >= 400) console.log('[PAGE][response]', resp.url(), status);
      } catch (e) {
        /* ignore */
      }
    });

    await p2.goto(`/profesor/questionnaires/new?courseId=${COURSE_ID}`);
    await p2.waitForSelector('text=Información Básica', { timeout: 15000 });
    
    const isSurveyCheckbox = p2.locator('input[formControlName="isSurvey"]');
    await isSurveyCheckbox.waitFor({ state: 'visible', timeout: 10000 });

    await isSurveyCheckbox.check();
    await expect(p2.locator('h2:has-text("Configuración")')).not.toBeVisible();
    await isSurveyCheckbox.uncheck();
    await expect(p2.locator('h2:has-text("Configuración")')).toBeVisible();

    await ctx2.close();
  });
});