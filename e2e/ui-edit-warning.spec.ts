import { test, expect, Page, Route } from '@playwright/test';
import { injectProfesorAuth } from './helpers/auth';

const API = 'http://localhost:8081/api/v1';
const QUESTIONNAIRE_ID = 'ui-warning-qid-000000000000';
const COURSE_ID = 'ui-warning-course-000000000000';

test('UI muestra advertencia y bloquea cambios estructurales cuando hay envíos', async ({ page }) => {
  await injectProfesorAuth(page);

  // Log requests/responses to help debug why /has-submissions may not be called
  page.on('request', req => console.log('REQ ->', req.method(), req.url()));
  page.on('response', resp => console.log('RESP <-', resp.status(), resp.url()));

  // Mock del cuestionario
  await page.route(`${API}/questionnaires/${QUESTIONNAIRE_ID}`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          _id: QUESTIONNAIRE_ID,
          courseId: COURSE_ID,
          title: 'UI Warning Test',
          status: 'ACTIVE',
          position: { type: 'FINAL_EXAM' },
          questions: [
            {
              _id: 'q1',
              type: 'MULTIPLE_CHOICE',
              questionText: 'Pregunta 1',
              order: 0,
              points: 10,
              required: true,
              options: [
                { _id: 'o1', text: 'A', order: 0 },
                { _id: 'o2', text: 'B', order: 1 },
                { _id: 'o3', text: 'C', order: 2 }
              ],
              correctOptionId: 'o1'
            }
          ],
          passingScore: 70,
          allowRetries: false,
          showCorrectAnswers: false
        }
      })
    })
  );

  // Mock has-submissions -> true
  await page.route(`${API}/questionnaires/${QUESTIONNAIRE_ID}/has-submissions`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { hasSubmissions: true } })
    })
  );

  // Mock classes list called by the component
  await page.route(`${API}/class/course/${COURSE_ID}/classes`, (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
  );

  // Mock questionnairesByCourse
  await page.route(`${API}/questionnaires/course/${COURSE_ID}`, (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
  );

  // Navegar a la página de edición
  await page.goto(`/profesor/questionnaires/${QUESTIONNAIRE_ID}/edit`);

  // Esperar que el formulario cargue
  await page.waitForSelector('button:has-text("Actualizar Cuestionario")', { timeout: 20000 });

  // Verificar banner (esperar hasta 10s por si ya se ha procesado la respuesta previamente)
  const banner = page.locator('text=ya tiene envíos');
  // Dump a snippet of the page HTML for debugging
  const html = await page.content();
  console.log('PAGE HTML SNIPPET:', html.slice(0, 20000));
  const bannerCount = await banner.count();
  console.log('BANNER COUNT:', bannerCount);
  const bodyText = await page.textContent('body');
  console.log('BODY TEXT SNIPPET:', (bodyText || '').slice(0, 20000));
  await expect(banner).toBeVisible({ timeout: 10000 });

  // Verificar que el botón agregar pregunta esté deshabilitado
  const addQuestionBtn = page.locator('button:has-text("Agregar Pregunta")');
  await expect(addQuestionBtn).toBeDisabled();

  // Dentro del primer question-item, contar opciones
  const firstQuestion = page.locator('app-question-item').first();
  const optionInputs = firstQuestion.locator('input[formcontrolname="text"]');
  const beforeCount = await optionInputs.count();

  // Intentar agregar opción y verificar que no aumente el conteo
  const addOptionBtn = firstQuestion.locator('button:has-text("Agregar Opción")');
  await addOptionBtn.click();
  await page.waitForTimeout(300); // pequeño delay para que lógica JS se ejecute
  const afterCount = await optionInputs.count();
  await expect(afterCount).toBe(beforeCount);

  // Intentar eliminar la primera opción y verificar que conteo no cambie
  const deleteButtons = firstQuestion.locator('button:has-text("Eliminar")');
  if (await deleteButtons.count() > 0) {
    await deleteButtons.first().click();
    await page.waitForTimeout(300);
    const afterDeleteCount = await optionInputs.count();
    await expect(afterDeleteCount).toBe(beforeCount);
  }
});
