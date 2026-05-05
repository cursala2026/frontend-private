import { Component, OnInit, OnDestroy, inject, signal, effect } from '@angular/core';

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

  // Answer tracking
  answers: { [questionId: string]: Answer } = {};
  // For MULTIPLE_SELECT, track selected option IDs as arrays
  multipleSelectAnswers: { [questionId: string]: string[] } = {};

  // State
  loading = signal<boolean>(true);
  submitting = signal<boolean>(false);
  showResults = signal<boolean>(false);
  canRetry = signal<boolean>(false);
  started = signal<boolean>(false);
  // Cached next navigation target to avoid repeated computation from template
  nextItem = signal<{ type: 'CLASS'|'QUESTIONNAIRE'; id: string } | null>(null);

  // Timer
  timeRemaining = signal<number | null>(null); // Tiempo restante en segundos
  timeExpired = signal<boolean>(false);
  private timerInterval: any = null;

  // Mostrar explicación de cómo se calcula la nota para el estudiante (antes de comenzar)
  showGradingExplanationStudent = signal<boolean>(true);

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.courseId.set(params['courseId']);
      this.questionnaireId.set(params['questionnaireId']);
      this.loadQuestionnaire();
    });
  }

  constructor() {
    // Focus the explanation button when the explanation becomes visible.
    // `effect` must run in an injection context (constructor/field initializer).
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

  startTimer(): void {
    this.clearTimer();
    const questionnaire = this.questionnaire();
    const submission = this.currentSubmission();

    // Si el cuestionario no tiene tiempo límite, no iniciar el temporizador
    if (!questionnaire || !submission || !questionnaire.timeLimitMinutes) {
      this.timeRemaining.set(null);
      return;
    }

    // Calcular tiempo restante
    const startedAt = new Date(submission.startedAt);
    const timeLimitMs = questionnaire.timeLimitMinutes * 60 * 1000;
    const now = new Date();
    const elapsedMs = now.getTime() - startedAt.getTime();
    let remainingMs = timeLimitMs - elapsedMs;

    // Si el tiempo ya expiró, cerrar inmediatamente
    if (remainingMs <= 0) {
      this.timeExpired.set(true);
      this.timeRemaining.set(0);
      this.handleTimeExpired();
      return;
    }

    this.timeRemaining.set(Math.floor(remainingMs / 1000));
    this.timeExpired.set(false);

    // Actualizar el temporizador cada segundo
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
    // Si ya se está mostrando resultados, no hacer nada
    if (this.showResults()) {
      return;
    }

    // Si se está enviando, no hacer nada
    if (this.submitting()) {
      return;
    }

    this.infoService.showError('El tiempo para resolver el cuestionario ha finalizado. El cuestionario se enviará automáticamente con las respuestas que has proporcionado hasta ahora.');
    
    // Enviar automáticamente el cuestionario
    this.autoSubmitOnTimeExpired();
  }

  autoSubmitOnTimeExpired(): void {
    const submission = this.currentSubmission();
    if (!submission) {
      return;
    }

    this.submitting.set(true);

    const answersArray: Answer[] = Object.values(this.answers).filter(a =>
      (a.questionType === 'MULTIPLE_CHOICE' && a.selectedOptionId) ||
      (a.questionType === 'MULTIPLE_SELECT' && a.selectedOptionIds && a.selectedOptionIds.length > 0) ||
      (a.questionType === 'TEXT' && a.textAnswer)
    );

    // Enviar con las respuestas que tenga hasta ahora
    this.questionnairesService.submitAnswers(submission._id!, answersArray).subscribe({
      next: (response) => {
        const updatedSubmission = response?.data;
        this.currentSubmission.set(updatedSubmission);
        this.showResults.set(true);
        this.submitting.set(false);
        this.clearTimer(); // Detener el temporizador

        // Update course progress
        this.updateCourseProgress(updatedSubmission);

        // Reload previous submissions
        this.loadPreviousSubmissions();

        this.infoService.showInfo('El cuestionario se ha enviado automáticamente al finalizar el tiempo.');
      },
      error: (error) => {
        console.error('Error auto-submitting questionnaire:', error);
        let errorMessage = 'Error al enviar el cuestionario automáticamente';
        if (error.error?.message) {
          errorMessage += `: ${error.error.message}`;
        }
        this.infoService.showError(errorMessage);
        this.submitting.set(false);
      }
    });
  }

  formatTimeRemaining(seconds: number): string {
    if (seconds <= 0) {
      return '00:00';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  }

  getTimeRemainingClass(): string {
    const remaining = this.timeRemaining();
    if (remaining === null) {
      return '';
    }

    // Cambiar color según el tiempo restante
    const minutes = Math.floor(remaining / 60);
    if (remaining <= 60) {
      return 'text-red-600 font-bold animate-pulse';
    } else if (minutes <= 5) {
      return 'text-orange-600 font-semibold';
    } else {
      return 'text-blue-600';
    }
  }

  loadQuestionnaire(): void {
    const qId = this.questionnaireId();
    const cId = this.courseId();
    // Reset transient state to avoid showing stale data from previous questionnaire
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
    } catch (e) { /* ignore */ }

    // debug logs removed
    // Load course data to find next class
    this.coursesService.getCourseById(cId).subscribe({
      next: (response: any) => {
        const course = response?.data || response;
        // debug logs removed
        this.courseData.set(course);
      },
      error: (err: any) => {
        console.error('[q-take] Error loading course:', err);
      }
    });

    this.questionnairesService.getQuestionnaireById(qId).subscribe({
      next: (response) => {
        const questionnaire = response?.data;
        // debug logs removed
        this.questionnaire.set(questionnaire);

        // Load previous submissions first, then check/start submission
        this.loadPreviousSubmissions();
      },
      error: (error) => {
        console.error('[q-take] Error loading questionnaire:', error);
        // debug logs removed
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
        const submissions = response?.data || [];
        this.previousSubmissions.set(submissions);

        // Recalculate canRetry after submissions are loaded
        this.recalculateCanRetry();

        // After loading submissions, check if should start/resume/show results
        // Only if we're not already showing results (to avoid starting new submission after submit)
        if (!this.showResults()) {
          this.checkOrStartSubmission();
        }

        // If we are showing results and the current submission is graded,
        // ensure nextItem is calculated so the "Continuar" button appears.
        if (this.showResults() && this.currentSubmission()?.status === 'GRADED') {
          try {
            this.updateCourseProgress(this.currentSubmission()!);
          } catch (e) { /* ignore */ }
        }

        // Set loading to false after everything is done
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading previous submissions:', error);
        // Even on error, try to check/start submission
        this.checkOrStartSubmission();
        this.loading.set(false);
      }
    });
  }

  recalculateCanRetry(): void {
    const questionnaire = this.questionnaire();
    const submissions = this.previousSubmissions();
    
    if (questionnaire) {
      // Count only completed submissions (GRADED or SUBMITTED)
      // IN_PROGRESS submissions don't count as completed attempts
      const completedSubmissions = submissions.filter(s => 
        s.status === 'GRADED' || s.status === 'SUBMITTED'
      );
      const attemptCount = completedSubmissions.length;
      const maxRetries = questionnaire.maxRetries;

      // Logic: maxRetries = total attempts allowed
      // If maxRetries = 2, student can make 2 attempts total
      // If student has made 1 attempt, they have 1 remaining (1 < 2 = true)
      // If student has made 2 attempts, they have 0 remaining (2 < 2 = false)
      // So condition is: attemptCount < maxRetries
      const canRetryValue = questionnaire.allowRetries &&
        (!maxRetries || attemptCount < maxRetries);

      this.canRetry.set(canRetryValue);
    }
  }

  checkOrStartSubmission(): void {
    const submissions = this.previousSubmissions();

    if (submissions.length === 0) {
      // No submissions yet, start new one
      this.startNewSubmission();
      return;
    }

    // Sort submissions by attempt number (most recent first)
    const sortedSubmissions = [...submissions].sort((a, b) => 
      (b.attemptNumber || 0) - (a.attemptNumber || 0)
    );

    // Priority: Check for completed submissions (GRADED or SUBMITTED) first
    // Only show form if the MOST RECENT submission is IN_PROGRESS
    
    // Check if there's a graded (completed) submission
    const graded = sortedSubmissions.find(s => s.status === 'GRADED');
    if (graded) {
      // Show results of the most recent graded submission
      // debug logs removed
      this.currentSubmission.set(graded);
      this.showResults.set(true);
      // ensure nextItem is computed for graded case
      try { this.updateCourseProgress(graded); } catch(e) {}
      return;
    }

    // Check if there's a submitted (pending grading) submission
    const submitted = sortedSubmissions.find(s => s.status === 'SUBMITTED');
    if (submitted) {
      // Show waiting message but don't show results/answers until graded
      // debug logs removed
      this.currentSubmission.set(submitted);
      this.showResults.set(true); // Show waiting message, but template will hide results/answers
      return;
    }

    // Check if the MOST RECENT submission is in-progress
    const mostRecent = sortedSubmissions[0];
    if (mostRecent && mostRecent.status === 'IN_PROGRESS') {
      // Existing submission in progress: load it but do NOT auto-start the timer.
      // Require the user to click 'Comenzar' to resume, so they always see the start screen.
      this.currentSubmission.set(mostRecent);
      this.loadAnswersFromSubmission(mostRecent);
      this.showResults.set(false);
      this.started.set(false);
      return;
    }

    // Check if can start new submission
    if (!this.canRetry()) {
      // Has submissions but can't retry - show the last one
      this.currentSubmission.set(mostRecent);
      this.showResults.set(true);
      this.infoService.showInfo('Ya no tienes más intentos disponibles para este cuestionario');
      return;
    }

    // Start new submission
    this.startNewSubmission();
  }

  startNewSubmission(): void {
    this.questionnairesService.startSubmission(this.questionnaireId()).subscribe({
      next: (response) => {
        const submission = response?.data;
        // debug logs removed
        this.currentSubmission.set(submission);
        this.showResults.set(false); // Ensure we show the form, not results
        this.initializeAnswers();
        this.started.set(false); // Esperar a que el usuario haga clic en comenzar
      },
      error: (error) => {
        console.error('[q-take] Error starting submission:', error);

        // Check if error is about retry limits
        const errorMsg = error?.error?.message || '';
        if (errorMsg.includes('retry') || errorMsg.includes('exceeded') || errorMsg.includes('not allowed')) {
          this.infoService.showError('Ya no tienes más intentos disponibles para este cuestionario');
        } else {
          this.infoService.showError(errorMsg || 'Error al iniciar el cuestionario');
        }

        // debug logs removed
        // Go back after a short delay
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
      
      // Initialize empty array for MULTIPLE_SELECT
      if (question.type === 'MULTIPLE_SELECT') {
        this.multipleSelectAnswers[question._id!] = [];
      }
    });
  }

  loadAnswersFromSubmission(submission: QuestionnaireSubmission): void {
    submission.answers.forEach(answer => {
      // Ensure IDs are strings
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
    // debug logs removed
    this.started.set(true);
    this.startTimer();
  }

  printQuestions(): void {
    const q = this.questionnaire();
    if (!q) {
      return;
    }
    try {
      // Log a structured copy and attempt to copy to clipboard
      const text = JSON.stringify(q.questions || [], null, 2);
      if (navigator && (navigator as any).clipboard && (navigator as any).clipboard.writeText) {
        (navigator as any).clipboard.writeText(text).catch(() => {});
      }
    } catch (e) {
      // ignore
    }
  }

  onMultipleChoiceChange(questionId: string, optionId: string): void {
    // Ensure optionId is a string
    const optionIdStr = typeof optionId === 'object' ? (optionId as any)._id?.toString() || String(optionId) : String(optionId);
    
    this.answers[questionId] = {
      questionId,
      questionType: 'MULTIPLE_CHOICE',
      selectedOptionId: optionIdStr
    };
  }

  onMultipleSelectChange(questionId: string, optionId: string, checked: boolean): void {
    // Ensure optionId is a string
    const optionIdStr = typeof optionId === 'object' ? (optionId as any)._id?.toString() || String(optionId) : String(optionId);
    
    if (!this.multipleSelectAnswers[questionId]) {
      this.multipleSelectAnswers[questionId] = [];
    }
    
    if (checked) {
      // Add option if not already selected
      if (!this.multipleSelectAnswers[questionId].includes(optionIdStr)) {
        this.multipleSelectAnswers[questionId].push(optionIdStr);
      }
    } else {
      // Remove option
      const index = this.multipleSelectAnswers[questionId].indexOf(optionIdStr);
      if (index > -1) {
        this.multipleSelectAnswers[questionId].splice(index, 1);
      }
    }
    
    // Update answer object
    this.answers[questionId] = {
      questionId,
      questionType: 'MULTIPLE_SELECT',
      selectedOptionIds: this.multipleSelectAnswers[questionId]
    };
  }

  isMultipleSelectOptionSelected(questionId: string, optionId: string): boolean {
    return this.multipleSelectAnswers[questionId]?.includes(optionId) || false;
  }

  onTextAnswerChange(questionId: string, text: string): void {
    this.answers[questionId] = {
      questionId,
      questionType: 'TEXT',
      textAnswer: text
    };
  }

  submitQuestionnaire(): void {
    const submission = this.currentSubmission();
    if (!submission) {
      this.infoService.showError('No hay un envío activo');
      return;
    }

    // Validate required questions
    const questionnaire = this.questionnaire();
    if (!questionnaire) return;

    for (const question of questionnaire.questions) {
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

    // debug logs removed

    this.questionnairesService.submitAnswers(submission._id!, answersArray).subscribe({
      next: (response) => {
        const updatedSubmission = response?.data;
        this.currentSubmission.set(updatedSubmission);
        this.showResults.set(true);
        this.submitting.set(false);
        this.clearTimer(); // Detener el temporizador al enviar

        // Update course progress
        this.updateCourseProgress(updatedSubmission);

        // Reload previous submissions to update canRetry status
        // This will also call checkOrStartSubmission, but since showResults is already true,
        // it won't start a new submission
        this.loadPreviousSubmissions();

        // Show appropriate message based on status
        if (updatedSubmission.status === 'SUBMITTED') {
          this.infoService.showSuccess('Cuestionario enviado exitosamente. Esperando calificación del profesor.');
        } else if (updatedSubmission.status === 'GRADED') {
          const passed = this.isPassed();
          if (passed) {
            this.infoService.showSuccess('¡Felicidades! Has aprobado el cuestionario.');
          } else {
            if (this.canRetry()) {
              this.infoService.showInfo('No has aprobado el cuestionario. Puedes intentar nuevamente.');
            } else {
              this.infoService.showInfo('No has aprobado el cuestionario. Ya no tienes más intentos disponibles.');
            }
          }
        } else {
          this.infoService.showSuccess('Cuestionario enviado exitosamente');
        }
      },
      error: (error) => {
        console.error('Error submitting questionnaire:', error);
        let errorMessage = 'Error al enviar el cuestionario';
        if (error.error?.message) {
          errorMessage += `: ${error.error.message}`;
        } else if (error.status === 500) {
          errorMessage += '. Error interno del servidor. Contacta al administrador.';
        }
        this.infoService.showError(errorMessage);
        this.submitting.set(false);
      }
    });
  }

  updateCourseProgress(submission: QuestionnaireSubmission): void {
    // After submitting a questionnaire, refresh course progress and navigate to next item
    const questionnaire = this.questionnaire();
    if (!questionnaire) return;

    // Usar ?? en lugar de || para que un puntaje de 0 no sea tratado como falsy
    const score = submission.finalScore ?? submission.autoGradedScore ?? 0;
    const passed = questionnaire.passingScore ? score >= questionnaire.passingScore : true;

    // debug log removed

    const courseId = this.courseId();

    // Refresh server-side progress (best-effort) and then decide navigation
    this.progressService.getProgress(courseId).subscribe({
      next: (progress) => {
        // If the user navigated to another questionnaire while this async call was pending,
        // avoid performing navigation from this (stale) component instance.
        try {
          const currentRouteQid = this.route.snapshot.paramMap.get('questionnaireId');
          if (currentRouteQid && questionnaire._id && String(questionnaire._id) !== String(currentRouteQid)) {
            // debug logs removed
            return;
          }
        } catch (e) { /* ignore */ }
        // debug log removed
        // Build ordered items from course data (support orderedContent)
        const course = this.courseData();
        if (!course) {
          // Course data missing; don't auto-navigate back from an async callback.
          this.nextItem.set(null);
          return;
        }

        const ordered = Array.isArray(course.orderedContent)
          ? course.orderedContent
          : (course.orderedContent && Array.isArray((course.orderedContent as any).items) ? (course.orderedContent as any).items : null);

        let items: Array<{ type: 'CLASS'|'QUESTIONNAIRE'; data: any }> = [];
        if (ordered && Array.isArray(ordered)) {
          items = ordered.filter((it: any) => it.data && (it.type === 'CLASS' || it.type === 'QUESTIONNAIRE'));
        } else {
          // fallback: interleave classes and questionnaires
          const classes = (course.classes || []).filter((c: any) => c.status === 'ACTIVE');
          items = [];
          classes.forEach((c: any) => {
            items.push({ type: 'CLASS', data: c });
            // Insert questionnaires positioned BETWEEN_CLASSES after this class (if present in course.questionnaires)
            if (course.questionnaires && Array.isArray(course.questionnaires)) {
              const afterQs = course.questionnaires.filter((q: any) => q.position?.type === 'BETWEEN_CLASSES' && q.position?.afterClassId === c._id);
              afterQs.forEach((q: any) => items.push({ type: 'QUESTIONNAIRE', data: q }));
            }
          });
          // remaining questionnaires
          if (course.questionnaires && Array.isArray(course.questionnaires)) {
            const added = new Set(items.filter(i => i.type === 'QUESTIONNAIRE').map(i => i.data._id));
            course.questionnaires.forEach((q: any) => { if (!added.has(q._id)) items.push({ type: 'QUESTIONNAIRE', data: q }); });
          }
        }

        // Find current questionnaire index
        const currentIndex = items.findIndex(it => it.type === 'QUESTIONNAIRE' && String(it.data._id) === String(questionnaire._id));
        // debug log removed

        if (currentIndex === -1) {
          // couldn't find in ordered items - log snapshot for diagnosis then go back
          try {
            // debug logs removed
          } catch (e) { /* ignore */ }
          this.goBack();
          return;
        }

        // If didn't pass and can retry, stay on results to allow retry
        if (!passed && this.canRetry()) {
          this.nextItem.set(null);
          return;
        }

        // Determine next item (class or questionnaire). Cache it in `nextItem` to avoid
        // repeated recomputation from the template and prevent cyclic behavior.
        for (let i = currentIndex + 1; i < items.length; i++) {
          const next = items[i];
          if (next.type === 'CLASS') {
            const target = { type: 'CLASS', id: String(next.data._id) } as { type: 'CLASS'|'QUESTIONNAIRE'; id: string };
            // debug logs removed
            this.nextItem.set(target);
            return;
          }
          if (next.type === 'QUESTIONNAIRE') {
            const target = { type: 'QUESTIONNAIRE', id: String(next.data._id) } as { type: 'CLASS'|'QUESTIONNAIRE'; id: string };
            // debug logs removed
            this.nextItem.set(target);
            return;
          }
        }

        // No next item, clear cache. Do not auto-navigate back from async callback.
        this.nextItem.set(null);
        return;
      },
      error: (err) => {
        console.error('[questionnaire-take] error refreshing progress', err);
        // On error, still attempt to navigate using local course data
        try {
          const currentRouteQid = this.route.snapshot.paramMap.get('questionnaireId');
          if (currentRouteQid && questionnaire._id && String(questionnaire._id) !== String(currentRouteQid)) {
            // debug logs removed
            return;
          }
        } catch (e) { /* ignore */ }

        const course = this.courseData();
        if (!course) { this.nextItem.set(null); return; }
        const ordered = Array.isArray(course.orderedContent)
          ? course.orderedContent
          : (course.orderedContent && Array.isArray((course.orderedContent as any).items) ? (course.orderedContent as any).items : null);
        let items: Array<{ type: 'CLASS'|'QUESTIONNAIRE'; data: any }> = [];
        if (ordered && Array.isArray(ordered)) items = ordered.filter((it: any) => it.data && (it.type === 'CLASS' || it.type === 'QUESTIONNAIRE'));
        if (items.length === 0 && course.classes) {
          const classes = (course.classes || []).filter((c: any) => c.status === 'ACTIVE');
          classes.forEach((c: any) => { items.push({ type: 'CLASS', data: c }); });
          if (course.questionnaires && Array.isArray(course.questionnaires)) {
            course.questionnaires.forEach((q: any) => items.push({ type: 'QUESTIONNAIRE', data: q }));
          }
        }
        const currentIndex = items.findIndex(it => it.type === 'QUESTIONNAIRE' && String(it.data._id) === String(questionnaire._id));
        for (let i = currentIndex + 1; i < items.length; i++) {
          const next = items[i];
          if (next.type === 'CLASS') { this.nextItem.set({ type: 'CLASS', id: String(next.data._id) }); return; }
          if (next.type === 'QUESTIONNAIRE') { this.nextItem.set({ type: 'QUESTIONNAIRE', id: String(next.data._id) }); return; }
        }
        this.nextItem.set(null);
        this.goBack();
      }
    });
  }

  retry(): void {
    if (!this.canRetry()) {
      this.infoService.showError('No puedes realizar más intentos');
      return;
    }

    this.showResults.set(false);
    this.answers = {};
    this.startNewSubmission();
  }

  goBack(): void {
    // debug logs removed
    this.router.navigate(['/alumno/course-detail', this.courseId()]);
  }

  getNextClassId(): string | null {
    const questionnaire = this.questionnaire();
    const course = this.courseData();
    
    if (!questionnaire || !course || !course.classes) {
      return null;
    }

    const afterClassId = questionnaire.position?.afterClassId;
    if (!afterClassId) {
      return null;
    }

    // Find the class that comes after the one specified in questionnaire position
    const afterClassIndex = course.classes.findIndex((c: any) => c._id === afterClassId);
    
    if (afterClassIndex === -1 || afterClassIndex >= course.classes.length - 1) {
      return null;
    }

    return course.classes[afterClassIndex + 1]._id;
  }

  goToNextClass(): void {
    const nextClassId = this.getNextClassId();
    if (nextClassId) {
      this.router.navigate(['/alumno/course-detail', this.courseId(), 'class', nextClassId]);
    } else {
      this.goBack();
    }
  }

  /**
   * Devuelve el siguiente ítem (clase o cuestionario) después del cuestionario actual, según orderedContent o fallback
   */
  getNextItem(): { type: 'CLASS'|'QUESTIONNAIRE'; id: string } | null {
    const questionnaire = this.questionnaire();
    const course = this.courseData();
    if (!questionnaire || !course) return null;

    const ordered = Array.isArray(course.orderedContent)
      ? course.orderedContent
      : (course.orderedContent && Array.isArray((course.orderedContent as any).items) ? (course.orderedContent as any).items : null);

    let items: Array<{ type: string; data: any }> = [];
    if (ordered && Array.isArray(ordered)) {
      items = ordered.filter((it: any) => it.data && (it.type === 'CLASS' || it.type === 'QUESTIONNAIRE'));
    } else {
      const classes = (course.classes || []).filter((c: any) => c.status === 'ACTIVE');
      classes.forEach((c: any) => {
        items.push({ type: 'CLASS', data: c });
        if (course.questionnaires && Array.isArray(course.questionnaires)) {
          const afterQs = course.questionnaires.filter((q: any) => q.position?.type === 'BETWEEN_CLASSES' && q.position?.afterClassId === c._id);
          afterQs.forEach((q: any) => items.push({ type: 'QUESTIONNAIRE', data: q }));
        }
      });
      if (course.questionnaires && Array.isArray(course.questionnaires)) {
        const added = new Set(items.filter(i => i.type === 'QUESTIONNAIRE').map(i => i.data._id));
        course.questionnaires.forEach((q: any) => { if (!added.has(q._id)) items.push({ type: 'QUESTIONNAIRE', data: q }); });
      }
    }

    const currentIndex = items.findIndex(it => it.type === 'QUESTIONNAIRE' && String(it.data._id) === String(questionnaire._id));
    if (currentIndex === -1) return null;
    for (let i = currentIndex + 1; i < items.length; i++) {
      const next = items[i];
      if (next.type === 'CLASS') {
        return { type: 'CLASS', id: next.data._id };
      }
      if (next.type === 'QUESTIONNAIRE') {
        return { type: 'QUESTIONNAIRE', id: next.data._id };
      }
    }
    return null;
  }

  goToNextItem(): void {
    const cached = this.nextItem();
    const next = cached || this.getNextItem();
    if (!next) { this.nextItem.set(null); this.goBack(); return; }
    const target = next.type === 'CLASS'
      ? ['/alumno/course-detail', this.courseId(), 'class', next.id]
      : ['/alumno/course-detail', this.courseId(), 'questionnaire', next.id];

    // Log navigation attempt for diagnosis. Wait for router result and only clear cache on success.
    try {
      // debug logs removed
      const course = this.courseData();
      if (course && (course.orderedContent || course.classes)) {
        const ordered = Array.isArray(course.orderedContent) ? course.orderedContent : (course.orderedContent && Array.isArray((course.orderedContent as any).items) ? (course.orderedContent as any).items : null);
        // debug logs removed
      }
    } catch (e) { /* ignore */ }

    // Attempt navigation and handle result: only clear cached nextItem if navigation succeeds.
    this.router.navigate(target)
      .then(success => {
        // debug logs removed
        if (success) {
          this.nextItem.set(null);

          // After a short delay, verify router actually updated the route params.
          setTimeout(() => {
            try {
              const routeQid = this.route.snapshot.paramMap.get('questionnaireId');
              const routeCid = this.route.snapshot.paramMap.get('courseId');
              const expectQ = next.type === 'QUESTIONNAIRE' ? String(next.id) : null;
              const expectC = String(this.courseId());
              const routeMismatch = (expectQ && routeQid !== expectQ) || (routeCid !== expectC);
              if (routeMismatch) {
                console.warn('[q-take] navigation appears not applied by router, forcing full reload to target', { routeQid, expectQ, routeCid, expectC });
                const url = next.type === 'CLASS'
                  ? `/alumno/course-detail/${this.courseId()}/class/${next.id}`
                  : `/alumno/course-detail/${this.courseId()}/questionnaire/${next.id}`;
                window.location.href = url;
              }
            } catch (e) { /* ignore */ }
          }, 400);
        } else {
          console.error('[q-take] navigation returned false, restoring nextItem', next);
          try { this.nextItem.set(next); } catch (e) { /* ignore */ }
          this.infoService.showError('No se pudo navegar a la siguiente actividad. Intenta nuevamente.');
        }
      })
      .catch(err => {
        console.error('[questionnaire-take] router.navigate error=', err, 'target=', target);
        try { this.nextItem.set(next); } catch (e) { /* ignore */ }
        this.infoService.showError('Error al navegar a la siguiente actividad.');
      });
  }

  getQuestionNumber(questionId: string): number {
    const questionnaire = this.questionnaire();
    if (!questionnaire) return 0;
    return questionnaire.questions.findIndex(q => q._id === questionId) + 1;
  }

  getScore(): number {
    const submission = this.currentSubmission();
    return submission?.finalScore || submission?.autoGradedScore || 0;
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
    const submission = this.currentSubmission();
    if (!submission) return undefined;
    return submission.answers.find(a => a.questionId === questionId);
  }

  isCorrectOption(questionId: string, optionId: string): boolean {
    const questionnaire = this.questionnaire();
    if (!questionnaire) return false;

    const question = questionnaire.questions.find(q => q._id === questionId);
    return question?.correctOptionId?.toString() === optionId.toString();
  }

  isCorrectMultipleSelectOption(questionId: string, optionId: string): boolean {
    const questionnaire = this.questionnaire();
    if (!questionnaire) return false;

    const question = questionnaire.questions.find(q => q._id === questionId);
    const correctOptionIds = question?.correctOptionIds || [];
    return correctOptionIds.some((id: any) => id.toString() === optionId.toString());
  }

  isMultipleSelectOptionSelectedInAnswer(answer: Answer, optionId: string): boolean {
    const selectedIds = answer.selectedOptionIds || [];
    return selectedIds.some((id: any) => id.toString() === optionId.toString());
  }

  /**
   * Calcula el tiempo transcurrido entre startedAt y submittedAt
   * Retorna el tiempo en formato legible (MM:SS o HH:MM:SS)
   */
  getTimeElapsed(): string | null {
    const submission = this.currentSubmission();
    if (!submission || !submission.startedAt || !submission.submittedAt) {
      return null;
    }

    const startedAt = new Date(submission.startedAt);
    const submittedAt = new Date(submission.submittedAt);
    const diffMs = submittedAt.getTime() - startedAt.getTime();

    if (diffMs < 0) {
      return null; // Datos inválidos
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }
}
