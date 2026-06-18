# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: remove-correct-option.spec.ts >> Eliminación de opciones en editor de cuestionario >> dos eliminaciones consecutivas mantienen el orden correcto
- Location: e2e\remove-correct-option.spec.ts:211:7

# Error details

```
Test timeout of 20000ms exceeded.
```

```
Error: page.waitForSelector: Test timeout of 20000ms exceeded.
Call log:
  - waiting for locator('button:has-text("Actualizar Cuestionario")') to be visible

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - navigation [ref=e5]:
    - generic [ref=e8]:
      - link "Cursala Campus Virtual" [ref=e9] [cursor=pointer]:
        - /url: /profesor
        - img "Cursala" [ref=e10]
        - generic [ref=e11]: Campus Virtual
      - generic [ref=e12]:
        - link "Mis Cursos" [ref=e13] [cursor=pointer]:
          - /url: /profesor/courses
        - link "Mis Clases" [ref=e14] [cursor=pointer]:
          - /url: /profesor/classes
        - link "Mis Cuestionarios" [ref=e15] [cursor=pointer]:
          - /url: /profesor/questionnaires
        - link "Mis Alumnos" [ref=e16] [cursor=pointer]:
          - /url: /profesor/students
  - main [ref=e17]:
    - generic [ref=e19]:
      - generic [ref=e22]:
        - heading "Mis Cuestionarios" [level=1] [ref=e23]
        - paragraph [ref=e24]: Gestiona los cuestionarios y exámenes de tus cursos
      - generic [ref=e27]:
        - generic [ref=e28]: Selecciona un Curso
        - combobox "Selecciona un Curso" [ref=e30]
      - generic [ref=e31]:
        - img [ref=e32]
        - heading "Selecciona un curso" [level=3] [ref=e34]
        - paragraph [ref=e35]: Elige un curso para ver sus cuestionarios
```

# Test source

