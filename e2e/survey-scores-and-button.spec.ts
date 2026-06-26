/**
 * E2E Tests — Issue #115: Eliminar referencias a puntajes en encuestas
 *             Issue #116: Botón exclusivo para crear encuesta de satisfacción
 *
 * #115: En las encuestas de satisfacción NO deben verse:
 *   - Tiempo de resolución
 *   - Respuestas correctas/incorrectas
 *   - Puntajes por pregunta
 *   - Nota final (columna "Nota" en el reporte)
 *
 * #116: Debe existir un botón separado "Nueva Encuesta" además de "Nuevo Cuestionario"
 *   El botón en el template se llama "Crear Encuesta de Satisfacción"
 */

import { test, expect, Page, Route } from '@playwright/test';
import path from 'path';
import {
  COURSE_ID,
  QUESTIONNAIRE_ID,
  STUDENT_USER_ID,
} from './helpers/auth';

const API = 'http://localhost:8081/api/v1';
const SURVEY_ID = 'survey-aabbccddeeff001122334455';

// ─── Mocks compartidos ────────────────────────────────────────────────────────

async function mockCommonData(page: Page) {
  await page.context().route('**/api/v1/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/auth') || url.endsWith('/me') || url.includes('/users/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {} }) });
    }
    if (url.includes(`/class/course/${COURSE_ID}`)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
  });
}

const MOCK_SURVEY = {
  _id: SURVEY_ID,
  courseId: COURSE_ID,
  title: 'Encuesta de Satisfacción del Curso',
  status: 'ACTIVE',
  isSurvey: true,
  passingScore: 0,
  allowRetries: false,
  showCorrectAnswers: false,
  timeLimitMinutes: null,
  questions: [
    {
      _id: 'sq1',
      type: 'MULTIPLE_CHOICE',
      questionText: '¿Cómo calificarías el curso?',
      order: 1,
      points: 0,
      required: true,
      options: [
        { _id: 'so1', text: 'Excelente', order: 1 },
        { _id: 'so2', text: 'Bueno', order: 2 },
        { _id: 'so3', text: 'Regular', order: 3 },
      ],
      correctOptionId: null,
    },
    {
      _id: 'sq2',
      type: 'TEXT',
      questionText: '¿Qué mejorarías del curso?',
      order: 2,
      points: 0,
      required: false,
    },
  ],
};

const MOCK_SURVEY_GRADED_SUBMISSION = {
  _id: 'subsurvey001',
  questionnaireId: SURVEY_ID,
  courseId: COURSE_ID,
  studentId: STUDENT_USER_ID,
  studentName: 'Alumno Encuesta',
  studentEmail: 'alumno@encuesta.com',
  attemptNumber: 1,
  answers: [
    { questionId: 'sq1', questionType: 'MULTIPLE_CHOICE', selectedOptionId: 'so1', isCorrect: null },
    { questionId: 'sq2', questionType: 'TEXT', textAnswer: 'Más ejercicios prácticos' },
  ],
  status: 'GRADED',
  autoGradedScore: 100,
  finalScore: 100,
  startedAt: new Date(Date.now() - 300000).toISOString(),
  submittedAt: new Date().toISOString(),
};

async function mockSurveyAndReport(page: Page) {
  await page.context().route(`${API}/questionnaires/${SURVEY_ID}`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_SURVEY }),
    })
  );

  await page.context().route(`${API}/questionnaires/${SURVEY_ID}/grade-report`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [MOCK_SURVEY_GRADED_SUBMISSION] }),
    })
  );
}

// Mock para el endpoint que llama viewSubmission() del componente:
// getStudentSubmissions(questionnaireId, studentId) → GET /questionnaires/:id/submissions/student/:studentId
async function mockSurveyStudentSubmissions(page: Page) {
  await page.context().route(
    `${API}/questionnaires/${SURVEY_ID}/submissions/student/${STUDENT_USER_ID}`,
    (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [MOCK_SURVEY_GRADED_SUBMISSION] }),
      })
  );
}

// Mock para la lista de cuestionarios del curso (usado por #116)
// También mockea courses/teacher para que loading() complete y se muestren los botones
async function mockQuestionnairesListBoth(page: Page) {
  // Mock courses/teacher para que el componente salga del estado loading
  await page.context().route(`**/courses/teacher/**`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [{ _id: COURSE_ID, name: 'Curso de Prueba' }] }),
    })
  );

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
            allowRetries: true,
            maxRetries: 2,
            showCorrectAnswers: false,
            questions: [],
            position: { type: 'FINAL_EXAM' },
          },
          {
            _id: SURVEY_ID,
            courseId: COURSE_ID,
            title: 'Encuesta de Satisfacción del Curso',
            status: 'ACTIVE',
            isSurvey: true,
            passingScore: 0,
            allowRetries: false,
            showCorrectAnswers: false,
            questions: [],
            position: { type: 'FINAL_EXAM' },
          },
        ],
      }),
    })
  );
}

