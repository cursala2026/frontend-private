import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { ALUMNO } from './helpers/user-constants';

test.beforeEach(async ({ context }, testInfo) => {
  // If this is an auth-related test, ensure any preloaded storageState is cleared
  const file = (testInfo.file || '').toString();
  const isAuthSpec = file.includes('auth-flow.spec.ts') || testInfo.title?.toString().toLowerCase().includes('autenticación');
  if (isAuthSpec) {
    try {
      await context.addInitScript(() => {
        try { localStorage.removeItem('token'); } catch (e) {}
        try { localStorage.removeItem('user'); } catch (e) {}
      });
    } catch (e) {
      // ignore
    }
    // Do not add the normal auth injection or fallback routes for auth specs
    return;
  }
  // Inject localStorage from the storageState file early so the app starts authenticated
  try {
    const storagePath = path.resolve(__dirname, '.auth-alumno.json');
    if (fs.existsSync(storagePath)) {
      const storage = JSON.parse(fs.readFileSync(storagePath, 'utf8')) as any;
      const origins = storage.origins || [];
      for (const origin of origins) {
        const items = origin.localStorage || [];
        if (items.length) {
          await context.addInitScript((itemsArg) => {
            for (const it of itemsArg) {
              try { localStorage.setItem(it.name, it.value); } catch (e) { /* ignore */ }
            }
          }, items.map((i: any) => ({ name: i.name, value: i.value })));
        }
      }
    }
  } catch (e) {
    // keep running tests even if storage injection fails
    // eslint-disable-next-line no-console
    console.error('global-setup: storage injection failed', e);
  }

  // Register a context-level fallback route to avoid early 401 redirects.
  // Per-test page routes will still be able to override specific endpoints.
  try {
    await context.route('**/api/v1/**', async (route) => {
      const req = route.request();
      const url = req.url();

      // Provide a lightweight response for auth/me endpoints to avoid logout
      if (url.endsWith('/auth/me') || url.endsWith('/users/me') || url.includes('/auth/me')) {
        return route.fulfill({
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(ALUMNO),
        });
      }

      // For other requests, continue to the network to allow tests' mocks to handle them.
      return route.continue();
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('global-setup: registering fallback route failed', e);
  }
});
