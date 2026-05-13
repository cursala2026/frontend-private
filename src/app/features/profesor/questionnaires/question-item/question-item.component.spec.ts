import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, FormGroup, FormArray, FormControl, Validators, AbstractControl } from '@angular/forms';
import { QuestionItemComponent } from './question-item.component';
import { InfoService } from '../../../../core/services/info.service';
import { QuestionMediaUploadManagerService } from '../../../../core/services/question-media-upload-manager.service';
import { QuestionnairesService } from '../../../../core/services/questionnaires.service';
import { Subject } from 'rxjs';

// ─── Helpers ────────────────────────────────────────────────────────────────

function createOptionGroup(text = ''): FormGroup {
  return new FormGroup({
    _id: new FormControl(null),
    text: new FormControl(text, [Validators.required, Validators.maxLength(500)]),
    order: new FormControl(0)
  });
}

function createQuestionGroup(type: string = 'MULTIPLE_CHOICE'): FormGroup {
  const optionsArray = new FormArray<FormGroup>([]);
  for (let i = 0; i < 4; i++) {
    optionsArray.push(createOptionGroup(`Opción ${i + 1}`));
  }

  return new FormGroup({
    type: new FormControl(type),
    questionText: new FormControl('Pregunta de prueba'),
    points: new FormControl(10),
    required: new FormControl(true),
    options: optionsArray,
    correctOptionId: new FormControl(''),
    correctOptionIds: new FormControl<string[]>([]),
    originalCorrectOptionId: new FormControl(null),
    originalCorrectOptionIds: new FormControl<string[]>([]),
    promptType: new FormControl('TEXT'),
    promptMediaUrl: new FormControl(''),
    promptMediaProvider: new FormControl('BUNNY')
  });
}

// ─── Mocks ──────────────────────────────────────────────────────────────────

const infoServiceMock = {
  showError: jasmine.createSpy('showError'),
  showInfo: jasmine.createSpy('showInfo'),
  showSuccess: jasmine.createSpy('showSuccess')
};

const uploadManagerMock = {
  startUpload: jasmine.createSpy('startUpload').and.returnValue({ started: false }),
  uploadCompleted$: new Subject()
};

