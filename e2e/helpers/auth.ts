import { Page } from '@playwright/test';

const COURSE_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const QUESTIONNAIRE_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const CLASS_ID = 'cccccccccccccccccccccccc';
const STUDENT_USER_ID = 'dddddddddddddddddddddddd';
const PROFESOR_USER_ID = 'eeeeeeeeeeeeeeeeeeeeeeee';
const SUBMISSION_ID = 'ffffffffffffffffffffffff';

export { COURSE_ID, QUESTIONNAIRE_ID, CLASS_ID, STUDENT_USER_ID, PROFESOR_USER_ID, SUBMISSION_ID };

/**
 * Genera un token JWT fake con exp muy lejano (año 2286).
 * El frontend sólo decodifica el payload para verificar expiración —
 * no valida la firma— así que esto funciona para tests E2E.
 */
function makeFakeJwt(payload: object): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${header}.${body}.fakesignature`;
}

/** Inyecta sesión de ALUMNO en localStorage via addInitScript (corre antes de Angular). */
export async function injectAlumnoAuth(page: Page): Promise<void> {
  const user = {
    _id: STUDENT_USER_ID,
    username: 'alumno.dev',
    email: 'alumno@dev.local',
    firstName: 'Alumno',
    lastName: 'Dev',
    status: 'ACTIVE',
    roles: ['ALUMNO'],
  };
  const token = makeFakeJwt({ _id: user._id, email: user.email, roles: user.roles, exp: 9999999999 });
  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    },
    { token, user }
  );
}

/** Inyecta sesión de PROFESOR en localStorage via addInitScript (corre antes de Angular). */
export async function injectProfesorAuth(page: Page): Promise<void> {
  const user = {
    _id: PROFESOR_USER_ID,
    username: 'profesor.dev',
    email: 'profesor@dev.local',
    firstName: 'Profesor',
    lastName: 'Dev',
    status: 'ACTIVE',
    roles: ['PROFESOR'],
  };
  const token = makeFakeJwt({ _id: user._id, email: user.email, roles: user.roles, exp: 9999999999 });
  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    },
    { token, user }
  );
}
