/**
 * Modalidad del curso (alineada con el backend: 'SYNC' | 'ASYNC').
 * Si el valor no llega o no es reconocido se trata como SYNC.
 */
export type CourseModality = 'SYNC' | 'ASYNC';

export const DEFAULT_COURSE_MODALITY: CourseModality = 'SYNC';

export function normalizeCourseModality(value: unknown): CourseModality {
  if (typeof value === 'string' && value.trim().toUpperCase() === 'ASYNC') {
    return 'ASYNC';
  }
  return DEFAULT_COURSE_MODALITY;
}

export function isAsyncCourse(value: unknown): boolean {
  return normalizeCourseModality(value) === 'ASYNC';
}

export function getCourseModalityLabel(value: unknown): string {
  return normalizeCourseModality(value) === 'ASYNC' ? 'Asincrónico' : 'Sincrónico';
}
