import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  QuestionnairesService,
  Questionnaire,
  QuestionnaireSubmission,
  Answer
} from '../../../core/services/questionnaires.service';
import { CoursesService } from '../../../core/services/courses.service';
import { InfoService } from '../../../core/services/info.service';
import { AuthService } from '../../../core/services/auth.service';
import { FormSavepointService } from '../../../core/services/form-savepoint.service';

@Component({
  selector: 'app-survey-take',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './survey-take.component.html',
})
export class SurveyTakeComponent implements OnInit, OnDestroy {
  private questionnairesService = inject(QuestionnairesService);
  private coursesService = inject(CoursesService);
  private infoService = inject(InfoService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private savepointService = inject(FormSavepointService);

  courseId = signal<string>('');
  surveyId = signal<string>('');
  survey = signal<Questionnaire | null>(null);
  currentSubmission = signal<QuestionnaireSubmission | null>(null);
  courseData = signal<any>(null);

  // Answer tracking
  answers: { [questionId: string]: Answer } = {};
  multipleSelectAnswers: { [questionId: string]: string[] } = {};

  // State
  loading = signal<boolean>(true);
  submitting = signal<boolean>(false);
  showResults = signal<boolean>(false);
  started = signal<boolean>(false);
  nextItem = signal<{ type: 'CLASS' | 'QUESTIONNAIRE' | 'SURVEY'; id: string } | null>(null);

  // beforeunload warning
  private beforeUnloadHandler?: (e: BeforeUnloadEvent) => void;

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.courseId.set(params['courseId']);
      this.surveyId.set(params['surveyId']);
      this.loadSurvey();
    });
  }

  ngOnDestroy(): void {
    this.removeBeforeUnloadWarning();
  }

  // ─── Savepoint ────────────────────────────────────────────────────────

  private get savepointKey(): string {
    return `survey_answers_${this.surveyId()}`;
  }

  private saveAnswers(): void {
    this.savepointService.save(this.savepointKey, {
      answers: this.answers,
      multipleSelectAnswers: this.multipleSelectAnswers,
    });
  }

  private tryRestoreAnswers(): boolean {
    const saved = this.savepointService.load(this.savepointKey);
    if (!saved) return false;
    if (saved.answers) this.answers = saved.answers;
    if (saved.multipleSelectAnswers) this.multipleSelectAnswers = saved.multipleSelectAnswers;
    return true;
  }

  private clearAnswersSavepoint(): void {
    this.savepointService.clear(this.savepointKey);
  }

  private activateBeforeUnloadWarning(): void {
    this.removeBeforeUnloadWarning();
    this.beforeUnloadHandler = (e: BeforeUnloadEvent) => {
      if (this.started() && !this.showResults()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
  }

  private removeBeforeUnloadWarning(): void {
    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      this.beforeUnloadHandler = undefined;
    }
  }

  // ─── Load ─────────────────────────────────────────────────────────────

  loadSurvey(): void {
    const sId = this.surveyId();
    const cId = this.courseId();

    this.survey.set(null);
    this.currentSubmission.set(null);
    this.answers = {};
    this.multipleSelectAnswers = {};
    this.showResults.set(false);
    this.started.set(false);
    this.submitting.set(false);
    this.nextItem.set(null);
    this.removeBeforeUnloadWarning();

    this.coursesService.getCourseById(cId).subscribe({
      next: (response: any) => this.courseData.set(response?.data || response),
      error: (err: any) => console.error('[survey-take] Error loading course:', err)
    });

    this.questionnairesService.getQuestionnaireById(sId).subscribe({
      next: (response) => {
        const survey = response?.data;
        this.survey.set(survey);
        this.checkOrStartSubmission();
      },
      error: (error) => {
        console.error('[survey-take] Error loading survey:', error);
        this.infoService.showError('Error al cargar la encuesta');
        this.goBack();
      }
    });
  }

  checkOrStartSubmission(): void {
    const user = this.authService.currentUser();
    if (!user) return;

    const userId = user._id?.toString() || user._id;

    this.questionnairesService.getStudentSubmissions(this.surveyId(), userId).subscribe({
      next: (response) => {
        const submissions: QuestionnaireSubmission[] = response?.data || [];

        // Si ya completó la encuesta, mostrar pantalla de completado
        const completed = submissions.find(s => s.status === 'GRADED' || s.status === 'SUBMITTED');
        if (completed) {
          this.currentSubmission.set(completed);
          this.showResults.set(true);
          this.computeNextItem();
          this.loading.set(false);
          return;
        }

        // Si hay una IN_PROGRESS, retomarla
        const inProgress = submissions.find(s => s.status === 'IN_PROGRESS');
        if (inProgress) {
          this.currentSubmission.set(inProgress);
          this.loadAnswersFromSubmission(inProgress);
          const restored = this.tryRestoreAnswers();
          if (restored) this.infoService.showInfo('Se restauraron tus respuestas guardadas.');
          this.showResults.set(false);
          this.started.set(false);
          this.loading.set(false);
          return;
        }

        // Nueva submission
        this.startNewSubmission();
      },
      error: () => {
        this.startNewSubmission();
      }
    });
  }

  startNewSubmission(): void {
    this.questionnairesService.startSubmission(this.surveyId()).subscribe({
      next: (response) => {
        const submission = response?.data;
        this.currentSubmission.set(submission);
        this.showResults.set(false);
        this.initializeAnswers();
        this.started.set(false);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('[survey-take] Error starting submission:', error);
        this.infoService.showError('Error al iniciar la encuesta');
        setTimeout(() => this.goBack(), 2000);
      }
    });
  }

  initializeAnswers(): void {
    const survey = this.survey();
    if (!survey) return;

    survey.questions.forEach(question => {
      this.answers[question._id!] = {
        questionId: question._id!,
        questionType: question.type
      };
      if (question.type === 'MULTIPLE_SELECT') {
        this.multipleSelectAnswers[question._id!] = [];
      }
    });
  }

  loadAnswersFromSubmission(submission: QuestionnaireSubmission): void {
    submission.answers.forEach(answer => {
      if (answer.questionType === 'MULTIPLE_CHOICE' && answer.selectedOptionId) {
        answer.selectedOptionId = typeof answer.selectedOptionId === 'object'
          ? (answer.selectedOptionId as any)._id?.toString() || String(answer.selectedOptionId)
          : String(answer.selectedOptionId);
      }
      if (answer.questionType === 'MULTIPLE_SELECT' && answer.selectedOptionIds) {
        answer.selectedOptionIds = answer.selectedOptionIds.map(id =>
          typeof id === 'object' ? (id as any)._id?.toString() || String(id) : String(id)
        );
        this.multipleSelectAnswers[answer.questionId] = answer.selectedOptionIds;
      }
      this.answers[answer.questionId] = answer;
    });
  }

  startSurvey(): void {
    this.started.set(true);
    this.activateBeforeUnloadWarning();
  }

  // ─── Answer handlers ──────────────────────────────────────────────────

  onMultipleChoiceChange(questionId: string, optionId: string): void {
    const optionIdStr = typeof optionId === 'object' ? (optionId as any)._id?.toString() || String(optionId) : String(optionId);
    this.answers[questionId] = { questionId, questionType: 'MULTIPLE_CHOICE', selectedOptionId: optionIdStr };
    this.saveAnswers();
  }

  onMultipleSelectChange(questionId: string, optionId: string, checked: boolean): void {
    const optionIdStr = typeof optionId === 'object' ? (optionId as any)._id?.toString() || String(optionId) : String(optionId);
    if (!this.multipleSelectAnswers[questionId]) this.multipleSelectAnswers[questionId] = [];

    if (checked) {
      if (!this.multipleSelectAnswers[questionId].includes(optionIdStr)) {
        this.multipleSelectAnswers[questionId].push(optionIdStr);
      }
    } else {
      const index = this.multipleSelectAnswers[questionId].indexOf(optionIdStr);
      if (index > -1) this.multipleSelectAnswers[questionId].splice(index, 1);
    }

    this.answers[questionId] = { questionId, questionType: 'MULTIPLE_SELECT', selectedOptionIds: this.multipleSelectAnswers[questionId] };
    this.saveAnswers();
  }

  isMultipleSelectOptionSelected(questionId: string, optionId: string): boolean {
    return this.multipleSelectAnswers[questionId]?.includes(optionId) || false;
  }

  onTextAnswerChange(questionId: string, text: string): void {
    this.answers[questionId] = { questionId, questionType: 'TEXT', textAnswer: text };
    this.saveAnswers();
  }

  // ─── Submit ───────────────────────────────────────────────────────────

  submitSurvey(): void {
    const submission = this.currentSubmission();
    if (!submission) {
      this.infoService.showError('No hay un envío activo');
      return;
    }

    const survey = this.survey();
    if (!survey) return;

    // Validar preguntas obligatorias
    for (const question of survey.questions) {
      if (question.required) {
        const answer = this.answers[question._id!];
        if (!answer ||
          (question.type === 'MULTIPLE_CHOICE' && !answer.selectedOptionId) ||
          (question.type === 'MULTIPLE_SELECT' && (!this.multipleSelectAnswers[question._id!] || this.multipleSelectAnswers[question._id!].length === 0)) ||
          (question.type === 'TEXT' && !answer.textAnswer?.trim())) {
          this.infoService.showError(`La pregunta "${question.questionText}" es obligatoria`);
          return;
        }
      }
    }

    this.submitting.set(true);

    const answersArray: Answer[] = Object.values(this.answers).filter(a =>
      (a.questionType === 'MULTIPLE_CHOICE' && a.selectedOptionId) ||
      (a.questionType === 'MULTIPLE_SELECT' && a.selectedOptionIds && a.selectedOptionIds.length > 0) ||
      (a.questionType === 'TEXT' && a.textAnswer)
    );

    this.questionnairesService.submitAnswers(submission._id!, answersArray).subscribe({
      next: (response) => {
        const updatedSubmission = response?.data;
        this.currentSubmission.set(updatedSubmission);
        this.showResults.set(true);
        this.submitting.set(false);
        this.clearAnswersSavepoint();
        this.removeBeforeUnloadWarning();
        this.computeNextItem();
        this.infoService.showSuccess('¡Gracias por completar la encuesta!');
      },
      error: (error) => {
        console.error('Error submitting survey:', error);
        const errorMessage = error.error?.message
          ? `Error al enviar la encuesta: ${error.error.message}`
          : 'Error al enviar la encuesta';
        this.infoService.showError(errorMessage);
        this.submitting.set(false);
      }
    });
  }

  // ─── Navigation ───────────────────────────────────────────────────────

  private computeNextItem(): void {
    const survey = this.survey();
    const course = this.courseData();
    if (!survey || !course) { this.nextItem.set(null); return; }

    const ordered = Array.isArray(course.orderedContent)
      ? course.orderedContent
      : (course.orderedContent && Array.isArray((course.orderedContent as any).items)
        ? (course.orderedContent as any).items : null);

    let items: Array<{ type: string; data: any }> = [];
    if (ordered && Array.isArray(ordered)) {
      items = ordered.filter((it: any) => it.data && (it.type === 'CLASS' || it.type === 'QUESTIONNAIRE'));
    } else {
      const classes = (course.classes || []).filter((c: any) => c.status === 'ACTIVE');
      classes.forEach((c: any) => {
        items.push({ type: 'CLASS', data: c });
        if (course.questionnaires && Array.isArray(course.questionnaires)) {
          course.questionnaires
            .filter((q: any) => q.position?.type === 'BETWEEN_CLASSES' && q.position?.afterClassId === c._id)
            .forEach((q: any) => items.push({ type: 'QUESTIONNAIRE', data: q }));
        }
      });
      if (course.questionnaires && Array.isArray(course.questionnaires)) {
        const added = new Set(items.filter(i => i.type === 'QUESTIONNAIRE').map(i => i.data._id));
        course.questionnaires.forEach((q: any) => { if (!added.has(q._id)) items.push({ type: 'QUESTIONNAIRE', data: q }); });
      }
    }

    const currentIndex = items.findIndex(it =>
      (it.type === 'QUESTIONNAIRE') && String(it.data._id) === String(survey._id)
    );
    if (currentIndex === -1) { this.nextItem.set(null); return; }

    for (let i = currentIndex + 1; i < items.length; i++) {
      const next = items[i];
      if (next.type === 'CLASS') { this.nextItem.set({ type: 'CLASS', id: String(next.data._id) }); return; }
      if (next.type === 'QUESTIONNAIRE') { this.nextItem.set({ type: 'QUESTIONNAIRE', id: String(next.data._id) }); return; }
    }
    this.nextItem.set(null);
  }

  goToNextItem(): void {
    const next = this.nextItem();
    if (!next) { this.goBack(); return; }

    const target = next.type === 'CLASS'
      ? ['/alumno/course-detail', this.courseId(), 'class', next.id]
      : next.type === 'SURVEY'
        ? ['/alumno/course-detail', this.courseId(), 'survey', next.id]
        : ['/alumno/course-detail', this.courseId(), 'questionnaire', next.id];

    this.router.navigate(target).catch(() => {
      this.infoService.showError('Error al navegar a la siguiente actividad.');
    });
  }

  goBack(): void {
    this.removeBeforeUnloadWarning();
    this.router.navigate(['/alumno/course-detail', this.courseId()]);
  }
}