```ts
  1   | /**
  2   |  * E2E – Eliminación de opciones en el editor de cuestionarios
  3   |  *
  4   |  * Cubre el bug: al hacer click en "Eliminar" sobre la opción marcada como
  5   |  * correcta, el sistema eliminaba la ÚLTIMA opción de la lista en lugar de
  6   |  * la opción seleccionada. Causa: `track option` en el @for del template
  7   |  * causaba que Angular reutilizara nodos DOM por identidad de objeto, no por
  8   |  * posición, produciendo una eliminación visual incorrecta.
  9   |  *
  10  |  * Fix aplicado: cambiar `track option` → `track $index`.
  11  |  */
  12  | import { test, expect, Page, Route } from '@playwright/test';
  13  | import { injectProfesorAuth } from './helpers/auth';
  14  | 
  15  | const API = 'http://localhost:8081/api/v1';
  16  | const QID = 'remove-option-test-000000000';
  17  | const COURSE_ID = 'remove-option-course-0000000';
  18  | 
  19  | // ── Helper: montar mocks de API ──────────────────────────────────────────────
  20  | 
  21  | async function setupMocks(page: Page, hasSubmissions = false) {
  22  |   const questionnaire = {
  23  |     _id: QID,
  24  |     courseId: COURSE_ID,
  25  |     title: 'Test eliminar opción correcta',
  26  |     status: 'ACTIVE',
  27  |     position: { type: 'FINAL_EXAM' },
  28  |     passingScore: 60,
  29  |     allowRetries: false,
  30  |     showCorrectAnswers: true,
  31  |     questions: [
  32  |       {
  33  |         _id: 'q1',
  34  |         type: 'MULTIPLE_CHOICE',
  35  |         questionText: '¿Cuál es la respuesta correcta?',
  36  |         order: 0,
  37  |         points: 10,
  38  |         required: true,
  39  |         options: [
  40  |           { _id: 'o1', text: 'Alpha', order: 0 },
  41  |           { _id: 'o2', text: 'Beta',  order: 1 },
  42  |           { _id: 'o3', text: 'Gamma', order: 2 },
  43  |           { _id: 'o4', text: 'Delta', order: 3 },
  44  |         ],
  45  |         correctOptionId: 'o2', // Beta es la correcta
  46  |       },
  47  |     ],
  48  |   };
  49  | 
  50  |   await page.route(`${API}/questionnaires/${QID}`, (route: Route) =>
  51  |     route.fulfill({
  52  |       status: 200,
  53  |       contentType: 'application/json',
  54  |       body: JSON.stringify({ data: questionnaire }),
  55  |     })
  56  |   );
  57  | 
  58  |   await page.route(`${API}/questionnaires/${QID}/has-submissions`, (route: Route) =>
  59  |     route.fulfill({
  60  |       status: 200,
  61  |       contentType: 'application/json',
  62  |       body: JSON.stringify({ data: { hasSubmissions } }),
  63  |     })
  64  |   );
  65  | 
  66  |   await page.route(`${API}/class/course/${COURSE_ID}/classes`, (route: Route) =>
  67  |     route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
  68  |   );
  69  | 
  70  |   await page.route(`${API}/questionnaires/course/${COURSE_ID}`, (route: Route) =>
  71  |     route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
  72  |   );
  73  | 
  74  |   // Mock PATCH para que guardar no falle
  75  |   await page.route(`${API}/questionnaires/${QID}`, (route: Route) => {
  76  |     if (route.request().method() === 'PATCH') {
  77  |       route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: questionnaire }) });
  78  |       return;
  79  |     }
  80  |     route.continue();
  81  |   });
  82  | }
  83  | 
  84  | // ── Helper: obtener textos visibles de las opciones ──────────────────────────
  85  | 
  86  | async function getOptionTexts(page: Page): Promise<string[]> {
  87  |   const firstQuestion = page.locator('app-question-item').first();
  88  |   const inputs = firstQuestion.locator('input[formcontrolname="text"]');
  89  |   const count = await inputs.count();
  90  |   const texts: string[] = [];
  91  |   for (let i = 0; i < count; i++) {
  92  |     texts.push(await inputs.nth(i).inputValue());
  93  |   }
  94  |   return texts;
  95  | }
  96  | 
  97  | // ── Helper: navegar y esperar formulario ─────────────────────────────────────
  98  | 
  99  | async function navigateToEdit(page: Page) {
  100 |   await page.goto(`/profesor/questionnaires/${QID}/edit`);
> 101 |   await page.waitForSelector('button:has-text("Actualizar Cuestionario")', { timeout: 20000 });
      |              ^ Error: page.waitForSelector: Test timeout of 20000ms exceeded.
  102 |   await page.waitForSelector('app-question-item', { timeout: 10000 });
  103 | }
  104 | 
  105 | // ── Tests ────────────────────────────────────────────────────────────────────
  106 | 
  107 | test.describe('Eliminación de opciones en editor de cuestionario', () => {
  108 | 
  109 |   /**
  110 |    * Caso 1 (Bug principal): eliminar la opción CORRECTA
  111 |    * Debe desaparecer la opción marcada, no la última.
  112 |    */
  113 |   test('eliminar la opción correcta elimina la opción seleccionada, no la última', async ({ page }) => {
  114 |     await injectProfesorAuth(page);
  115 |     await setupMocks(page, false);
  116 |     await navigateToEdit(page);
  117 | 
  118 |     // Verificar estado inicial: 4 opciones con textos esperados
  119 |     const before = await getOptionTexts(page);
  120 |     expect(before).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta']);
  121 | 
  122 |     // Localizar el botón "Eliminar" de la segunda opción (índice 1 = "Beta", la correcta)
  123 |     const firstQuestion = page.locator('app-question-item').first();
  124 |     const deleteButtons = firstQuestion.locator('button:has-text("Eliminar")');
  125 |     await expect(deleteButtons).toHaveCount(4);
  126 | 
  127 |     // Hacer click en "Eliminar" de la segunda opción (Beta, que es la correcta)
  128 |     await deleteButtons.nth(1).click();
  129 |     await page.waitForTimeout(300);
  130 | 
  131 |     // Debe haber quedado exactamente 3 opciones
  132 |     const after = await getOptionTexts(page);
  133 |     expect(after).toHaveLength(3);
  134 | 
  135 |     // "Beta" debe haberse ido; el resto debe estar en orden
  136 |     expect(after).not.toContain('Beta');
  137 |     expect(after[0]).toBe('Alpha');
  138 |     expect(after[1]).toBe('Gamma');
  139 |     expect(after[2]).toBe('Delta');
  140 | 
  141 |     // "Delta" (la última) debe seguir presente — esto fallaba con el bug
  142 |     expect(after).toContain('Delta');
  143 |   });
  144 | 
  145 |   /**
  146 |    * Caso 2: eliminar la primera opción cuando hay 4
  147 |    */
  148 |   test('eliminar la primera opción deja las 3 restantes en orden correcto', async ({ page }) => {
  149 |     await injectProfesorAuth(page);
  150 |     await setupMocks(page, false);
  151 |     await navigateToEdit(page);
  152 | 
  153 |     const firstQuestion = page.locator('app-question-item').first();
  154 |     const deleteButtons = firstQuestion.locator('button:has-text("Eliminar")');
  155 | 
  156 |     await deleteButtons.nth(0).click(); // eliminar "Alpha"
  157 |     await page.waitForTimeout(300);
  158 | 
  159 |     const after = await getOptionTexts(page);
  160 |     expect(after).toHaveLength(3);
  161 |     expect(after[0]).toBe('Beta');
  162 |     expect(after[1]).toBe('Gamma');
  163 |     expect(after[2]).toBe('Delta');
  164 |   });
  165 | 
  166 |   /**
  167 |    * Caso 3: eliminar la última opción
  168 |    */
  169 |   test('eliminar la última opción deja las 3 primeras en orden correcto', async ({ page }) => {
  170 |     await injectProfesorAuth(page);
  171 |     await setupMocks(page, false);
  172 |     await navigateToEdit(page);
  173 | 
  174 |     const firstQuestion = page.locator('app-question-item').first();
  175 |     const deleteButtons = firstQuestion.locator('button:has-text("Eliminar")');
  176 | 
  177 |     await deleteButtons.nth(3).click(); // eliminar "Delta"
  178 |     await page.waitForTimeout(300);
  179 | 
  180 |     const after = await getOptionTexts(page);
  181 |     expect(after).toHaveLength(3);
  182 |     expect(after[0]).toBe('Alpha');
  183 |     expect(after[1]).toBe('Beta');
  184 |     expect(after[2]).toBe('Gamma');
  185 |   });
  186 | 
  187 |   /**
  188 |    * Caso 4: eliminar del medio (opción 2 = "Gamma")
  189 |    */
  190 |   test('eliminar una opción del medio deja el orden correcto', async ({ page }) => {
  191 |     await injectProfesorAuth(page);
  192 |     await setupMocks(page, false);
  193 |     await navigateToEdit(page);
  194 | 
  195 |     const firstQuestion = page.locator('app-question-item').first();
  196 |     const deleteButtons = firstQuestion.locator('button:has-text("Eliminar")');
  197 | 
  198 |     await deleteButtons.nth(2).click(); // eliminar "Gamma"
  199 |     await page.waitForTimeout(300);
  200 | 
  201 |     const after = await getOptionTexts(page);
```