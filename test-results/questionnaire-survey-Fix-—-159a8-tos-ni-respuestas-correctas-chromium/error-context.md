# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: questionnaire-survey.spec.ts >> Fix — Encuestas no muestran configuración de evaluación >> Card de encuesta muestra badge y NO muestra nota mínima, reintentos ni respuestas correctas
- Location: e2e\questionnaire-survey.spec.ts:69:7

# Error details

```
TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('text=Encuesta de Satisfacción') to be visible

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - img
  - main [ref=e5]:
    - generic [ref=e7]:
      - img "Cursala Logo" [ref=e10] [cursor=pointer]
      - generic [ref=e11]:
        - heading "Iniciar Sesión" [level=3] [ref=e12]
        - generic [ref=e13]:
          - generic [ref=e14]:
            - generic [ref=e15]: Usuario o Email
            - generic [ref=e16]:
              - generic:
                - img
              - textbox "Usuario o Email" [ref=e17]:
                - /placeholder: Ingresa tu usuario
          - generic [ref=e18]:
            - generic [ref=e19]: Contraseña
            - generic [ref=e22]:
              - generic:
                - img
              - textbox "Ingresa tu contraseña" [ref=e23]
              - button "Mostrar contraseña" [ref=e24] [cursor=pointer]:
                - img [ref=e25]
          - generic [ref=e27]:
            - generic [ref=e28]:
              - checkbox "Recordarme" [ref=e29] [cursor=pointer]
              - generic [ref=e30] [cursor=pointer]: Recordarme
            - link "¿Olvidaste tu contraseña?" [ref=e31] [cursor=pointer]:
              - /url: /forgot-password
          - button "Iniciar Sesión" [ref=e33] [cursor=pointer]
          - paragraph [ref=e34]:
            - text: ¿No tienes una cuenta?
            - link "Regístrate aquí" [ref=e35] [cursor=pointer]:
              - /url: /register
```

# Test source

