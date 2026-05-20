import { test, expect } from '@playwright/test';

const API_BASE = 'http://localhost:8081/api/v1';

test('Crear y editar cuestionario (API) para validar frontend behavior', async ({ request }) => {
  const loginResp = await request.post(`${API_BASE}/login`, { data: { user: 'sebas', password: 'seba1979' } });
  expect(loginResp.status()).toBe(200);
  const loginJson = await loginResp.json();
  const token = loginJson?.data?.token;
  expect(token).toBeTruthy();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const payload = {
    courseId: '69fe33c71e5015c9b8a147bb',
    title: 'E2E Test - Crear y editar',
    description: 'Creado para prueba de edición',
    status: 'ACTIVE',
    position: { type: 'BETWEEN_CLASSES', afterClassId: '69fe3f171e5015c9b8a147c0' },
    questions: [
      {
        type: 'MULTIPLE_CHOICE',
        questionText: 'Pregunta edit test',
        order: 0,
        points: 10,
        required: true,
        options: [
          { text: 'A', order: 0 },
          { text: 'B', order: 1 },
          { text: 'C', order: 2 }
        ],
        correctOptionId: 1
      }
    ]
  };

  const createResp = await request.post(`${API_BASE}/questionnaires`, { headers, data: payload });
  expect(createResp.status()).toBe(201);
  const createBody = await createResp.json();
  const created = createBody?.data;
  expect(created).toBeTruthy();
  const qId = created._id;

  // Now prepare an edit payload: change text of first option, include _id for options
  const updatedQuestions = created.questions.map((q: any) => {
    if (q.type === 'MULTIPLE_CHOICE' && q.options && q.options.length) {
      const opts = q.options.map((opt: any, idx: number) => ({ text: idx === 0 ? opt.text + ' EDIT' : opt.text, order: idx, _id: opt._id }));
      return { type: q.type, questionText: q.questionText, order: q.order, points: q.points, required: q.required, options: opts, correctOptionId: q.correctOptionId };
    }
    return q;
  });

  const editPayload = { title: created.title, description: created.description, status: created.status, position: created.position, questions: updatedQuestions };

  const patchResp = await request.patch(`${API_BASE}/questionnaires/${qId}`, { headers, data: editPayload });
  console.log('PATCH status', patchResp.status());
  const patchBody = await patchResp.json();
  console.log('PATCH body', patchBody);
  expect(patchResp.status()).toBe(200);

  // Cleanup
  const delResp = await request.delete(`${API_BASE}/questionnaires/${qId}`, { headers });
  expect(delResp.status()).toBe(200);
});