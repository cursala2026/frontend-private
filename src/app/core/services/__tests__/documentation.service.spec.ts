import '@angular/compiler';
import { describe, it, beforeEach, expect } from 'vitest';
import { signal, Injector } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { DocumentationService } from '../documentation.service';
import { AuthService } from '../auth.service';
import { IDocument } from '../../models/documentation.model';

describe('DocumentationService - Control Sustantivo de Visibilidad', () => {
  let service: DocumentationService;
  let httpClientMock: { get: any; post: any };

  const userRolesSignal = signal<string[]>(['PROFESOR']);
  const authServiceMock = {
    getUserRoles: () => userRolesSignal()
  };

  const mockDocuments: IDocument[] = [
    {
      _id: 'doc-1',
      title: 'Plantilla de Exámenes',
      filename: 'plantilla.docx',
      category: 'PLANTILLAS',
      url: 'https://cdn.cursala.net/plantilla.docx',
      sizeBytes: 1024,
      visibility: 'PROFESORES'
    },
    {
      _id: 'doc-2',
      title: 'Manual Institucional',
      filename: 'manual.pdf',
      category: 'OTROS',
      url: 'https://cdn.cursala.net/manual.pdf',
      sizeBytes: 2048,
      visibility: 'TODOS'
    }
  ];

  beforeEach(() => {
    userRolesSignal.set(['PROFESOR']);

    httpClientMock = {
      get: () => of(mockDocuments),
      post: () => of(mockDocuments[0])
    };

    const injector = Injector.create({
      providers: [
        DocumentationService,
        { provide: HttpClient, useValue: httpClientMock },
        { provide: AuthService, useValue: authServiceMock }
      ]
    });

    service = injector.get(DocumentationService);
  });

  it('debe filtrar y exponer documentos con visibilidad PROFESORES y TODOS para el rol PROFESOR', () => {
    service.getDocuments().subscribe();

    const visibleDocs = service.filteredDocuments();
    expect(visibleDocs.length).toBe(2);
    expect(visibleDocs.map(d => d._id)).toEqual(['doc-1', 'doc-2']);
  });

  it('debe ocultar documentos exclusivos de docentes cuando el rol pasa a ALUMNO', () => {
    userRolesSignal.set(['ALUMNO']);

    service.getDocuments().subscribe();

    const visibleDocs = service.filteredDocuments();
    expect(visibleDocs.length).toBe(1);
    expect(visibleDocs[0]._id).toBe('doc-2');
  });

  it('debe otorgar visibilidad total sin filtros al rol ADMIN', () => {
    userRolesSignal.set(['ADMIN']);

    service.getDocuments().subscribe();

    const visibleDocs = service.filteredDocuments();
    expect(visibleDocs.length).toBe(2);
  });

  it('debe limpiar las signals y propagar el error ante respuesta HTTP 401/403', () => {
    httpClientMock.get = () => throwError(() => ({ status: 401, statusText: 'Unauthorized' }));

    let errorStatus = 0;
    service.getDocuments().subscribe({
      next: () => {
        expect(false).toBe(true);
      },
      error: (err) => {
        errorStatus = err.status;
      }
    });

    expect(errorStatus).toBe(401);
    expect(service.documents().length).toBe(0);
    expect(service.filteredDocuments().length).toBe(0);
  });
});