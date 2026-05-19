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
      getQuestionnaireById: jasmine.createSpy('getQuestionnaireById'),
      getStudentSubmissions: jasmine.createSpy('getStudentSubmissions').and.returnValue(of({ data: [] })),
    };

    mockInfoService = {
      showError: jasmine.createSpy('showError'),
      showSuccess: jasmine.createSpy('showSuccess'),
    };

    mockAuthService = {
      currentUser: jasmine.createSpy('currentUser').and.returnValue({ _id: 'user123' }),
    };

    mockCoursesService = {
      getCourseById: jasmine.createSpy('getCourseById').and.returnValue(of({ data: { _id: 'course123' } })),
    };

    mockProgressService = {
      updateProgress: jasmine.createSpy('updateProgress'),
    };

    mockRouter = {
      navigate: jasmine.createSpy('navigate'),
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
    mockQuestionnairesService.getQuestionnaireById.and.returnValue(of({ data: {} }));
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('loadQuestionnaire', () => {
    it('should handle API errors and call goBack and infoService.showError when getQuestionnaireById fails', () => {
      // Simulate API failure (e.g. 500 error or routing error as experienced in the bug)
      mockQuestionnairesService.getQuestionnaireById.and.returnValue(
        throwError(() => new Error('Server Error'))
      );

      // We spy on console.error to avoid polluting test output
      spyOn(console, 'error');
      
      // Spy on goBack
      spyOn(component as any, 'goBack');

      fixture.detectChanges(); // triggers ngOnInit which calls loadQuestionnaire

      expect(mockQuestionnairesService.getQuestionnaireById).toHaveBeenCalledWith('q123');
      expect(console.error).toHaveBeenCalledWith('[q-take] Error loading questionnaire:', jasmine.any(Error));
      expect(mockInfoService.showError).toHaveBeenCalledWith('Error al cargar el cuestionario');
      expect((component as any).goBack).toHaveBeenCalled();
    });

    it('should set questionnaire data when getQuestionnaireById succeeds', () => {
      const mockQ = { _id: 'q123', title: 'Test Q', questions: [] };
      mockQuestionnairesService.getQuestionnaireById.and.returnValue(of({ data: mockQ }));

      fixture.detectChanges(); // triggers ngOnInit which calls loadQuestionnaire

      expect(mockQuestionnairesService.getQuestionnaireById).toHaveBeenCalledWith('q123');
      expect(component.questionnaire()).toEqual(mockQ as any);
      expect(mockQuestionnairesService.getStudentSubmissions).toHaveBeenCalled();
    });
  });
});
