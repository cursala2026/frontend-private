# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-edit-warning.spec.ts >> UI muestra advertencia y bloquea cambios estructurales cuando hay envíos
- Location: e2e\ui-edit-warning.spec.ts:8:5

# Error details

```
Test timeout of 20000ms exceeded.
```

```
Error: locator.click: Test timeout of 20000ms exceeded.
Call log:
  - waiting for locator('app-question-item').first().locator('button:has-text("Agregar Opción")')
    - locator resolved to <button disabled type="button" class="cursor-pointer px-4 py-2 text-sm font-bold border-2 rounded-full hover:bg-brand-tertiary-lighten/20 transition-all">+ Agregar Opción</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not enabled
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not enabled
    - retrying click action
      - waiting 100ms
    34 × waiting for element to be visible, enabled and stable
       - element is not enabled
     - retrying click action
       - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - navigation [ref=e5]:
    - generic [ref=e7]:
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
      - button "PD" [ref=e19] [cursor=pointer]:
        - generic [ref=e20]: PD
        - img [ref=e21]
  - main [ref=e23]:
    - generic [ref=e25]:
      - heading "Editar Cuestionario" [level=1] [ref=e28]
      - generic [ref=e29]:
        - generic [ref=e30]:
          - heading "1 Información Básica" [level=2] [ref=e32]:
            - generic [ref=e33]: "1"
            - text: Información Básica
          - generic [ref=e34]:
            - generic [ref=e35]:
              - generic [ref=e36]: Título del Cuestionario *
              - textbox "Título del Cuestionario *" [ref=e37]:
                - /placeholder: "Ej: Examen del Módulo 1..."
                - text: UI Warning Test
            - generic [ref=e38]:
              - generic [ref=e39]: Descripción
              - textbox "Descripción" [ref=e40]:
                - /placeholder: Descripción opcional del cuestionario...
            - generic [ref=e41]:
              - checkbox "Marcar como Encuesta de Satisfacción" [ref=e43] [cursor=pointer]
              - generic [ref=e44]:
                - generic [ref=e45] [cursor=pointer]: Marcar como Encuesta de Satisfacción
                - paragraph [ref=e46]: Las encuestas no evalúan respuestas correctas y otorgan 100% de puntuación automáticamente.
            - generic [ref=e47]:
              - generic [ref=e48]: Estado
              - combobox "Estado" [ref=e49] [cursor=pointer]:
                - option "Activo" [selected]
                - option "Inactivo"
                - option "Borrador"
            - generic [ref=e50]:
              - generic [ref=e51]: Posición
              - combobox "Posición" [ref=e52] [cursor=pointer]:
                - option "Entre Clases"
                - option "Examen Final" [selected]
        - generic [ref=e53]:
          - heading "2 Configuración" [level=2] [ref=e55]:
            - generic [ref=e56]: "2"
            - text: Configuración
          - generic [ref=e57]:
            - generic [ref=e58]:
              - generic [ref=e59]: Nota Mínima (%)
              - spinbutton "Nota Mínima (%)" [ref=e60]: "70"
            - generic [ref=e61]:
              - generic [ref=e62]: Máximo de Intentos
              - spinbutton "Máximo de Intentos" [disabled] [ref=e63]
            - generic [ref=e64] [cursor=pointer]:
              - checkbox "Permitir Reintentos" [ref=e65]
              - generic [ref=e66]: Permitir Reintentos
            - generic [ref=e67] [cursor=pointer]:
              - checkbox "Mostrar Respuestas Correctas" [ref=e68]
              - generic [ref=e69]: Mostrar Respuestas Correctas
            - generic [ref=e70]:
              - generic [ref=e71]: Tiempo Límite (minutos)
              - spinbutton "Tiempo Límite (minutos)" [ref=e72]
              - paragraph [ref=e73]:
                - text: Establece un tiempo límite en minutos para resolver el cuestionario.
                - text: Deja vacío para tiempo ilimitado.
        - generic [ref=e74]:
          - heading "3 Preguntas Cómo se califican las preguntas" [level=2] [ref=e76]:
            - generic [ref=e77]: "3"
            - text: Preguntas
            - button "Cómo se califican las preguntas" [ref=e78]:
              - img [ref=e79]
          - generic [ref=e82]:
            - paragraph [ref=e83]: Este cuestionario ya tiene envíos.
            - paragraph [ref=e84]: No se permite modificar la estructura de las preguntas (tipo, opciones, orden, puntos). Las preguntas están bloqueadas para edición.
          - generic [ref=e87]:
            - heading "Pregunta 1" [level=3] [ref=e89]
            - generic [ref=e90]:
              - generic [ref=e91]:
                - generic [ref=e92]: Tipo de Pregunta *
                - combobox [disabled] [ref=e93]:
                  - option "Opción Múltiple (una correcta)" [selected]
                  - option "Selección Múltiple (varias correctas)"
                  - option "Texto Libre"
              - generic [ref=e94]:
                - generic [ref=e95]: Puntos *
                - spinbutton [disabled] [ref=e96]: "10"
              - generic [ref=e97]:
                - generic [ref=e98]: Enunciado de la Pregunta *
                - textbox "Escribe aquí la pregunta..." [disabled] [ref=e99]: Pregunta 1
              - generic [ref=e100]:
                - generic [ref=e101]: Imagen o Video (Opcional)
                - generic [ref=e102]:
                  - generic [ref=e103] [cursor=pointer]: Seleccionar Archivo
                  - generic [ref=e104]: JPG, PNG, GIF, MP4, WEBM, OGG, AVI, MOV (Máx. 1GB)
              - generic [ref=e105]:
                - checkbox [checked] [disabled] [ref=e106]
                - generic [ref=e107]: Pregunta Obligatoria
              - generic [ref=e108]:
                - generic [ref=e109]:
                  - heading "Opciones de Respuesta" [level=4] [ref=e110]
                  - button "+ Agregar Opción" [disabled] [ref=e111] [cursor=pointer]
                - generic [ref=e112]:
                  - generic [ref=e113]:
                    - generic [ref=e114]:
                      - radio [checked] [ref=e115] [cursor=pointer]
                      - textbox "Escribe la opción 1 o elimínela" [disabled] [ref=e116]: A
                      - button "Eliminar" [ref=e117] [cursor=pointer]
                    - generic [ref=e118]:
                      - radio [ref=e119] [cursor=pointer]
                      - textbox "Escribe la opción 2 o elimínela" [disabled] [ref=e120]: B
                      - button "Eliminar" [ref=e121] [cursor=pointer]
                    - generic [ref=e122]:
                      - radio [ref=e123] [cursor=pointer]
                      - textbox "Escribe la opción 3 o elimínela" [disabled] [ref=e124]: C
                      - button "Eliminar" [ref=e125] [cursor=pointer]
                  - paragraph [ref=e126]: 💡 Selecciona el círculo junto a la opción correcta
          - button "Agregar Pregunta" [disabled] [ref=e128]:
            - img [ref=e129]
            - text: Agregar Pregunta
        - generic [ref=e131]:
          - button "Cancelar" [ref=e132] [cursor=pointer]
          - button "Actualizar Cuestionario" [disabled] [ref=e133]:
            - generic [ref=e134]: Actualizar Cuestionario
```

