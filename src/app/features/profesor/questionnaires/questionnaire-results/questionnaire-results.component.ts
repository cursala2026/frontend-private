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
  styleUrls: ['./questionnaire-results.component.css']
})
export class QuestionnaireResultsComponent implements OnInit {
  private questionnairesService = inject(QuestionnairesService);
  private infoService = inject(InfoService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  questionnaireId = '';
  questionnaire = signal<Questionnaire | null>(null);
  gradeReport = signal<GradeReportEntry[]>([]);
  pendingSubmissions = signal<QuestionnaireSubmission[]>([]);

  loading = signal<boolean>(true);
  loadingPending = signal<boolean>(false);

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
        this.loadPendingSubmissions();
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
        this.gradeReport.set(response?.data || []);
      },
      error: (error) => {
        console.error('Error loading grade report:', error);
        this.infoService.showError('Error al cargar el reporte de calificaciones');
      }
    });
  }

  loadPendingSubmissions(): void {
    this.loadingPending.set(true);
    this.questionnairesService.getPendingGrading(this.questionnaireId).subscribe({
      next: (response) => {
        this.pendingSubmissions.set(response?.data || []);
        this.loadingPending.set(false);
      },
      error: (error) => {
        console.error('Error loading pending submissions:', error);
        this.infoService.showError('Error al cargar envíos pendientes');
        this.loadingPending.set(false);
      }
    });
  }

  viewSubmission(studentId: string): void {
    this.questionnairesService.getStudentSubmissions(this.questionnaireId, studentId).subscribe({
      next: (response) => {
        const submissions = response?.data || [];
        if (submissions.length > 0) {
          // Get best submission or latest
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
        this.loadPendingSubmissions();
        this.savingGrade.set(false);
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

  resetStudentAttempts(studentId: string): void {
    this.studentIdToReset = studentId;
    this.showResetConfirmModal.set(true);
  }

  onConfirmReset(): void {
    if (!this.studentIdToReset) return;

    this.questionnairesService.resetStudentAttempts(this.questionnaireId, this.studentIdToReset).subscribe({
      next: (response) => {
        this.infoService.showSuccess('Intentos del estudiante reseteados exitosamente');
        // Recargar los datos
        this.loadGradeReport();
        this.loadPendingSubmissions();
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
}
