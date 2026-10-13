import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QuestionnaireTakeComponent } from './questionnaire-take.component';
import { QuestionnairesService } from '../../../core/services/questionnaires.service';
import { CourseProgressService } from '../../../core/services/course-progress.service';
import { CoursesService } from '../../../core/services/courses.service';
import { InfoService } from '../../../core/services/info.service';
import { AuthService } from '../../../core/services/auth.service';
import { Router, ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';

// ────────────────── helpers ──────────────────

const COURSE_ID = 'course123';
const Q_ID = 'q123';
const USER_ID = 'user123';

function makeQuestionnaire(overrides: any = {}) {
  return {
    _id: Q_ID,
    title: 'Cuestionario de prueba',
    questions: [],
    passingScore: 60,
    allowRetries: true,
    maxRetries: 3,
    showCorrectAnswers: true,
    isSurvey: false,
    status: 'ACTIVE',
    courseId: COURSE_ID,
    position: { type: 'BETWEEN_CLASSES', afterClassId: 'class001' },
    ...overrides,
  };
}

function makeSubmission(overrides: any = {}) {
  return {
    _id: 'sub001',
    questionnaireId: Q_ID,
    courseId: COURSE_ID,
    studentId: USER_ID,
    attemptNumber: 1,
    answers: [],
    status: 'IN_PROGRESS',
    autoGradedScore: 0,
    startedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeOrderedCourse(questionnaire: any) {
  return {
    _id: COURSE_ID,
    name: 'Curso de prueba',
    classes: [
      { _id: 'class001', name: 'Clase 1', status: 'ACTIVE' },
      { _id: 'class002', name: 'Clase 2', status: 'ACTIVE' },
    ],
    questionnaires: [questionnaire],
    orderedContent: [
      { type: 'CLASS', data: { _id: 'class001', name: 'Clase 1', status: 'ACTIVE' } },
      { type: 'QUESTIONNAIRE', data: questionnaire },
      { type: 'CLASS', data: { _id: 'class002', name: 'Clase 2', status: 'ACTIVE' } },
    ],
  };
}

// ────────────────── suite ──────────────────

describe('QuestionnaireTakeComponent', () => {
  let component: QuestionnaireTakeComponent;
  let fixture: ComponentFixture<QuestionnaireTakeComponent>;

  let mockQuestionnairesService: any;
  let mockInfoService: any;
  let mockAuthService: any;
  let mockCoursesService: any;
  let mockProgressService: any;
  let mockRouter: any;

  beforeEach(async () => {
    mockQuestionnairesService = {
      getQuestionnaireById: vi.fn(),
      getStudentSubmissions: vi.fn().mockReturnValue(of({ data: [] })),
      startSubmission: vi.fn().mockReturnValue(of({ data: makeSubmission() })),
      submitAnswers: vi.fn(),
    };

    mockInfoService = {
      showError: vi.fn(),
      showSuccess: vi.fn(),
      showInfo: vi.fn(),
    };

    mockAuthService = {
      currentUser: vi.fn().mockReturnValue({ _id: USER_ID }),
    };

    mockCoursesService = {
      getCourseById: vi.fn().mockReturnValue(of({ data: { _id: COURSE_ID } })),
    };

    mockProgressService = {
      updateProgress: vi.fn(),
      getProgress: vi.fn().mockReturnValue(of({ overallProgress: 0, classesProgress: [] })),
    };

    mockRouter = {
      navigate: vi.fn().mockResolvedValue(true),
    };

    const mockActivatedRoute = {
      params: of({ courseId: COURSE_ID, questionnaireId: Q_ID }),
      snapshot: { paramMap: { get: vi.fn().mockReturnValue(Q_ID) } },
    };

    await TestBed.configureTestingModule({
      imports: [QuestionnaireTakeComponent],
      providers: [
        { provide: QuestionnairesService, useValue: mockQuestionnairesService },
        { provide: InfoService, useValue: mockInfoService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: CoursesService, useValue: mockCoursesService },
        { provide: CourseProgressService, useValue: mockProgressService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(QuestionnaireTakeComponent);
    component = fixture.componentInstance;
  });

  // ──────────────────────────────────────────
  // Creación del componente
  // ──────────────────────────────────────────

  it('debe crear el componente', () => {
    mockQuestionnairesService.getQuestionnaireById.mockReturnValue(of({ data: makeQuestionnaire() }));
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  // ──────────────────────────────────────────
  // BUG PRINCIPAL: "Error al cargar el cuestionario"
  // ──────────────────────────────────────────

  describe('BUG: Error al cargar el cuestionario', () => {

    it('debe mostrar error y volver al curso cuando la API devuelve un error 500', () => {
      mockQuestionnairesService.getQuestionnaireById.mockReturnValue(
        throwError(() => ({ status: 500, error: { message: 'Internal Server Error' } }))
      );
      vi.spyOn(console, 'error');
      vi.spyOn(component as any, 'goBack');

      fixture.detectChanges();

      expect(mockQuestionnairesService.getQuestionnaireById).toHaveBeenCalledWith(Q_ID);
      expect(console.error).toHaveBeenCalledWith('[q-take] Error loading questionnaire:', expect.anything());
      expect(mockInfoService.showError).toHaveBeenCalledWith('Error al cargar el cuestionario');
      expect((component as any).goBack).toHaveBeenCalled();
    });

    it('debe mostrar error y volver al curso cuando la API devuelve error 404 (cuestionario no existe)', () => {
      mockQuestionnairesService.getQuestionnaireById.mockReturnValue(
        throwError(() => ({ status: 404, error: { message: 'Questionnaire not found' } }))
      );
      vi.spyOn(console, 'error');
      vi.spyOn(component as any, 'goBack');

      fixture.detectChanges();

      expect(mockInfoService.showError).toHaveBeenCalledWith('Error al cargar el cuestionario');
      expect((component as any).goBack).toHaveBeenCalled();
    });

    it('debe mostrar error y volver al curso cuando la API devuelve error 403 (sin acceso)', () => {
      mockQuestionnairesService.getQuestionnaireById.mockReturnValue(
        throwError(() => ({ status: 403, error: { message: 'Forbidden' } }))
      );
      vi.spyOn(console, 'error');
      vi.spyOn(component as any, 'goBack');

      fixture.detectChanges();

      expect(mockInfoService.showError).toHaveBeenCalledWith('Error al cargar el cuestionario');
      expect((component as any).goBack).toHaveBeenCalled();
    });

    it('debe mostrar error cuando la red falla (error de red sin status)', () => {
      mockQuestionnairesService.getQuestionnaireById.mockReturnValue(
        throwError(() => new Error('Network Error'))
      );
      vi.spyOn(console, 'error');
      vi.spyOn(component as any, 'goBack');

      fixture.detectChanges();

      expect(mockInfoService.showError).toHaveBeenCalledWith('Error al cargar el cuestionario');
      expect((component as any).goBack).toHaveBeenCalled();
    });

    it('NO debe mostrar error cuando el cuestionario carga correctamente', () => {
      mockQuestionnairesService.getQuestionnaireById.mockReturnValue(
        of({ data: makeQuestionnaire() })
      );

      fixture.detectChanges();

      expect(mockInfoService.showError).not.toHaveBeenCalledWith('Error al cargar el cuestionario');
    });
  });

  // ──────────────────────────────────────────
  // loadQuestionnaire — flujo exitoso
  // ──────────────────────────────────────────

  describe('loadQuestionnaire() — flujo exitoso', () => {
    it('debe setear los datos del cuestionario en el signal cuando la API responde correctamente', () => {
      const mockQ = makeQuestionnaire();
      mockQuestionnairesService.getQuestionnaireById.mockReturnValue(of({ data: mockQ }));

      fixture.detectChanges();

      expect(mockQuestionnairesService.getQuestionnaireById).toHaveBeenCalledWith(Q_ID);
      expect(component.questionnaire()).toEqual(mockQ as any);
    });

    it('debe cargar submissions del estudiante después de cargar el cuestionario', () => {
      mockQuestionnairesService.getQuestionnaireById.mockReturnValue(of({ data: makeQuestionnaire() }));

      fixture.detectChanges();

      expect(mockQuestionnairesService.getStudentSubmissions).toHaveBeenCalledWith(Q_ID, USER_ID);
    });

    it('debe establecer loading en false después de la carga exitosa', () => {
      const submission = makeSubmission();
      mockQuestionnairesService.getQuestionnaireById.mockReturnValue(of({ data: makeQuestionnaire() }));
      // Asegurar que getStudentSubmissions devuelve una submission para que el flujo termine
      mockQuestionnairesService.getStudentSubmissions.mockReturnValue(of({ data: [submission] }));

      fixture.detectChanges();

      expect(component.loading()).toBe(false);
    });

    it('debe resetear el estado (answers, showResults, etc.) al cargar un nuevo cuestionario', () => {
      mockQuestionnairesService.getQuestionnaireById.mockReturnValue(of({ data: makeQuestionnaire() }));

      // Setear estado previo
      component.showResults.set(true);
      component.answers = { someQ: { questionId: 'someQ', questionType: 'TEXT', textAnswer: 'algo' } };

      component.loadQuestionnaire();

      // Después de la carga, debe resetear
      expect(component.showResults()).toBe(false);
      expect(component.answers).toEqual({});
    });
  });

  // ──────────────────────────────────────────
  // checkOrStartSubmission — lógica de estado
  // ──────────────────────────────────────────

  describe('checkOrStartSubmission()', () => {
    it('debe iniciar nueva submission si no hay submissions previas', () => {
      const newSubmission = makeSubmission();
      mockQuestionnairesService.startSubmission = vi.fn().mockReturnValue(of({ data: newSubmission }));
      mockQuestionnairesService.getStudentSubmissions.mockReturnValue(of({ data: [] }));
      mockQuestionnairesService.getQuestionnaireById.mockReturnValue(of({ data: makeQuestionnaire() }));

      fixture.detectChanges();

      expect(mockQuestionnairesService.startSubmission).toHaveBeenCalledWith(Q_ID);
      expect(component.currentSubmission()).toEqual(newSubmission as any);
    });

    it('debe mostrar resultados si existe una submission GRADED', () => {
      const gradedSub = makeSubmission({ status: 'GRADED', attemptNumber: 1, autoGradedScore: 80 });
      mockQuestionnairesService.getStudentSubmissions.mockReturnValue(of({ data: [gradedSub] }));
      mockQuestionnairesService.getQuestionnaireById.mockReturnValue(of({ data: makeQuestionnaire() }));

      fixture.detectChanges();

      expect(component.showResults()).toBe(true);
      expect(component.currentSubmission()?.status).toBe('GRADED');
    });

    it('debe mostrar pantalla de espera si la submission está SUBMITTED (pendiente de calificación)', () => {
      const submittedSub = makeSubmission({ status: 'SUBMITTED', attemptNumber: 1 });
      mockQuestionnairesService.getStudentSubmissions.mockReturnValue(of({ data: [submittedSub] }));
      mockQuestionnairesService.getQuestionnaireById.mockReturnValue(of({ data: makeQuestionnaire() }));

      fixture.detectChanges();

      expect(component.showResults()).toBe(true);
      expect(component.currentSubmission()?.status).toBe('SUBMITTED');
    });

    it('debe retomar submission IN_PROGRESS sin auto-iniciar el timer', () => {
      const inProgressSub = makeSubmission({ status: 'IN_PROGRESS', attemptNumber: 1 });
      mockQuestionnairesService.getStudentSubmissions.mockReturnValue(of({ data: [inProgressSub] }));
      mockQuestionnairesService.getQuestionnaireById.mockReturnValue(of({ data: makeQuestionnaire() }));

      fixture.detectChanges();

      expect(component.started()).toBe(false);
      expect(component.showResults()).toBe(false);
      expect(component.currentSubmission()?._id).toBe('sub001');
    });

    it('debe mostrar aviso de "sin más intentos" si no puede reintentar y ya tiene submissions', () => {
      // maxRetries = 1, ya tiene 1 intento completado
      const gradedSub = makeSubmission({ status: 'GRADED', attemptNumber: 1 });
      const qNoRetry = makeQuestionnaire({ allowRetries: false });

      mockQuestionnairesService.getStudentSubmissions.mockReturnValue(of({ data: [gradedSub] }));
      mockQuestionnairesService.getQuestionnaireById.mockReturnValue(of({ data: qNoRetry }));

      fixture.detectChanges();

      // Con allowRetries: false, debe mostrar resultados (del último intento)
      expect(component.showResults()).toBe(true);
    });
  });

  // ──────────────────────────────────────────
  // startNewSubmission — manejo de errores
  // ──────────────────────────────────────────

  describe('startNewSubmission() — manejo de errores', () => {
    it('debe mostrar error de intentos agotados cuando el backend rechaza el inicio', () => {
      mockQuestionnairesService.getQuestionnaireById.mockReturnValue(of({ data: makeQuestionnaire() }));
      mockQuestionnairesService.startSubmission = vi.fn().mockReturnValue(
        throwError(() => ({
          error: { message: 'Retry limit exceeded' }
        }))
      );
      vi.useFakeTimers();

      fixture.detectChanges();

      expect(mockInfoService.showError).toHaveBeenCalledWith(
        expect.stringContaining('más intentos disponibles')
      );

      vi.useRealTimers();
    });

    it('debe mostrar el mensaje de error del backend si no es sobre intentos', () => {
      mockQuestionnairesService.getQuestionnaireById.mockReturnValue(of({ data: makeQuestionnaire() }));
      mockQuestionnairesService.startSubmission = vi.fn().mockReturnValue(
        throwError(() => ({
          error: { message: 'El cuestionario no está disponible en este momento' }
        }))
      );
      vi.useFakeTimers();

      fixture.detectChanges();

      expect(mockInfoService.showError).toHaveBeenCalledWith(
        'El cuestionario no está disponible en este momento'
      );

      vi.useRealTimers();
    });
  });

  // ──────────────────────────────────────────
  // Visualización de Calificaciones
  // ──────────────────────────────────────────

  describe('Visualización de Calificaciones Autocalificables', () => {
    it('debe devolver la calificación autocalificada (autoGradedScore) cuando finalScore no está definido', () => {
      const mockSubmission = makeSubmission({ status: 'GRADED', autoGradedScore: 75, finalScore: undefined });
      component.currentSubmission.set(mockSubmission as any);

      expect(component.getScore()).toBe(75);
    });

    it('debe devolver la calificación final (finalScore) cuando es 0, sin caer erróneamente en la autocalificada', () => {
      const mockSubmission = makeSubmission({ status: 'GRADED', autoGradedScore: 75, finalScore: 0 });
      component.currentSubmission.set(mockSubmission as any);

      expect(component.getScore()).toBe(0);
    });

    it('debe devolver finalScore cuando está definido y es mayor que autoGradedScore', () => {
      const mockSubmission = makeSubmission({ status: 'GRADED', autoGradedScore: 50, finalScore: 90 });
      component.currentSubmission.set(mockSubmission as any);

      expect(component.getScore()).toBe(90);
    });

    it('debe mostrar la calificación autocalificada en el DOM cuando finalScore no está definido y el estado es GRADED', () => {
      const mockQ = makeQuestionnaire({ passingScore: 60 });
      const mockSubmission = makeSubmission({ status: 'GRADED', autoGradedScore: 75, finalScore: undefined, attemptNumber: 1 });

      mockQuestionnairesService.getQuestionnaireById.mockReturnValue(of({ data: mockQ }));
      mockQuestionnairesService.getStudentSubmissions.mockReturnValue(of({ data: [mockSubmission] }));

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const scoreElement = compiled.querySelector('.text-7xl');
      expect(scoreElement?.textContent).toContain('75.0%');

      const statusElement = compiled.querySelector('.text-lg');
      expect(statusElement?.textContent).toContain('¡Aprobado!');
    });

    it('debe mostrar la calificación final de 0 en el DOM y reflejar "No Aprobado" cuando finalScore es 0', () => {
      const mockQ = makeQuestionnaire({ passingScore: 60 });
      const mockSubmission = makeSubmission({ status: 'GRADED', autoGradedScore: 75, finalScore: 0, attemptNumber: 1 });

      mockQuestionnairesService.getQuestionnaireById.mockReturnValue(of({ data: mockQ }));
      mockQuestionnairesService.getStudentSubmissions.mockReturnValue(of({ data: [mockSubmission] }));

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const scoreElement = compiled.querySelector('.text-7xl');
      expect(scoreElement?.textContent).toContain('0.0%');

      const statusElement = compiled.querySelector('.text-lg');
      expect(statusElement?.textContent).toContain('No Aprobado');
    });
  });

  // ──────────────────────────────────────────
  // recalculateCanRetry
  // ──────────────────────────────────────────

  describe('recalculateCanRetry()', () => {
    beforeEach(() => {
      mockQuestionnairesService.getQuestionnaireById.mockReturnValue(of({ data: makeQuestionnaire() }));
    });

    it('permite reintentar cuando attemptCount < maxRetries', () => {
      const q = makeQuestionnaire({ allowRetries: true, maxRetries: 3 });
      component.questionnaire.set(q as any);
      component.previousSubmissions.set([
        makeSubmission({ status: 'GRADED', attemptNumber: 1 }),
      ] as any);

      component.recalculateCanRetry();

      expect(component.canRetry()).toBe(true);
    });

    it('NO permite reintentar cuando attemptCount >= maxRetries', () => {
      const q = makeQuestionnaire({ allowRetries: true, maxRetries: 2 });
      component.questionnaire.set(q as any);
      component.previousSubmissions.set([
        makeSubmission({ status: 'GRADED', attemptNumber: 1 }),
        makeSubmission({ status: 'GRADED', attemptNumber: 2 }),
      ] as any);

      component.recalculateCanRetry();

      expect(component.canRetry()).toBe(false);
    });

    it('NO permite reintentar cuando allowRetries es false', () => {
      const q = makeQuestionnaire({ allowRetries: false });
      component.questionnaire.set(q as any);
      component.previousSubmissions.set([
        makeSubmission({ status: 'GRADED', attemptNumber: 1 }),
      ] as any);

      component.recalculateCanRetry();

      expect(component.canRetry()).toBe(false);
    });

    it('las submissions IN_PROGRESS no cuentan como intentos completados', () => {
      const q = makeQuestionnaire({ allowRetries: true, maxRetries: 1 });
      component.questionnaire.set(q as any);
      component.previousSubmissions.set([
        makeSubmission({ status: 'IN_PROGRESS', attemptNumber: 1 }),
      ] as any);

      component.recalculateCanRetry();

      // IN_PROGRESS no cuenta como completado → todavía puede reintentar (0 < 1)
      expect(component.canRetry()).toBe(true);
    });
  });

  // ──────────────────────────────────────────
  // isPassed — lógica de aprobación
  // ──────────────────────────────────────────

  describe('isPassed()', () => {
    it('devuelve true cuando el puntaje supera el mínimo requerido', () => {
      component.questionnaire.set(makeQuestionnaire({ passingScore: 60 }) as any);
      component.currentSubmission.set(makeSubmission({ autoGradedScore: 75 }) as any);

      expect(component.isPassed()).toBe(true);
    });

    it('devuelve false cuando el puntaje es menor al mínimo requerido', () => {
      component.questionnaire.set(makeQuestionnaire({ passingScore: 60 }) as any);
      component.currentSubmission.set(makeSubmission({ autoGradedScore: 50 }) as any);

      expect(component.isPassed()).toBe(false);
    });

    it('devuelve true cuando no hay passingScore definido (todo aprueba)', () => {
      component.questionnaire.set(makeQuestionnaire({ passingScore: undefined }) as any);
      component.currentSubmission.set(makeSubmission({ autoGradedScore: 0 }) as any);

      expect(component.isPassed()).toBe(true);
    });

    it('devuelve true cuando el puntaje exactamente iguala el mínimo requerido', () => {
      component.questionnaire.set(makeQuestionnaire({ passingScore: 60 }) as any);
      component.currentSubmission.set(makeSubmission({ autoGradedScore: 60 }) as any);

      expect(component.isPassed()).toBe(true);
    });
  });

  // ──────────────────────────────────────────
  // goToNextItem — navegación post cuestionario
  // ──────────────────────────────────────────

  describe('goToNextItem()', () => {
    it('navega a la siguiente clase cuando la hay después del cuestionario', () => {
      const q = makeQuestionnaire();
      const course = makeOrderedCourse(q);

      mockQuestionnairesService.getQuestionnaireById.mockReturnValue(of({ data: q }));
      mockCoursesService.getCourseById.mockReturnValue(of({ data: course }));

      // Inicializar señales que usa goToNextItem()
      component.courseId.set(COURSE_ID);
      component.questionnaire.set(q as any);
      component.courseData.set(course);

      const nextClassTarget = { type: 'CLASS' as const, id: 'class002' };
      component.nextItem.set(nextClassTarget);

      component.goToNextItem();

      expect(mockRouter.navigate).toHaveBeenCalledWith([
        '/alumno/course-detail',
        COURSE_ID,
        'class',
        'class002',
      ]);
    });

    it('vuelve al detalle del curso cuando no hay siguiente item', () => {
      // Inicializar señales que usa goBack() (llamado cuando no hay nextItem)
      component.courseId.set(COURSE_ID);
      component.questionnaire.set(makeQuestionnaire() as any);
      component.courseData.set({ _id: COURSE_ID, classes: [], questionnaires: [] });
      component.nextItem.set(null);

      // Simular que getNextItem() tampoco encuentra nada
      vi.spyOn(component, 'getNextItem').mockReturnValue(null);

      component.goToNextItem();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/alumno/course-detail', COURSE_ID]);
    });
  });

  // ──────────────────────────────────────────
  // Timer — temporizador
  // ──────────────────────────────────────────

  describe('formatTimeRemaining()', () => {
    it('formatea correctamente minutos y segundos', () => {
      expect(component.formatTimeRemaining(125)).toBe('02:05');
    });

    it('formatea correctamente horas, minutos y segundos', () => {
      expect(component.formatTimeRemaining(3661)).toBe('01:01:01');
    });

    it('devuelve 00:00 cuando el tiempo es 0 o negativo', () => {
      expect(component.formatTimeRemaining(0)).toBe('00:00');
      expect(component.formatTimeRemaining(-5)).toBe('00:00');
    });
  });

  // ──────────────────────────────────────────
  // getTimeElapsed — tiempo transcurrido
  // ──────────────────────────────────────────

  describe('getTimeElapsed()', () => {
    it('devuelve null si no hay submission', () => {
      component.currentSubmission.set(null);
      expect(component.getTimeElapsed()).toBeNull();
    });

    it('devuelve null si falta submittedAt', () => {
      component.currentSubmission.set(makeSubmission({ submittedAt: undefined }) as any);
      expect(component.getTimeElapsed()).toBeNull();
    });

    it('devuelve formato en segundos cuando el tiempo es menor a un minuto', () => {
      const start = new Date('2024-01-01T10:00:00.000Z');
      const end = new Date('2024-01-01T10:00:45.000Z');
      component.currentSubmission.set(makeSubmission({
        startedAt: start.toISOString(),
        submittedAt: end.toISOString(),
      }) as any);

      expect(component.getTimeElapsed()).toBe('45s');
    });

    it('devuelve formato en minutos y segundos cuando supera un minuto', () => {
      const start = new Date('2024-01-01T10:00:00.000Z');
      const end = new Date('2024-01-01T10:02:30.000Z');
      component.currentSubmission.set(makeSubmission({
        startedAt: start.toISOString(),
        submittedAt: end.toISOString(),
      }) as any);

      expect(component.getTimeElapsed()).toBe('2m 30s');
    });
  });
});
