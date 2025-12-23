import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { QuestionnairesService, Questionnaire } from '../../../core/services/questionnaires.service';
import { CoursesService } from '../../../core/services/courses.service';
import { AuthService } from '../../../core/services/auth.service';
import { InfoService } from '../../../core/services/info.service';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';

interface Course {
  _id: string;
  name: string;
}

@Component({
  selector: 'app-teacher-questionnaires',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmModalComponent],
  templateUrl: './teacher-questionnaires.component.html',
})
export class TeacherQuestionnairesComponent implements OnInit {
  private questionnairesService = inject(QuestionnairesService);
  private coursesService = inject(CoursesService);
  private authService = inject(AuthService);
  private infoService = inject(InfoService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  user = this.authService.currentUser;
  questionnaires = signal<Questionnaire[]>([]);
  courses = signal<Course[]>([]);
  selectedCourseId = '';

  loading = signal<boolean>(true);
  loadingQuestionnaires = signal<boolean>(false);

  // Delete modal
  showDeleteModal = signal<boolean>(false);
  questionnaireToDelete: Questionnaire | null = null;

  deleteModalConfig = {
    title: 'Eliminar Cuestionario',
    message: '¿Estás seguro de que deseas eliminar este cuestionario?',
    confirmText: 'Eliminar',
    cancelText: 'Cancelar',
    confirmClass: 'bg-red-600 hover:bg-red-700'
  };

  ngOnInit(): void {
    this.loadCourses();

    // Check for courseId in query params
    this.route.queryParams.subscribe(params => {
      if (params['courseId']) {
        this.selectedCourseId = params['courseId'];
        this.loadQuestionnairesByCourse(this.selectedCourseId);
      }
    });
  }

  loadCourses(): void {
    const currentUser = this.user();
    if (!currentUser) {
      this.loading.set(false);
      return;
    }

    this.coursesService.getTeacherCourses(currentUser._id).subscribe({
      next: (response) => {
        this.courses.set(response?.data || []);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading courses:', error);
        this.infoService.showError('Error al cargar los cursos');
        this.loading.set(false);
      }
    });
  }

  onCourseChange(): void {
    if (this.selectedCourseId) {
      // Update URL with query param
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { courseId: this.selectedCourseId },
        queryParamsHandling: 'merge'
      });

      this.loadQuestionnairesByCourse(this.selectedCourseId);
    } else {
      // Clear query param
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {}
      });
      this.questionnaires.set([]);
    }
  }

  loadQuestionnairesByCourse(courseId: string): void {
    this.loadingQuestionnaires.set(true);

    this.questionnairesService.getQuestionnairesByCourse(courseId).subscribe({
      next: (response) => {
        this.questionnaires.set(response?.data || []);
        this.loadingQuestionnaires.set(false);
      },
      error: (error) => {
        console.error('Error loading questionnaires:', error);
        this.infoService.showError('Error al cargar los cuestionarios');
        this.loadingQuestionnaires.set(false);
      }
    });
  }

  openQuestionnaireEdit(questionnaire?: Questionnaire): void {
    if (questionnaire) {
      this.router.navigate(['/profesor/questionnaires', questionnaire._id, 'edit']);
    } else {
      // Create new questionnaire with pre-selected course
      this.router.navigate(['/profesor/questionnaires/new'], {
        queryParams: { courseId: this.selectedCourseId }
      });
    }
  }

  viewResults(questionnaire: Questionnaire): void {
    this.router.navigate(['/profesor/questionnaires', questionnaire._id, 'results']);
  }

  confirmDelete(event: Event, questionnaire: Questionnaire): void {
    event.stopPropagation();
    this.questionnaireToDelete = questionnaire;
    this.deleteModalConfig.message = `¿Estás seguro de que deseas eliminar el cuestionario "${questionnaire.title}"? Esta acción no se puede deshacer.`;
    this.showDeleteModal.set(true);
  }

  deleteQuestionnaire(): void {
    if (!this.questionnaireToDelete) return;

    const id = this.questionnaireToDelete._id!;

    this.questionnairesService.deleteQuestionnaire(id).subscribe({
      next: () => {
        this.infoService.showSuccess('Cuestionario eliminado exitosamente');
        this.showDeleteModal.set(false);
        this.questionnaireToDelete = null;
        // Reload questionnaires
        if (this.selectedCourseId) {
          this.loadQuestionnairesByCourse(this.selectedCourseId);
        }
      },
      error: (error) => {
        console.error('Error deleting questionnaire:', error);
        const errorMsg = error?.error?.message || 'Error al eliminar el cuestionario. Puede que tenga envíos de estudiantes.';
        this.infoService.showError(errorMsg);
        this.showDeleteModal.set(false);
      }
    });
  }

  cancelDelete(): void {
    this.showDeleteModal.set(false);
    this.questionnaireToDelete = null;
  }

  getPositionText(questionnaire: Questionnaire): string {
    if (questionnaire.position.type === 'FINAL_EXAM') {
      return 'Examen Final';
    } else {
      return 'Entre Clases';
    }
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'INACTIVE':
        return 'bg-gray-100 text-gray-800';
      case 'DRAFT':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'Activo';
      case 'INACTIVE':
        return 'Inactivo';
      case 'DRAFT':
        return 'Borrador';
      default:
        return status;
    }
  }
}
