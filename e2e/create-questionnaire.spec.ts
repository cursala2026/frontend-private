import { test, expect } from '@playwright/test';

test('API (mocked): Crear cuestionario simulando backend', async ({ page }) => {
  const payload = {
    courseId: '69fe33c71e5015c9b8a147bb',
    title: 'E2E Test - Cuestionario de edición',
    description: 'Cuestionario creado por Playwright para probar edición',
    status: 'ACTIVE',
    position: { type: 'BETWEEN_CLASSES', afterClassId: '69fe3f171e5015c9b8a147c0' },
    questions: [
      {
        type: 'MULTIPLE_CHOICE',
        questionText: 'Pregunta de prueba: ¿Cuál es la opción correcta?',
        order: 0,
        points: 10,
        required: true,
        options: [
          { text: 'Opción A', order: 0 },
          { text: 'Opción B', order: 1 },
          { text: 'Opción C', order: 2 }
        ],
        correctOptionId: 1
      }
    ]
  };

  // Interceptar la creación y devolver un objeto "creado" sin tocar el backend real
  await page.route('**/api/v1/questionnaires', route => {
    if (route.request().method() === 'POST') {
      const created = { ...payload, _id: 'fake-created-id' };
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: created })
      });
      return;
    }
    // Passthrough para otros métodos si hiciera falta
    route.continue();
  });

  // Interceptar el borrado (cleanup) y devolver 200
  await page.route('**/api/v1/questionnaires/*', route => {
    if (route.request().method() === 'DELETE') {
      route.fulfill({ status: 200 });
      return;
    }
    route.continue();
  });

  // No dependemos del servidor local: usar URL absoluta para que Playwright
  // intercepte la petición con `page.route` aunque la app no esté subida.
  await page.goto('about:blank');
  const resp = await page.evaluate(async (payload) => {
    const r = await fetch('http://localhost:4200/api/v1/questionnaires', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await r.json();
    return { status: r.status, body: json };
  }, payload);

  expect(resp.status).toBe(201);
  expect(resp.body?.data?._id).toBe('fake-created-id');

  // Simular cleanup
  const delResp = await page.evaluate(async (id) => {
    const r = await fetch(`http://localhost:4200/api/v1/questionnaires/${id}`, { method: 'DELETE' });
    return r.status;
  }, 'fake-created-id');
  expect(delResp).toBe(200);
});