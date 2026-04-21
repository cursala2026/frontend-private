import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QuestionnaireEditComponent } from './questionnaire-edit.component';
import { ReactiveFormsModule } from '@angular/forms';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

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

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // --- TESTS DE LA TAREA #14: ENCUESTAS ---

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
});
