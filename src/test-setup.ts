import 'zone.js';
import 'zone.js/testing';
import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';

try {
  TestBed.initTestEnvironment(
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting()
  );
} catch (e) {
  // Test environment might already be initialized by the Angular test builder — ignore
}

// Asegurar que los globals de Vitest estén disponibles en tiempo de ejecución

// Intento dinámico de import para evitar usar `require` y errores de tipado en TS
try {
  import('vitest').then((vitest) => {
    if (vitest) {
      (globalThis as any).vi = (globalThis as any).vi || vitest.vi;
      (globalThis as any).describe = (globalThis as any).describe || vitest.describe;
      (globalThis as any).it = (globalThis as any).it || vitest.it || vitest.test;
      (globalThis as any).test = (globalThis as any).test || vitest.test || vitest.it;
      (globalThis as any).expect = (globalThis as any).expect || vitest.expect;
      (globalThis as any).beforeEach = (globalThis as any).beforeEach || vitest.beforeEach;
      (globalThis as any).afterEach = (globalThis as any).afterEach || vitest.afterEach;
    }
  }).catch(() => {
    // no action
  });
} catch {
  // ignore
}

// Evitar que tests realicen llamadas XHR reales a servicios externos (jsdom admite XHR)
// Stub simple de XMLHttpRequest que responde con 200 y cuerpo vacío JSON para todas las peticiones.
// Nota: ya no se hace stub global de XHR aquí. Use `HttpClientTestingModule` o mocks de servicios en specs.
