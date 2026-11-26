import { test, expect, Page } from '@playwright/test';

const createValidToken = (roles: string[] = ['ALUMNO']) => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ _id: 'student-123', role: roles[0], roles, exp: Math.floor(Date.now() / 1000) + 3600 })
  ).toString('base64url');
  return `${header}.${payload}.fake-signature`;
};

async function setupAlumnoDashboard(page: Page, teacherStatus?: string, roles: string[] = ['ALUMNO']) {
  const mockUser = {
    _id: 'student-123',
    username: 'alumno@test.com',
    email: 'alumno@test.com',
    firstName: 'Federico',
    lastName: 'Test',
    status: 'ACTIVE',
    roles,
    ...(teacherStatus ? { teacherStatus } : {}),
  };

  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }, { token: createValidToken(roles), user: mockUser });

  await page.route('**/api/v1/current-user', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: mockUser }) })
  );
  await page.route('**/api/v1/courses/published', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
  );
  await page.route('**/api/v1/courses/me/courses', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
  );
  await page.route('**/api/v1/courseProgress', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
  );

  await page.goto('/alumno');
}

test.describe('TC-04 — Banner reactivo de postulación docente en /alumno', () => {
  test('Sin postulación: muestra CTA para postularse hacia /ser-profesor', async ({ page }) => {
    await setupAlumnoDashboard(page);
    await expect(page.getByText('¿Querés enseñar en Cursala?')).toBeVisible();
    const link = page.getByRole('link', { name: 'Postularme como docente' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', /\/ser-profesor$/);
  });

  test('PENDING_APPROVAL: muestra estado en revisión sin botón de postulación', async ({ page }) => {
    await setupAlumnoDashboard(page, 'PENDING_APPROVAL');
    await expect(page.getByText('Postulación docente en revisión')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Postularme como docente' })).toHaveCount(0);
  });

  test('REJECTED: muestra aviso de rechazo con botón para volver a postularse', async ({ page }) => {
    await setupAlumnoDashboard(page, 'REJECTED');
    await expect(page.getByText('Tu postulación docente no fue aprobada')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Volver a postularme' })).toBeVisible();
  });

  test('APPROVED: muestra confirmación y botón Ir al Panel Docente', async ({ page }) => {
    await setupAlumnoDashboard(page, 'APPROVED');
    await expect(page.getByText('¡Ya sos docente en Cursala!')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ir al Panel Docente' })).toBeVisible();
  });
});