import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CoursesService, Course } from '../../../core/services/courses.service';
import { CourseProgressService, CourseProgress } from '../../../core/services/course-progress.service';
import { InfoService } from '../../../core/services/info.service';
import { AuthService } from '../../../core/services/auth.service';
import { EnrollModalComponent } from '../../../shared/components/enroll-modal/enroll-modal.component';
import { UnenrollModalComponent } from '../../../shared/components/unenroll-modal/unenroll-modal.component';

@Component({
  selector: 'app-course-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, EnrollModalComponent, UnenrollModalComponent],
  templateUrl: './course-detail.component.html',
})
export class CourseDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private coursesService = inject(CoursesService);
  private progressService = inject(CourseProgressService);
  private info = inject(InfoService);
  private authService = inject(AuthService);

  course = signal<Course | null>(null);
  courseProgress = signal<CourseProgress | null>(null);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  showEnrollModal = signal<boolean>(false);
  showUnenrollModal = signal<boolean>(false);
  isEnrolling = signal<boolean>(false);
  isUnenrolling = signal<boolean>(false);
  enrollError = signal<string | null>(null);

  currentUser = this.authService.currentUser;
  isEnrolled = computed(() => {
    const course = this.course();
    const user = this.currentUser();
    
    if (!course || !user) return false;
    
    // Verificar si el usuario está en el array de estudiantes
    const students = course.students || [];
    return students.some((student: any) => {
      const studentId = typeof student === 'string' ? student : student._id || student;
      return studentId === user._id;
    });
  });

  ngOnInit(): void {
    const courseId = this.route.snapshot.paramMap.get('courseId');
    if (courseId) {
      this.loadCourse(courseId);
    } else {
      this.error.set('ID de curso no válido');
      this.loading.set(false);
    }
  }

  loadCourse(courseId: string): void {
    this.loading.set(true);
    this.error.set(null);
    
    this.coursesService.getCourseById(courseId).subscribe({
      next: (response: any) => {
        const courseData = response?.data || response;
        this.course.set(courseData);
        this.loading.set(false);
        
        // Cargar progreso del curso si el usuario está inscrito
        if (this.isEnrolled()) {
          this.loadCourseProgress(courseId);
        }
      },
      error: (error) => {
        console.error('Error loading course:', error);
        this.error.set('No se pudo cargar el curso. Por favor, intenta nuevamente.');
        this.loading.set(false);
      }
    });
  }

  loadCourseProgress(courseId: string): void {
    this.progressService.getProgress(courseId).subscribe({
      next: (response: any) => {
        const progress = response?.data || response;
        this.courseProgress.set(progress);
      },
      error: (error) => {
        console.error('Error loading course progress:', error);
      }
    });
  }

  /**
   * Verifica si una clase está completada
   */
  isClassCompleted(classId: string): boolean {
    const progress = this.courseProgress();
    if (!progress || !progress.classesProgress) return false;
    
    const classProgress = progress.classesProgress.find(cp => cp.classId === classId);
    return classProgress?.completed || false;
  }

  /**
   * Verifica si el usuario puede acceder a una clase específica.
   * Solo puede acceder si completó todas las clases anteriores.
   */
  canAccessClass(classIndex: number): boolean {
    // La primera clase siempre está disponible
    if (classIndex === 0) return true;
    
    const courseData = this.course();
    if (!courseData || !courseData.classes) return false;
    
    // Verificar que todas las clases anteriores estén completadas
    for (let i = 0; i < classIndex; i++) {
      const prevClass = courseData.classes[i];
      if (!this.isClassCompleted(prevClass._id!)) {
        return false;
      }
    }
    
    return true;
  }

  getCourseImageUrl(imageUrl?: string): string {
    if (!imageUrl) return '';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    return `https://cursala.b-cdn.net/course-images/${imageUrl}`;
  }

  getTeacherImageUrl(imageUrl?: string): string {
    if (!imageUrl) return '';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    // Codificar el nombre del archivo para manejar caracteres especiales
    const encodedFileName = encodeURIComponent(imageUrl);
    return `https://cursala.b-cdn.net/profile-images/${encodedFileName}`;
  }

  handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    // Mostrar el placeholder si existe
    const placeholder = img.nextElementSibling as HTMLElement;
    if (placeholder) {
      placeholder.style.display = 'flex';
    }
  }

  formatPrice(price?: number): string {
    if (!price) return 'Gratis';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(price);
  }

  formatDate(date?: Date | string): string {
    if (!date) return '';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(dateObj);
  }

  goBack(): void {
    this.router.navigate(['/alumno']);
  }

  openEnrollModal(): void {
    const courseData = this.course();
    if (courseData && (!courseData.price || courseData.price === 0)) {
      this.showEnrollModal.set(true);
      this.enrollError.set(null);
    }
  }

  closeEnrollModal(): void {
    this.showEnrollModal.set(false);
  }

  openUnenrollModal(): void {
    this.showUnenrollModal.set(true);
  }

  closeUnenrollModal(): void {
    this.showUnenrollModal.set(false);
  }

  confirmEnroll(): void {
    const courseData = this.course();
    if (!courseData || !courseData._id) {
      this.enrollError.set('Información del curso inválida');
      return;
    }

    this.isEnrolling.set(true);
    this.enrollError.set(null);

    this.coursesService.enrollInCourse(courseData._id).subscribe({
      next: (response: any) => {
        this.isEnrolling.set(false);
        this.showEnrollModal.set(false);
        
        // Mostrar mensaje de éxito con toast
        this.info.showSuccess('¡Inscripción completada! Ya estás inscrito en este curso.');
        
        // Redirigir a "Mis Cursos"
        this.router.navigate(['/alumno/courses']);
      },
      error: (error) => {
        console.error('Error enrolling in course:', error);
        this.isEnrolling.set(false);
        
        let errorMessage = 'Error al inscribirse en el curso. Por favor, intenta nuevamente.';
        if (error?.error?.message) {
          errorMessage = error.error.message;
        }
        
        this.enrollError.set(errorMessage);
      }
    });
  }

  confirmUnenroll(): void {
    const courseData = this.course();
    if (!courseData || !courseData._id) {
      this.info.showError('Información del curso inválida');
      return;
    }

    this.isUnenrolling.set(true);

    this.coursesService.unenrollFromCourse(courseData._id).subscribe({
      next: (response: any) => {
        this.isUnenrolling.set(false);
        this.showUnenrollModal.set(false);
        
        // Mostrar mensaje de éxito con toast
        this.info.showSuccess('¡Te has desinscrito del curso exitosamente!');
        
        // Redirigir a "Mis Cursos"
        this.router.navigate(['/alumno/courses']);
      },
      error: (error) => {
        console.error('Error unenrolling from course:', error);
        this.isUnenrolling.set(false);
        
        let errorMessage = 'Error al desinscribirse del curso. Por favor, intenta nuevamente.';
        if (error?.error?.message) {
          errorMessage = error.error.message;
        }
        
        this.info.showError(errorMessage);
      }
    });
  }

  beginCourse(): void {
    const courseData = this.course();
    if (!courseData || !courseData._id || !courseData.classes || courseData.classes.length === 0) {
      this.info.showError('No hay clases disponibles');
      return;
    }

    // Si hay progreso, ir a la última clase en progreso o la siguiente no completada
    const progress = this.courseProgress();
    if (progress && progress.currentClassId) {
      // Ir a la clase actual
      this.router.navigate(['/alumno/course-detail', courseData._id, 'class', progress.currentClassId]);
      return;
    }

    // Si no hay progreso, buscar la primera clase no completada
    if (progress && progress.classesProgress && progress.classesProgress.length > 0) {
      for (let i = 0; i < courseData.classes.length; i++) {
        const cls = courseData.classes[i];
        if (!this.isClassCompleted(cls._id!)) {
          this.router.navigate(['/alumno/course-detail', courseData._id, 'class', cls._id]);
          return;
        }
      }
    }

    // Si no hay progreso, ir a la primera clase
    const firstClass = courseData.classes[0];
    this.router.navigate(['/alumno/course-detail', courseData._id, 'class', firstClass._id]);
  }

  /**
   * Verifica si el curso tiene algún progreso
   */
  hasProgress(): boolean {
    const progress = this.courseProgress();
    return progress !== null && progress.classesProgress && progress.classesProgress.length > 0;
  }

  /**
   * Obtiene el número de clases completadas
   */
  getCompletedClassesCount(): number {
    const progress = this.courseProgress();
    if (!progress || !progress.classesProgress) return 0;
    return progress.classesProgress.filter(cp => cp.completed).length;
  }

  /**
   * Obtiene el progreso general del curso
   */
  getOverallProgress(): number {
    const progress = this.courseProgress();
    return progress?.overallProgress || 0;
  }

  goToClass(classData: any, classIndex: number): void {
    const course = this.course();
    if (!course || !course._id) {
      this.info.showError('Información del curso inválida');
      return;
    }

    const classId = classData._id;
    if (!classId) {
      this.info.showError('Información de la clase inválida');
      return;
    }

    // Verificar si puede acceder a esta clase
    if (!this.canAccessClass(classIndex)) {
      this.info.showInfo('Debes completar las clases anteriores para acceder a esta clase');
      return;
    }

    this.router.navigate(['/alumno/course-detail', course._id, 'class', classId]);
  }
}