# Test source

```ts
  1   | import { test, expect, Page, Route } from '@playwright/test';
  2   | import { injectProfesorAuth } from './helpers/auth';
  3   | 
  4   | const API = 'http://localhost:8081/api/v1';
  5   | const QUESTIONNAIRE_ID = 'ui-warning-qid-000000000000';
  6   | const COURSE_ID = 'ui-warning-course-000000000000';
  7   | 
  8   | test('UI muestra advertencia y bloquea cambios estructurales cuando hay envíos', async ({ page }) => {
  9   |   await injectProfesorAuth(page);
  10  | 
  11  |   // Log requests/responses to help debug why /has-submissions may not be called
  12  |   page.on('request', req => console.log('REQ ->', req.method(), req.url()));
  13  |   page.on('response', resp => console.log('RESP <-', resp.status(), resp.url()));
  14  | 
  15  |   // Mock del cuestionario
  16  |   await page.route(`${API}/questionnaires/${QUESTIONNAIRE_ID}`, (route: Route) =>
  17  |     route.fulfill({
  18  |       status: 200,
  19  |       contentType: 'application/json',
  20  |       body: JSON.stringify({
  21  |         data: {
  22  |           _id: QUESTIONNAIRE_ID,
  23  |           courseId: COURSE_ID,
  24  |           title: 'UI Warning Test',
  25  |           status: 'ACTIVE',
  26  |           position: { type: 'FINAL_EXAM' },
  27  |           questions: [
  28  |             {
  29  |               _id: 'q1',
  30  |               type: 'MULTIPLE_CHOICE',
  31  |               questionText: 'Pregunta 1',
  32  |               order: 0,
  33  |               points: 10,
  34  |               required: true,
  35  |               options: [
  36  |                 { _id: 'o1', text: 'A', order: 0 },
  37  |                 { _id: 'o2', text: 'B', order: 1 },
  38  |                 { _id: 'o3', text: 'C', order: 2 }
  39  |               ],
  40  |               correctOptionId: 'o1'
  41  |             }
  42  |           ],
  43  |           passingScore: 70,
  44  |           allowRetries: false,
  45  |           showCorrectAnswers: false
  46  |         }
  47  |       })
  48  |     })
  49  |   );
  50  | 
  51  |   // Mock has-submissions -> true
  52  |   await page.route(`${API}/questionnaires/${QUESTIONNAIRE_ID}/has-submissions`, (route: Route) =>
  53  |     route.fulfill({
  54  |       status: 200,
  55  |       contentType: 'application/json',
  56  |       body: JSON.stringify({ data: { hasSubmissions: true } })
  57  |     })
  58  |   );
  59  | 
  60  |   // Mock classes list called by the component
  61  |   await page.route(`${API}/class/course/${COURSE_ID}/classes`, (route: Route) =>
  62  |     route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
  63  |   );
  64  | 
  65  |   // Mock questionnairesByCourse
  66  |   await page.route(`${API}/questionnaires/course/${COURSE_ID}`, (route: Route) =>
  67  |     route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
  68  |   );
  69  | 
  70  |   // Navegar a la página de edición
  71  |   await page.goto(`/profesor/questionnaires/${QUESTIONNAIRE_ID}/edit`);
  72  | 
  73  |   // Esperar que el formulario cargue
  74  |   await page.waitForSelector('button:has-text("Actualizar Cuestionario")', { timeout: 20000 });
  75  | 
  76  |   // Verificar banner (esperar hasta 10s por si ya se ha procesado la respuesta previamente)
  77  |   const banner = page.locator('text=ya tiene envíos');
  78  |   // Dump a snippet of the page HTML for debugging
  79  |   const html = await page.content();
  80  |   console.log('PAGE HTML SNIPPET:', html.slice(0, 20000));
  81  |   const bannerCount = await banner.count();
  82  |   console.log('BANNER COUNT:', bannerCount);
  83  |   const bodyText = await page.textContent('body');
  84  |   console.log('BODY TEXT SNIPPET:', (bodyText || '').slice(0, 20000));
  85  |   await expect(banner).toBeVisible({ timeout: 10000 });
  86  | 
  87  |   // Verificar que el botón agregar pregunta esté deshabilitado
  88  |   const addQuestionBtn = page.locator('button:has-text("Agregar Pregunta")');
  89  |   await expect(addQuestionBtn).toBeDisabled();
  90  | 
  91  |   // Dentro del primer question-item, contar opciones
  92  |   const firstQuestion = page.locator('app-question-item').first();
  93  |   const optionInputs = firstQuestion.locator('input[formcontrolname="text"]');
  94  |   const beforeCount = await optionInputs.count();
  95  | 
  96  |   // Intentar agregar opción y verificar que no aumente el conteo
  97  |   const addOptionBtn = firstQuestion.locator('button:has-text("Agregar Opción")');
> 98  |   await addOptionBtn.click();
      |                      ^ Error: locator.click: Test timeout of 20000ms exceeded.
  99  |   await page.waitForTimeout(300); // pequeño delay para que lógica JS se ejecute
  100 |   const afterCount = await optionInputs.count();
  101 |   await expect(afterCount).toBe(beforeCount);
  102 | 
  103 |   // Intentar eliminar la primera opción y verificar que conteo no cambie
  104 |   const deleteButtons = firstQuestion.locator('button:has-text("Eliminar")');
  105 |   if (await deleteButtons.count() > 0) {
  106 |     await deleteButtons.first().click();
  107 |     await page.waitForTimeout(300);
  108 |     const afterDeleteCount = await optionInputs.count();
  109 |     await expect(afterDeleteCount).toBe(beforeCount);
  110 |   }
  111 | });
  112 | 
```