import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule, FormsModule],
  templateUrl: './questionnaire-take.component.html',
})
export class QuestionnaireTakeComponent implements OnInit {
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

  // State
  loading = signal<boolean>(true);
  submitting = signal<boolean>(false);
  showResults = signal<boolean>(false);
  canRetry = signal<boolean>(false);

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.courseId.set(params['courseId']);
      this.questionnaireId.set(params['questionnaireId']);
      this.loadQuestionnaire();
    });
  }

  loadQuestionnaire(): void {
    const qId = this.questionnaireId();
    const cId = this.courseId();

    // Load course data to find next class
    this.coursesService.getCourseById(cId).subscribe({
      next: (response: any) => {
        const course = response?.data || response;
        this.courseData.set(course);
      },
      error: (err: any) => {
        console.error('Error loading course:', err);
      }
    });

    this.questionnairesService.getQuestionnaireById(qId).subscribe({
      next: (response) => {
        const questionnaire = response?.data;
        this.questionnaire.set(questionnaire);

        // Load previous submissions first, then check/start submission
        this.loadPreviousSubmissions();
      },
      error: (error) => {
        console.error('Error loading questionnaire:', error);
        this.infoService.showError('Error al cargar el cuestionario');
        this.goBack();
      }
    });
  }

  loadPreviousSubmissions(): void {
    const user = this.authService.currentUser();
    if (!user) return;

    this.questionnairesService.getStudentSubmissions(this.questionnaireId(), user._id).subscribe({
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
      this.currentSubmission.set(graded);
      this.showResults.set(true);
      return;
    }

    // Check if there's a submitted (pending grading) submission
    const submitted = sortedSubmissions.find(s => s.status === 'SUBMITTED');
    if (submitted) {
      // Always show results for submitted (pending grading) submissions
      this.currentSubmission.set(submitted);
      this.showResults.set(true);
      return;
    }

    // Check if the MOST RECENT submission is in-progress
    const mostRecent = sortedSubmissions[0];
    if (mostRecent && mostRecent.status === 'IN_PROGRESS') {
      // Resume existing submission
      this.currentSubmission.set(mostRecent);
      this.loadAnswersFromSubmission(mostRecent);
      this.showResults.set(false);
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
        this.currentSubmission.set(submission);
        this.showResults.set(false); // Ensure we show the form, not results
        this.initializeAnswers();
      },
      error: (error) => {
        console.error('Error starting submission:', error);

        // Check if error is about retry limits
        const errorMsg = error?.error?.message || '';
        if (errorMsg.includes('retry') || errorMsg.includes('exceeded') || errorMsg.includes('not allowed')) {
          this.infoService.showError('Ya no tienes más intentos disponibles para este cuestionario');
        } else {
          this.infoService.showError(errorMsg || 'Error al iniciar el cuestionario');
        }

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
    });
  }

  loadAnswersFromSubmission(submission: QuestionnaireSubmission): void {
    submission.answers.forEach(answer => {
      this.answers[answer.questionId] = answer;
    });
  }

  onMultipleChoiceChange(questionId: string, optionId: string): void {
    this.answers[questionId] = {
      questionId,
      questionType: 'MULTIPLE_CHOICE',
      selectedOptionId: optionId
    };
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
            (question.type === 'TEXT' && !answer.textAnswer?.trim())) {
          this.infoService.showError(`La pregunta "${question.questionText}" es obligatoria`);
          return;
        }
      }
    }

    this.submitting.set(true);

    const answersArray: Answer[] = Object.values(this.answers).filter(a =>
      (a.questionType === 'MULTIPLE_CHOICE' && a.selectedOptionId) ||
      (a.questionType === 'TEXT' && a.textAnswer)
    );

    this.questionnairesService.submitAnswers(submission._id!, answersArray).subscribe({
      next: (response) => {
        const updatedSubmission = response?.data;
        this.currentSubmission.set(updatedSubmission);
        this.showResults.set(true);
        this.submitting.set(false);

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
        this.infoService.showError('Error al enviar el cuestionario');
        this.submitting.set(false);
      }
    });
  }

  updateCourseProgress(submission: QuestionnaireSubmission): void {
    // Update progress if the submission is graded (auto-graded for MC)
    const questionnaire = this.questionnaire();
    if (!questionnaire) return;

    const score = submission.finalScore || submission.autoGradedScore || 0;
    const passed = questionnaire.passingScore ? score >= questionnaire.passingScore : true;

    // The backend should handle updating courseProgress, but we can trigger a reload
    // of the course detail when user goes back
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
}
