import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CoursesService, Course } from '../../../core/services/courses.service';
import { ViewModeService } from '../../../core/services/view-mode.service';
import { UserRole } from '../../../core/models/user-role.enum';
import { BunnyConfigService } from '../../../core/services/bunny-config.service';
import { InfoService } from '../../../core/services/info.service';

@Component({
  selector: 'app-teacher-courses',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './teacher-courses.component.html',
})
export class TeacherCoursesComponent implements OnInit {
  private authService = inject(AuthService);
  private coursesService = inject(CoursesService);
  private router = inject(Router);
  private viewModeService = inject(ViewModeService);
  private bunnyConfigService = inject(BunnyConfigService);
  private infoService = inject(InfoService);

  user = this.authService.currentUser;
  courses = signal<any[]>([]);
  loading = signal<boolean>(true);

  // Estado del modal de Solicitar Aprobación (TC-10)
  reviewModalOpen = signal<boolean>(false);
  selectedCourseForReview = signal<any | null>(null);
  reviewNotes = signal<string>('');
  submittingReview = signal<boolean>(false);

  ngOnInit(): void {
    this.loadCourses();
  }

  loadCourses(): void {
    const currentUser = this.user();
    if (!currentUser?._id) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);

    if (this.authService.hasRole(UserRole.ADMIN) && this.viewModeService.isProfesorMode()) {
      this.coursesService.getCourses({ page: 1, page_size: 1000 }).subscribe({
        next: (response: any) => {
          const data = response?.data || [];
          const coursesWithEditFlag = Array.isArray(data)
            ? data.map((course: any) => ({ ...course, isMainTeacher: true }))
            : [];
          this.courses.set(coursesWithEditFlag);
          this.loading.set(false);
        },
        error: (error) => {
          console.error('Error loading courses:', error);
          this.courses.set([]);
          this.loading.set(false);
        }
      });
    } else {
      this.coursesService.getTeacherCourses(currentUser._id).subscribe({
        next: (response: any) => {
          const data = response?.data || [];
          this.courses.set(Array.isArray(data) ? data : []);
          this.loading.set(false);
        },
        error: (error) => {
          console.error('Error loading courses:', error);
          this.courses.set([]);
          this.loading.set(false);
        }
      });
    }
  }

  openCourseEdit(course: Course): void {
    this.router.navigate(['/profesor/courses', course._id, 'edit']);
  }

  openReviewModal(event: Event, course: any): void {
    event.stopPropagation();
    this.selectedCourseForReview.set(course);
    this.reviewNotes.set(course?.reviewNotes || '');
    this.reviewModalOpen.set(true);
  }

  closeReviewModal(): void {
    this.reviewModalOpen.set(false);
    this.selectedCourseForReview.set(null);
    this.reviewNotes.set('');
    this.submittingReview.set(false);
  }

  hasCourseName(course: any): boolean {
    return !!course?.name?.trim();
  }

  hasCourseDescription(course: any): boolean {
    return !!course?.description?.trim();
  }

  hasCourseContent(course: any): boolean {
    return (course?.classes?.length ?? 0) > 0 || (course?.modules?.length ?? 0) > 0;
  }

  canSubmitReview(course: any): boolean {
    return this.hasCourseName(course) && this.hasCourseDescription(course) && this.hasCourseContent(course);
  }

  submitReviewRequest(): void {
    const course = this.selectedCourseForReview();
    if (!course?._id || !this.canSubmitReview(course)) return;

    this.submittingReview.set(true);
    this.coursesService.requestReview(course._id, this.reviewNotes().trim()).subscribe({
      next: () => {
        this.infoService.showSuccess('Solicitud de aprobación enviada correctamente. El curso quedó en revisión.');
        this.closeReviewModal();
        this.loadCourses();
      },
      error: (err) => {
        const msg = err?.error?.message || 'Error al solicitar la aprobación del curso';
        this.infoService.showError(msg);
        this.submittingReview.set(false);
      }
    });
  }

  getCourseImageUrl(imageUrl?: string): string {
    return this.bunnyConfigService.getCourseImageUrl(imageUrl);
  }

  formatPrice(price?: number): string {
    if (!price) return 'Gratis';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(price);
  }

  handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }
}