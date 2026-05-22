import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClassDetailComponent } from './class-detail.component';
import { ClassesService } from '../../../core/services/classes.service';
import { CoursesService } from '../../../core/services/courses.service';
import { CourseProgressService } from '../../../core/services/course-progress.service';
import { QuestionnairesService } from '../../../core/services/questionnaires.service';
import { InfoService } from '../../../core/services/info.service';
import { Router, ActivatedRoute } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';

// ─────────────────────────── helpers ─────────────────────────────────
const CLASS_ID_1 = 'class001';
const CLASS_ID_2 = 'class002';
const COURSE_ID = 'course123';
const Q_ID = 'q001';

function makeClass(id: string, extra: any = {}) {
  return { _id: id, name: `Clase ${id}`, status: 'ACTIVE', videoUrl: null, ...extra };
}

function makeCourse(classes: any[], questionnaires: any[] = [], orderedContent?: any[]) {
  const course: any = {
    _id: COURSE_ID,
    name: 'Curso de Prueba',
    classes,
    questionnaires,
  };
  if (orderedContent !== undefined) {
    course.orderedContent = orderedContent;
  }
  return course;
}

function makeQuestionnaire(id: string, afterClassId?: string) {
  return {
    _id: id,
    title: `Cuestionario ${id}`,
    status: 'ACTIVE',
    courseId: COURSE_ID,
    questions: [],
    isSurvey: false,
    allowRetries: true,
    showCorrectAnswers: true,
    position: afterClassId
      ? { type: 'BETWEEN_CLASSES', afterClassId }
      : { type: 'FINAL_EXAM' },
  };
}

