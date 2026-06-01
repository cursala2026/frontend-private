import { Component, OnInit, OnDestroy, inject, signal, effect, HostListener } from '@angular/core';

import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  QuestionnairesService,
  Questionnaire,
  QuestionnaireSubmission,
  Answer
} from '../../../core/services/questionnaires.service';
import { CourseProgressService } from '../../../core/services/course-progress.service';
import { CoursesService } from '../../../core/services/courses.service';
import { InfoService } from '../../../core/services/info.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-questionnaire-take',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './questionnaire-take.component.html',
})
export class QuestionnaireTakeComponent implements OnInit, OnDestroy {
  private questionnairesService = inject(QuestionnairesService);
  private progressService = inject(CourseProgressService);
  private coursesService = inject(CoursesService);
  private infoService = inject(InfoService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  courseId = signal<string>('');
  questionnaireId = signal<string>('');
  questionnaire = signal<Questionnaire | null>(null);
  currentSubmission = signal<QuestionnaireSubmission | null>(null);
  previousSubmissions = signal<QuestionnaireSubmission[]>([]);
  courseData = signal<any>(null);

  answers: { [questionId: string]: Answer } = {};
  multipleSelectAnswers: { [questionId: string]: string[] } = {};

  loading = signal<boolean>(true);
  submitting = signal<boolean>(false);
  showResults = signal<boolean>(false);
  canRetry = signal<boolean>(false);
  started = signal<boolean>(false);
  
  isReviewing = signal<boolean>(false); 
  sendEmailCopy = signal<boolean>(false);
  showEmailModal = signal<boolean>(false); // NUEVO: Estado del Modal
  
  nextItem = signal<{ type: 'CLASS'|'QUESTIONNAIRE'; id: string } | null>(null);

  timeRemaining = signal<number | null>(null);
  timeExpired = signal<boolean>(false);
  private timerInterval: any = null;

  showGradingExplanationStudent = signal<boolean>(true);

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.started() && !this.submitting() && !this.showResults()) {
      $event.returnValue = true; 
    }
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.courseId.set(params['courseId']);
      this.questionnaireId.set(params['questionnaireId']);
      this.loadQuestionnaire();
    });
  }

  constructor() {
    effect(() => {
      if (this.showGradingExplanationStudent && this.showGradingExplanationStudent()) {
        setTimeout(() => {
          const btn = document.getElementById('grading-explain-close-button') as HTMLElement | null;
          btn?.focus();
        }, 0);
      }
    });
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  closeGradingExplanationStudent(): void {
    this.showGradingExplanationStudent.set(false);
  }

  clearTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private getStorageKey(): string {
    const subId = this.currentSubmission()?._id;
    return `cursala_draft_${this.questionnaireId()}_${subId || 'new'}`;
  }

  private saveProgressToLocal(): void {
    if (!this.started()) return;
    const draft = {
      answers: this.answers,
      multipleSelectAnswers: this.multipleSelectAnswers
    };
    localStorage.setItem(this.getStorageKey(), JSON.stringify(draft));
  }

  private restoreProgressFromLocal(): boolean {
    const saved = localStorage.getItem(this.getStorageKey());
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        this.answers = draft.answers || {};
        this.multipleSelectAnswers = draft.multipleSelectAnswers || {};
        return true;
      } catch (e) {
        console.error('Error recuperando savepoint', e);
      }
    }
    return false;
  }

  private clearLocalProgress(): void {
    localStorage.removeItem(this.getStorageKey());
  }

  startTimer(): void {
    this.clearTimer();
    const questionnaire = this.questionnaire();
    const submission = this.currentSubmission();

    if (!questionnaire || !submission || !questionnaire.timeLimitMinutes) {
      this.timeRemaining.set(null);
      return;
    }

    const startedAt = new Date(submission.startedAt);
    const timeLimitMs = questionnaire.timeLimitMinutes * 60 * 1000;
    const now = new Date();
    const elapsedMs = now.getTime() - startedAt.getTime();
    let remainingMs = timeLimitMs - elapsedMs;

    if (remainingMs <= 0) {
      this.timeExpired.set(true);
      this.timeRemaining.set(0);
      this.handleTimeExpired();
      return;
    }

    this.timeRemaining.set(Math.floor(remainingMs / 1000));
    this.timeExpired.set(false);

    this.timerInterval = setInterval(() => {
      remainingMs -= 1000;
      const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));
      this.timeRemaining.set(remainingSeconds);

      if (remainingSeconds <= 0) {
        this.timeExpired.set(true);
        this.clearTimer();
        this.handleTimeExpired();
      }
    }, 1000);
  }

  handleTimeExpired(): void {
    if (this.showResults()) return;
    if (this.submitting()) return;

    this.infoService.showError('El tiempo ha finalizado. El cuestionario se enviará automáticamente con las respuestas actuales.');
    this.autoSubmitOnTimeExpired();
  }

  autoSubmitOnTimeExpired(): void {
    const submission = this.currentSubmission();
    if (!submission) return;

    this.submitting.set(true);

    const answersArray: Answer[] = Object.values(this.answers).filter(a =>
      (a.questionType === 'MULTIPLE_CHOICE' && a.selectedOptionId) ||
      (a.questionType === 'MULTIPLE_SELECT' && a.selectedOptionIds && a.selectedOptionIds.length > 0) ||
      (a.questionType === 'TEXT' && a.textAnswer) ||
      (a.questionType === 'LINEAR_SCALE' && a.numericAnswer !== undefined) // NUEVO
    );

    this.questionnairesService.submitAnswers(submission._id!, answersArray).subscribe({
      next: (response) => {
        const updatedSubmission = response?.data;
        this.currentSubmission.set(updatedSubmission);
        this.showResults.set(true);
        this.submitting.set(false);
        this.clearTimer();
        this.updateCourseProgress(updatedSubmission);
        this.loadPreviousSubmissions();
        this.infoService.showInfo('Enviado automáticamente al finalizar el tiempo.');
        this.clearLocalProgress();
      },
      error: (error) => {
        this.infoService.showError(error.error?.message || 'Error al enviar automáticamente');
        this.submitting.set(false);
      }
    });
  }

  formatTimeRemaining(seconds: number): string {
    if (seconds <= 0) return '00:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  getTimeRemainingClass(): string {
    const remaining = this.timeRemaining();
    if (remaining === null) return '';
    const minutes = Math.floor(remaining / 60);
    if (remaining <= 60) return 'text-red-600 font-bold animate-pulse';
    else if (minutes <= 5) return 'text-orange-600 font-semibold';
    else return 'text-blue-600';
  }

  loadQuestionnaire(): void {
    const qId = this.questionnaireId();
    const cId = this.courseId();
    try {
      this.questionnaire.set(null);
      this.currentSubmission.set(null);
      this.previousSubmissions.set([]);
      this.answers = {};
      this.multipleSelectAnswers = {};
      this.showResults.set(false);
      this.started.set(false);
      this.submitting.set(false);
      this.timeExpired.set(false);
      this.clearTimer();
      this.nextItem.set(null);
    } catch (e) {}

    this.coursesService.getCourseById(cId).subscribe({
      next: (response: any) => this.courseData.set(response?.data || response),
      error: (err: any) => console.error('[q-take] Error loading course:', err)
    });

    this.questionnairesService.getQuestionnaireById(qId).subscribe({
      next: (response) => {
        this.questionnaire.set(response?.data);
        this.loadPreviousSubmissions();
      },
      error: () => {
        this.infoService.showError('Error al cargar el cuestionario');
        this.goBack();
      }
    });
  }

  loadPreviousSubmissions(): void {
    const user = this.authService.currentUser();
    if (!user) return;
    const userId = user._id?.toString() || user._id;

    this.questionnairesService.getStudentSubmissions(this.questionnaireId(), userId).subscribe({
      next: (response) => {
        this.previousSubmissions.set(response?.data || []);
        this.recalculateCanRetry();
        if (!this.showResults()) this.checkOrStartSubmission();
        if (this.showResults() && this.currentSubmission()?.status === 'GRADED') {
          try { this.updateCourseProgress(this.currentSubmission()!); } catch (e) { }
        }
        this.loading.set(false);
      },
      error: () => {
        this.checkOrStartSubmission();
        this.loading.set(false);
      }
    });
  }

  recalculateCanRetry(): void {
    const questionnaire = this.questionnaire();
    const submissions = this.previousSubmissions();
    if (questionnaire) {
      const completedSubmissions = submissions.filter(s => s.status === 'GRADED' || s.status === 'SUBMITTED');
      const attemptCount = completedSubmissions.length;
      const maxRetries = questionnaire.maxRetries;
      this.canRetry.set(questionnaire.allowRetries && (!maxRetries || attemptCount < maxRetries));
    }
  }

  checkOrStartSubmission(): void {
    const submissions = this.previousSubmissions();
    if (submissions.length === 0) {
      this.startNewSubmission();
      return;
    }

    const sortedSubmissions = [...submissions].sort((a, b) => (b.attemptNumber || 0) - (a.attemptNumber || 0));
    
    const graded = sortedSubmissions.find(s => s.status === 'GRADED');
    if (graded) {
      this.currentSubmission.set(graded);
      this.showResults.set(true);
      try { this.updateCourseProgress(graded); } catch(e) {}
      return;
    }

    const submitted = sortedSubmissions.find(s => s.status === 'SUBMITTED');
    if (submitted) {
      this.currentSubmission.set(submitted);
      this.showResults.set(true); 
      return;
    }

    const mostRecent = sortedSubmissions[0];
    if (mostRecent && mostRecent.status === 'IN_PROGRESS') {
      this.currentSubmission.set(mostRecent);
      this.loadAnswersFromSubmission(mostRecent);
      this.showResults.set(false);
      this.started.set(false);
      return;
    }

    if (!this.canRetry()) {
      this.currentSubmission.set(mostRecent);
      this.showResults.set(true);
      this.infoService.showInfo('Ya no tienes más intentos disponibles');
      return;
    }

    this.startNewSubmission();
  }

  startNewSubmission(): void {
    this.questionnairesService.startSubmission(this.questionnaireId()).subscribe({
      next: (response) => {
        this.currentSubmission.set(response?.data);
        this.showResults.set(false);
        this.initializeAnswers();
        this.started.set(false); 
      },
      error: (error) => {
        const errorMsg = error?.error?.message || '';
        if (errorMsg.includes('retry') || errorMsg.includes('exceeded')) {
          this.infoService.showError('Ya no tienes más intentos disponibles');
        } else {
          this.infoService.showError(errorMsg || 'Error al iniciar el cuestionario');
        }
        setTimeout(() => this.goBack(), 2000);
      }
    });
  }

  initializeAnswers(): void {
    const questionnaire = this.questionnaire();
    if (!questionnaire) return;

    questionnaire.questions.forEach(question => {
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

  startQuestionnaire(): void {
    this.started.set(true);
    this.startTimer();
    this.restoreProgressFromLocal();
  }

  onMultipleChoiceChange(questionId: string, optionId: string): void {
    const optionIdStr = typeof optionId === 'object' ? (optionId as any)._id?.toString() || String(optionId) : String(optionId);
    this.answers[questionId] = { questionId, questionType: 'MULTIPLE_CHOICE', selectedOptionId: optionIdStr };
    this.saveProgressToLocal();
  }

  onMultipleSelectChange(questionId: string, optionId: string, checked: boolean): void {
    const optionIdStr = typeof optionId === 'object' ? (optionId as any)._id?.toString() || String(optionId) : String(optionId);
    if (!this.multipleSelectAnswers[questionId]) this.multipleSelectAnswers[questionId] = [];
    
    if (checked) {
      if (!this.multipleSelectAnswers[questionId].includes(optionIdStr)) this.multipleSelectAnswers[questionId].push(optionIdStr);
    } else {
      const index = this.multipleSelectAnswers[questionId].indexOf(optionIdStr);
      if (index > -1) this.multipleSelectAnswers[questionId].splice(index, 1);
    }
    
    this.answers[questionId] = { questionId, questionType: 'MULTIPLE_SELECT', selectedOptionIds: this.multipleSelectAnswers[questionId] };
    this.saveProgressToLocal();
  }

  onTextAnswerChange(questionId: string, text: string): void {
    this.answers[questionId] = { questionId, questionType: 'TEXT', textAnswer: text };
    this.saveProgressToLocal();
  }

  onLinearScaleChange(questionId: string, value: number): void {
    this.answers[questionId] = { questionId, questionType: 'LINEAR_SCALE', numericAnswer: value };
    this.saveProgressToLocal();
  }

  reviewAnswers(): void {
    const submission = this.currentSubmission();
    if (!submission) return;

    const questionnaire = this.questionnaire();
    if (!questionnaire) return;

    // Validación
    for (const question of questionnaire.questions) {
      const questionType = question.type as 'MULTIPLE_CHOICE' | 'MULTIPLE_SELECT' | 'TEXT' | 'LINEAR_SCALE';
      if (question.required) {
        const answer = this.answers[question._id!];
        if (!answer ||
            (questionType === 'MULTIPLE_CHOICE' && !answer.selectedOptionId) ||
            (questionType === 'MULTIPLE_SELECT' && (!this.multipleSelectAnswers[question._id!] || this.multipleSelectAnswers[question._id!].length === 0)) ||
            (questionType === 'TEXT' && !answer.textAnswer?.trim()) ||
            (questionType === 'LINEAR_SCALE' && answer.numericAnswer === undefined)) {
          this.infoService.showError(`La pregunta "${question.questionText}" es obligatoria`);
          return;
        }
      }
    }

    this.isReviewing.set(true);
    this.saveProgressToLocal(); 
  }

  // Dispara la ventana emergente
  promptSubmit(): void {
    this.showEmailModal.set(true);
  }

  closeEmailModal(): void {
    this.showEmailModal.set(false);
  }

  confirmSubmit(): void {
    this.showEmailModal.set(false);
    const submission = this.currentSubmission();
    if (!submission) return;

    this.submitting.set(true);

    const answersArray: Answer[] = Object.values(this.answers).filter(a =>
      (a.questionType === 'MULTIPLE_CHOICE' && a.selectedOptionId) ||
      (a.questionType === 'MULTIPLE_SELECT' && a.selectedOptionIds && a.selectedOptionIds.length > 0) ||
      (a.questionType === 'TEXT' && a.textAnswer) ||
      (a.questionType === 'LINEAR_SCALE' && a.numericAnswer !== undefined)
    );
    
    this.questionnairesService.submitAnswers(submission._id!, answersArray).subscribe({
      next: (response) => {
        const updatedSubmission = response?.data;
        this.clearLocalProgress();
        this.currentSubmission.set(updatedSubmission);
        this.isReviewing.set(false);
        this.showResults.set(true);
        this.submitting.set(false);
        this.clearTimer();

        this.updateCourseProgress(updatedSubmission);
        this.loadPreviousSubmissions();

        if (this.sendEmailCopy()) {
          this.infoService.showSuccess('Cuestionario enviado. Recibirás una copia en tu email.');
        } else {
          this.infoService.showSuccess('Cuestionario enviado exitosamente.');
        }
      },
      error: (error) => {
        this.infoService.showError(error.error?.message || 'Error al enviar el cuestionario');
        this.submitting.set(false);
      }
    });
  }

  updateCourseProgress(submission: QuestionnaireSubmission): void {
    const questionnaire = this.questionnaire();
    if (!questionnaire) return;
    const score = submission.finalScore ?? submission.autoGradedScore ?? 0;
    const passed = questionnaire.passingScore ? score >= questionnaire.passingScore : true;
    const courseId = this.courseId();

    this.progressService.getProgress(courseId).subscribe({
      next: (progress) => {
        const course = this.courseData();
        if (!course) { this.nextItem.set(null); return; }
        const ordered = Array.isArray(course.orderedContent) ? course.orderedContent : (course.orderedContent && Array.isArray((course.orderedContent as any).items) ? (course.orderedContent as any).items : null);
        let items: Array<{ type: 'CLASS'|'QUESTIONNAIRE'; data: any }> = [];
        if (ordered && Array.isArray(ordered)) {
          items = ordered.filter((it: any) => it.data && (it.type === 'CLASS' || it.type === 'QUESTIONNAIRE'));
        }
        const currentIndex = items.findIndex(it => it.type === 'QUESTIONNAIRE' && String(it.data._id) === String(questionnaire._id));
        if (currentIndex === -1) { this.goBack(); return; }
        if (!passed && this.canRetry()) { this.nextItem.set(null); return; }

        for (let i = currentIndex + 1; i < items.length; i++) {
          const next = items[i];
          if (next.type === 'CLASS' || next.type === 'QUESTIONNAIRE') {
            this.nextItem.set({ type: next.type, id: String(next.data._id) });
            return;
          }
        }
        this.nextItem.set(null);
      },
      error: () => this.goBack()
    });
  }

  retry(): void {
    if (!this.canRetry()) return;
    this.showResults.set(false);
    this.answers = {};
    this.startNewSubmission();
  }

  goBack(): void {
    this.router.navigate(['/alumno/course-detail', this.courseId()]);
  }

  goToNextItem(): void {
    const next = this.nextItem();
    if (!next) { this.goBack(); return; }
    const target = next.type === 'CLASS'
      ? ['/alumno/course-detail', this.courseId(), 'class', next.id]
      : ['/alumno/course-detail', this.courseId(), 'questionnaire', next.id];
    this.router.navigate(target).then(success => {
      if (success) this.nextItem.set(null);
    });
  }

  getScore(): number {
    const submission = this.currentSubmission();
    return submission?.finalScore ?? submission?.autoGradedScore ?? 0;
  }

  isPassed(): boolean {
    const questionnaire = this.questionnaire();
    const score = this.getScore();
    if (!questionnaire || !questionnaire.passingScore) return true;
    return score >= questionnaire.passingScore;
  }

  getScoreColor(): string {
    return this.isPassed() ? 'text-green-600' : 'text-red-600';
  }

  getAnswerForQuestion(questionId: string): Answer | undefined {
    return this.currentSubmission()?.answers.find(a => a.questionId === questionId);
  }

  isCorrectOption(questionId: string, optionId: string): boolean {
    const question = this.questionnaire()?.questions.find(q => q._id === questionId);
    return question?.correctOptionId?.toString() === optionId.toString();
  }

  isCorrectMultipleSelectOption(questionId: string, optionId: string): boolean {
    const question = this.questionnaire()?.questions.find(q => q._id === questionId);
    return (question?.correctOptionIds || []).some((id: any) => id.toString() === optionId.toString());
  }
  isMultipleSelectOptionSelectedInAnswer(answer: Answer, optionId: string): boolean {
    return (answer.selectedOptionIds || []).some((id: any) => id.toString() === optionId.toString());
  }

  isMultipleSelectOptionSelected(questionId: string, optionId: string): boolean {
    return this.multipleSelectAnswers[questionId]?.includes(optionId) || false;
  }

  getTimeElapsed(): string | null {
    const submission = this.currentSubmission();
    if (!submission || !submission.startedAt || !submission.submittedAt) return null;
    const diffMs = new Date(submission.submittedAt).getTime() - new Date(submission.startedAt).getTime();
    if (diffMs < 0) return null;
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    else if (minutes > 0) return `${minutes}m ${seconds}s`;
    else return `${seconds}s`;
  }

  // HELPER: Generar rango de números para la escala lineal
  getScaleRange(min: number = 1, max: number = 10): number[] {
    const range = [];
    for (let i = min; i <= max; i++) range.push(i);
    return range;
  }

  // HELPER: Obtener el texto de una opción basado en su ID (para la vista de revisión)
  getOptionText(question: any, optionId: string | undefined): string {
    if (!optionId) return '';
    const opt = question.options?.find((o: any) => o._id?.toString() === optionId.toString());
    return opt ? opt.text : '(Opción desconocida)';
  }
}