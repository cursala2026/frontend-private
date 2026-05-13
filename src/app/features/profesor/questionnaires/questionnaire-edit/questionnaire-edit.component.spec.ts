import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, FormGroup, FormArray, FormControl, Validators } from '@angular/forms';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { QuestionnaireEditComponent } from './questionnaire-edit.component';

// ─── Helper ─────────────────────────────────────────────────────────────────

function buildOptionsArray(texts: string[]): FormArray {
  const arr = new FormArray<FormGroup>([]);
  texts.forEach(txt =>
    arr.push(new FormGroup({
      _id: new FormControl(null),
      text: new FormControl(txt, [Validators.required]),
      order: new FormControl(0)
    }))
  );
  return arr;
}

// ─── Suite ──────────────────────────────────────────────────────────────────

describe('QuestionnaireEditComponent', () => {
  let component: QuestionnaireEditComponent;
  let fixture: ComponentFixture<QuestionnaireEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuestionnaireEditComponent, ReactiveFormsModule],
      providers: [
        provideHttpClient(),
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(QuestionnaireEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ── Tests existentes (Tarea #14: Encuestas) ──────────────────────────────

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('debe tener el control isSurvey en el formulario', () => {
    const isSurveyControl = component.questionnaireForm.get('isSurvey');
    expect(isSurveyControl).toBeTruthy();
  });

  it('debe permitir cambiar el valor de isSurvey', () => {
    const isSurveyControl = component.questionnaireForm.get('isSurvey');
    isSurveyControl?.setValue(true);
    expect(isSurveyControl?.value).toBeTrue();
  });

  it('debe cargar el estado de encuesta al usar populateForm', () => {
    const mockSurvey = {
      courseId: '123',
      title: 'Encuesta',
      isSurvey: true,
      position: { type: 'BETWEEN_CLASSES' },
      questions: []
    };
    component.populateForm(mockSurvey as any);
    expect(component.questionnaireForm.get('isSurvey')?.value).toBeTrue();
  });

  // ── Tests nuevos: questionGroupValidator ─────────────────────────────────

  describe('questionGroupValidator()', () => {

    it('no debe retornar errores si todas las opciones tienen texto y hay respuesta correcta (MULTIPLE_CHOICE)', () => {
      const group = new FormGroup({
        type: new FormControl('MULTIPLE_CHOICE'),
        options: buildOptionsArray(['Opción A', 'Opción B', 'Opción C', 'Opción D']),
        correctOptionId: new FormControl('0'),
        correctOptionIds: new FormControl<string[]>([])
      });

      const errors = (component as any).questionGroupValidator(group);
      expect(errors).toBeNull();
    });

    it('no debe retornar errores si todas las opciones tienen texto y hay respuestas correctas (MULTIPLE_SELECT)', () => {
      const group = new FormGroup({
        type: new FormControl('MULTIPLE_SELECT'),
        options: buildOptionsArray(['Opción A', 'Opción B', 'Opción C']),
        correctOptionId: new FormControl(''),
        correctOptionIds: new FormControl<string[]>(['0', '2'])
      });

      const errors = (component as any).questionGroupValidator(group);
      expect(errors).toBeNull();
    });

    it('no debe retornar errores para preguntas de tipo TEXT', () => {
      const group = new FormGroup({
        type: new FormControl('TEXT'),
        options: new FormArray([]),
        correctOptionId: new FormControl(''),
        correctOptionIds: new FormControl<string[]>([])
      });

      const errors = (component as any).questionGroupValidator(group);
      expect(errors).toBeNull();
    });

    it('NO debe reportar optionTextEmpty si las opciones preservadas tienen texto tras cambiar tipo — bug #reporte', () => {
      // Reproduce exactamente el bug: usuario tenía MULTIPLE_CHOICE con 4 opciones
      // completas y cambió a MULTIPLE_SELECT. El validador no debe ver opciones vacías.
      const group = new FormGroup({
        type: new FormControl('MULTIPLE_SELECT'),
        options: buildOptionsArray(['Alpha', 'Beta', 'Gamma', 'Delta']),
        correctOptionId: new FormControl(''),
        correctOptionIds: new FormControl<string[]>(['0'])
      });

      const errors = (component as any).questionGroupValidator(group);
      expect(errors?.['optionTextEmpty']).toBeUndefined(
        'No debe haber error de opciones vacías cuando todas tienen texto'
      );
    });

    it('debe reportar optionTextEmpty si hay opciones sin texto', () => {
      const group = new FormGroup({
        type: new FormControl('MULTIPLE_CHOICE'),
        options: buildOptionsArray(['Opción A', '', 'Opción C', '']),
        correctOptionId: new FormControl('0'),
        correctOptionIds: new FormControl<string[]>([])
      });

      const errors = (component as any).questionGroupValidator(group);
      expect(errors?.['optionTextEmpty']).toContain('2 opción(es) sin texto');
    });

    it('debe reportar optionsCount si hay menos de 2 opciones', () => {
      const group = new FormGroup({
        type: new FormControl('MULTIPLE_CHOICE'),
        options: buildOptionsArray(['Única opción']),
        correctOptionId: new FormControl('0'),
        correctOptionIds: new FormControl<string[]>([])
      });

      const errors = (component as any).questionGroupValidator(group);
      expect(errors?.['optionsCount']).toBeTruthy();
    });

    it('debe reportar noCorrect si no se selecciona opción correcta en MULTIPLE_CHOICE', () => {
      const group = new FormGroup({
        type: new FormControl('MULTIPLE_CHOICE'),
        options: buildOptionsArray(['A', 'B', 'C', 'D']),
        correctOptionId: new FormControl(''),
        correctOptionIds: new FormControl<string[]>([])
      });

      const errors = (component as any).questionGroupValidator(group);
      expect(errors?.['noCorrect']).toBeTruthy();
    });

    it('debe reportar noCorrect si no se selecciona ninguna opción en MULTIPLE_SELECT', () => {
      const group = new FormGroup({
        type: new FormControl('MULTIPLE_SELECT'),
        options: buildOptionsArray(['A', 'B', 'C']),
        correctOptionId: new FormControl(''),
        correctOptionIds: new FormControl<string[]>([])
      });

      const errors = (component as any).questionGroupValidator(group);
      expect(errors?.['noCorrect']).toBeTruthy();
    });

    it('NO debe modificar los errores de controles hijos válidos', () => {
      // El validador anterior llamaba setErrors({ required: true }) en controles hijos.
      // El fix elimina ese comportamiento.
      const optA = new FormControl('Texto ok', [Validators.required]);
      const optB = new FormControl('', [Validators.required]);

      const group = new FormGroup({
        type: new FormControl('MULTIPLE_CHOICE'),
        options: new FormArray([
          new FormGroup({ _id: new FormControl(null), text: optA, order: new FormControl(0) }),
          new FormGroup({ _id: new FormControl(null), text: optB, order: new FormControl(0) })
        ]),
        correctOptionId: new FormControl('0'),
        correctOptionIds: new FormControl<string[]>([])
      });

      const errorsAntes = optA.errors;
      (component as any).questionGroupValidator(group);

      expect(optA.errors).toEqual(errorsAntes,
        'El validador padre no debe sobreescribir los errores de controles hijos válidos'
      );
    });

    it('puede reportar múltiples errores a la vez', () => {
      const group = new FormGroup({
        type: new FormControl('MULTIPLE_CHOICE'),
        options: buildOptionsArray(['']),
        correctOptionId: new FormControl(''),
        correctOptionIds: new FormControl<string[]>([])
      });

      const errors = (component as any).questionGroupValidator(group);
      expect(errors?.['optionsCount']).toBeTruthy();
      expect(errors?.['optionTextEmpty']).toBeTruthy();
      expect(errors?.['noCorrect']).toBeTruthy();
    });
  });
});
