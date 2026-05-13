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

async function mockQuestionnairesListWithSurvey(page: Page) {
  await page.route(`${API}/questionnaires/course/${COURSE_ID}`, (route: Route) =>
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
  await page.route(`${API}/questionnaires/course/${COURSE_ID}`, (route: Route) =>
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

  test('Card de encuesta muestra badge y NO muestra nota mínima, reintentos ni respuestas correctas', async ({ page }) => {
    await injectProfesorAuth(page);
    await mockQuestionnairesListWithSurvey(page);

    await page.goto(`/profesor/questionnaires?courseId=${COURSE_ID}`);
    await page.waitForSelector('text=Encuesta de Satisfacción', { timeout: 10000 });

    await expect(page.locator('text=📋 Encuesta de Satisfacción').first()).toBeVisible();
    await expect(page.locator('text=Puntuación automática: 100%')).toBeVisible();
    await expect(page.locator('text=No evalúa respuestas correctas')).toBeVisible();
    await expect(page.locator('text=Nota mínima')).not.toBeVisible();
    await expect(page.locator('text=Sin reintentos')).not.toBeVisible();
    await expect(page.locator('text=Oculta respuestas correctas')).not.toBeVisible();
  });

  test('Card de cuestionario normal NO muestra badge de encuesta y SÍ muestra configuración', async ({ page }) => {
    await injectProfesorAuth(page);
    await mockQuestionnairesListWithRegular(page);

    await page.goto(`/profesor/questionnaires?courseId=${COURSE_ID}`);
    await page.waitForSelector('text=Examen Final', { timeout: 10000 });

    await expect(page.locator('text=📋 Encuesta de Satisfacción')).not.toBeVisible();
    await expect(page.locator('text=Nota mínima: 70%')).toBeVisible();
    await expect(page.locator('text=Sin reintentos')).toBeVisible();
    await expect(page.locator('text=Oculta respuestas correctas')).toBeVisible();
  });

  test('Formulario de edición oculta sección Configuración al marcar isSurvey', async ({ page }) => {
    await injectProfesorAuth(page);

    await page.goto(`/profesor/questionnaires/new?courseId=${COURSE_ID}`);
    await page.waitForSelector('text=Información Básica', { timeout: 10000 });

    await expect(page.locator('text=Configuración')).toBeVisible();
    await page.locator('#isSurvey').check();
    await expect(page.locator('text=Configuración')).not.toBeVisible();
  });

  test('Formulario de edición muestra sección Configuración al desmarcar isSurvey', async ({ page }) => {
    await injectProfesorAuth(page);

    await page.goto(`/profesor/questionnaires/new?courseId=${COURSE_ID}`);
    await page.waitForSelector('text=Información Básica', { timeout: 10000 });

    await page.locator('#isSurvey').check();
    await expect(page.locator('text=Configuración')).not.toBeVisible();
    await page.locator('#isSurvey').uncheck();
    await expect(page.locator('text=Configuración')).toBeVisible();
  });
});