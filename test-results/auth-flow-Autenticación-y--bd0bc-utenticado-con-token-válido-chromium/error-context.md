# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth-flow.spec.ts >> Autenticación y LocalStorage >> debe redirigir al dashboard si ya está autenticado con token válido
- Location: e2e\auth-flow.spec.ts:18:7

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /.*alumno/
Received string:  "http://localhost:4200/login"
Timeout: 10000ms

Call log:
  - Expect "toHaveURL" with timeout 10000ms
    23 × unexpected value "http://localhost:4200/login"

```

```yaml
- main:
  - img "Cursala Logo"
  - heading "Iniciar Sesión" [level=3]
  - text: Usuario o Email
  - img
  - textbox "Usuario o Email":
    - /placeholder: Ingresa tu usuario
  - text: Contraseña
  - textbox "Ingresa tu contraseña"
  - button "Mostrar contraseña"
  - checkbox "Recordarme"
  - text: Recordarme
  - link "¿Olvidaste tu contraseña?":
    - /url: /forgot-password
  - button "Iniciar Sesión"
  - paragraph:
    - text: ¿No tienes una cuenta?
    - link "Regístrate aquí":
      - /url: /register
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | function makeFakeJwt(payload: object): string {
  4   |   const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  5   |     .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  6   |   const body = btoa(JSON.stringify(payload))
  7   |     .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  8   |   return `${header}.${body}.fakesignature`;
  9   | }
  10  | 
  11  | test.describe('Autenticación y LocalStorage', () => {
  12  |   
  13  |   test('debe redirigir al login si no hay token', async ({ page }) => {
  14  |     await page.goto('/dashboard');
  15  |     await expect(page).toHaveURL(/.*login/);
  16  |   });
  17  | 
  18  |   test('debe redirigir al dashboard si ya está autenticado con token válido', async ({ page }) => {
  19  |     const user = {
  20  |       _id: '123',
  21  |       username: 'testuser',
  22  |       email: 'test@test.com',
  23  |       roles: ['ALUMNO'],
  24  |       firstName: 'Test',
  25  |       lastName: 'User',
  26  |       status: 'ACTIVE',
  27  |       hasCompletedInterestsForm: true // Para evitar redirección al form de intereses
  28  |     };
  29  |     // Token con expiración en el futuro (año 2040 aprox)
  30  |     const token = makeFakeJwt({ _id: user._id, roles: user.roles, exp: 2208988800 });
  31  |     
  32  |     await page.addInitScript(({ token, user }) => {
  33  |       localStorage.setItem('token', token);
  34  |       localStorage.setItem('user', JSON.stringify(user));
  35  |     }, { token, user });
  36  | 
  37  |     // Ir al login debería redirigir al dashboard/alumno
  38  |     await page.goto('/login');
  39  |     
  40  |     // El dispatcher redirige a /alumno
> 41  |     await expect(page).toHaveURL(/.*alumno/, { timeout: 10000 });
      |                        ^ Error: expect(page).toHaveURL(expected) failed
  42  |   });
  43  | 
  44  |   test('debe limpiar la sesión y quedarse en login si el token está expirado', async ({ page }) => {
  45  |     const user = {
  46  |       _id: '123',
  47  |       username: 'testuser',
  48  |       roles: ['ALUMNO'],
  49  |       status: 'ACTIVE'
  50  |     };
  51  |     // Token expirado (año 2010)
  52  |     const token = makeFakeJwt({ _id: user._id, roles: user.roles, exp: 1262304000 });
  53  |     
  54  |     await page.addInitScript(({ token, user }) => {
  55  |       localStorage.setItem('token', token);
  56  |       localStorage.setItem('user', JSON.stringify(user));
  57  |     }, { token, user });
  58  | 
  59  |     await page.goto('/login');
  60  |     
  61  |     // Debería permanecer en login porque el componente detecta el token expirado y hace logout
  62  |     await expect(page).toHaveURL(/.*login/);
  63  |     
  64  |     // Verificar que el localStorage se limpió (esperar un poco por el setTimeout 0 en el componente)
  65  |     await page.waitForTimeout(500);
  66  |     const storedToken = await page.evaluate(() => localStorage.getItem('token'));
  67  |     expect(storedToken).toBeNull();
  68  |   });
  69  | 
  70  |   test('debe cerrar sesión automáticamente ante un error 401 del backend', async ({ page }) => {
  71  |     const user = { 
  72  |       _id: '123', 
  73  |       username: 'testuser', 
  74  |       roles: ['ALUMNO'],
  75  |       status: 'ACTIVE',
  76  |       hasCompletedInterestsForm: true
  77  |     };
  78  |     const token = makeFakeJwt({ _id: user._id, roles: user.roles, exp: 2208988800 });
  79  |     
  80  |     // Mock de una petición fallida con error de firma (tal cual lo devuelve tu backend)
  81  |     await page.route('**/api/**', route => {
  82  |       route.fulfill({
  83  |         status: 401,
  84  |         contentType: 'application/json',
  85  |         body: JSON.stringify({ 
  86  |           name: 'JsonWebTokenError',
  87  |           message: 'invalid signature'
  88  |         })
  89  |       });
  90  |     });
  91  | 
  92  |     await page.addInitScript(({ token, user }) => {
  93  |       localStorage.setItem('token', token);
  94  |       localStorage.setItem('user', JSON.stringify(user));
  95  |     }, { token, user });
  96  | 
  97  |     // Navegar a una ruta protegida
  98  |     await page.goto('/alumno');
  99  |     
  100 |     // Esperar a que el dashboard de alumno intente cargar algo (que fallará con 401)
  101 |     // O forzar una navegación interna que dispare peticiones de Angular
  102 |     
  103 |     // Esperar a que el interceptor detecte el 401 e "invalid signature" y redirija
  104 |     await expect(page).toHaveURL(/.*login/, { timeout: 15000 });
  105 |     
  106 |     // Verificar limpieza de storage
  107 |     const storedToken = await page.evaluate(() => localStorage.getItem('token'));
  108 |     expect(storedToken).toBeNull();
  109 |   });
  110 | });
  111 | 
```