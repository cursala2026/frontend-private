import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TeacherApplyComponent } from './teacher-apply.component';

describe('TeacherApplyComponent (Postulacion interna con Signals)', () => {
  let component: TeacherApplyComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeacherApplyComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const fixture = TestBed.createComponent(TeacherApplyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // 1. Inyeccion de dependencias: compila sin error NG0201
  it('se instancia sin error NG0201 usando provideHttpClient() y provideHttpClientTesting()', () => {
    expect(component).toBeTruthy();
  });

  // 2. Limite de caracteres: bio invalida a 501 chars
  it('marca la bio como invalida al ingresar 501 caracteres', () => {
    const bio = component.form.get('bio');
    bio?.setValue('a'.repeat(501));
    expect(bio?.valid).toBe(false);
    expect(bio?.hasError('maxlength')).toBe(true);
  });

  // 3. Aceptacion legal: invalido si es false
  it('marca agreementAccepted como invalido si su valor es false', () => {
    const agreement = component.form.get('agreementAccepted');
    agreement?.setValue(false);
    expect(agreement?.valid).toBe(false);
  });

  // 4. Envio bloqueado mientras el form sea invalido o falten urls
  it('mantiene el submit deshabilitado si el form es invalido o faltan urls', () => {
    // form vacio -> bloqueado
    expect(component.isSubmitDisabled()).toBe(true);

    // completamos el form con datos validos
    component.form.setValue({
      title: 'Ingeniero',
      yearsOfExperience: 5,
      bio: 'Hola, soy profesor de matematica',
      agreementAccepted: true,
    });

    // faltan las urls -> sigue bloqueado
    expect(component.isSubmitDisabled()).toBe(true);

    // cargamos las 3 urls en los signals
    component.photoUrl.set('http://cdn/foto.png');
    component.cvUrl.set('http://cdn/cv.pdf');
    component.signatureUrl.set('http://cdn/firma.png');

    // ahora si -> habilitado
    expect(component.isSubmitDisabled()).toBe(false);
  });
});