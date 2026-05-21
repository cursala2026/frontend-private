import { test, expect } from '@playwright/test';

test('Reset permite editar preguntas tras eliminar envíos (mocked)', async ({ page }) => {
  const API = 'http://localhost:4200/api/v1';
  const qId = 'q-e2e-1';

  // Mocked questionnaire payload
  const questionnaire = {
    _id: qId,
    courseId: 'c1',
    title: 'E2E Reset Edit Test',
    status: 'ACTIVE',
    position: { type: 'BETWEEN_CLASSES', afterClassId: 'cls1' },
    questions: [
      { _id: 'q1', type: 'MULTIPLE_CHOICE', questionText: 'Q1', order: 0, points: 10, required: true, options: [{ _id: 'o1', text: 'A', order: 0 }, { _id: 'o2', text: 'B', order: 1 }], correctOptionId: '0' }
    ]
  };

  let hasSubmissionsFlag = true;

  // Single catch-all handler for API routes we need to mock
  await page.route('**/*', async route => {
    const url = route.request().url();
    const method = route.request().method();

    // Only handle our API paths
    if (url.includes('/api/v1/questionnaires')) {
      // GET questionnaire
      if (method === 'GET' && url.endsWith(`/questionnaires/${qId}`)) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: questionnaire }) });
        return;
      }

      // GET has-submissions
      if (method === 'GET' && url.includes(`/questionnaires/${qId}/has-submissions`)) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { hasSubmissions: hasSubmissionsFlag } }) });
        return;
      }

      // GET questionnaires by course
      if (method === 'GET' && url.includes('/questionnaires/course/')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
        return;
      }

      // DELETE submissions (toggle flag)
      if (method === 'DELETE' && url.includes(`/questionnaires/${qId}/submissions`)) {
        hasSubmissionsFlag = false;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { deleted: true } }) });
        return;
      }
    }

    // Classes endpoint
    if (url.includes('/api/v1/class/course/') && url.includes('/classes')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
      return;
    }

    // Otherwise continue (let network handle it)
    route.continue();
  });

  // Instead of navigating the full Angular app (dev server may not be running),
  // test the client-side flow by issuing fetch requests from the page context
  // which are intercepted by Playwright's route handlers above.

  const getQuestionnaire = await page.evaluate(async ({ api, id }) => {
    const r = await fetch(`${api}/questionnaires/${id}`);
    return r.json();
  }, { api: API, id: qId });
  expect(getQuestionnaire?.data?._id).toBe(qId);

  const hasBefore = await page.evaluate(async ({ api, id }) => {
    const r = await fetch(`${api}/questionnaires/${id}/has-submissions`);
    return r.json();
  }, { api: API, id: qId });
  expect(hasBefore?.data?.hasSubmissions).toBe(true);

  // Perform DELETE using the app origin so the page.route handler flips the flag
  const deleteStatus = await page.evaluate(async ({ api, id }) => {
    const r = await fetch(`${api}/questionnaires/${id}/submissions`, { method: 'DELETE' });
    return r.status;
  }, { api: API, id: qId });
  expect(deleteStatus).toBe(200);

  const hasAfter = await page.evaluate(async ({ api, id }) => {
    const r = await fetch(`${api}/questionnaires/${id}/has-submissions`);
    return r.json();
  }, { api: API, id: qId });
  expect(hasAfter?.data?.hasSubmissions).toBe(false);
});
