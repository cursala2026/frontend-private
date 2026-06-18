# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: questionnaire-score.spec.ts >> Bug #4 — finalScore=0 tratado como 0, no falsy (operador ??) >> Botón "Intentar Nuevamente" NO visible cuando finalScore=0 y isPassed() evalúa 75 (bug de getScore)
- Location: e2e\questionnaire-score.spec.ts:177:7

# Error details

```
Error: expect(locator).not.toBeVisible() failed

Locator:  locator('button:has-text("Intentar Nuevamente")')
Expected: not visible
Received: visible
Timeout:  5000ms

Call log:
  - Expect "not toBeVisible" with timeout 5000ms
  - waiting for locator('button:has-text("Intentar Nuevamente")')
    14 × locator resolved to <button class="cursor-pointer px-6 py-2 bg-brand-primary text-white rounded-full hover:bg-brand-primary-dark transition-colors"> Intentar Nuevamente </button>
       - unexpected value "visible"

```

```yaml
- button "Intentar Nuevamente"
```

# Test source

```ts
  97  |   );
  98  | }
  99  | 
  100 | /** Mockea las submissions del alumno para el cuestionario con el finalScore indicado. */
  101 | async function mockSubmissions(page: Page, finalScore: number, autoGradedScore: number) {
  102 |   await page.route(
  103 |     `${API}/questionnaires/${QUESTIONNAIRE_ID}/submissions/student/${STUDENT_USER_ID}`,
  104 |     (route: Route) =>
  105 |       route.fulfill({
  106 |         status: 200,
  107 |         contentType: 'application/json',
  108 |         body: JSON.stringify({
  109 |           data: [
  110 |             {
  111 |               _id: 'ffffffffffffffffffffffff',
  112 |               questionnaireId: QUESTIONNAIRE_ID,
  113 |               courseId: COURSE_ID,
  114 |               studentId: STUDENT_USER_ID,
  115 |               attemptNumber: 1,
  116 |               answers: [],
  117 |               status: 'GRADED',
  118 |               autoGradedScore,
  119 |               finalScore,
  120 |               startedAt: new Date().toISOString(),
  121 |               submittedAt: new Date().toISOString(),
  122 |             },
  123 |           ],
  124 |         }),
  125 |       })
  126 |   );
  127 | }
  128 | 
  129 | // ─────────────────────────────────────────────────────────────────────────────
  130 | 
  131 | test.describe('Bug #4 — finalScore=0 tratado como 0, no falsy (operador ??)', () => {
  132 |   test(
  133 |     'Botón "Continuar" NO visible cuando finalScore=0 y autoGradedScore=75 (alumno no aprobó con 0)',
  134 |     async ({ page }) => {
  135 |       // 1. Inyectar auth antes de que Angular inicie
  136 |       await injectAlumnoAuth(page);
  137 | 
  138 |       // 2. Configurar mocks de API
  139 |       await mockCourse(page);
  140 |       await mockQuestionnaire(page);
  141 |       await mockSubmissions(page, 0, 75); // finalScore=0, autoGradedScore=75
  142 |       await mockCourseProgress(page);
  143 | 
  144 |       // 3. Navegar a la página (Angular inicializa con token en localStorage)
  145 |       await page.goto(`/alumno/course-detail/${COURSE_ID}/questionnaire/${QUESTIONNAIRE_ID}`);
  146 | 
  147 |       // 4. Esperar que cargue la vista de resultados
  148 |       await page.waitForSelector('text=Resultado del Cuestionario', { timeout: 10000 });
  149 | 
  150 |       // 5. El botón "Continuar" NO debe estar visible
  151 |       //    - Con el fix (??): score=0, passed=false, nextItem=null → sin "Continuar"
  152 |       //    - Sin el fix (||): score=75, passed=true, nextItem=CLASS → "Continuar" sí aparece
  153 |       const continuarBtn = page.locator('button:has-text("Continuar")');
  154 |       await expect(continuarBtn).not.toBeVisible();
  155 |     }
  156 |   );
  157 | 
  158 |   test(
  159 |     'Botón "Continuar" SÍ visible cuando finalScore=80 (alumno aprobó)',
  160 |     async ({ page }) => {
  161 |       await injectAlumnoAuth(page);
  162 | 
  163 |       await mockCourse(page);
  164 |       await mockQuestionnaire(page);
  165 |       await mockSubmissions(page, 80, 75); // finalScore=80 → pasa el corte de 50
  166 |       await mockCourseProgress(page);
  167 | 
  168 |       await page.goto(`/alumno/course-detail/${COURSE_ID}/questionnaire/${QUESTIONNAIRE_ID}`);
  169 |       await page.waitForSelector('text=Resultado del Cuestionario', { timeout: 10000 });
  170 | 
  171 |       // Con score=80 >= passingScore=50 → passed=true, nextItem=CLASS → "Continuar" visible
  172 |       const continuarBtn = page.locator('button:has-text("Continuar")');
  173 |       await expect(continuarBtn).toBeVisible({ timeout: 5000 });
  174 |     }
  175 |   );
  176 | 
  177 |   test(
  178 |     'Botón "Intentar Nuevamente" NO visible cuando finalScore=0 y isPassed() evalúa 75 (bug de getScore)',
  179 |     async ({ page }) => {
  180 |       // Este test documenta el comportamiento actual:
  181 |       // getScore() sigue usando || por lo que isPassed() devuelve true (75>=50)
  182 |       // → el botón "Intentar Nuevamente" tampoco aparece (necesita !isPassed())
  183 |       // Esto es un comportamiento secundario conocido; el fix principal es en updateCourseProgress.
  184 |       await injectAlumnoAuth(page);
  185 | 
  186 |       await mockCourse(page);
  187 |       await mockQuestionnaire(page);
  188 |       await mockSubmissions(page, 0, 75);
  189 |       await mockCourseProgress(page);
  190 | 
  191 |       await page.goto(`/alumno/course-detail/${COURSE_ID}/questionnaire/${QUESTIONNAIRE_ID}`);
  192 |       await page.waitForSelector('text=Resultado del Cuestionario', { timeout: 10000 });
  193 | 
  194 |       // "Intentar Nuevamente" muestra solo cuando GRADED && canRetry && !isPassed()
  195 |       // isPassed() usa getScore() con || → devuelve 75 → isPassed()=true → NO muestra
  196 |       const retryBtn = page.locator('button:has-text("Intentar Nuevamente")');
> 197 |       await expect(retryBtn).not.toBeVisible();
      |                                  ^ Error: expect(locator).not.toBeVisible() failed
  198 |     }
  199 |   );
  200 | });
  201 | 
```