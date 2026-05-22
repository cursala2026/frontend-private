import { Page } from '@playwright/test';
import { ALUMNO, PROFESOR } from './user-constants';

const COURSE_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const QUESTIONNAIRE_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const CLASS_ID = 'cccccccccccccccccccccccc';
const SUBMISSION_ID = 'ffffffffffffffffffffffff';

// Student user id exported for tests
const STUDENT_USER_ID = ALUMNO._id;
const PROFESOR_USER_ID = PROFESOR._id;

export { COURSE_ID, QUESTIONNAIRE_ID, CLASS_ID, SUBMISSION_ID, STUDENT_USER_ID, PROFESOR_USER_ID };

function makeFakeJwt(payload: object): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-').replace(/\//g, '_');
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-').replace(/\//g, '_');
  return `${header}.${body}.fakesignature`;
}

export async function injectAlumnoAuth(page: Page): Promise<void> {
  const user = { ...ALUMNO };
  const token = makeFakeJwt({ _id: user._id, email: user.email, roles: user.roles, exp: 9999999999 });
  // Register at context level first (earlier than page scripts)
  try {
    await page.context().addInitScript(
      ({ token, user }) => {
        try {
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(user));
        } catch (e) {
          // ignore localStorage access errors
        }
      },
      { token, user }
    );
  } catch (e) {
    // context may not support addInitScript in some environments; ignore
  }
  // Register a small auth responder at context level so startup validation
  // requests (e.g. GET /api/v1/auth/me or /api/v1/users/me) return the
  // fake user and avoid redirects to login when tests rely on token.
  try {
    await page.context().route('**/api/v1/**', (route) => {
      const url = route.request().url();
      const method = route.request().method();
      if (method === 'GET' && (url.includes('/auth') || url.endsWith('/me') || url.includes('/users/'))) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: user }),
        });
      }
      return route.continue();
    });
  } catch (err) {
    // ignore route registration errors
  }
  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    },
    { token, user }
  );
  // Do NOT use page.evaluate to write localStorage (can raise SecurityError).
  // Rely on context/page init scripts and the context-level route above.
}

export async function injectProfesorAuth(page: Page): Promise<void> {
  const user = { ...PROFESOR };
  const token = makeFakeJwt({ _id: user._id, email: user.email, roles: user.roles, exp: 9999999999 });
  // Register at context level first (earlier than page scripts)
  try {
    await page.context().addInitScript(
      ({ token, user }) => {
        try {
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(user));
        } catch (e) {
          // ignore localStorage access errors
        }
      },
      { token, user }
    );
  } catch (e) {
    // ignore
  }
  // Register a small auth responder at context level so startup validation
  // requests (e.g. GET /api/v1/auth/me or /api/v1/users/me) return the
  // fake user and avoid redirects to login when tests rely on token.
  try {
    await page.context().route('**/api/v1/**', (route) => {
      const url = route.request().url();
      const method = route.request().method();
      if (method === 'GET' && (url.includes('/auth') || url.endsWith('/me') || url.includes('/users/'))) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: user }),
        });
      }
      return route.continue();
    });
  } catch (err) {
    // ignore route registration errors
  }
  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    },
    { token, user }
  );
  // Do NOT use page.evaluate to write localStorage (can raise SecurityError).
  // Rely on context/page init scripts and the context-level route above.
}