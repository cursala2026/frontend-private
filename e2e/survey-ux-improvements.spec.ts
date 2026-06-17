/**
 * E2E Tests — Issue #114: Mejora en la experiencia de usuario
 *
 * Verifica:
 * 1. El alumno puede visualizar sus respuestas antes de enviarlas
 * 2. Aparece checkbox preguntando si quiere recibir copia por email (en pantalla de revisión)
 * 3. Las preguntas de escala lineal muestran escala visual horizontal
 */

import { test, expect, Page, Route } from '@playwright/test';
import path from 'path';
import {
  COURSE_ID,
  QUESTIONNAIRE_ID,
  STUDENT_USER_ID,
} from './helpers/auth';

const API = 'http://localhost:8081/api/v1';

// El tipo correcto para escala visual es LINEAR_SCALE, no MULTIPLE_CHOICE con isRange
const MOCK_QUESTIONNAIRE_WITH_RANGE = {
  _id: QUESTIONNAIRE_ID,
  courseId: COURSE_ID,
  title: 'Encuesta UX',
  status: 'ACTIVE',
  isSurvey: true,
  passingScore: 0,
  allowRetries: false,
  showCorrectAnswers: false,
  questions: [
    {
      _id: 'q1',
      type: 'LINEAR_SCALE',
      questionText: '¿Cómo calificarías el curso del 1 al 10?',
      order: 1,
      points: 0,
      required: true,
      scaleMin: 1,
      scaleMax: 10,
      scaleMinLabel: 'Muy malo',
      scaleMaxLabel: 'Excelente',
    },
    {
      _id: 'q2',
      type: 'TEXT',
      questionText: '¿Qué fue lo más valioso del curso?',
      order: 2,
      points: 0,
      required: false,
    },
  ],
};

async function mockSurveyUX(page: Page) {
  await page.context().route('**/api/v1/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/auth') || url.endsWith('/me') || url.includes('/users/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {} }) });
    }
    return route.continue();
  });

  await page.context().route(`${API}/questionnaires/${QUESTIONNAIRE_ID}`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_QUESTIONNAIRE_WITH_RANGE }),
    })
  );

  await page.context().route(
    `${API}/questionnaires/${QUESTIONNAIRE_ID}/submissions/student/${STUDENT_USER_ID}`,
    (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      })
  );

  await page.context().route(`${API}/questionnaires/${QUESTIONNAIRE_ID}/submissions`, (route: Route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            _id: 'sub-ux-001',
            questionnaireId: QUESTIONNAIRE_ID,
            studentId: STUDENT_USER_ID,
            attemptNumber: 1,
            answers: [],
            status: 'IN_PROGRESS',
          },
        }),
      });
    }
    return route.continue();
  });

  await page.context().route(`${API}/questionnaires/submissions/sub-ux-001`, (route: Route) => {
    if (route.request().method() === 'PATCH') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { status: 'SUBMITTED' } }),
      });
    }
    return route.continue();
  });

  await page.context().route(`${API}/courseProgress/${COURSE_ID}`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { questionnairesProgress: [], classesProgress: [] } }),
    })
  );

  await page.context().route(`${API}/courses/${COURSE_ID}`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          _id: COURSE_ID,
          name: 'Curso UX',
          orderedContent: [{ type: 'QUESTIONNAIRE', data: { _id: QUESTIONNAIRE_ID, title: 'Encuesta UX' } }],
        },
      }),
    })
  );
}

// Helper para crear contexto de alumno
async function createAlumnoContext(page: Page) {
  const browser = page.context().browser();
  if (!browser) throw new Error('No browser available');
  return browser.newContext({
    storageState: path.join(__dirname, '.auth-alumno.json'),
    baseURL: 'http://localhost:4200',
  });
}

