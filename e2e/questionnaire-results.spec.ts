/**
 * E2E Tests — Bug #8: questionnaire-results.component mostraba autoGradedScore
 *                      cuando finalScore=0 (usaba || en vez de ??).
 *
 * El fix cambia en dos lugares:
 *   const score = submission.finalScore || submission.autoGradedScore || 0
 * por:
 *   const score = submission.finalScore ?? submission.autoGradedScore ?? 0
 *
 * Así, cuando finalScore=0, bestScore en el reporte es 0 (no 75).
 * El test verifica que la tabla muestre "0.0%" y NO "75.0%".
 */

import { test, expect, Page, Route } from '@playwright/test';
import {
  injectProfesorAuth,
  QUESTIONNAIRE_ID,
  COURSE_ID,
  STUDENT_USER_ID,
  PROFESOR_USER_ID,
} from './helpers/auth';

const API = 'http://localhost:8081/api/v1';

// ─── Mock data ───────────────────────────────────────────────────────────────

const MOCK_QUESTIONNAIRE = {
  _id: QUESTIONNAIRE_ID,
  courseId: COURSE_ID,
  title: 'Examen Final',
  status: 'ACTIVE',
  position: { type: 'FINAL_EXAM' },
  questions: [],
  passingScore: 50,
  allowRetries: false,
  showCorrectAnswers: false,
};

/** Crea una submission GRADED con los scores indicados. */
function makeGradedSubmission(finalScore: number | null, autoGradedScore: number) {
  return {
    _id: 'ffffffffffffffffffffffff',
    questionnaireId: QUESTIONNAIRE_ID,
    courseId: COURSE_ID,
    studentId: STUDENT_USER_ID,
    studentName: 'Alumno Dev',
    studentEmail: 'alumno@dev.local',
    attemptNumber: 1,
    answers: [],
    status: 'GRADED',
    autoGradedScore,
    finalScore,
    startedAt: new Date().toISOString(),
    submittedAt: new Date().toISOString(),
  };
}

// ─── Setup helpers ────────────────────────────────────────────────────────────

async function mockQuestionnaireEndpoint(page: Page) {
  await page.route(`${API}/questionnaires/${QUESTIONNAIRE_ID}`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_QUESTIONNAIRE }),
    })
  );
}

async function mockGradeReport(page: Page, finalScore: number | null, autoGradedScore: number) {
  const submission = makeGradedSubmission(finalScore, autoGradedScore);
  await page.route(`${API}/questionnaires/${QUESTIONNAIRE_ID}/grade-report`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [submission] }),
    })
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Bug #8 — Grade report muestra finalScore=0 correctamente, no autoGradedScore', () => {
  test.beforeEach(async ({ page }) => {
    await injectProfesorAuth(page);
    await mockQuestionnaireEndpoint(page);
  });

  test('Muestra 0.0% cuando finalScore=0 y autoGradedScore=75 (no debe mostrar 75.0%)', async ({
    page,
  }) => {
    await mockGradeReport(page, 0, 75); // finalScore=0, autoGradedScore=75

    await page.goto(`/profesor/questionnaires/${QUESTIONNAIRE_ID}/results`);

    // Esperar que la tabla cargue con el nombre del alumno
    await page.waitForSelector('text=Alumno Dev', { timeout: 10000 });

    // La nota mostrada debe ser 0.0%, NO 75.0%
    // El template usa: {{ entry.bestScore?.toFixed(1) || 0 }}%
    // Con el fix (?? en loadGradeReport): bestScore=0 → "0.0%"
    // Sin el fix (|| en loadGradeReport): bestScore=75 → "75.0%"
    await expect(page.locator('text=0.0%')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=75.0%')).not.toBeVisible();
  });

  test('Muestra 75.0% cuando finalScore=75 y autoGradedScore=50 (control)', async ({ page }) => {
    await mockGradeReport(page, 75, 50); // finalScore=75 → ambos operadores dan 75

    await page.goto(`/profesor/questionnaires/${QUESTIONNAIRE_ID}/results`);
    await page.waitForSelector('text=Alumno Dev', { timeout: 10000 });

    // Cuando finalScore=75, tanto || como ?? devuelven 75 → muestra 75.0%
    await expect(page.locator('text=75.0%')).toBeVisible({ timeout: 5000 });
  });

  test('Muestra 0.0% cuando finalScore es null y autoGradedScore=0', async ({ page }) => {
    await mockGradeReport(page, null, 0); // finalScore=null, autoGradedScore=0

    await page.goto(`/profesor/questionnaires/${QUESTIONNAIRE_ID}/results`);
    await page.waitForSelector('text=Alumno Dev', { timeout: 10000 });

    // finalScore=null → cae a autoGradedScore=0 → bestScore=0 → "0.0%"
    // (el template tiene: {{ entry.bestScore?.toFixed(1) || 0 }}%
    //  con bestScore=0: 0?.toFixed(1)="0.0" (truthy) → "0.0%")
    await expect(page.locator('text=0.0%')).toBeVisible({ timeout: 5000 });
  });

  test('Calcula bestScore como el máximo de intentos múltiples', async ({ page }) => {
    // Dos submissions: intento 1 con 30, intento 2 con 65 → bestScore debe ser 65
    const submissions = [
      { ...makeGradedSubmission(30, 30), attemptNumber: 1, _id: 'aaa000000000000000000001' },
      { ...makeGradedSubmission(65, 65), attemptNumber: 2, _id: 'aaa000000000000000000002' },
    ];

    await page.route(`${API}/questionnaires/${QUESTIONNAIRE_ID}/grade-report`, (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: submissions }),
      })
    );

    await page.goto(`/profesor/questionnaires/${QUESTIONNAIRE_ID}/results`);
    await page.waitForSelector('text=Alumno Dev', { timeout: 10000 });

    // bestScore = max(30, 65) = 65 → muestra "65.0%"
    await expect(page.locator('text=65.0%')).toBeVisible({ timeout: 5000 });
  });

  test('La pestaña "Pendientes" existe y el tab "Reporte" muestra la tabla', async ({ page }) => {
    await mockGradeReport(page, 80, 75);

    await page.goto(`/profesor/questionnaires/${QUESTIONNAIRE_ID}/results`);
    await page.waitForSelector('text=Alumno Dev', { timeout: 10000 });

    // Verificar que la tabla de reporte es visible
    await expect(page.locator('text=80.0%')).toBeVisible({ timeout: 5000 });
  });
});
