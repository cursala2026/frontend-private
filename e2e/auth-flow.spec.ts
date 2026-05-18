import { test, expect } from '@playwright/test';

function makeFakeJwt(payload: object): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${header}.${body}.fakesignature`;
}

test.describe('Autenticación y LocalStorage', () => {
  
  test('debe redirigir al login si no hay token', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*login/);
  });

  test('debe redirigir al dashboard si ya está autenticado con token válido', async ({ page }) => {
    const user = {
      _id: '123',
      username: 'testuser',
      email: 'test@test.com',
      roles: ['ALUMNO'],
      firstName: 'Test',
      lastName: 'User',
      status: 'ACTIVE',
      hasCompletedInterestsForm: true // Para evitar redirección al form de intereses
    };
    // Token con expiración en el futuro (año 2040 aprox)
    const token = makeFakeJwt({ _id: user._id, roles: user.roles, exp: 2208988800 });
    
    await page.addInitScript(({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }, { token, user });

    // Ir al login debería redirigir al dashboard/alumno
    await page.goto('/login');
    
    // El dispatcher redirige a /alumno
    await expect(page).toHaveURL(/.*alumno/, { timeout: 10000 });
  });

  test('debe limpiar la sesión y quedarse en login si el token está expirado', async ({ page }) => {
    const user = {
      _id: '123',
      username: 'testuser',
      roles: ['ALUMNO'],
      status: 'ACTIVE'
    };
    // Token expirado (año 2010)
    const token = makeFakeJwt({ _id: user._id, roles: user.roles, exp: 1262304000 });
    
    await page.addInitScript(({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }, { token, user });

    await page.goto('/login');
    
    // Debería permanecer en login porque el componente detecta el token expirado y hace logout
    await expect(page).toHaveURL(/.*login/);
    
    // Verificar que el localStorage se limpió (esperar un poco por el setTimeout 0 en el componente)
    await page.waitForTimeout(500);
    const storedToken = await page.evaluate(() => localStorage.getItem('token'));
    expect(storedToken).toBeNull();
  });

  test('debe cerrar sesión automáticamente ante un error 401 del backend', async ({ page }) => {
    const user = { 
      _id: '123', 
      username: 'testuser', 
      roles: ['ALUMNO'],
      status: 'ACTIVE',
      hasCompletedInterestsForm: true
    };
    const token = makeFakeJwt({ _id: user._id, roles: user.roles, exp: 2208988800 });
    
    // Mock de una petición fallida con error de firma (tal cual lo devuelve tu backend)
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ 
          name: 'JsonWebTokenError',
          message: 'invalid signature'
        })
      });
    });

    await page.addInitScript(({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }, { token, user });

    // Navegar a una ruta protegida
    await page.goto('/alumno');
    
    // Esperar a que el dashboard de alumno intente cargar algo (que fallará con 401)
    // O forzar una navegación interna que dispare peticiones de Angular
    
    // Esperar a que el interceptor detecte el 401 e "invalid signature" y redirija
    await expect(page).toHaveURL(/.*login/, { timeout: 15000 });
    
    // Verificar limpieza de storage
    const storedToken = await page.evaluate(() => localStorage.getItem('token'));
    expect(storedToken).toBeNull();
  });
});
