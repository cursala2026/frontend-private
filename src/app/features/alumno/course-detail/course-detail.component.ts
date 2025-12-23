import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { CoursesService, Course } from '../../../core/services/courses.service';
import { CourseProgressService, CourseProgress } from '../../../core/services/course-progress.service';
import { QuestionnairesService, Questionnaire } from '../../../core/services/questionnaires.service';
import { InfoService } from '../../../core/services/info.service';
import { AuthService } from '../../../core/services/auth.service';
import { EnrollModalComponent } from '../../../shared/components/enroll-modal/enroll-modal.component';
import { UnenrollModalComponent } from '../../../shared/components/unenroll-modal/unenroll-modal.component';

interface CourseItem {
  type: 'class' | 'questionnaire';
  data: any;
  index: number;
}

@Component({
  selector: 'app-course-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, EnrollModalComponent, UnenrollModalComponent],
  templateUrl: './course-detail.component.html',
})
export class CourseDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private routerSubscription?: Subscription;
  private coursesService = inject(CoursesService);
  private progressService = inject(CourseProgressService);
  private questionnairesService = inject(QuestionnairesService);
  private info = inject(InfoService);
  private authService = inject(AuthService);

  course = signal<Course | null>(null);
  courseProgress = signal<CourseProgress | null>(null);
  questionnaires = signal<Questionnaire[]>([]);
  courseItems = signal<CourseItem[]>([]);
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
    // Load course initially
    const courseId = this.route.snapshot.paramMap.get('courseId');
    if (courseId) {
      this.loadCourse(courseId);
    } else {
      this.error.set('ID de curso no válido');
      this.loading.set(false);
    }

    // Reload course data when navigating back from child routes (questionnaire/class)
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        // Check if we navigated back to this course detail page
        if (event.url.includes('/alumno/course-detail/') && !event.url.includes('/class/') && !event.url.includes('/questionnaire/')) {
          const currentCourseId = this.route.snapshot.paramMap.get('courseId');
          if (currentCourseId) {
            // Reload course progress to reflect any changes from completing classes/questionnaires
            this.loadCourseProgress(currentCourseId);
          }
        }
      });
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
  }

  loadCourse(courseId: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.coursesService.getCourseById(courseId).subscribe({
      next: (response: any) => {
        const courseData = response?.data || response;
        this.course.set(courseData);

        // Cargar cuestionarios del curso
        this.loadQuestionnaires(courseId);

        // Cargar progreso del curso si el usuario está inscrito
        if (this.isEnrolled()) {
          this.loadCourseProgress(courseId);
        } else {
          this.loading.set(false);
        }
      },
      error: (error) => {
        console.error('Error loading course:', error);
        this.error.set('No se pudo cargar el curso. Por favor, intenta nuevamente.');
        this.loading.set(false);
      }
    });
  }

  loadQuestionnaires(courseId: string): void {
    this.questionnairesService.getQuestionnairesByCourse(courseId).subscribe({
      next: (response: any) => {
        const questionnaires = response?.data || [];
        // Solo mostrar cuestionarios activos
        this.questionnaires.set(questionnaires.filter((q: Questionnaire) => q.status === 'ACTIVE'));
        this.buildCourseItems();
      },
      error: (error) => {
        console.error('Error loading questionnaires:', error);
        // No mostrar error, simplemente continuar sin cuestionarios
        this.questionnaires.set([]);
        this.buildCourseItems();
      }
    });
  }

  buildCourseItems(): void {
    const course = this.course();
    const questionnaires = this.questionnaires();

    if (!course || !course.classes) {
      this.courseItems.set([]);
      return;
    }

    const items: CourseItem[] = [];
    const classes = course.classes || [];

    // Ordenar clases por order
    const sortedClasses = [...classes].sort((a: any, b: any) => a.order - b.order);

    // Insertar clases y cuestionarios en orden
    sortedClasses.forEach((classData: any, index: number) => {
      // Agregar la clase
      items.push({
        type: 'class',
        data: classData,
        index: items.length
      });

      // Buscar cuestionarios que van después de esta clase
      const questionnairesAfterClass = questionnaires.filter(q =>
        q.position.type === 'BETWEEN_CLASSES' &&
        q.position.afterClassId === classData._id
      );

      // Agregar cuestionarios después de la clase
      questionnairesAfterClass.forEach(quest => {
        items.push({
          type: 'questionnaire',
          data: quest,
          index: items.length
        });
      });
    });

    // Agregar cuestionarios finales (exámenes)
    const finalExams = questionnaires.filter(q => q.position.type === 'FINAL_EXAM');
    finalExams.forEach(quest => {
      items.push({
        type: 'questionnaire',
        data: quest,
        index: items.length
      });
    });

    this.courseItems.set(items);
  }

  loadCourseProgress(courseId: string): void {
    this.progressService.getProgress(courseId).subscribe({
      next: (response: any) => {
        const progress = response?.data || response;
        this.courseProgress.set(progress);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading course progress:', error);
        this.loading.set(false);
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
    const items = this.courseItems();

    if (!courseData || !courseData._id || items.length === 0) {
      this.info.showError('No hay contenido disponible');
      return;
    }

    // Buscar el primer item (clase o cuestionario) no completado
    for (const item of items) {
      if (item.type === 'class') {
        if (!this.isClassCompleted(item.data._id)) {
          this.router.navigate(['/alumno/course-detail', courseData._id, 'class', item.data._id]);
          return;
        }
      } else if (item.type === 'questionnaire') {
        if (!this.isQuestionnaireCompleted(item.data._id)) {
          this.router.navigate(['/alumno/course-detail', courseData._id, 'questionnaire', item.data._id]);
          return;
        }
      }
    }

    // Si todo está completado, ir al primer item
    const firstItem = items[0];
    if (firstItem.type === 'class') {
      this.router.navigate(['/alumno/course-detail', courseData._id, 'class', firstItem.data._id]);
    } else {
      this.router.navigate(['/alumno/course-detail', courseData._id, 'questionnaire', firstItem.data._id]);
    }
  }

  /**
   * Verifica si el curso tiene algún progreso
   */
  hasProgress(): boolean {
    const progress = this.courseProgress();
    if (!progress) return false;

    const hasClassProgress = progress.classesProgress && progress.classesProgress.length > 0;
    const hasQuestionnaireProgress = progress.questionnairesProgress && progress.questionnairesProgress.length > 0;

    return hasClassProgress || hasQuestionnaireProgress || false;
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
   * Obtiene el número de cuestionarios completados
   */
  getCompletedQuestionnairesCount(): number {
    const progress = this.courseProgress();
    if (!progress || !progress.questionnairesProgress) return 0;
    return progress.questionnairesProgress.filter(qp => qp.completed).length;
  }

  /**
   * Obtiene el número total de items completados (clases + cuestionarios)
   */
  getTotalCompletedItems(): number {
    return this.getCompletedClassesCount() + this.getCompletedQuestionnairesCount();
  }

  /**
   * Obtiene el progreso general del curso (incluye clases y cuestionarios)
   */
  getOverallProgress(): number {
    const progress = this.courseProgress();
    return progress?.overallProgress || 0;
  }

  /**
   * Navega al siguiente item del curso (clase o cuestionario)
   */
  goToNextItem(): void {
    const courseData = this.course();
    const items = this.courseItems();

    if (!courseData || !courseData._id || items.length === 0) {
      return;
    }

    // Buscar el primer item no completado
    for (const item of items) {
      const isCompleted = item.type === 'class'
        ? this.isClassCompleted(item.data._id)
        : this.isQuestionnaireCompleted(item.data._id);

      if (!isCompleted) {
        this.goToItem(item);
        return;
      }
    }

    // Si todos están completados, volver al detalle del curso
    this.info.showSuccess('¡Felicidades! Has completado todo el curso');
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

  /**
   * Verifica si un cuestionario está completado
   */
  isQuestionnaireCompleted(questionnaireId: string): boolean {
    const progress = this.courseProgress();
    if (!progress || !progress.questionnairesProgress || progress.questionnairesProgress.length === 0) return false;

    const questionnaireProgress = progress.questionnairesProgress.find(
      (qp: any) => qp.questionnaireId === questionnaireId
    );
    return questionnaireProgress?.completed || false;
  }

  /**
   * Verifica si el usuario puede acceder a un item del curso (clase o cuestionario)
   */
  canAccessItem(itemIndex: number): boolean {
    const items = this.courseItems();
    if (itemIndex === 0) return true; // Primer item siempre disponible

    // Verificar que todos los items anteriores estén completados
    for (let i = 0; i < itemIndex; i++) {
      const item = items[i];
      if (item.type === 'class') {
        if (!this.isClassCompleted(item.data._id)) {
          return false;
        }
      } else if (item.type === 'questionnaire') {
        if (!this.isQuestionnaireCompleted(item.data._id)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Navega a un cuestionario
   */
  goToQuestionnaire(questionnaire: Questionnaire, itemIndex: number): void {
    const course = this.course();
    if (!course || !course._id) {
      this.info.showError('Información del curso inválida');
      return;
    }

    // Verificar si puede acceder a este cuestionario
    if (!this.canAccessItem(itemIndex)) {
      this.info.showInfo('Debes completar los elementos anteriores para acceder a este cuestionario');
      return;
    }

    this.router.navigate(['/alumno/course-detail', course._id, 'questionnaire', questionnaire._id]);
  }

  /**
   * Navega a una clase o cuestionario dependiendo del tipo
   */
  goToItem(item: CourseItem): void {
    if (item.type === 'class') {
      this.goToClass(item.data, item.index);
    } else {
      this.goToQuestionnaire(item.data, item.index);
    }
  }

  /**
   * Obtiene el mejor puntaje para un cuestionario
   */
  getQuestionnaireBestScore(questionnaireId: string): number | null {
    const progress = this.courseProgress();
    if (!progress || !progress.questionnairesProgress || progress.questionnairesProgress.length === 0) return null;

    const questionnaireProgress = progress.questionnairesProgress.find(
      (qp: any) => qp.questionnaireId === questionnaireId
    );
    return questionnaireProgress?.bestScore || null;
  }
}

