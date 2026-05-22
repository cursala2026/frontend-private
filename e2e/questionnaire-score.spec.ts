/**
 * E2E Tests — Bug #4: updateCourseProgress usaba || en vez de ?? para el score.
 *
 * Escenario: submission con finalScore=0 y autoGradedScore=75.
 * - ANTES del fix: score = 0 || 75 = 75 → passed=true → nextItem se setea → botón "Continuar" visible
 * - DESPUÉS del fix: score = 0 ?? 75 = 0 → passed=false → nextItem=null → botón "Continuar" oculto
 */

import { test, expect, Page, Route } from '@playwright/test';
import {
  injectAlumnoAuth,
  COURSE_ID,
  QUESTIONNAIRE_ID,
  CLASS_ID,
  STUDENT_USER_ID,
} from './helpers/auth';

const API = 'http://localhost:8081/api/v1';

/** Mockea el cuestionario con passingScore=50 y allowRetries=true. */
async function mockQuestionnaire(page: Page) {
  await page.context().route(`${API}/questionnaires/${QUESTIONNAIRE_ID}`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          _id: QUESTIONNAIRE_ID,
          courseId: COURSE_ID,
          title: 'Quiz de Prueba',
          status: 'ACTIVE',
          position: { type: 'FINAL_EXAM' },
          questions: [
            {
              _id: 'q1',
              type: 'MULTIPLE_CHOICE',
              questionText: '¿Cuánto es 1+1?',
              order: 1,
              points: 100,
              required: true,
              options: [{ _id: 'o1', text: '2', order: 1 }],
              correctOptionId: 'o1',
            },
          ],
          passingScore: 50,
          allowRetries: true,
          maxRetries: 3,
          showCorrectAnswers: false,
        },
      }),
    })
  );
}

/** Mockea el curso con un CLASS después del cuestionario (para poder navegar). */
async function mockCourse(page: Page) {
  await page.context().route(`${API}/courses/${COURSE_ID}`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          _id: COURSE_ID,
          name: 'Curso de Prueba',
          orderedContent: [
            { type: 'QUESTIONNAIRE', data: { _id: QUESTIONNAIRE_ID, title: 'Quiz de Prueba' } },
            { type: 'CLASS', data: { _id: CLASS_ID, title: 'Clase Siguiente', status: 'ACTIVE' } },
          ],
          classes: [{ _id: CLASS_ID, name: 'Clase Siguiente', status: 'ACTIVE' }],
          questionnaires: [],
        },
      }),
    })
  );
}

/** Mockea el progreso del alumno en el curso. */
async function mockCourseProgress(page: Page) {
  await page.context().route(`${API}/courseProgress/${COURSE_ID}`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          userId: STUDENT_USER_ID,
          courseId: COURSE_ID,
          classesProgress: [],
          questionnairesProgress: [
            { questionnaireId: QUESTIONNAIRE_ID, completed: false, bestScore: 0, attempts: 1 },
          ],
          overallProgress: 0,
          startedAt: new Date().toISOString(),
          lastAccessedAt: new Date().toISOString(),
        },
      }),
    })
  );
}

/** Mockea las submissions del alumno para el cuestionario con el finalScore indicado. */
async function mockSubmissions(page: Page, finalScore: number, autoGradedScore: number) {
  await page.context().route(
    `${API}/questionnaires/${QUESTIONNAIRE_ID}/submissions/student/${STUDENT_USER_ID}`,
    (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              _id: 'ffffffffffffffffffffffff',
              questionnaireId: QUESTIONNAIRE_ID,
              courseId: COURSE_ID,
              studentId: STUDENT_USER_ID,
              attemptNumber: 1,
              answers: [],
              status: 'GRADED',
              autoGradedScore,
              finalScore,
              startedAt: new Date().toISOString(),
              submittedAt: new Date().toISOString(),
            },
          ],
        }),
      })
  );
}

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Bug #4 — finalScore=0 tratado como 0, no falsy (operador ??)', () => {
  test(
    'Botón "Continuar" NO visible cuando finalScore=0 y autoGradedScore=75 (alumno no aprobó con 0)',
    async ({ page }) => {
      // 1. Crear un contexto nuevo con storageState (asegura token/localStorage)
      const browser = page.context().browser();
      if (!browser) throw new Error('No browser instance available');
      const ctx = await browser.newContext({ storageState: 'F:/cursala/cursala-private/frontend-private/e2e/.auth-alumno.json', baseURL: 'http://localhost:4200' });
      const p = await ctx.newPage();

      // 2. Configurar mocks de API en el nuevo page/context
      await mockCourse(p);
      await mockQuestionnaire(p);
      await mockSubmissions(p, 0, 75); // finalScore=0, autoGradedScore=75
      await mockCourseProgress(p);

      // 3. Navegar a la página (Angular inicializa con token en localStorage)
      await p.goto(`/alumno/course-detail/${COURSE_ID}/questionnaire/${QUESTIONNAIRE_ID}`);

      // 4. Esperar que cargue la vista de resultados
      await p.waitForSelector('text=Resultado del Cuestionario', { timeout: 10000 });

      // 5. El botón "Continuar" NO debe estar visible
      const continuarBtn = p.locator('button:has-text("Continuar")');
      await expect(continuarBtn).not.toBeVisible();

      await ctx.close();
    }
  );

  test(
    'Botón "Continuar" SÍ visible cuando finalScore=80 (alumno aprobó)',
    async ({ page }) => {
      const browser2 = page.context().browser();
      if (!browser2) throw new Error('No browser instance available');
      const ctx = await browser2.newContext({ storageState: 'F:/cursala/cursala-private/frontend-private/e2e/.auth-alumno.json', baseURL: 'http://localhost:4200' });
      const p = await ctx.newPage();

      await mockCourse(p);
      await mockQuestionnaire(p);
      await mockSubmissions(p, 80, 75); // finalScore=80 → pasa el corte de 50
      await mockCourseProgress(p);

      await p.goto(`/alumno/course-detail/${COURSE_ID}/questionnaire/${QUESTIONNAIRE_ID}`);
      await p.waitForSelector('text=Resultado del Cuestionario', { timeout: 10000 });

      // Con score=80 >= passingScore=50 → passed=true, nextItem=CLASS → "Continuar" visible
      const continuarBtn = p.locator('button:has-text("Continuar")');
      await expect(continuarBtn).toBeVisible({ timeout: 5000 });

      await ctx.close();
    }
  );

  test(
    'Botón "Intentar Nuevamente" SÍ visible cuando finalScore=0 (respetando que 0 no es falsy)',
    async ({ page }) => {
      const browser3 = page.context().browser();
      if (!browser3) throw new Error('No browser instance available');
      const ctx = await browser3.newContext({ storageState: 'F:/cursala/cursala-private/frontend-private/e2e/.auth-alumno.json', baseURL: 'http://localhost:4200' });
      const p = await ctx.newPage();

      await mockCourse(p);
      await mockQuestionnaire(p);
      await mockSubmissions(p, 0, 75);
      await mockCourseProgress(p);

      await p.goto(`/alumno/course-detail/${COURSE_ID}/questionnaire/${QUESTIONNAIRE_ID}`);
      await p.waitForSelector('text=Resultado del Cuestionario', { timeout: 10000 });

      // "Intentar Nuevamente" muestra solo cuando GRADED && canRetry && !isPassed()
      // getsScore() con ?? devuelve 0 → isPassed()=false → SÍ muestra
      const retryBtn = p.locator('button:has-text("Intentar Nuevamente")');
      await expect(retryBtn).toBeVisible();

      await ctx.close();
    }
  );
});
