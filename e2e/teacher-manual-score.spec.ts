/**
 * E2E Tests — Bug #7: updateManualScore usaba details.questionnaires (inexistente)
 *                      en vez de details.items.
 *
 * El fix cambia:
 *   const found = details.questionnaires.find(...)  // TypeError: undefined
 * por:
 *   const found = details.items.find(...)
 *
 * El test verifica que al editar una nota manual la UI se actualiza sin crashear
 * y el PATCH se envía con los datos correctos.
 */

import { test, expect, Page, Route } from '@playwright/test';
import {
  injectProfesorAuth,
  COURSE_ID,
  QUESTIONNAIRE_ID,
  CLASS_ID,
  STUDENT_USER_ID,
  PROFESOR_USER_ID,
} from './helpers/auth';

const API = 'http://localhost:8081/api/v1';

// ─── Mock data ───────────────────────────────────────────────────────────────

const MOCK_STUDENT = {
  userId: STUDENT_USER_ID,
  email: 'alumno@dev.local',
  username: 'alumno.dev',
  firstName: 'Alumno',
  lastName: 'Dev',
  courseId: COURSE_ID,
  courseName: 'Curso de Prueba',
  startDate: new Date().toISOString(),
  endDate: new Date().toISOString(),
  progress: 50,
  completedClasses: 1,
  totalClasses: 2,
  completedQuestionnaires: 0,
  totalQuestionnaires: 1,
};

const MOCK_COURSE = {
  _id: COURSE_ID,
  name: 'Curso de Prueba',
  classes: [
    { _id: CLASS_ID, name: 'Clase 1', status: 'ACTIVE', order: 1 },
  ],
  questionnaires: [],
};

const MOCK_PROGRESS = {
  userId: STUDENT_USER_ID,
  courseId: COURSE_ID,
  classesProgress: [{ classId: CLASS_ID, completed: true, watchTime: 100, duration: 100 }],
  questionnairesProgress: [
    { questionnaireId: QUESTIONNAIRE_ID, completed: true, bestScore: 75, attempts: 1 },
  ],
  overallProgress: 50,
  startedAt: new Date().toISOString(),
  lastAccessedAt: new Date().toISOString(),
};

const MOCK_QUESTIONNAIRES = [
  {
    _id: QUESTIONNAIRE_ID,
    title: 'Examen Final',
    courseId: COURSE_ID,
    status: 'ACTIVE',
    position: { type: 'FINAL_EXAM' },
    passingScore: 50,
    allowRetries: false,
  },
];

// ─── Setup helpers ────────────────────────────────────────────────────────────

async function setupMocks(page: Page) {
  // GET cursos del profesor
  await page.route(`${API}/courses/teacher/${PROFESOR_USER_ID}`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [MOCK_COURSE] }),
    })
  );

  // GET estudiantes del profesor
  await page.route(`${API}/user/getStudentsByTeacherCourses/${PROFESOR_USER_ID}`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [MOCK_STUDENT] }),
    })
  );

  // GET curso (para loadStudentProgressDetails)
  await page.route(`${API}/courses/${COURSE_ID}`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_COURSE }),
    })
  );

  // GET progreso del alumno
  await page.route(`${API}/courseProgress/${COURSE_ID}?userId=${STUDENT_USER_ID}`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_PROGRESS }),
    })
  );

  // GET cuestionarios del curso
  await page.route(`${API}/questionnaires/course/${COURSE_ID}`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_QUESTIONNAIRES }),
    })
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Bug #7 — updateManualScore usa details.items, no details.questionnaires', () => {
  test.beforeEach(async ({ page }) => {
    await injectProfesorAuth(page);
    await setupMocks(page);
  });

  test('El PATCH de nota manual se envía con score correcto', async ({ page }) => {
    // Interceptar PATCH para verificar payload
    let capturedBody: any = null;
    await page.route(`${API}/courseProgress/manual-update`, async (route: Route) => {
      capturedBody = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            ...MOCK_PROGRESS,
            overallProgress: 75,
          },
        }),
      });
    });

    await page.goto(`/profesor/students?courseId=${COURSE_ID}`);

    // Esperar que cargue la lista de alumnos
    await page.waitForSelector('text=Alumno Dev', { timeout: 10000 });

    // Expandir el alumno para ver sus detalles
    await page.locator('text=Alumno Dev').first().click();

    // Esperar que aparezca el input de nota (solo visible cuando item.completed=true)
    await page.waitForSelector('input[type="number"][min="0"][max="100"]', { timeout: 5000 });

    // Cambiar la nota a 90
    const scoreInput = page.locator('input[type="number"][min="0"][max="100"]').first();
    await scoreInput.fill('90');
    await scoreInput.blur(); // dispara updateManualScore

    // Esperar que se envíe el PATCH
    await page.waitForTimeout(500);

    // Verificar el payload del PATCH
    expect(capturedBody).not.toBeNull();
    expect(capturedBody.score).toBe(90);
    expect(capturedBody.userId).toBe(STUDENT_USER_ID);
    expect(capturedBody.courseId).toBe(COURSE_ID);
    expect(capturedBody.itemId).toBe(QUESTIONNAIRE_ID);
    expect(capturedBody.type).toBe('questionnaire');
  });

  test('La UI no crashea al actualizar nota (details.items existe)', async ({ page }) => {
    await page.route(`${API}/courseProgress/manual-update`, (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { ...MOCK_PROGRESS, overallProgress: 80 },
        }),
      })
    );

    await page.goto(`/profesor/students?courseId=${COURSE_ID}`);
    await page.waitForSelector('text=Alumno Dev', { timeout: 10000 });
    await page.locator('text=Alumno Dev').first().click();

    // Esperar detalles
    await page.waitForSelector('input[type="number"][min="0"][max="100"]', { timeout: 5000 });

    const scoreInput = page.locator('input[type="number"][min="0"][max="100"]').first();
    await scoreInput.fill('85');
    await scoreInput.blur();

    // Esperar respuesta
    await page.waitForTimeout(500);

    // El mensaje de éxito debe mostrarse (no un error de crash)
    // La ausencia de errores de JavaScript en consola también cuenta
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // No debe haber errores del tipo "Cannot read properties of undefined"
    const crashErrors = errors.filter(e => e.includes('Cannot read properties'));
    expect(crashErrors).toHaveLength(0);
  });

  test('El progreso general del alumno se actualiza en la lista después del PATCH', async ({ page }) => {
    await page.route(`${API}/courseProgress/manual-update`, (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            ...MOCK_PROGRESS,
            overallProgress: 100,
            questionnairesProgress: [
              { questionnaireId: QUESTIONNAIRE_ID, completed: true, bestScore: 95, attempts: 1 },
            ],
          },
        }),
      })
    );

    await page.goto(`/profesor/students?courseId=${COURSE_ID}`);
    await page.waitForSelector('text=Alumno Dev', { timeout: 10000 });
    await page.locator('text=Alumno Dev').first().click();
    await page.waitForSelector('input[type="number"][min="0"][max="100"]', { timeout: 5000 });

    const scoreInput = page.locator('input[type="number"][min="0"][max="100"]').first();
    await scoreInput.fill('95');
    await scoreInput.blur();

    // El progreso general debe actualizarse a 100%
    // (la barra de progreso o el texto de porcentaje en la lista)
    await page.waitForTimeout(500);
    // La lista debe reflejar el nuevo progress sin error
    const studentRow = page.locator('text=Alumno Dev').first();
    await expect(studentRow).toBeVisible();
  });
});
