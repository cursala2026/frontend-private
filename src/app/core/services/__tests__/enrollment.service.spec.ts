import '@angular/compiler';
import { describe, it, beforeEach, expect } from 'vitest';
import { Injector } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { EnrollmentService } from '../enrollment.service';
import { EnrolledStudent } from '../../models/enrollment.model';

describe('EnrollmentService - Minimizacion de datos', () => {
  let service: EnrollmentService;
  let httpClientMock: { get: any };

  // El backend manda campos sensibles A PROPOSITO.
  // El service tiene que dejar pasar SOLO name, lastName y education.
  const backendResponse = [
    {
      firstName: 'Ana',
      lastName: 'Garcia',
      education: 'Ingenieria en Sistemas',
      email: 'ana@secreto.com',
      dni: '40123456',
      phone: '2611234567',
      _id: 'user-1',
    },
    {
      firstName: 'Luis',
      lastName: 'Perez',
      education: 'Contador Publico',
      email: 'luis@secreto.com',
      dni: '38999888',
      phone: '2617654321',
      _id: 'user-2',
    },
  ];

  function buildService(getImpl: () => any): EnrollmentService {
    httpClientMock = { get: getImpl };
    const injector = Injector.create({
      providers: [
        EnrollmentService,
        { provide: HttpClient, useValue: httpClientMock },
      ],
    });
    return injector.get(EnrollmentService);
  }

  beforeEach(() => {
    service = buildService(() => of(backendResponse));
  });

  it('debe devolver la cantidad correcta de alumnos', () => {
    let result: EnrolledStudent[] = [];
    service.getEnrolledStudents('curso-1').subscribe((r) => (result = r));
    expect(result.length).toBe(2);
  });

  it('debe mapear firstName del backend a name del contrato', () => {
    let result: EnrolledStudent[] = [];
    service.getEnrolledStudents('curso-1').subscribe((r) => (result = r));
    expect(result[0].name).toBe('Ana');
    expect(result[0].lastName).toBe('Garcia');
    expect(result[0].education).toBe('Ingenieria en Sistemas');
  });

  it('MINIMIZACION: cada alumno tiene EXACTAMENTE 3 campos', () => {
    let result: EnrolledStudent[] = [];
    service.getEnrolledStudents('curso-1').subscribe((r) => (result = r));

    result.forEach((student) => {
      expect(Object.keys(student).sort()).toEqual([
        'education',
        'lastName',
        'name',
      ]);
    });
  });

  it('MINIMIZACION: no filtra datos sensibles (email, dni, phone, _id)', () => {
    let result: any[] = [];
    service.getEnrolledStudents('curso-1').subscribe((r) => (result = r));

    result.forEach((student) => {
      expect(student.email).toBeUndefined();
      expect(student.dni).toBeUndefined();
      expect(student.phone).toBeUndefined();
      expect(student._id).toBeUndefined();
    });
  });

  it('debe soportar respuesta envuelta en { data: [...] }', () => {
    service = buildService(() => of({ data: backendResponse }));

    let result: EnrolledStudent[] = [];
    service.getEnrolledStudents('curso-1').subscribe((r) => (result = r));
    expect(result.length).toBe(2);
    expect(result[1].name).toBe('Luis');
  });

  it('debe devolver lista vacia si no hay alumnos', () => {
    service = buildService(() => of([]));

    let result: EnrolledStudent[] = [];
    service.getEnrolledStudents('curso-1').subscribe((r) => (result = r));
    expect(result).toEqual([]);
  });

  it('debe propagar el error ante una respuesta HTTP fallida', () => {
    service = buildService(() =>
      throwError(() => ({ status: 500, statusText: 'Server Error' })),
    );

    let errorStatus = 0;
    service.getEnrolledStudents('curso-1').subscribe({
      next: () => {
        expect(false).toBe(true);
      },
      error: (err) => {
        errorStatus = err.status;
      },
    });

    expect(errorStatus).toBe(500);
  });
});