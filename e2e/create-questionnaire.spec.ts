import { test, expect } from '@playwright/test';

const API_BASE = 'http://localhost:8081/api/v1';

test('API: Crear cuestionario de prueba y verificar', async ({ request }) => {
  const loginResp = await request.post(`${API_BASE}/login`, { data: { user: 'sebas', password: 'seba1979' } });
  expect(loginResp.status()).toBe(200);
  const loginJson = await loginResp.json();
  const token = loginJson?.data?.token;
  expect(token).toBeTruthy();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

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

  const createResp = await request.post(`${API_BASE}/questionnaires`, { headers, data: payload });
  const createBody = await createResp.json().catch(() => null);
  console.log('Create status', createResp.status());
  console.log('Create body', createBody);
  expect(createResp.ok()).toBeTruthy();
  const created = createBody?.data;
  expect(created).toBeTruthy();
  console.log('Created questionnaire id:', created?._id);

  // Cleanup: delete the created questionnaire to keep environment clean
  if (created?._id) {
    const delResp = await request.delete(`${API_BASE}/questionnaires/${created._id}`, { headers });
    console.log('Delete status', delResp.status());
    expect(delResp.ok()).toBeTruthy();
  }
});