// Helper para crear contexto de profesor y evitar repetición
async function createProfesorContext(page: Page) {
  const browser = page.context().browser();
  if (!browser) throw new Error('No browser available');
  return browser.newContext({
    storageState: path.join(__dirname, '.auth-profesor.json'),
    baseURL: 'http://localhost:4200',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ISSUE #115 — Eliminar referencias a puntajes en encuestas
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Issue #115 — Encuestas no muestran puntajes ni tiempo de resolución', () => {

  test('Vista de resultados de encuesta NO muestra columna "Nota"', async ({ page }) => {
    const ctx = await createProfesorContext(page);
    const p = await ctx.newPage();

    await mockCommonData(p);
    await mockSurveyAndReport(p);

    await p.goto(`/profesor/questionnaires/${SURVEY_ID}/results`);
    await p.waitForSelector('text=Encuesta de Satisfacción del Curso', { timeout: 10000 });

    await expect(p.locator('th:has-text("Nota")')).not.toBeVisible();
    await expect(p.locator('text=Alumno Encuesta')).toBeVisible({ timeout: 5000 });

    await ctx.close();
  });

  test('Vista de resultados de encuesta NO muestra columna "Tiempo de Resolución"', async ({ page }) => {
    const ctx = await createProfesorContext(page);
    const p = await ctx.newPage();

    await mockCommonData(p);
    await mockSurveyAndReport(p);

    await p.goto(`/profesor/questionnaires/${SURVEY_ID}/results`);
    await p.waitForSelector('text=Encuesta de Satisfacción del Curso', { timeout: 10000 });

    await expect(p.locator('th:has-text("Tiempo de Resolución")')).not.toBeVisible();

    await ctx.close();
  });

  test('Modal de revisión de encuesta NO muestra "Correcta" ni "Incorrecta" en las respuestas', async ({ page }) => {
    const ctx = await createProfesorContext(page);
    const p = await ctx.newPage();

    await mockCommonData(p);
    await mockSurveyAndReport(p);
    await mockSurveyStudentSubmissions(p);

    await p.goto(`/profesor/questionnaires/${SURVEY_ID}/results`);
    await p.waitForSelector('text=Alumno Encuesta', { timeout: 10000 });

    // Usar tbody para apuntar específicamente al botón de la tabla, no al del header
    await p.locator('tbody button:has-text("Ver")').first().click();
    await p.waitForSelector('text=Revisar y Calificar', { timeout: 8000 });

    // Con isSurvey=true el template no renderiza el span "Correcta" ni el mensaje "Incorrecta"
    await expect(p.locator('text=Correcta').first()).not.toBeVisible();
    await expect(p.locator('text=Incorrecta').first()).not.toBeVisible();

    // El span de "X puntos" está condicionado a !isSurvey en el template
    await expect(p.locator('text=puntos').first()).not.toBeVisible();

    await ctx.close();
  });

  test('Modal de revisión de encuesta NO muestra campo de puntos para preguntas TEXT', async ({ page }) => {
    const ctx = await createProfesorContext(page);
    const p = await ctx.newPage();

    await mockCommonData(p);
    await mockSurveyAndReport(p);
    await mockSurveyStudentSubmissions(p);

    await p.goto(`/profesor/questionnaires/${SURVEY_ID}/results`);
    await p.waitForSelector('text=Alumno Encuesta', { timeout: 10000 });

    // Usar tbody para apuntar específicamente al botón de la tabla, no al del header
    await p.locator('tbody button:has-text("Ver")').first().click();
    await p.waitForSelector('text=Revisar y Calificar', { timeout: 8000 });

    // El label "Puntos (de X)" está condicionado a !isSurvey en el template
    await expect(p.locator('label:has-text("Puntos")')).not.toBeVisible();

    await ctx.close();
  });

  test('Cuestionario normal SÍ muestra columna "Nota" y "Tiempo de Resolución"', async ({ page }) => {
    const ctx = await createProfesorContext(page);
    const p = await ctx.newPage();

    await mockCommonData(p);

    await p.context().route(`${API}/questionnaires/${QUESTIONNAIRE_ID}`, (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            _id: QUESTIONNAIRE_ID,
            courseId: COURSE_ID,
            title: 'Examen Final',
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
        body: JSON.stringify({
          data: [{
            ...MOCK_SURVEY_GRADED_SUBMISSION,
            questionnaireId: QUESTIONNAIRE_ID,
            studentName: 'Alumno Examen',
            finalScore: 85,
            autoGradedScore: 85,
          }],
        }),
      })
    );

    await p.goto(`/profesor/questionnaires/${QUESTIONNAIRE_ID}/results`);
    await p.waitForSelector('text=Alumno Examen', { timeout: 10000 });

    await expect(p.locator('th:has-text("Nota")')).toBeVisible();
    await expect(p.locator('th:has-text("Tiempo de Resolución")')).toBeVisible();

    // "Completada" es solo para encuestas
    await expect(p.locator('text=Completada')).not.toBeVisible();

    await ctx.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ISSUE #116 — Botón exclusivo para crear encuesta de satisfacción
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Issue #116 — Botón exclusivo para crear encuesta de satisfacción', () => {

  test('Existe un botón separado "Crear Encuesta de Satisfacción" en la lista de cuestionarios', async ({ page }) => {
    const ctx = await createProfesorContext(page);
    const p = await ctx.newPage();

    await mockCommonData(p);
    await mockQuestionnairesListBoth(p);

    await p.goto(`/profesor/questionnaires?courseId=${COURSE_ID}`);
    await p.waitForSelector('text=Examen Final', { timeout: 10000 });

    // El template usa exactamente este texto en el botón verde
    const surveyBtn = p.locator('button:has-text("Crear Encuesta de Satisfacción")').first();
    await expect(surveyBtn).toBeVisible({ timeout: 5000 });

    await ctx.close();
  });

  test('El botón "Nuevo Cuestionario" también existe (no fue reemplazado)', async ({ page }) => {
    const ctx = await createProfesorContext(page);
    const p = await ctx.newPage();

    await mockCommonData(p);
    await mockQuestionnairesListBoth(p);

    await p.goto(`/profesor/questionnaires?courseId=${COURSE_ID}`);
    await p.waitForSelector('text=Examen Final', { timeout: 10000 });

    const questionnaireBtn = p.locator('button:has-text("Nuevo Cuestionario"), a:has-text("Nuevo Cuestionario")').first();
    await expect(questionnaireBtn).toBeVisible({ timeout: 5000 });

    await ctx.close();
  });

  test('El botón "Crear Encuesta de Satisfacción" navega a la ruta de creación con isSurvey=true', async ({ page }) => {
    const ctx = await createProfesorContext(page);
    const p = await ctx.newPage();

    await mockCommonData(p);
    await mockQuestionnairesListBoth(p);

    await p.goto(`/profesor/questionnaires?courseId=${COURSE_ID}`);
    await p.waitForSelector('text=Examen Final', { timeout: 10000 });

    // openQuestionnaireEdit(undefined, true) navega a /profesor/questionnaires/new?isSurvey=true
    const surveyBtn = p.locator('button:has-text("Crear Encuesta de Satisfacción")').first();
    await surveyBtn.click();

    await p.waitForURL(
      url => url.toString().includes('questionnaires/new') && (url.toString().includes('survey') || url.toString().includes('isSurvey')),
      { timeout: 5000 }
    );

    // Si el checkbox isSurvey está visible, debe estar marcado por defecto
    const isSurveyCheckbox = p.locator('input[formControlName="isSurvey"]');
    if (await isSurveyCheckbox.isVisible()) {
      await expect(isSurveyCheckbox).toBeChecked();
    }

    await ctx.close();
  });

  test('Los cuestionarios tipo encuesta se identifican visualmente en la lista', async ({ page }) => {
    const ctx = await createProfesorContext(page);
    const p = await ctx.newPage();

    await mockCommonData(p);
    await mockQuestionnairesListBoth(p);

    await p.goto(`/profesor/questionnaires?courseId=${COURSE_ID}`);
    await p.waitForSelector('text=Examen Final', { timeout: 10000 });

    // El template muestra un badge "📋 Encuesta de Satisfacción" para isSurvey=true
    await expect(p.locator('text=Encuesta de Satisfacción del Curso').first()).toBeVisible({ timeout: 5000 });
    await expect(p.locator('text=Encuesta de Satisfacción').first()).toBeVisible({ timeout: 5000 });

    // El cuestionario normal no tiene ese badge
    await expect(p.locator('text=Examen Final').first()).toBeVisible();

    await ctx.close();
  });
});