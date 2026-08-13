import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { AdminDocumentationComponent } from './admin-documentation.component';
import { DocumentationService } from '../../../core/services/documentation.service';
import { InfoService } from '../../../core/services/info.service';

// dobles de prueba: reemplazan a los services reales para aislar el componente
const documentationServiceMock = {
  documents: signal([]),
  uploadDocument: () => of({ status: 201 }),
  refreshDocuments: () => {},
};
const infoServiceMock = {
  showSuccess: () => {},
  showError: () => {},
};

describe('AdminDocumentationComponent', () => {
  let fixture: ComponentFixture<AdminDocumentationComponent>;
  let component: AdminDocumentationComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDocumentationComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DocumentationService, useValue: documentationServiceMock },
        { provide: InfoService, useValue: infoServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDocumentationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deberia crearse', () => {
    expect(component).toBeTruthy();
  });

  it('mantiene el submit deshabilitado si el form es invalido', () => {
    const btn = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(btn.disabled).toBe(true);
  });

  it('habilita el submit con form valido y archivo elegido', () => {
    component.form.setValue({ title: 'documento test', category: 'PLANTILLAS' });
    component.selectedFile = new File(['x'], 'test.pdf');
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(btn.disabled).toBe(false);
  });
});