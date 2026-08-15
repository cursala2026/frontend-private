import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import { AdminDocumentationComponent } from './admin-documentation.component';
import { DocumentationService } from '../../../core/services/documentation.service';
import { InfoService } from '../../../core/services/info.service';

describe('AdminDocumentationComponent (Prueba Sustantiva de Lógica y Estado)', () => {
  let component: AdminDocumentationComponent;
  let injector: Injector;

  const docServiceMock = {
    uploadDocument: vi.fn().mockReturnValue(of({ success: true })),
    documents: vi.fn().mockReturnValue([])
  };

  const infoServiceMock = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn()
  };

  beforeEach(() => {
    injector = Injector.create({
      providers: [
        FormBuilder,
        { provide: DocumentationService, useValue: docServiceMock },
        { provide: InfoService, useValue: infoServiceMock }
      ]
    });

    runInInjectionContext(injector, () => {
      component = new AdminDocumentationComponent();
    });
  });

  it('deberia instanciarse correctamente con dependencias resueltas', () => {
    expect(component).toBeTruthy();
  });

  it('mantiene el formulario invalido si faltan campos requeridos', () => {
    component.form.patchValue({ title: '', category: '' });
    expect(component.form.valid).toBe(false);
  });

  it('habilita el estado con formulario valido y archivo cargado', () => {
    component.form.patchValue({
      title: 'Planilla de Asistencia',
      category: 'PLANTILLAS'
    });

    const fakeFile = new File(['dummy-content'], 'asistencia.pdf', { type: 'application/pdf' });
    component.selectedFile = fakeFile;

    expect(component.form.valid).toBe(true);
    expect(component.selectedFile).not.toBeNull();
    expect(component.selectedFile?.name).toBe('asistencia.pdf');
  });
});