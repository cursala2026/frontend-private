import { describe, it, expect } from 'vitest';
import {
  getCourseModalityLabel,
  isAsyncCourse,
  normalizeCourseModality,
} from './course-modality';

describe('normalizeCourseModality', () => {
  it('devuelve ASYNC para ASYNC', () => {
    expect(normalizeCourseModality('ASYNC')).toBe('ASYNC');
  });

  it('devuelve SYNC para SYNC', () => {
    expect(normalizeCourseModality('SYNC')).toBe('SYNC');
  });

  it('usa SYNC como fallback cuando la modalidad es undefined o null', () => {
    expect(normalizeCourseModality(undefined)).toBe('SYNC');
    expect(normalizeCourseModality(null)).toBe('SYNC');
  });

  it('usa SYNC como fallback para valores no reconocidos', () => {
    expect(normalizeCourseModality('')).toBe('SYNC');
    expect(normalizeCourseModality('Presencial')).toBe('SYNC');
  });
});

describe('isAsyncCourse', () => {
  it('es true solo para ASYNC', () => {
    expect(isAsyncCourse('ASYNC')).toBe(true);
    expect(isAsyncCourse('SYNC')).toBe(false);
    expect(isAsyncCourse(undefined)).toBe(false);
  });
});

describe('getCourseModalityLabel', () => {
  it('muestra SYNC como Sincrónico y ASYNC como Asincrónico', () => {
    expect(getCourseModalityLabel('SYNC')).toBe('Sincrónico');
    expect(getCourseModalityLabel('ASYNC')).toBe('Asincrónico');
  });

  it('usa Sincrónico cuando no hay modalidad', () => {
    expect(getCourseModalityLabel(undefined)).toBe('Sincrónico');
  });
});