// Helper para navegar hasta la pantalla de preguntas
async function navigateToQuestions(p: Page) {
  await p.goto(`/alumno/course-detail/${COURSE_ID}/questionnaire/${QUESTIONNAIRE_ID}`);
  await p.waitForSelector('text=Encuesta UX', { timeout: 10000 });

  // El botón de inicio se llama "Comenzar Cuestionario"
  const startBtn = p.locator('button:has-text("Comenzar Cuestionario")');
  await startBtn.click();

  await p.waitForSelector('text=¿Cómo calificarías el curso', { timeout: 10000 });
}

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Issue #114 — Mejoras de UX en cuestionarios y encuestas', () => {

  test('El alumno puede ver un resumen de sus respuestas antes de enviar', async ({ page }) => {
    const ctx = await createAlumnoContext(page);
    const p = await ctx.newPage();

    await mockSurveyUX(p);
    await navigateToQuestions(p);

    // Responder la pregunta de escala lineal seleccionando el radio value=7
    await p.locator('input[type="radio"][value="7"]').click();

    // El botón para avanzar a revisión se llama "Siguiente: Revisar"
    await p.locator('button:has-text("Siguiente: Revisar")').click();

    // Debe mostrar la pantalla de "Revisión Final"
    await p.waitForSelector('text=Revisión Final', { timeout: 5000 });

    // La pantalla de revisión debe existir con el mensaje de revisión
    await expect(p.locator('text=Revisión Final')).toBeVisible();
    await expect(p.locator('text=revisa tus opciones')).toBeVisible();

    await ctx.close();
  });

  test('En la pantalla de revisión aparece opción para recibir copia por email', async ({ page }) => {
    const ctx = await createAlumnoContext(page);
    const p = await ctx.newPage();

    await mockSurveyUX(p);
    await navigateToQuestions(p);

    // Responder y avanzar a revisión
    await p.locator('input[type="radio"][value="5"]').click();
    await p.locator('button:has-text("Siguiente: Revisar")').click();
    await p.waitForSelector('text=Revisión Final', { timeout: 5000 });

    // Debe aparecer el checkbox de copia por email
    const emailLabel = p.locator('label:has-text("Enviarme una copia de mis respuestas")');
    await expect(emailLabel).toBeVisible({ timeout: 3000 });

    // El checkbox debe estar accesible
    const emailCheckbox = p.locator('#emailCopy');
    await expect(emailCheckbox).toBeVisible();

    // El botón de confirmar envío debe estar presente
    await expect(p.locator('button:has-text("Confirmar y Enviar")')).toBeVisible();

    await ctx.close();
  });

  test('Preguntas de escala lineal muestran escala visual horizontal', async ({ page }) => {
    const ctx = await createAlumnoContext(page);
    const p = await ctx.newPage();

    await mockSurveyUX(p);
    await navigateToQuestions(p);

    // Los radios de la escala lineal deben estar visibles
    // El template renderiza inputs[type=radio] con los valores 1-10 en un flex horizontal
    await expect(p.locator('input[type="radio"][value="1"]')).toBeVisible({ timeout: 5000 });
    await expect(p.locator('input[type="radio"][value="10"]')).toBeVisible();

    // Las etiquetas de mínimo y máximo deben mostrarse
    await expect(p.locator('text=Muy malo')).toBeVisible();
    await expect(p.locator('text=Excelente')).toBeVisible();

    // Verificar que los números 1 y 10 están en la misma fila (layout horizontal)
    const box1 = await p.locator('input[type="radio"][value="1"]').boundingBox();
    const box10 = await p.locator('input[type="radio"][value="10"]').boundingBox();

    if (box1 && box10) {
      const yDiff = Math.abs(box1.y - box10.y);
      expect(yDiff).toBeLessThan(50);
    }

    await ctx.close();
  });

  test('El alumno puede seleccionar un valor en la escala lineal y avanzar a revisión', async ({ page }) => {
    const ctx = await createAlumnoContext(page);
    const p = await ctx.newPage();

    await mockSurveyUX(p);
    await navigateToQuestions(p);

    // Seleccionar el valor 8 en la escala lineal
    await p.locator('input[type="radio"][value="8"]').click();

    // Verificar que quedó seleccionado
    await expect(p.locator('input[type="radio"][value="8"]')).toBeChecked();

    // El botón "Siguiente: Revisar" debe estar habilitado
    const reviewBtn = p.locator('button:has-text("Siguiente: Revisar")');
    await expect(reviewBtn).toBeEnabled({ timeout: 3000 });

    // Avanzar a revisión
    await reviewBtn.click();
    await p.waitForSelector('text=Revisión Final', { timeout: 5000 });

    // Desde revisión se puede volver a editar
    await p.locator('button:has-text("Volver y editar respuestas")').click();
    await p.waitForSelector('text=¿Cómo calificarías el curso', { timeout: 5000 });

    // La respuesta debe mantenerse seleccionada
    await expect(p.locator('input[type="radio"][value="8"]')).toBeChecked();

    await ctx.close();
  });
});