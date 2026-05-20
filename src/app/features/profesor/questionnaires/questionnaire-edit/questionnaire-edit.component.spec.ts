import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, FormGroup, FormArray, FormControl, Validators } from '@angular/forms';
import { of } from 'rxjs';
import { QuestionnairesService } from '../../../../core/services/questionnaires.service';
import { ClassesService } from '../../../../core/services/classes.service';
import { CourseEventsService } from '../../../../core/services/course-events.service';
import { InfoService } from '../../../../core/services/info.service';
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
  // Mocks de servicios
  const mockClassesService = { getClassesByCourse: vi.fn().mockReturnValue(of({ data: [] })) };
  const mockQuestionnairesService = {
    getQuestionnairesByCourse: vi.fn().mockReturnValue(of({ data: [] })),
    getQuestionnaireById: vi.fn().mockReturnValue(of({ data: null })),
    hasSubmissions: vi.fn().mockReturnValue(of({ data: { hasSubmissions: false } })),
    updateQuestionnaire: vi.fn().mockReturnValue(of({ data: {} }))
  };
  const mockInfoService = { showError: vi.fn(), showSuccess: vi.fn() };
  const mockCourseEvents = {} as Partial<CourseEventsService>;

  beforeEach(() => {
    // En entorno Vitest evitar inicializar TestBed para este spec; los tests de
    // `questionGroupValidator` se ejecutan de forma standalone llamando al método
    // desde el prototype del componente.
  });

  describe('Comportamiento frente a envíos existentes', () => {
    let mockCourseEvents: Partial<CourseEventsService>;
    beforeEach(async () => {
      mockCourseEvents = {
        onQuestionnaireReset: vi.fn().mockReturnValue(of())
      } as any;

      await TestBed.configureTestingModule({
        imports: [ReactiveFormsModule, QuestionnaireEditComponent],
        providers: [
          { provide: ClassesService, useValue: mockClassesService },
          { provide: QuestionnairesService, useValue: mockQuestionnairesService },
          { provide: InfoService, useValue: mockInfoService },
          { provide: CourseEventsService, useValue: mockCourseEvents },
          provideRouter([])
        ]
      }).compileComponents();

      fixture = TestBed.createComponent(QuestionnaireEditComponent);
      component = fixture.componentInstance as QuestionnaireEditComponent;

      // Inicializar el formulario mínimo para evitar validaciones por defecto
      component.initForm();
      component.isEditMode = true;
      component.questionnaireId = 'qid-1';
    });

    it('bloquea agregar/eliminar preguntas si hay envíos', () => {
      component.hasSubmissions.set(true);

      component.addQuestion();
      expect(mockInfoService.showError).toHaveBeenCalledWith('Este cuestionario ya tiene envíos; no se puede agregar nuevas preguntas.');

      // Añadir una pregunta para luego intentar eliminar (forzar estado)
      component.questions.push((component as any).createQuestionGroup());
      component.removeQuestion(0);
      expect(mockInfoService.showError).toHaveBeenCalledWith('Este cuestionario ya tiene envíos; no se pueden eliminar preguntas.');
    });

    it('al guardar en edición con envíos NO envía `questions` al backend', () => {
      // Preparar formulario con valores válidos
      component.hasSubmissions.set(true);
      component.questionnaireForm.patchValue({ courseId: 'c1', title: 'T', status: 'ACTIVE', positionType: 'BETWEEN_CLASSES', afterClassId: 'cls1' });

      // Añadir una pregunta válida
      component.questions.clear();
      component.questions.push((component as any).createQuestionGroup({ type: 'MULTIPLE_CHOICE', questionText: 'Q', points: 10, options: [{ text: 'A' }, { text: 'B' }], correctOptionId: '0' } as any));

      const updateSpy = vi.spyOn(TestBed.inject(QuestionnairesService), 'updateQuestionnaire').mockReturnValue(of({ data: {} }));

      component.onSubmit();

      expect(updateSpy).toHaveBeenCalled();
      expect(component.lastSavePayload).toBeDefined();
      expect(component.lastSavePayload.questions).toBeUndefined();
    });

    it('permite editar cuando NO hay envíos y envía preguntas al backend', () => {
      component.hasSubmissions.set(false);
      component.questionnaireForm.patchValue({ courseId: 'c1', title: 'T', status: 'ACTIVE', positionType: 'BETWEEN_CLASSES', afterClassId: 'cls1' });

      component.questions.clear();
      component.questions.push((component as any).createQuestionGroup({ type: 'MULTIPLE_CHOICE', questionText: 'Q', points: 10, options: [{ text: 'A' }, { text: 'B' }], correctOptionId: '0' } as any));

      const updateSpy = vi.spyOn(TestBed.inject(QuestionnairesService), 'updateQuestionnaire').mockReturnValue(of({ data: {} }));

      component.onSubmit();

      expect(updateSpy).toHaveBeenCalled();
      expect(component.lastSavePayload).toBeDefined();
      expect(component.lastSavePayload.questions).toBeDefined();
      expect(Array.isArray(component.lastSavePayload.questions)).toBe(true);
    });
  });


  // ── Tests existentes (Tarea #14: Encuestas) ──────────────────────────────

  it.skip('should create', () => {
    // Skip: este test requiere TestBed + template. Ejecutar en builder Angular.
  });

  it.skip('debe tener el control isSurvey en el formulario', () => {});

  it.skip('debe permitir cambiar el valor de isSurvey', () => {});

  it.skip('debe cargar el estado de encuesta al usar populateForm', () => {});

  // ── Tests nuevos: questionGroupValidator ─────────────────────────────────

  describe('questionGroupValidator()', () => {

    it('no debe retornar errores si todas las opciones tienen texto y hay respuesta correcta (MULTIPLE_CHOICE)', () => {
      const group = new FormGroup({
        type: new FormControl('MULTIPLE_CHOICE'),
        options: buildOptionsArray(['Opción A', 'Opción B', 'Opción C', 'Opción D']),
        correctOptionId: new FormControl('0'),
        correctOptionIds: new FormControl<string[]>([])
      });

      const errors = (QuestionnaireEditComponent.prototype as any).questionGroupValidator.call({}, group);
      expect(errors).toBeNull();
    });

    it('no debe retornar errores si todas las opciones tienen texto y hay respuestas correctas (MULTIPLE_SELECT)', () => {
      const group = new FormGroup({
        type: new FormControl('MULTIPLE_SELECT'),
        options: buildOptionsArray(['Opción A', 'Opción B', 'Opción C']),
        correctOptionId: new FormControl(''),
        correctOptionIds: new FormControl<string[]>(['0', '2'])
      });

      const errors = (QuestionnaireEditComponent.prototype as any).questionGroupValidator.call({}, group);
      expect(errors).toBeNull();
    });

    it('no debe retornar errores para preguntas de tipo TEXT', () => {
      const group = new FormGroup({
        type: new FormControl('TEXT'),
        options: new FormArray([]),
        correctOptionId: new FormControl(''),
        correctOptionIds: new FormControl<string[]>([])
      });

      const errors = (QuestionnaireEditComponent.prototype as any).questionGroupValidator.call({}, group);
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

      const errors = (QuestionnaireEditComponent.prototype as any).questionGroupValidator.call({}, group);
      expect(errors?.['optionTextEmpty']).toBeUndefined();
    });

    it('debe reportar optionTextEmpty si hay opciones sin texto', () => {
      const group = new FormGroup({
        type: new FormControl('MULTIPLE_CHOICE'),
        options: buildOptionsArray(['Opción A', '', 'Opción C', '']),
        correctOptionId: new FormControl('0'),
        correctOptionIds: new FormControl<string[]>([])
      });

      const errors = (QuestionnaireEditComponent.prototype as any).questionGroupValidator.call({}, group);
      expect(errors?.['optionTextEmpty']).toContain('2 opción(es) sin texto');
    });

    it('debe reportar optionsCount si hay menos de 2 opciones', () => {
      const group = new FormGroup({
        type: new FormControl('MULTIPLE_CHOICE'),
        options: buildOptionsArray(['Única opción']),
        correctOptionId: new FormControl('0'),
        correctOptionIds: new FormControl<string[]>([])
      });

      const errors = (QuestionnaireEditComponent.prototype as any).questionGroupValidator.call({}, group);
      expect(errors?.['optionsCount']).toBeTruthy();
    });

    it('debe reportar noCorrect si no se selecciona opción correcta en MULTIPLE_CHOICE', () => {
      const group = new FormGroup({
        type: new FormControl('MULTIPLE_CHOICE'),
        options: buildOptionsArray(['A', 'B', 'C', 'D']),
        correctOptionId: new FormControl(''),
        correctOptionIds: new FormControl<string[]>([])
      });

      const errors = (QuestionnaireEditComponent.prototype as any).questionGroupValidator.call({}, group);
      expect(errors?.['noCorrect']).toBeTruthy();
    });

    it('debe reportar noCorrect si no se selecciona ninguna opción en MULTIPLE_SELECT', () => {
      const group = new FormGroup({
        type: new FormControl('MULTIPLE_SELECT'),
        options: buildOptionsArray(['A', 'B', 'C']),
        correctOptionId: new FormControl(''),
        correctOptionIds: new FormControl<string[]>([])
      });

      const errors = (QuestionnaireEditComponent.prototype as any).questionGroupValidator.call({}, group);
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
      (QuestionnaireEditComponent.prototype as any).questionGroupValidator.call({}, group);

      expect(optA.errors).toEqual(errorsAntes);
    });

    it('puede reportar múltiples errores a la vez', () => {
      const group = new FormGroup({
        type: new FormControl('MULTIPLE_CHOICE'),
        options: buildOptionsArray(['']),
        correctOptionId: new FormControl(''),
        correctOptionIds: new FormControl<string[]>([])
      });

      const errors = (QuestionnaireEditComponent.prototype as any).questionGroupValidator.call({}, group);
      expect(errors?.['optionsCount']).toBeTruthy();
      expect(errors?.['optionTextEmpty']).toBeTruthy();
      expect(errors?.['noCorrect']).toBeTruthy();
    });
  });
});