const questionnairesServiceMock = {
  getQuestionnaireById: jasmine.createSpy('getQuestionnaireById')
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('QuestionItemComponent', () => {
  let component: QuestionItemComponent;
  let fixture: ComponentFixture<QuestionItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuestionItemComponent, ReactiveFormsModule],
      providers: [
        { provide: InfoService, useValue: infoServiceMock },
        { provide: QuestionMediaUploadManagerService, useValue: uploadManagerMock },
        { provide: QuestionnairesService, useValue: questionnairesServiceMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(QuestionItemComponent);
    component = fixture.componentInstance;
  });

  // ── onQuestionTypeChange ────────────────────────────────────────────────

  describe('onQuestionTypeChange()', () => {

    it('debe preservar el texto de las opciones al cambiar de MULTIPLE_CHOICE a MULTIPLE_SELECT', () => {
      // Arrange: pregunta MULTIPLE_CHOICE con 4 opciones con texto
      const questionGroup = createQuestionGroup('MULTIPLE_CHOICE');
      component.question = questionGroup as AbstractControl;
      fixture.detectChanges();

      const textoEsperado = ['Alpha', 'Beta', 'Gamma', 'Delta'];
      const options = questionGroup.get('options') as FormArray;
      textoEsperado.forEach((txt, i) => options.at(i).get('text')?.setValue(txt));

      // Act: cambiar tipo a MULTIPLE_SELECT
      questionGroup.get('type')?.setValue('MULTIPLE_SELECT');
      component.onQuestionTypeChange();

      // Assert: los textos se preservaron
      const optionsAfter = (component.question as FormGroup).get('options') as FormArray;
      textoEsperado.forEach((txt, i) => {
        expect(optionsAfter.at(i).get('text')?.value).toBe(txt,
          `La opción ${i + 1} debería conservar el texto "${txt}"`);
      });
    });

    it('debe preservar el texto de las opciones al cambiar de MULTIPLE_SELECT a MULTIPLE_CHOICE', () => {
      // Arrange
      const questionGroup = createQuestionGroup('MULTIPLE_SELECT');
      component.question = questionGroup as AbstractControl;
      fixture.detectChanges();

      const textos = ['Opción A', 'Opción B', 'Opción C', 'Opción D'];
      const options = questionGroup.get('options') as FormArray;
      textos.forEach((txt, i) => options.at(i).get('text')?.setValue(txt));

      // Act
      questionGroup.get('type')?.setValue('MULTIPLE_CHOICE');
      component.onQuestionTypeChange();

      // Assert
      const optionsAfter = (component.question as FormGroup).get('options') as FormArray;
      textos.forEach((txt, i) => {
        expect(optionsAfter.at(i).get('text')?.value).toBe(txt);
      });
    });

    it('debe resetear correctOptionId y correctOptionIds al cambiar de tipo', () => {
      // Arrange
      const questionGroup = createQuestionGroup('MULTIPLE_CHOICE');
      questionGroup.patchValue({ correctOptionId: '2', correctOptionIds: ['0', '1'] });
      component.question = questionGroup as AbstractControl;
      fixture.detectChanges();

      // Act
      questionGroup.get('type')?.setValue('MULTIPLE_SELECT');
      component.onQuestionTypeChange();

      // Assert
      expect(questionGroup.get('correctOptionId')?.value).toBe('');
      expect(questionGroup.get('correctOptionIds')?.value).toEqual([]);
    });

    it('debe limpiar las opciones al cambiar a tipo TEXT', () => {
      // Arrange
      const questionGroup = createQuestionGroup('MULTIPLE_CHOICE');
      component.question = questionGroup as AbstractControl;
      fixture.detectChanges();

      // Act
      questionGroup.get('type')?.setValue('TEXT');
      component.onQuestionTypeChange();

      // Assert
      const optionsAfter = (component.question as FormGroup).get('options') as FormArray;
      expect(optionsAfter.length).toBe(0);
    });

    it('NO debe mostrar error de opciones vacías después de cambiar tipo si las opciones tienen texto', () => {
      // Arrange — este es el caso exacto del bug report
      const questionGroup = createQuestionGroup('MULTIPLE_CHOICE');
      component.question = questionGroup as AbstractControl;
      fixture.detectChanges();

      // Completar todas las opciones
      const options = questionGroup.get('options') as FormArray;
      ['Texto 1', 'Texto 2', 'Texto 3', 'Texto 4'].forEach((txt, i) =>
        options.at(i).get('text')?.setValue(txt)
      );

      // Act: cambiar tipo (reproduce el bug)
      questionGroup.get('type')?.setValue('MULTIPLE_SELECT');
      component.onQuestionTypeChange();

      // Assert: no debe haber error de optionTextEmpty
      const errors = questionGroup.errors;
      expect(errors?.['optionTextEmpty']).toBeUndefined(
        'No debería haber error de opciones vacías si todas tienen texto'
      );
    });

    it('debe crear exactamente 4 opciones al cambiar entre tipos de opción múltiple', () => {
      const questionGroup = createQuestionGroup('MULTIPLE_CHOICE');
      component.question = questionGroup as AbstractControl;
      fixture.detectChanges();

      questionGroup.get('type')?.setValue('MULTIPLE_SELECT');
      component.onQuestionTypeChange();

      const optionsAfter = (component.question as FormGroup).get('options') as FormArray;
      expect(optionsAfter.length).toBe(4);
    });

    it('debe rellenar con texto vacío si el nuevo tipo tiene más opciones que las existentes', () => {
      // Arrange: solo 2 opciones previas
      const questionGroup = createQuestionGroup('TEXT');
      const options = questionGroup.get('options') as FormArray;
      while (options.length) options.removeAt(0);
      options.push(createOptionGroup('Solo una opción'));
      component.question = questionGroup as AbstractControl;
      fixture.detectChanges();

      // Act
      questionGroup.get('type')?.setValue('MULTIPLE_CHOICE');
      component.onQuestionTypeChange();

      // Assert: 4 opciones, primera con texto, resto vacías
      const optionsAfter = (component.question as FormGroup).get('options') as FormArray;
      expect(optionsAfter.length).toBe(4);
      expect(optionsAfter.at(0).get('text')?.value).toBe('Solo una opción');
      expect(optionsAfter.at(1).get('text')?.value).toBe('');
      expect(optionsAfter.at(2).get('text')?.value).toBe('');
      expect(optionsAfter.at(3).get('text')?.value).toBe('');
    });
  });

  // ── addOption / removeOption ────────────────────────────────────────────

  describe('addOption()', () => {
    it('debe agregar una opción vacía al array', () => {
      const questionGroup = createQuestionGroup('MULTIPLE_CHOICE');
      component.question = questionGroup as AbstractControl;
      fixture.detectChanges();

      const beforeCount = component.options.length;
      component.addOption();
      expect(component.options.length).toBe(beforeCount + 1);
    });
  });

  describe('removeOption()', () => {
    it('debe eliminar la opción en el índice indicado si hay más de 2', () => {
      const questionGroup = createQuestionGroup('MULTIPLE_CHOICE');
      component.question = questionGroup as AbstractControl;
      fixture.detectChanges();

      expect(component.options.length).toBe(4);
      component.removeOption(0);
      expect(component.options.length).toBe(3);
    });

    it('NO debe eliminar si solo hay 2 opciones', () => {
      const questionGroup = createQuestionGroup('MULTIPLE_CHOICE');
      const options = questionGroup.get('options') as FormArray;
      while (options.length > 2) options.removeAt(options.length - 1);
      component.question = questionGroup as AbstractControl;
      fixture.detectChanges();

      component.removeOption(0);
      expect(component.options.length).toBe(2);
    });
  });

  // ── toggleCorrectOption ─────────────────────────────────────────────────

  describe('toggleCorrectOption()', () => {
    it('debe agregar el índice a correctOptionIds si no estaba', () => {
      const questionGroup = createQuestionGroup('MULTIPLE_SELECT');
      component.question = questionGroup as AbstractControl;
      fixture.detectChanges();

      component.toggleCorrectOption(1);
      expect(questionGroup.get('correctOptionIds')?.value).toContain('1');
    });

    it('debe quitar el índice de correctOptionIds si ya estaba', () => {
      const questionGroup = createQuestionGroup('MULTIPLE_SELECT');
      questionGroup.patchValue({ correctOptionIds: ['0', '1'] });
      component.question = questionGroup as AbstractControl;
      fixture.detectChanges();

      component.toggleCorrectOption(1);
      expect(questionGroup.get('correctOptionIds')?.value).not.toContain('1');
    });
  });

  // ── onOptionTextChange ──────────────────────────────────────────────────

  describe('onOptionTextChange()', () => {
    it('debe actualizar el valor del control de texto en el índice correcto', () => {
      const questionGroup = createQuestionGroup('MULTIPLE_CHOICE');
      component.question = questionGroup as AbstractControl;
      fixture.detectChanges();

      component.onOptionTextChange('Nuevo texto', 2);
      const options = (component.question as FormGroup).get('options') as FormArray;
      expect(options.at(2).get('text')?.value).toBe('Nuevo texto');
    });

    it('debe marcar el control como touched', () => {
      const questionGroup = createQuestionGroup('MULTIPLE_CHOICE');
      component.question = questionGroup as AbstractControl;
      fixture.detectChanges();

      component.onOptionTextChange('Algo', 0);
      const options = (component.question as FormGroup).get('options') as FormArray;
      expect(options.at(0).get('text')?.touched).toBeTrue();
    });
  });
});