// ─────────────────────────── suite ───────────────────────────────────
describe('ClassDetailComponent', () => {
  let component: ClassDetailComponent;
  let fixture: ComponentFixture<ClassDetailComponent>;

  let mockClassesService: any;
  let mockCoursesService: any;
  let mockProgressService: any;
  let mockQuestionnairesService: any;
  let mockInfoService: any;
  let mockRouter: any;
  let mockSanitizer: any;

  /** Configura el TestBed con la respuesta de curso indicada */
  async function setup(courseResponse: any) {
    mockClassesService = { getClassById: vi.fn() };

    mockCoursesService = {
      getCourseById: vi.fn().mockReturnValue(of({ data: courseResponse })),
    };

    mockProgressService = {
      getClassProgress: vi.fn().mockReturnValue(of({ data: null })),
      getProgress: vi.fn().mockReturnValue(of({ overallProgress: 0, classesProgress: [] })),
      canAccessClass: vi.fn().mockReturnValue(of({ data: { canAccess: true } })),
      updateProgress: vi.fn().mockReturnValue(of({ overallProgress: 0, classesProgress: [] })),
      markCompleted: vi.fn().mockReturnValue(of({ overallProgress: 100, classesProgress: [] })),
    };

    mockQuestionnairesService = {
      getQuestionnairesByCourse: vi.fn().mockReturnValue(of({ data: courseResponse.questionnaires || [] })),
    };

    mockInfoService = {
      showError: vi.fn(),
      showSuccess: vi.fn(),
      showInfo: vi.fn(),
    };

    mockRouter = { navigate: vi.fn().mockResolvedValue(true) };

    mockSanitizer = {
      bypassSecurityTrustResourceUrl: vi.fn((url: string) => url),
    };

    const mockActivatedRoute = {
      params: of({ courseId: COURSE_ID, classId: CLASS_ID_1 }),
      snapshot: { paramMap: { get: vi.fn().mockReturnValue(null) } },
    };

    await TestBed.configureTestingModule({
      imports: [ClassDetailComponent],
      providers: [
        { provide: ClassesService, useValue: mockClassesService },
        { provide: CoursesService, useValue: mockCoursesService },
        { provide: CourseProgressService, useValue: mockProgressService },
        { provide: QuestionnairesService, useValue: mockQuestionnairesService },
        { provide: InfoService, useValue: mockInfoService },
        { provide: Router, useValue: mockRouter },
        { provide: DomSanitizer, useValue: mockSanitizer },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    }).compileComponents();
  }

  afterEach(() => {
    // Limpiar listeners de window para evitar fugas entre tests
    try { fixture?.destroy(); } catch (_) {}
  });

  // ═══════════════════ BUG PRINCIPAL: flujo Siguiente → cuestionario ═══════════════════

  describe('BUG: Error al cargar el cuestionario — flujo completo', () => {
    /**
     * Reproduce los pasos del bug:
     * 1. Entrar a un curso con clase + cuestionario BETWEEN_CLASSES
     * 2. El componente detecta el cuestionario después de la clase actual
     * 3. Al hacer clic en "Siguiente", navega a la ruta del cuestionario
     */
    it('debe navegar al cuestionario al hacer clic en Siguiente cuando existe un cuestionario después de la clase', async () => {
      const classe1 = makeClass(CLASS_ID_1);
      const classe2 = makeClass(CLASS_ID_2);
      const questionnaire = makeQuestionnaire(Q_ID, CLASS_ID_1);
      const course = makeCourse([classe1, classe2], [questionnaire]);

      await setup(course);
      fixture = TestBed.createComponent(ClassDetailComponent);
      component = fixture.componentInstance;

      // Simular clase completada para poder avanzar
      component.isClassCompleted.set(true);
      fixture.detectChanges();

      // Llamar directamente al método que dispara el clic en "Siguiente"
      component.goToNextClassWithCheck();

      expect(mockRouter.navigate).toHaveBeenCalledWith([
        '/alumno/course-detail',
        COURSE_ID,
        'questionnaire',
        Q_ID,
      ]);
    });

    it('NO debe navegar al cuestionario si el cuestionario no está activo (status ≠ ACTIVE)', async () => {
      const classe1 = makeClass(CLASS_ID_1);
      const classe2 = makeClass(CLASS_ID_2);
      const inactiveQ = { ...makeQuestionnaire(Q_ID, CLASS_ID_1), status: 'INACTIVE' };
      const course = makeCourse([classe1, classe2], [inactiveQ]);

      await setup(course);
      fixture = TestBed.createComponent(ClassDetailComponent);
      component = fixture.componentInstance;
      component.isClassCompleted.set(true);
      fixture.detectChanges();

      component.goToNextClassWithCheck();

      // Cuando no hay cuestionario activo, debe navegar a la siguiente clase
      expect(mockRouter.navigate).toHaveBeenCalledWith([
        '/alumno/course-detail',
        COURSE_ID,
        'class',
        CLASS_ID_2,
      ]);
    });

    it('debe navegar a la siguiente clase si no hay cuestionario activo entre las dos clases', async () => {
      const classe1 = makeClass(CLASS_ID_1);
      const classe2 = makeClass(CLASS_ID_2);
      const course = makeCourse([classe1, classe2], []);

      await setup(course);
      fixture = TestBed.createComponent(ClassDetailComponent);
      component = fixture.componentInstance;
      component.isClassCompleted.set(true);
      fixture.detectChanges();

      component.goToNextClassWithCheck();

      expect(mockRouter.navigate).toHaveBeenCalledWith([
        '/alumno/course-detail',
        COURSE_ID,
        'class',
        CLASS_ID_2,
      ]);
    });

    it('debe navegar al cuestionario usando orderedContent si el backend lo provee', async () => {
      const classe1 = makeClass(CLASS_ID_1);
      const questionnaire = makeQuestionnaire(Q_ID, CLASS_ID_1);
      const orderedContent = [
        { type: 'CLASS', data: classe1 },
        { type: 'QUESTIONNAIRE', data: questionnaire },
      ];
      const course = makeCourse([classe1], [questionnaire], orderedContent);

      await setup(course);
      fixture = TestBed.createComponent(ClassDetailComponent);
      component = fixture.componentInstance;
      component.isClassCompleted.set(true);
      fixture.detectChanges();

      component.goToNextClassWithCheck();

      expect(mockRouter.navigate).toHaveBeenCalledWith([
        '/alumno/course-detail',
        COURSE_ID,
        'questionnaire',
        Q_ID,
      ]);
    });
  });

  // ═══════════════════ getQuestionnaireAfterClass ═══════════════════

  describe('getQuestionnaireAfterClass()', () => {
    it('devuelve el cuestionario cuando position.afterClassId coincide con la clase actual', async () => {
      const classe1 = makeClass(CLASS_ID_1);
      const classe2 = makeClass(CLASS_ID_2);
      const questionnaire = makeQuestionnaire(Q_ID, CLASS_ID_1);
      const course = makeCourse([classe1, classe2], [questionnaire]);

      await setup(course);
      fixture = TestBed.createComponent(ClassDetailComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      // El componente carga CLASS_ID_1 desde los params
      const result = component.getQuestionnaireAfterClass();
      expect(result).not.toBeNull();
      expect(result?._id).toBe(Q_ID);
    });

    it('devuelve null cuando no hay cuestionario entre la clase actual y la siguiente', async () => {
      const classe1 = makeClass(CLASS_ID_1);
      const classe2 = makeClass(CLASS_ID_2);
      const course = makeCourse([classe1, classe2], []);

      await setup(course);
      fixture = TestBed.createComponent(ClassDetailComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const result = component.getQuestionnaireAfterClass();
      expect(result).toBeNull();
    });

    it('devuelve cuestionario FINAL_EXAM si la clase actual es la última y no hay siguiente', async () => {
      const classe1 = makeClass(CLASS_ID_1);
      // Un solo elemento, por lo que no hay hasNextClass
      const finalQ = makeQuestionnaire(Q_ID);
      const course = makeCourse([classe1], [finalQ]);

      await setup(course);
      fixture = TestBed.createComponent(ClassDetailComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const result = component.getQuestionnaireAfterClass();
      expect(result?._id).toBe(Q_ID);
    });
  });

  // ═══════════════════ canContinue ═══════════════════

  describe('canContinue()', () => {
    it('devuelve true cuando la clase está completada y hay siguiente clase', async () => {
      const course = makeCourse([makeClass(CLASS_ID_1), makeClass(CLASS_ID_2)]);
      await setup(course);
      fixture = TestBed.createComponent(ClassDetailComponent);
      component = fixture.componentInstance;
      component.isClassCompleted.set(true);
      fixture.detectChanges();

      expect(component.canContinue()).toBe(true);
    });

    it('devuelve false si la clase tiene video y no está completada', async () => {
      const course = makeCourse([makeClass(CLASS_ID_1, { videoUrl: 'http://video.mp4' }), makeClass(CLASS_ID_2)]);
      await setup(course);
      fixture = TestBed.createComponent(ClassDetailComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      // Sobrescribir señales DESPUÉS de detectChanges para simular clase con video no completada
      component.classData.set(makeClass(CLASS_ID_1, { videoUrl: 'http://video.mp4' }));
      component.courseItems.set([
        { type: 'class', data: makeClass(CLASS_ID_1, { videoUrl: 'http://video.mp4' }), index: 0 },
        { type: 'class', data: makeClass(CLASS_ID_2), index: 1 },
      ]);
      component.classId.set(CLASS_ID_1);
      component.isClassCompleted.set(false);

      // La clase tiene video (hasVideo() = true) y no está completada → canContinue() = false
      expect(component.hasVideo()).toBe(true);
      expect(component.canContinue()).toBe(false);
    });

    it('devuelve false si no hay siguiente clase ni cuestionario (última clase sin cuestionario)', async () => {
      const course = makeCourse([makeClass(CLASS_ID_1)]);
      await setup(course);
      fixture = TestBed.createComponent(ClassDetailComponent);
      component = fixture.componentInstance;
      component.isClassCompleted.set(true);
      fixture.detectChanges();

      // Sin cuestionarios y sin siguiente clase => no puede continuar
      expect(component.canContinue()).toBe(false);
    });

    it('devuelve true cuando la clase sin video tiene cuestionario después (puede continuar aunque sin video)', async () => {
      const classe1 = makeClass(CLASS_ID_1); // sin videoUrl
      const questionnaire = makeQuestionnaire(Q_ID, CLASS_ID_1);
      const course = makeCourse([classe1, makeClass(CLASS_ID_2)], [questionnaire]);

      await setup(course);
      fixture = TestBed.createComponent(ClassDetailComponent);
      component = fixture.componentInstance;
      // No hay video: el campo hasVideo() será false → canContinue debe retornar true
      component.isClassCompleted.set(false);
      fixture.detectChanges();

      expect(component.canContinue()).toBe(true);
    });
  });

  // ═══════════════════ loadQuestionnaires — error handling ═══════════════════

  describe('loadQuestionnaires()', () => {
    it('setea questionnaires en vacío si la API falla', async () => {
      const course = makeCourse([makeClass(CLASS_ID_1)]);
      await setup(course);

      mockQuestionnairesService.getQuestionnairesByCourse.mockReturnValue(
        throwError(() => new Error('Network error'))
      );

      fixture = TestBed.createComponent(ClassDetailComponent);
      component = fixture.componentInstance;
      vi.spyOn(console, 'error');
      fixture.detectChanges();

      // Aunque la API falle, el componente no debe quedar en estado roto
      expect(component.questionnaires()).toEqual([]);
    });

    it('filtra cuestionarios INACTIVE y solo mantiene los ACTIVE', async () => {
      const activeQ = makeQuestionnaire(Q_ID, CLASS_ID_1);
      const inactiveQ = { ...makeQuestionnaire('q002', CLASS_ID_1), status: 'INACTIVE' };
      const course = makeCourse([makeClass(CLASS_ID_1)], [activeQ, inactiveQ]);

      // Simular que la API devuelve ambos
      await setup(course);
      mockQuestionnairesService.getQuestionnairesByCourse.mockReturnValue(
        of({ data: [activeQ, inactiveQ] })
      );

      fixture = TestBed.createComponent(ClassDetailComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      // Después de cargar, solo debe quedar el activo
      expect(component.questionnaires().length).toBe(1);
      expect(component.questionnaires()[0]._id).toBe(Q_ID);
    });
  });

  // ═══════════════════ buildCourseItemsFromCourse ═══════════════════

  describe('buildCourseItemsFromCourse() — integración con orderedContent', () => {
    it('usa orderedContent cuando está disponible y filtra inactivos', async () => {
      const classe1 = makeClass(CLASS_ID_1);
      const inactiveClass = makeClass('classX', { status: 'INACTIVE' });
      const questionnaire = makeQuestionnaire(Q_ID, CLASS_ID_1);
      const orderedContent = [
        { type: 'CLASS', data: classe1 },
        { type: 'QUESTIONNAIRE', data: questionnaire },
        { type: 'CLASS', data: inactiveClass },
      ];
      const course = makeCourse([classe1], [questionnaire], orderedContent);

      await setup(course);
      fixture = TestBed.createComponent(ClassDetailComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const items = component.courseItems();
      // Solo debe incluir los activos: clase1 + cuestionario
      expect(items.length).toBe(2);
      expect(items[0].type).toBe('class');
      expect(items[1].type).toBe('questionnaire');
    });

    it('construye items usando fallback (sin orderedContent) insertando cuestionarios after la clase', async () => {
      const classe1 = makeClass(CLASS_ID_1);
      const classe2 = makeClass(CLASS_ID_2);
      const questionnaire = makeQuestionnaire(Q_ID, CLASS_ID_1);
      // Sin orderedContent
      const course = makeCourse([classe1, classe2], [questionnaire]);

      await setup(course);
      fixture = TestBed.createComponent(ClassDetailComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const items = component.courseItems();
      // class1 → questionnaire → class2
      expect(items[0].type).toBe('class');
      expect(items[0].data._id).toBe(CLASS_ID_1);
      expect(items[1].type).toBe('questionnaire');
      expect(items[1].data._id).toBe(Q_ID);
      expect(items[2].type).toBe('class');
      expect(items[2].data._id).toBe(CLASS_ID_2);
    });
  });

  // ═══════════════════ loadClassData — error handling ═══════════════════

  describe('loadClassData() — manejo de errores', () => {
    it('setea error cuando el curso no puede cargarse', async () => {
      const course = makeCourse([makeClass(CLASS_ID_1)]);
      await setup(course);

      mockCoursesService.getCourseById.mockReturnValue(
        throwError(() => new Error('500 Internal Server Error'))
      );

      fixture = TestBed.createComponent(ClassDetailComponent);
      component = fixture.componentInstance;
      vi.spyOn(console, 'error');
      fixture.detectChanges();

      expect(component.error()).toBe('No se pudo cargar la clase');
      expect(component.loading()).toBe(false);
    });

    it('setea error cuando la clase no existe en el curso', async () => {
      // El curso no tiene la clase CLASS_ID_1
      const course = makeCourse([makeClass('otraClase')]);
      await setup(course);

      fixture = TestBed.createComponent(ClassDetailComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.error()).toBe('Clase no encontrada');
    });
  });
});
