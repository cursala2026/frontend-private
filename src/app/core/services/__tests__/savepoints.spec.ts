/**
 * E2E Tests — PDF Report: Descarga de reporte completo del cuestionario
 *
 * Verifica que:
 * 1. El botón "Descargar Reporte PDF" existe en la vista de resultados
 * 2. Al hacer click se dispara la descarga del PDF
 * 3. La petición va al endpoint correcto
 * 4. Funciona tanto para cuestionarios como para encuestas
 */

import { test, expect, Page, Route } from '@playwright/test';
import path from 'path';
import {
  COURSE_ID,
  QUESTIONNAIRE_ID,
} from './helpers/auth';

const API = 'http://localhost:8081/api/v1';
const SURVEY_ID = 'survey-aabbccddeeff001122334455';

async function mockCommonData(page: Page) {
  await page.context().route('**/api/v1/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/auth') || url.endsWith('/me') || url.includes('/users/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {} }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
  });
}

async function mockQuestionnaireResults(page: Page, questionnaireId: string, isSurvey: boolean) {
  await page.context().route(`${API}/questionnaires/${questionnaireId}`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          _id: questionnaireId,
          courseId: COURSE_ID,
          title: isSurvey ? 'Encuesta de Satisfacción' : 'Examen Final',
          isSurvey,
          passingScore: isSurvey ? 0 : 70,
          questions: [],
        },
      }),
    })
  );

  await page.context().route(`${API}/questionnaires/${questionnaireId}/grade-report`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            _id: 'sub-001',
            questionnaireId,
            studentId: 'student-001',
            studentName: 'Alumno Test',
            studentEmail: 'alumno@test.com',
            attemptNumber: 1,
            answers: [],
            status: 'GRADED',
            autoGradedScore: 80,
            finalScore: 80,
            startedAt: new Date(Date.now() - 600000).toISOString(),
            submittedAt: new Date().toISOString(),
          },
        ],
      }),
    })
  );
}

// ─────────────────────────────────────────────────────────────────────────────

