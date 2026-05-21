import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QuestionnaireTakeComponent } from './questionnaire-take.component';
import { QuestionnairesService } from '../../../core/services/questionnaires.service';
import { CourseProgressService } from '../../../core/services/course-progress.service';
import { CoursesService } from '../../../core/services/courses.service';
import { InfoService } from '../../../core/services/info.service';
import { AuthService } from '../../../core/services/auth.service';
import { Router, ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';

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
    };

    mockInfoService = {
      showError: vi.fn(),
      showSuccess: vi.fn(),
    };

    mockAuthService = {
      currentUser: vi.fn().mockReturnValue({ _id: 'user123' }),
    };

    mockCoursesService = {
      getCourseById: vi.fn().mockReturnValue(of({ data: { _id: 'course123' } })),
    };

    mockProgressService = {
      updateProgress: vi.fn(),
    };

    mockRouter = {
      navigate: vi.fn(),
    };

    const mockActivatedRoute = {
      params: of({ courseId: 'course123', questionnaireId: 'q123' }),
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

  it('should create', () => {
    mockQuestionnairesService.getQuestionnaireById.mockReturnValue(of({ data: {} }));
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('loadQuestionnaire', () => {
    it('should handle API errors and call goBack and infoService.showError when getQuestionnaireById fails', () => {
      // Simulate API failure (e.g. 500 error or routing error as experienced in the bug)
      mockQuestionnairesService.getQuestionnaireById.mockReturnValue(
        throwError(() => new Error('Server Error'))
      );

      // We spy on console.error to avoid polluting test output
      vi.spyOn(console, 'error');
      
      // Spy on goBack
      vi.spyOn(component as any, 'goBack');

      fixture.detectChanges(); // triggers ngOnInit which calls loadQuestionnaire

      expect(mockQuestionnairesService.getQuestionnaireById).toHaveBeenCalledWith('q123');
      expect(console.error).toHaveBeenCalledWith('[q-take] Error loading questionnaire:', expect.any(Error));
      expect(mockInfoService.showError).toHaveBeenCalledWith('Error al cargar el cuestionario');
      expect((component as any).goBack).toHaveBeenCalled();
    });

    it('should set questionnaire data when getQuestionnaireById succeeds', () => {
      const mockQ = { _id: 'q123', title: 'Test Q', questions: [] };
      mockQuestionnairesService.getQuestionnaireById.mockReturnValue(of({ data: mockQ }));

      fixture.detectChanges(); // triggers ngOnInit which calls loadQuestionnaire

      expect(mockQuestionnairesService.getQuestionnaireById).toHaveBeenCalledWith('q123');
      expect(component.questionnaire()).toEqual(mockQ as any);
      expect(mockQuestionnairesService.getStudentSubmissions).toHaveBeenCalled();
    });
  });

  describe('Visualización de Calificaciones Autocalificables', () => {
    it('debe devolver la calificación autocalificada (autoGradedScore) cuando finalScore no está definido', () => {
      const mockSubmission = {
        _id: 'sub123',
        status: 'GRADED',
        autoGradedScore: 75,
        finalScore: undefined,
        answers: []
      } as any;
      component.currentSubmission.set(mockSubmission);
      
      expect(component.getScore()).toBe(75);
    });

    it('debe devolver la calificación final (finalScore) cuando es 0, sin caer erróneamente en la autocalificada', () => {
      const mockSubmission = {
        _id: 'sub123',
        status: 'GRADED',
        autoGradedScore: 75,
        finalScore: 0,
        answers: []
      } as any;
      component.currentSubmission.set(mockSubmission);
      
      expect(component.getScore()).toBe(0);
    });

    it('debe mostrar la calificación autocalificada en el DOM cuando finalScore no está definido y el estado es GRADED', () => {
      const mockQ = { _id: 'q123', title: 'Test Q', questions: [], passingScore: 60 };
      const mockSubmission = {
        _id: 'sub123',
        status: 'GRADED',
        autoGradedScore: 75,
        finalScore: undefined,
        answers: [],
        attemptNumber: 1
      } as any;

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
      const mockQ = { _id: 'q123', title: 'Test Q', questions: [], passingScore: 60 };
      const mockSubmission = {
        _id: 'sub123',
        status: 'GRADED',
        autoGradedScore: 75,
        finalScore: 0,
        answers: [],
        attemptNumber: 1
      } as any;

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
});
