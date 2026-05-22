export const ROLES = {
  ALUMNO: 'ALUMNO',
  PROFESOR: 'PROFESOR',
  ADMIN: 'ADMIN',
};

export const ALUMNO = {
  _id: 'user-alumno-00000000000000000001',
  username: 'alumno',
  password: 'Test1234',
  email: 'alumno@cursala.test',
  firstName: 'Alumno',
  lastName: 'Test',
  status: 'ACTIVE',
  roles: [ROLES.ALUMNO],
};

export const PROFESOR = {
  _id: 'user-profesor-00000000000000000002',
  username: 'profesor',
  password: 'Test1234',
  email: 'profesor@cursala.test',
  firstName: 'Profesor',
  lastName: 'Test',
  status: 'ACTIVE',
  roles: [ROLES.PROFESOR],
};

export const ADMIN = {
  _id: 'user-admin-00000000000000000003',
  username: 'admin',
  password: 'Test1234',
  email: 'admin@cursala.test',
  firstName: 'Admin',
  lastName: 'Test',
  status: 'ACTIVE',
  roles: [ROLES.ADMIN],
};

export default { ROLES, ALUMNO, PROFESOR, ADMIN };