test.describe('PDF Report — Descarga de reporte completo del cuestionario', () => {

  test('El botón "Descargar Reporte PDF" es visible en la vista de resultados', async ({ page }) => {
    const browser = page.context().browser();
    if (!browser) throw new Error('No browser available');
    const ctx = await browser.newContext({
      storageState: path.join(__dirname, '.auth-profesor.json'),
      baseURL: 'http://localhost:4200',
    });
    const p = await ctx.newPage();

    await mockCommonData(p);
    await mockQuestionnaireResults(p, QUESTIONNAIRE_ID, false);

    await p.goto(`/profesor/questionnaires/${QUESTIONNAIRE_ID}/results`);
    await p.waitForSelector('text=Alumno Test', { timeout: 10000 });

    const pdfBtn = p.locator('button:has-text("Descargar Reporte PDF"), button:has-text("Reporte PDF")');
    await expect(pdfBtn).toBeVisible({ timeout: 5000 });

    await ctx.close();
  });

  test('Al hacer click en "Descargar Reporte PDF" se llama al endpoint correcto', async ({ page }) => {
    const browser = page.context().browser();
    if (!browser) throw new Error('No browser available');
    const ctx = await browser.newContext({
      storageState: path.join(__dirname, '.auth-profesor.json'),
      baseURL: 'http://localhost:4200',
    });
    const p = await ctx.newPage();

    await mockCommonData(p);
    await mockQuestionnaireResults(p, QUESTIONNAIRE_ID, false);

    // Interceptar la llamada al endpoint de PDF
    let pdfEndpointCalled = false;
    await p.context().route(`${API}/questionnaires/${QUESTIONNAIRE_ID}/report/pdf`, (route: Route) => {
      pdfEndpointCalled = true;
      // Responder con un PDF falso para no bloquear
      return route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: Buffer.from('%PDF-1.4 fake pdf content'),
        headers: {
          'Content-Disposition': `attachment; filename="reporte-examen_final.pdf"`,
        },
      });
    });

    await p.goto(`/profesor/questionnaires/${QUESTIONNAIRE_ID}/results`);
    await p.waitForSelector('text=Alumno Test', { timeout: 10000 });

    // El botón usa window.open, que abre una nueva pestaña
    const [newPage] = await Promise.all([
      p.context().waitForEvent('page', { timeout: 5000 }).catch(() => null),
      p.locator('button:has-text("Descargar Reporte PDF"), button:has-text("Reporte PDF")').click(),
    ]);

    // Dar tiempo para que se procese la navegación
    await p.waitForTimeout(1000);

    expect(pdfEndpointCalled).toBeTruthy();

    if (newPage) await newPage.close();
    await ctx.close();
  });

  test('El botón "Descargar Reporte PDF" también existe en vista de encuesta', async ({ page }) => {
    const browser = page.context().browser();
    if (!browser) throw new Error('No browser available');
    const ctx = await browser.newContext({
      storageState: path.join(__dirname, '.auth-profesor.json'),
      baseURL: 'http://localhost:4200',
    });
    const p = await ctx.newPage();

    await mockCommonData(p);
    await mockQuestionnaireResults(p, SURVEY_ID, true);

    await p.goto(`/profesor/questionnaires/${SURVEY_ID}/results`);
    await p.waitForSelector('text=Alumno Test', { timeout: 10000 });

    const pdfBtn = p.locator('button:has-text("Descargar Reporte PDF"), button:has-text("Reporte PDF")');
    await expect(pdfBtn).toBeVisible({ timeout: 5000 });

    await ctx.close();
  });

  test('El botón "Descargar PDF" individual en el modal sigue funcionando', async ({ page }) => {
    const browser = page.context().browser();
    if (!browser) throw new Error('No browser available');
    const ctx = await browser.newContext({
      storageState: path.join(__dirname, '.auth-profesor.json'),
      baseURL: 'http://localhost:4200',
    });
    const p = await ctx.newPage();

    await mockCommonData(p);
    await mockQuestionnaireResults(p, QUESTIONNAIRE_ID, false);

    await p.context().route(
      `${API}/questionnaires/${QUESTIONNAIRE_ID}/submissions/student/student-001`,
      (route: Route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [{
              _id: 'sub-001',
              questionnaireId: QUESTIONNAIRE_ID,
              studentId: 'student-001',
              studentName: 'Alumno Test',
              studentEmail: 'alumno@test.com',
              attemptNumber: 1,
              answers: [],
              status: 'GRADED',
              finalScore: 80,
              autoGradedScore: 80,
              startedAt: new Date(Date.now() - 600000).toISOString(),
              submittedAt: new Date().toISOString(),
            }],
          }),
        })
    );

    await p.goto(`/profesor/questionnaires/${QUESTIONNAIRE_ID}/results`);
    await p.waitForSelector('text=Alumno Test', { timeout: 10000 });

    // Abrir el modal de revisión
    await p.locator('button:has-text("Ver")').first().click();
    await p.waitForSelector('text=Revisar y Calificar', { timeout: 5000 });

    // El botón "Descargar PDF" individual debe seguir existiendo en el modal
    const individualPdfBtn = p.locator('button:has-text("Descargar PDF")');
    await expect(individualPdfBtn).toBeVisible({ timeout: 3000 });

    await ctx.close();
  });

  test('No hay resultados: el botón de PDF no aparece o está deshabilitado', async ({ page }) => {
    const browser = page.context().browser();
    if (!browser) throw new Error('No browser available');
    const ctx = await browser.newContext({
      storageState: path.join(__dirname, '.auth-profesor.json'),
      baseURL: 'http://localhost:4200',
    });
    const p = await ctx.newPage();

    await mockCommonData(p);

    // Cuestionario sin submissions
    await p.context().route(`${API}/questionnaires/${QUESTIONNAIRE_ID}`, (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            _id: QUESTIONNAIRE_ID,
            courseId: COURSE_ID,
            title: 'Cuestionario Vacío',
            isSurvey: false,
            passingScore: 70,
            questions: [],
          },
        }),
      })
    );

    await p.context().route(`${API}/questionnaires/${QUESTIONNAIRE_ID}/grade-report`, (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      })
    );

    await p.goto(`/profesor/questionnaires/${QUESTIONNAIRE_ID}/results`);
    await p.waitForSelector('text=No hay resultados calificados', { timeout: 10000 });

    // Cuando no hay resultados, el PDF no tiene sentido — debe estar oculto o disabled
    const pdfBtn = p.locator('button:has-text("Descargar Reporte PDF"), button:has-text("Reporte PDF")');
    const isVisible = await pdfBtn.isVisible().catch(() => false);
    const isEnabled = isVisible ? await pdfBtn.isEnabled().catch(() => false) : false;

    // El botón o no existe o está deshabilitado
    expect(!isVisible || !isEnabled).toBeTruthy();

    await ctx.close();
  });
});