```ts
  1   | /**
  2   |  * E2E Tests — Fix: Encuestas de satisfacción no deben mostrar
  3   |  * configuración de nota mínima, reintentos ni respuestas correctas.
  4   |  */
  5   | 
  6   | import { test, expect, Page, Route } from '@playwright/test';
  7   | import {
  8   |   injectProfesorAuth,
  9   |   COURSE_ID,
  10  |   QUESTIONNAIRE_ID,
  11  | } from './helpers/auth';
  12  | 
  13  | const API = 'http://localhost:8081/api/v1';
  14  | 
  15  | async function mockQuestionnairesListWithSurvey(page: Page) {
  16  |   await page.route(`${API}/questionnaires/course/${COURSE_ID}`, (route: Route) =>
  17  |     route.fulfill({
  18  |       status: 200,
  19  |       contentType: 'application/json',
  20  |       body: JSON.stringify({
  21  |         data: [
  22  |           {
  23  |             _id: QUESTIONNAIRE_ID,
  24  |             courseId: COURSE_ID,
  25  |             title: 'Encuesta de Satisfacción',
  26  |             status: 'ACTIVE',
  27  |             isSurvey: true,
  28  |             passingScore: 70,
  29  |             allowRetries: false,
  30  |             showCorrectAnswers: false,
  31  |             position: { type: 'FINAL_EXAM' },
  32  |             questions: [],
  33  |           },
  34  |         ],
  35  |       }),
  36  |     })
  37  |   );
  38  | }
  39  | 
  40  | async function mockQuestionnairesListWithRegular(page: Page) {
  41  |   await page.route(`${API}/questionnaires/course/${COURSE_ID}`, (route: Route) =>
  42  |     route.fulfill({
  43  |       status: 200,
  44  |       contentType: 'application/json',
  45  |       body: JSON.stringify({
  46  |         data: [
  47  |           {
  48  |             _id: QUESTIONNAIRE_ID,
  49  |             courseId: COURSE_ID,
  50  |             title: 'Examen Final',
  51  |             status: 'ACTIVE',
  52  |             isSurvey: false,
  53  |             passingScore: 70,
  54  |             allowRetries: false,
  55  |             showCorrectAnswers: false,
  56  |             position: { type: 'FINAL_EXAM' },
  57  |             questions: [],
  58  |           },
  59  |         ],
  60  |       }),
  61  |     })
  62  |   );
  63  | }
  64  | 
  65  | // ─────────────────────────────────────────────────────────────────────────────
  66  | 
  67  | test.describe('Fix — Encuestas no muestran configuración de evaluación', () => {
  68  | 
  69  |   test('Card de encuesta muestra badge y NO muestra nota mínima, reintentos ni respuestas correctas', async ({ page }) => {
  70  |     await injectProfesorAuth(page);
  71  |     await mockQuestionnairesListWithSurvey(page);
  72  | 
  73  |     await page.goto(`/profesor/questionnaires?courseId=${COURSE_ID}`);
> 74  |     await page.waitForSelector('text=Encuesta de Satisfacción', { timeout: 10000 });
      |                ^ TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
  75  | 
  76  |     await expect(page.locator('text=📋 Encuesta de Satisfacción').first()).toBeVisible();
  77  |     await expect(page.locator('text=Puntuación automática: 100%')).toBeVisible();
  78  |     await expect(page.locator('text=No evalúa respuestas correctas')).toBeVisible();
  79  |     await expect(page.locator('text=Nota mínima')).not.toBeVisible();
  80  |     await expect(page.locator('text=Sin reintentos')).not.toBeVisible();
  81  |     await expect(page.locator('text=Oculta respuestas correctas')).not.toBeVisible();
  82  |   });
  83  | 
  84  |   test('Card de cuestionario normal NO muestra badge de encuesta y SÍ muestra configuración', async ({ page }) => {
  85  |     await injectProfesorAuth(page);
  86  |     await mockQuestionnairesListWithRegular(page);
  87  | 
  88  |     await page.goto(`/profesor/questionnaires?courseId=${COURSE_ID}`);
  89  |     await page.waitForSelector('text=Examen Final', { timeout: 10000 });
  90  | 
  91  |     await expect(page.locator('text=📋 Encuesta de Satisfacción')).not.toBeVisible();
  92  |     await expect(page.locator('text=Nota mínima: 70%')).toBeVisible();
  93  |     await expect(page.locator('text=Sin reintentos')).toBeVisible();
  94  |     await expect(page.locator('text=Oculta respuestas correctas')).toBeVisible();
  95  |   });
  96  | 
  97  |   test('Formulario de edición oculta sección Configuración al marcar isSurvey', async ({ page }) => {
  98  |     await injectProfesorAuth(page);
  99  | 
  100 |     await page.goto(`/profesor/questionnaires/new?courseId=${COURSE_ID}`);
  101 |     await page.waitForSelector('text=Información Básica', { timeout: 10000 });
  102 | 
  103 |     await expect(page.locator('text=Configuración')).toBeVisible();
  104 |     await page.locator('#isSurvey').check();
  105 |     await expect(page.locator('text=Configuración')).not.toBeVisible();
  106 |   });
  107 | 
  108 |   test('Formulario de edición muestra sección Configuración al desmarcar isSurvey', async ({ page }) => {
  109 |     await injectProfesorAuth(page);
  110 | 
  111 |     await page.goto(`/profesor/questionnaires/new?courseId=${COURSE_ID}`);
  112 |     await page.waitForSelector('text=Información Básica', { timeout: 10000 });
  113 | 
  114 |     await page.locator('#isSurvey').check();
  115 |     await expect(page.locator('text=Configuración')).not.toBeVisible();
  116 |     await page.locator('#isSurvey').uncheck();
  117 |     await expect(page.locator('text=Configuración')).toBeVisible();
  118 |   });
  119 | });
```