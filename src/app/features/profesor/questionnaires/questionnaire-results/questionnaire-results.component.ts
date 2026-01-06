import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  QuestionnairesService,
  Questionnaire,
  QuestionnaireSubmission,
  GradeReportEntry
} from '../../../../core/services/questionnaires.service';
import { InfoService } from '../../../../core/services/info.service';
import { ConfirmModalComponent, ConfirmModalConfig } from '../../../../shared/components/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-questionnaire-results',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmModalComponent],
  templateUrl: './questionnaire-results.component.html',
})
export class QuestionnaireResultsComponent implements OnInit {
  private questionnairesService = inject(QuestionnairesService);
  private infoService = inject(InfoService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  questionnaireId = '';
  questionnaire = signal<Questionnaire | null>(null);
  allSubmissions = signal<QuestionnaireSubmission[]>([]);
  gradeReport = signal<GradeReportEntry[]>([]);
  pendingSubmissions = signal<QuestionnaireSubmission[]>([]);

  loading = signal<boolean>(true);

  // For grading modal
  showGradingModal = signal<boolean>(false);
  currentSubmission = signal<QuestionnaireSubmission | null>(null);
  gradingAnswers: { [questionId: string]: { points: number; feedback: string } } = {};
  overallFeedback = '';
  savingGrade = signal<boolean>(false);

  // For reset attempts confirmation modal
  showResetConfirmModal = signal<boolean>(false);
  studentIdToReset: string | null = null;
  resetConfirmConfig: ConfirmModalConfig = {
    title: 'Resetear Intentos del Estudiante',
    message: '¿Estás seguro de que deseas resetear los intentos de este estudiante?\n\nEsta acción eliminará todas sus submissions y no se puede deshacer.',
    confirmText: 'Resetear',
    cancelText: 'Cancelar',
    icon: 'danger',
    confirmButtonClass: 'bg-red-600 hover:bg-red-700'
  };

  // View state
  activeTab: 'report' | 'pending' = 'report';

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.questionnaireId = params['id'];
        this.loadQuestionnaire();
        this.loadGradeReport();
      } else {
        this.router.navigate(['/profesor/questionnaires']);
      }
    });
  }

  loadQuestionnaire(): void {
    this.questionnairesService.getQuestionnaireById(this.questionnaireId).subscribe({
      next: (response) => {
        const questionnaire = response?.data;
        this.questionnaire.set(questionnaire);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading questionnaire:', error);
        this.infoService.showError('Error al cargar el cuestionario');
        this.router.navigate(['/profesor/questionnaires']);
      }
    });
  }

  loadGradeReport(): void {
    this.questionnairesService.getGradeReport(this.questionnaireId).subscribe({
      next: (response) => {
        const allSubmissions = response?.data || [];
        this.allSubmissions.set(allSubmissions);

        // Filtrar pendientes de calificar (estado SUBMITTED)
        const pending = allSubmissions.filter((s: QuestionnaireSubmission) => s.status === 'SUBMITTED');
        this.pendingSubmissions.set(pending);

        // Filtrar calificados (estado GRADED) - estos van al grade report
        const graded = allSubmissions.filter((s: QuestionnaireSubmission) => s.status === 'GRADED');

        // Crear el reporte agrupado por estudiante
        const reportMap = new Map<string, GradeReportEntry>();

        graded.forEach((submission: QuestionnaireSubmission) => {
          const studentId = submission.studentId;

          if (!reportMap.has(studentId)) {
            reportMap.set(studentId, {
              studentId: studentId,
              studentName: submission.studentName || 'Sin nombre',
              studentEmail: submission.studentEmail || '',
              profilePhotoUrl: submission.profilePhotoUrl,
              attemptCount: 0,
              bestScore: null,
              lastAttempt: null,
              allSubmissions: []
            });
          }

          const entry = reportMap.get(studentId)!;
          entry.allSubmissions.push(submission);
          entry.attemptCount = entry.allSubmissions.length;

          const score = submission.finalScore || submission.autoGradedScore || 0;
          if (entry.bestScore === null || score > entry.bestScore) {
            entry.bestScore = score;
          }

          const submittedAt = submission.submittedAt ? new Date(submission.submittedAt) : null;
          if (submittedAt && (!entry.lastAttempt || submittedAt > new Date(entry.lastAttempt))) {
            entry.lastAttempt = submittedAt;
          }
        });

        this.gradeReport.set(Array.from(reportMap.values()));
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading grade report:', error);
        this.infoService.showError('Error al cargar el reporte de calificaciones');
        this.loading.set(false);
      }
    });
  }

  viewSubmission(studentId: string): void {
    this.questionnairesService.getStudentSubmissions(this.questionnaireId, studentId).subscribe({
      next: (response) => {
        const submissions = response?.data || [];
        if (submissions.length > 0) {
          const bestSubmission = submissions.reduce((best: QuestionnaireSubmission, current: QuestionnaireSubmission) => {
            const currentScore = current.finalScore || current.autoGradedScore || 0;
            const bestScore = best.finalScore || best.autoGradedScore || 0;
            return currentScore > bestScore ? current : best;
          });
          this.openGradingModal(bestSubmission);
        }
      },
      error: (error) => {
        console.error('Error loading student submissions:', error);
        this.infoService.showError('Error al cargar las respuestas del estudiante');
      }
    });
  }

  openGradingModal(submission: QuestionnaireSubmission): void {
    this.setCurrentSubmissionAndOpenModal(submission);
  }

  private setCurrentSubmissionAndOpenModal(submission: QuestionnaireSubmission): void {
    this.currentSubmission.set(submission);
    this.gradingAnswers = {};
    this.overallFeedback = submission.feedback || '';

    // Initialize grading answers for text questions
    const questionnaire = this.questionnaire();
    if (questionnaire) {
      submission.answers.forEach(answer => {
        if (answer.questionType === 'TEXT') {
          this.gradingAnswers[answer.questionId.toString()] = {
            points: answer.pointsAwarded || 0,
            feedback: answer.feedback || ''
          };
        }
      });
    }

    this.showGradingModal.set(true);
  }

  closeGradingModal(): void {
    this.showGradingModal.set(false);
    this.currentSubmission.set(null);
    this.gradingAnswers = {};
    this.overallFeedback = '';
  }

  saveGrade(): void {
    const submission = this.currentSubmission();
    if (!submission) return;

    // Build graded answers array
    const gradedAnswers = Object.entries(this.gradingAnswers).map(([questionId, grading]) => ({
      questionId,
      points: grading.points,
      feedback: grading.feedback
    }));

    this.savingGrade.set(true);

    this.questionnairesService.gradeTextQuestions(
      submission._id!,
      gradedAnswers,
      this.overallFeedback
    ).subscribe({
      next: () => {
        this.infoService.showSuccess('Calificación guardada exitosamente');
        this.closeGradingModal();
        this.loadGradeReport();
        this.savingGrade.set(false);
        // Forzar actualización de la notificación en el layout
        setTimeout(() => {
          window.dispatchEvent(new Event('exam-graded'));
        }, 500);
      },
      error: (error) => {
        console.error('Error saving grade:', error);
        this.infoService.showError('Error al guardar la calificación');
        this.savingGrade.set(false);
      }
    });
  }

  getQuestionById(questionId: string) {
    const questionnaire = this.questionnaire();
    if (!questionnaire) return null;
    return questionnaire.questions.find(q => q._id?.toString() === questionId.toString());
  }

  getAnswerForQuestion(submission: QuestionnaireSubmission, questionId: string) {
    return submission.answers.find(a => a.questionId.toString() === questionId.toString());
  }

  getOptionText(question: any, optionId: string): string {
    if (!question.options) return '';
    const option = question.options.find((opt: any) => opt._id?.toString() === optionId.toString());
    return option?.text || '';
  }

  isCorrectOption(question: any, optionId: string): boolean {
    return question.correctOptionId?.toString() === optionId.toString();
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'GRADED':
        return 'bg-green-100 text-green-800';
      case 'SUBMITTED':
        return 'bg-yellow-100 text-yellow-800';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'GRADED':
        return 'Calificado';
      case 'SUBMITTED':
        return 'Enviado';
      case 'IN_PROGRESS':
        return 'En Progreso';
      default:
        return status;
    }
  }

  getScoreColor(score: number): string {
    const passingScore = this.questionnaire()?.passingScore || 0;
    if (score >= passingScore) {
      return 'text-green-600';
    } else {
      return 'text-red-600';
    }
  }

  getStudentImageUrl(profilePhotoUrl?: string): string {
    if (!profilePhotoUrl) return '';
    if (profilePhotoUrl.startsWith('http://') || profilePhotoUrl.startsWith('https://')) {
      return profilePhotoUrl;
    }
    return `https://cursala.b-cdn.net/profile-images/${encodeURIComponent(profilePhotoUrl)}`;
  }

  handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }

  goBack(): void {
    const courseId = this.questionnaire()?.courseId;
    this.router.navigate(['/profesor/questionnaires'], {
      queryParams: courseId ? { courseId } : {}
    });
  }

  hasTextQuestions(): boolean {
    const questionnaire = this.questionnaire();
    if (!questionnaire) return false;
    return questionnaire.questions.some(q => q.type === 'TEXT');
  }

  changeTab(tab: 'report' | 'pending'): void {
    this.activeTab = tab;
  }

  resetStudentAttempts(studentId: any): void {
    // Normalize studentId: accept string or object containing _id
    let id: string | null = null;
    if (studentId == null) {
      id = null;
    } else if (typeof studentId === 'string') {
      id = studentId;
    } else if (typeof studentId === 'object') {
      // Common case: Mongo ObjectId wrapper or object with _id
      if ((studentId as any)._id) {
        id = (studentId as any)._id?.toString() || null;
      } else if ((studentId as any).toString && typeof (studentId as any).toString === 'function') {
        id = (studentId as any).toString();
      } else {
        id = null;
      }
    } else {
      id = String(studentId);
    }

    this.studentIdToReset = id;
    this.showResetConfirmModal.set(true);
  }

  onConfirmReset(): void {
    if (!this.studentIdToReset) return;

    const studentId = this.studentIdToReset;

    this.questionnairesService.resetStudentAttempts(this.questionnaireId, studentId).subscribe({
      next: (response) => {
        this.infoService.showSuccess('Intentos del estudiante reseteados exitosamente');
        // Recargar los datos
        this.loadGradeReport();
        this.showResetConfirmModal.set(false);
        this.studentIdToReset = null;
      },
      error: (error) => {
        console.error('Error resetting student attempts:', error);
        this.infoService.showError('Error al resetear los intentos del estudiante');
        this.showResetConfirmModal.set(false);
        this.studentIdToReset = null;
      }
    });
  }

  onCancelReset(): void {
    this.showResetConfirmModal.set(false);
    this.studentIdToReset = null;
  }

  /**
   * Calcula el tiempo transcurrido entre startedAt y submittedAt
   * Retorna el tiempo en formato legible (MM:SS o HH:MM:SS)
   */
  getTimeElapsed(submission: QuestionnaireSubmission): string | null {
    if (!submission.startedAt || !submission.submittedAt) {
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

  /**
   * Obtiene el tiempo transcurrido en minutos (número)
   */
  getTimeElapsedMinutes(submission: QuestionnaireSubmission): number | null {
    if (!submission.startedAt || !submission.submittedAt) {
      return null;
    }

    const startedAt = new Date(submission.startedAt);
    const submittedAt = new Date(submission.submittedAt);
    const diffMs = submittedAt.getTime() - startedAt.getTime();

    if (diffMs < 0) {
      return null;
    }

    return Math.round(diffMs / (1000 * 60));
  }

  /**
   * Obtiene el tiempo transcurrido del mejor intento de un estudiante
   */
  getBestAttemptTime(entry: GradeReportEntry): string | null {
    if (!entry.allSubmissions || entry.allSubmissions.length === 0) {
      return null;
    }

    // Encontrar la submission con el mejor score
    const bestSubmission = entry.allSubmissions.reduce((best, current) => {
      const currentScore = current.finalScore || current.autoGradedScore || 0;
      const bestScore = best.finalScore || best.autoGradedScore || 0;
      return currentScore > bestScore ? current : best;
    });

    return this.getTimeElapsed(bestSubmission);
  }
}
