const fs = require('fs');
function b64(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
const header = b64({ alg: 'HS256', typ: 'JWT' });
const users = {
  ALUMNO: { _id: 'user-alumno-00000000000000000001', username: 'alumno', password: 'Test1234', email: 'alumno@cursala.test', firstName: 'Alumno', lastName: 'Test', status: 'ACTIVE', roles: ['ALUMNO'] },
  PROFESOR: { _id: 'user-profesor-00000000000000000002', username: 'profesor', password: 'Test1234', email: 'profesor@cursala.test', firstName: 'Profesor', lastName: 'Test', status: 'ACTIVE', roles: ['PROFESOR'] },
  ADMIN: { _id: 'user-admin-00000000000000000003', username: 'admin', password: 'Test1234', email: 'admin@cursala.test', firstName: 'Admin', lastName: 'Test', status: 'ACTIVE', roles: ['ADMIN'] },
};
fs.mkdirSync(__dirname, { recursive: true });
for (const key of Object.keys(users)) {
  const u = users[key];
  const body = b64({ _id: u._id, email: u.email, roles: u.roles, exp: 9999999999 });
  const token = `${header}.${body}.fakesign`;
  const state = {
    cookies: [],
    origins: [
      {
        origin: 'http://localhost:4200',
        localStorage: [
          { name: 'token', value: token },
          { name: 'user', value: JSON.stringify(u) },
        ],
      },
    ],
  };
  // Write storage state only to parent e2e/ (canonical location)
  const outParent = `${__dirname}/../.auth-${u.username}.json`;
  fs.writeFileSync(outParent, JSON.stringify(state, null, 2));
  console.log('wrote', outParent);
}
