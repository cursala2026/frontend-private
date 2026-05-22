import { FormGroup, FormArray, FormControl, Validators, AbstractControl } from '@angular/forms';
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
  showError: vi.fn(),
  showInfo: vi.fn(),
  showSuccess: vi.fn()
};

const uploadManagerMock = {
  startUpload: vi.fn().mockReturnValue({ started: false }),
  uploadCompleted$: new Subject()
};

const questionnairesServiceMock = {
  getQuestionnaireById: vi.fn()
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('QuestionItemComponent', () => {
  let component: any;

  beforeEach(() => {
    // Crear una instancia basada en el prototipo para evitar Angular TestBed
    component = Object.create(QuestionItemComponent.prototype);
    // Asignar servicios y mocks que el componente espera vía `inject()`
    component.infoService = infoServiceMock;
    component.uploadManager = uploadManagerMock;
    component.questionnairesService = questionnairesServiceMock;
    component.isEditMode = false;
    component.hasSubmissions = false;
  });

  // ── onQuestionTypeChange ────────────────────────────────────────────────

  describe('onQuestionTypeChange()', () => {

    it('debe preservar el texto de las opciones al cambiar de MULTIPLE_CHOICE a MULTIPLE_SELECT', () => {
      // Arrange: pregunta MULTIPLE_CHOICE con 4 opciones con texto
      const questionGroup = createQuestionGroup('MULTIPLE_CHOICE');
      component.question = questionGroup as AbstractControl;

      const textoEsperado = ['Alpha', 'Beta', 'Gamma', 'Delta'];
      const options = questionGroup.get('options') as FormArray;
      textoEsperado.forEach((txt, i) => options.at(i).get('text')?.setValue(txt));

      // Act: cambiar tipo a MULTIPLE_SELECT
      questionGroup.get('type')?.setValue('MULTIPLE_SELECT');
      component.onQuestionTypeChange();

      // Assert: los textos se preservaron
      const optionsAfter = (component.question as FormGroup).get('options') as FormArray;
      textoEsperado.forEach((txt, i) => {
        expect(optionsAfter.at(i).get('text')?.value).toBe(txt);
      });
    });

    it('debe preservar el texto de las opciones al cambiar de MULTIPLE_SELECT a MULTIPLE_CHOICE', () => {
      // Arrange
      const questionGroup = createQuestionGroup('MULTIPLE_SELECT');
      component.question = questionGroup as AbstractControl;

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
      expect(errors?.['optionTextEmpty']).toBeUndefined();
    });

    it('debe crear exactamente 4 opciones al cambiar entre tipos de opción múltiple', () => {
      const questionGroup = createQuestionGroup('MULTIPLE_CHOICE');
      component.question = questionGroup as AbstractControl;

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

      const beforeCount = component.options.length;
      component.addOption();
      expect(component.options.length).toBe(beforeCount + 1);
    });
  });

  describe('removeOption()', () => {

    // ── Casos básicos ───────────────────────────────────────────────────────

    it('debe eliminar la opción en el índice indicado si hay más de 2', () => {
      const questionGroup = createQuestionGroup('MULTIPLE_CHOICE');
      component.question = questionGroup as AbstractControl;

      expect(component.options.length).toBe(4);
      component.removeOption(0);
      expect(component.options.length).toBe(3);
    });

    it('NO debe eliminar si solo hay 2 opciones', () => {
      const questionGroup = createQuestionGroup('MULTIPLE_CHOICE');
      const options = questionGroup.get('options') as FormArray;
      while (options.length > 2) options.removeAt(options.length - 1);
      component.question = questionGroup as AbstractControl;

      component.removeOption(0);
      expect(component.options.length).toBe(2);
    });

    it('NO debe eliminar si hasSubmissions=true (cuestionario con envíos)', () => {
      const questionGroup = createQuestionGroup('MULTIPLE_CHOICE');
      component.question = questionGroup as AbstractControl;
      component.isEditMode = true;
      component.hasSubmissions = true;

      component.removeOption(0);

      expect(component.options.length).toBe(4);
      expect(infoServiceMock.showError).toHaveBeenCalledWith(
        expect.stringContaining('envíos')
      );
    });

    // ── Bug de tracking: la opción eliminada debe ser exactamente la del índice dado ──

    it('debe eliminar exactamente la primera opción (índice 0), no la última', () => {
      const questionGroup = createQuestionGroup('MULTIPLE_CHOICE');
      const options = questionGroup.get('options') as FormArray;
      ['Alpha', 'Beta', 'Gamma', 'Delta'].forEach((txt, i) =>
        options.at(i).get('text')?.setValue(txt)
      );
      component.question = questionGroup as AbstractControl;

      component.removeOption(0); // eliminar "Alpha"

      expect(component.options.length).toBe(3);
      expect(component.options.at(0).get('text')?.value).toBe('Beta');
      expect(component.options.at(1).get('text')?.value).toBe('Gamma');
      expect(component.options.at(2).get('text')?.value).toBe('Delta');
    });

    it('debe eliminar exactamente la opción del medio (índice 1), no la última', () => {
      const questionGroup = createQuestionGroup('MULTIPLE_CHOICE');
      const options = questionGroup.get('options') as FormArray;
      ['Alpha', 'Beta', 'Gamma', 'Delta'].forEach((txt, i) =>
        options.at(i).get('text')?.setValue(txt)
      );
      component.question = questionGroup as AbstractControl;

      component.removeOption(1); // eliminar "Beta"

      expect(component.options.length).toBe(3);
      expect(component.options.at(0).get('text')?.value).toBe('Alpha');
      expect(component.options.at(1).get('text')?.value).toBe('Gamma');
      expect(component.options.at(2).get('text')?.value).toBe('Delta');
    });

    it('debe eliminar exactamente la última opción (índice 3)', () => {
      const questionGroup = createQuestionGroup('MULTIPLE_CHOICE');
      const options = questionGroup.get('options') as FormArray;
      ['Alpha', 'Beta', 'Gamma', 'Delta'].forEach((txt, i) =>
        options.at(i).get('text')?.setValue(txt)
      );
      component.question = questionGroup as AbstractControl;

      component.removeOption(3); // eliminar "Delta"

      expect(component.options.length).toBe(3);
      expect(component.options.at(0).get('text')?.value).toBe('Alpha');
      expect(component.options.at(1).get('text')?.value).toBe('Beta');
      expect(component.options.at(2).get('text')?.value).toBe('Gamma');
    });

    it('debe eliminar exactamente la opción en el índice dado (MULTIPLE_CHOICE) cuando es la correcta', () => {
      const questionGroup = createQuestionGroup('MULTIPLE_CHOICE');
      const options = questionGroup.get('options') as FormArray;
      ['Alpha', 'Beta', 'Gamma', 'Delta'].forEach((txt, i) =>
        options.at(i).get('text')?.setValue(txt)
      );
      questionGroup.patchValue({ correctOptionId: '1' }); // Beta es la correcta
      component.question = questionGroup as AbstractControl;

      component.removeOption(1); // eliminar "Beta" (la correcta)

      expect(component.options.length).toBe(3);
      expect(component.options.at(0).get('text')?.value).toBe('Alpha');
      expect(component.options.at(1).get('text')?.value).toBe('Gamma');
      expect(component.options.at(2).get('text')?.value).toBe('Delta');
      expect(questionGroup.get('correctOptionId')?.value).toBe('');
    });

    it('debe eliminar correctamente en eliminaciones múltiples consecutivas', () => {
      const questionGroup = createQuestionGroup('MULTIPLE_CHOICE');
      const options = questionGroup.get('options') as FormArray;
      ['Alpha', 'Beta', 'Gamma', 'Delta'].forEach((txt, i) =>
        options.at(i).get('text')?.setValue(txt)
      );
      component.question = questionGroup as AbstractControl;

      component.removeOption(1); // elimina Beta → [Alpha, Gamma, Delta]
      component.removeOption(1); // elimina Gamma → [Alpha, Delta]

      expect(component.options.length).toBe(2);
      expect(component.options.at(0).get('text')?.value).toBe('Alpha');
      expect(component.options.at(1).get('text')?.value).toBe('Delta');
    });

    // ── Gestión de correctOptionId (MULTIPLE_CHOICE) ────────────────────────

    it('debe limpiar correctOptionId al eliminar la opción marcada como correcta', () => {
      const questionGroup = createQuestionGroup('MULTIPLE_CHOICE');
      questionGroup.patchValue({ correctOptionId: '2' });
      component.question = questionGroup as AbstractControl;

      component.removeOption(2);

      expect(questionGroup.get('correctOptionId')?.value).toBe('');
    });

    it('debe decrementar correctOptionId si la opción eliminada estaba ANTES de la correcta', () => {
      const questionGroup = createQuestionGroup('MULTIPLE_CHOICE');
      questionGroup.patchValue({ correctOptionId: '3' }); // índice 3 es la correcta
      component.question = questionGroup as AbstractControl;

      component.removeOption(1); // eliminar índice 1 (antes de la correcta)

      expect(questionGroup.get('correctOptionId')?.value).toBe('2');
    });

    it('NO debe modificar correctOptionId si la opción eliminada estaba DESPUÉS de la correcta', () => {
      const questionGroup = createQuestionGroup('MULTIPLE_CHOICE');
      questionGroup.patchValue({ correctOptionId: '0' }); // índice 0 es la correcta
      component.question = questionGroup as AbstractControl;

      component.removeOption(2); // eliminar índice 2 (después de la correcta)

      expect(questionGroup.get('correctOptionId')?.value).toBe('0');
    });

    it('NO debe modificar correctOptionId si no hay ninguna selección', () => {
      const questionGroup = createQuestionGroup('MULTIPLE_CHOICE');
      questionGroup.patchValue({ correctOptionId: '' });
      component.question = questionGroup as AbstractControl;

      component.removeOption(0);

      expect(questionGroup.get('correctOptionId')?.value).toBe('');
    });

    // ── Gestión de correctOptionIds (MULTIPLE_SELECT) ───────────────────────

    it('debe eliminar exactamente la opción en el índice dado (MULTIPLE_SELECT) cuando es correcta', () => {
      const questionGroup = createQuestionGroup('MULTIPLE_SELECT');
      const options = questionGroup.get('options') as FormArray;
      ['Alpha', 'Beta', 'Gamma', 'Delta'].forEach((txt, i) =>
        options.at(i).get('text')?.setValue(txt)
      );
      questionGroup.patchValue({ correctOptionIds: ['0', '2'] });
      component.question = questionGroup as AbstractControl;

      component.removeOption(2); // eliminar "Gamma" (correcta en índice 2)

      expect(component.options.length).toBe(3);
      expect(component.options.at(0).get('text')?.value).toBe('Alpha');
      expect(component.options.at(1).get('text')?.value).toBe('Beta');
      expect(component.options.at(2).get('text')?.value).toBe('Delta');
      // '2' debe haberse eliminado de correctOptionIds; '0' sigue igual
      expect(questionGroup.get('correctOptionIds')?.value).not.toContain('2');
      expect(questionGroup.get('correctOptionIds')?.value).toContain('0');
    });

    it('debe decrementar índices en correctOptionIds para opciones que estaban después de la eliminada', () => {
      const questionGroup = createQuestionGroup('MULTIPLE_SELECT');
      questionGroup.patchValue({ correctOptionIds: ['1', '3'] });
      component.question = questionGroup as AbstractControl;

      component.removeOption(0); // eliminar índice 0 → índices 1 y 3 pasan a ser 0 y 2

      const ids: string[] = questionGroup.get('correctOptionIds')?.value;
      expect(ids).toContain('0');
      expect(ids).toContain('2');
      expect(ids).not.toContain('1');
      expect(ids).not.toContain('3');
    });

    it('debe mantener sin cambios correctOptionIds para opciones que estaban antes de la eliminada', () => {
      const questionGroup = createQuestionGroup('MULTIPLE_SELECT');
      questionGroup.patchValue({ correctOptionIds: ['0', '1'] }); // correctas en 0 y 1
      component.question = questionGroup as AbstractControl;

      component.removeOption(3); // eliminar el último (índice 3, no correcto)

      const ids: string[] = questionGroup.get('correctOptionIds')?.value;
      expect(ids).toContain('0');
      expect(ids).toContain('1');
    });

    it('debe quedar con correctOptionIds vacío al eliminar la única opción correcta (MULTIPLE_SELECT)', () => {
      const questionGroup = createQuestionGroup('MULTIPLE_SELECT');
      questionGroup.patchValue({ correctOptionIds: ['2'] });
      component.question = questionGroup as AbstractControl;

      component.removeOption(2);

      const ids: string[] = questionGroup.get('correctOptionIds')?.value;
      expect(ids).toHaveLength(0);
    });
  });




  // ── toggleCorrectOption ─────────────────────────────────────────────────

  describe('toggleCorrectOption()', () => {
    it('debe agregar el índice a correctOptionIds si no estaba', () => {
      const questionGroup = createQuestionGroup('MULTIPLE_SELECT');
      component.question = questionGroup as AbstractControl;

      component.toggleCorrectOption(1);
      expect(questionGroup.get('correctOptionIds')?.value).toContain('1');
    });

    it('debe quitar el índice de correctOptionIds si ya estaba', () => {
      const questionGroup = createQuestionGroup('MULTIPLE_SELECT');
      questionGroup.patchValue({ correctOptionIds: ['0', '1'] });
      component.question = questionGroup as AbstractControl;

      component.toggleCorrectOption(1);
      expect(questionGroup.get('correctOptionIds')?.value).not.toContain('1');
    });
  });

  // ── onOptionTextChange ──────────────────────────────────────────────────

  describe('onOptionTextChange()', () => {
    it('debe actualizar el valor del control de texto en el índice correcto', () => {
      const questionGroup = createQuestionGroup('MULTIPLE_CHOICE');
      component.question = questionGroup as AbstractControl;

      component.onOptionTextChange('Nuevo texto', 2);
      const options = (component.question as FormGroup).get('options') as FormArray;
      expect(options.at(2).get('text')?.value).toBe('Nuevo texto');
    });

    it('debe marcar el control como touched', () => {
      const questionGroup = createQuestionGroup('MULTIPLE_CHOICE');
      component.question = questionGroup as AbstractControl;

      component.onOptionTextChange('Algo', 0);
      const options = (component.question as FormGroup).get('options') as FormArray;
      expect(options.at(0).get('text')?.touched).toBe(true);
    });
  });
});