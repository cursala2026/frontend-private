import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ClassesService, ClassData } from '../../../core/services/classes.service';
import { CoursesService, Course } from '../../../core/services/courses.service';
import { ViewModeService } from '../../../core/services/view-mode.service';
import { UserRole } from '../../../core/models/user-role.enum';
import { ConfirmModalComponent, ConfirmModalConfig } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { VideoUploadProgressService } from '../../../core/services/video-upload-progress.service';
import { Subscription } from 'rxjs';

interface ClassWithCourse extends Omit<ClassData, 'courseId'> {
  courseName?: string;
  courseId?: string;
}

@Component({
  selector: 'app-teacher-classes',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmModalComponent],
  templateUrl: './teacher-classes.component.html',
})
export class TeacherClassesComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private classesService = inject(ClassesService);
  private coursesService = inject(CoursesService);
  private viewModeService = inject(ViewModeService);
  private route = inject(ActivatedRoute);
  private videoUploadProgressService = inject(VideoUploadProgressService);
  router = inject(Router);
  
  user = this.authService.currentUser;
  classes = signal<ClassData[]>([]);
  courses = signal<Course[]>([]);
  selectedCourseId = '';
  loading = signal<boolean>(true);
  loadingClasses = signal<boolean>(false);
  
  // Tracking de progreso de videos por clase
  videoProgress = signal<Map<string, number>>(new Map());
  videoStatuses = signal<Map<string, 'ready' | 'processing' | 'error'>>(new Map());
  private progressSubscriptions = new Map<string, Subscription>();

  // Modal de confirmación
  showDeleteModal = signal<boolean>(false);
  classToDelete: ClassData | null = null;
  deleteModalConfig: ConfirmModalConfig = {
    title: 'Eliminar Clase',
    message: '',
    confirmText: 'Eliminar',
    cancelText: 'Cancelar',
    confirmButtonClass: 'bg-red-600 hover:bg-red-700',
    icon: 'danger'
  };

  ngOnInit(): void {
    this.loadCourses();

    // Verificar si hay un courseId en los query params
    this.route.queryParamMap.subscribe(params => {
      const courseIdFromQuery = params.get('courseId');
      if (courseIdFromQuery) {
        this.selectedCourseId = courseIdFromQuery;
        this.loadClassesByCourse(courseIdFromQuery);
      }
    });
  }

  loadCourses(): void {
    const currentUser = this.user();
    if (!currentUser?._id) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    
    // Si el usuario es admin y está en modo profesor, cargar todos los cursos
    // Si es profesor normal, cargar solo sus cursos asignados
    if (this.authService.hasRole(UserRole.ADMIN) && this.viewModeService.isProfesorMode()) {
      // Admin en modo profesor: cargar todos los cursos
      this.coursesService.getCourses({ page: 1, page_size: 1000 }).subscribe({
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
    } else {
      // Profesor normal: cargar solo sus cursos asignados
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

  onCourseChange(): void {
    if (this.selectedCourseId) {
      this.loadClassesByCourse(this.selectedCourseId);
    } else {
      this.classes.set([]);
    }
  }

  private isReloading = false;

  loadClassesByCourse(courseId: string): void {
    // Evitar recargas múltiples simultáneas
    if (this.isReloading) {
      return;
    }
    
    this.isReloading = true;
    this.loadingClasses.set(true);
    this.classesService.getClassesByCourse(courseId).subscribe({
      next: (response: any) => {
        const data = response?.data || [];
        this.classes.set(Array.isArray(data) ? data : []);
        
        // Conectar al SSE para clases con videoStatus='processing'
        this.connectToProgressStreams(data);
        
        this.loadingClasses.set(false);
        this.isReloading = false;
      },
      error: (error) => {
        console.error('Error loading classes:', error);
        this.classes.set([]);
        this.loadingClasses.set(false);
        this.isReloading = false;
      }
    });
  }

  /**
   * Conecta al stream SSE para todas las clases que están procesando video
   */
  private connectToProgressStreams(classes: ClassData[]): void {
    // Limpiar suscripciones anteriores solo para clases que ya no están en la lista
    const currentClassIds = new Set(classes.map(c => c._id));
    this.progressSubscriptions.forEach((sub, classId) => {
      if (!currentClassIds.has(classId) && !classId.includes('_reloading')) {
        sub?.unsubscribe();
        this.progressSubscriptions.delete(classId);
      }
    });

    classes.forEach(classItem => {
      // Establecer estado inicial desde la BD
      const currentStatuses = this.videoStatuses();
      const currentStatus = classItem.videoStatus || 'ready';
      const previousStatus = currentStatuses.get(classItem._id);
      
      // Si el estado local ya es 'ready', mantenerlo aunque la BD diga 'processing'
      // (esto evita reconexiones cuando el progreso ya terminó pero la BD aún no se actualizó)
      const localStatus = previousStatus;
      if (localStatus === 'ready' && currentStatus === 'processing') {
        // No actualizar el estado, mantener 'ready'
      } else {
        currentStatuses.set(classItem._id, currentStatus);
        this.videoStatuses.set(new Map(currentStatuses));
      }

      // Solo conectar al SSE si:
      // 1. La BD dice 'processing'
      // 2. El estado local NO es 'ready' (para evitar reconexiones después de completar)
      // 3. No hay una suscripción activa
      const finalStatus = currentStatuses.get(classItem._id);
      if (currentStatus === 'processing' && 
          classItem._id && 
          !this.progressSubscriptions.has(classItem._id) &&
          finalStatus !== 'ready') {
        this.connectToProgressStream(classItem._id);
      } else if (finalStatus !== 'processing') {
        // Si no está procesando, limpiar cualquier suscripción existente
        if (this.progressSubscriptions.has(classItem._id)) {
          this.progressSubscriptions.get(classItem._id)?.unsubscribe();
          this.progressSubscriptions.delete(classItem._id);
          // Limpiar progreso también
          const progress = this.videoProgress();
          progress.delete(classItem._id);
          this.videoProgress.set(new Map(progress));
        }
      }
    });
  }

  /**
   * Conecta al stream SSE para una clase específica
   */
  private connectToProgressStream(classId: string): void {
    // Evitar múltiples conexiones para la misma clase
    if (this.progressSubscriptions.has(classId)) {
      return;
    }

    // Verificar si el estado local ya es 'ready' - si es así, no conectar
    const currentStatuses = this.videoStatuses();
    if (currentStatuses.get(classId) === 'ready') {
      return;
    }

    // Inicializar progreso solo si no existe
    const currentProgress = this.videoProgress();
    if (!currentProgress.has(classId)) {
      currentProgress.set(classId, 0);
      this.videoProgress.set(new Map(currentProgress));
    }

    if (currentStatuses.get(classId) !== 'processing') {
      currentStatuses.set(classId, 'processing');
      this.videoStatuses.set(new Map(currentStatuses));
    }

    const subscription = this.videoUploadProgressService.getUploadProgress(classId).subscribe({
      next: (event) => {
        if (event.error) {
          const statuses = this.videoStatuses();
          statuses.set(classId, 'error');
          this.videoStatuses.set(new Map(statuses));
          this.progressSubscriptions.delete(classId);
          // Recargar clases para obtener el estado actualizado
          if (this.selectedCourseId) {
            this.loadClassesByCourse(this.selectedCourseId);
          }
        } else {
          const progress = this.videoProgress();
          progress.set(classId, event.percent);
          this.videoProgress.set(new Map(progress));

          if (event.percent >= 100) {
            const statuses = this.videoStatuses();
            statuses.set(classId, 'ready');
            this.videoStatuses.set(new Map(statuses));
            
            // Cerrar suscripción inmediatamente
            this.progressSubscriptions.get(classId)?.unsubscribe();
            this.progressSubscriptions.delete(classId);
          }
        }
      },
      error: (error) => {
        const statuses = this.videoStatuses();
        statuses.set(classId, 'error');
        this.videoStatuses.set(new Map(statuses));
        this.progressSubscriptions.delete(classId);
      }
    });

    this.progressSubscriptions.set(classId, subscription);
  }

  /**
   * Obtiene el progreso de una clase
   */
  getVideoProgress(classId: string): number {
    return this.videoProgress().get(classId) || 0;
  }

  /**
   * Obtiene el estado del video de una clase
   */
  getVideoStatus(classId: string): 'ready' | 'processing' | 'error' | null {
    return this.videoStatuses().get(classId) || null;
  }

  ngOnDestroy(): void {
    // Limpiar todas las suscripciones
    this.progressSubscriptions.forEach(sub => sub.unsubscribe());
    this.progressSubscriptions.clear();
  }

  openClassEdit(classItem: ClassData): void {
    // Navegar a la página de edición de la clase
    this.router.navigate(['/profesor/classes', classItem._id, 'edit']);
  }

  openClassCreate(): void {
    if (this.selectedCourseId) {
      // Navegar a la página de creación de clase con el courseId como query param
      this.router.navigate(['/profesor/classes/new'], { queryParams: { courseId: this.selectedCourseId } });
    }
  }

  deleteClass(event: Event, classItem: ClassData): void {
    event.stopPropagation(); // Evitar que se dispare el click de la tarjeta

    // Configurar el modal con la información de la clase
    this.classToDelete = classItem;
    this.deleteModalConfig.message = `¿Estás seguro de que deseas eliminar la clase "${classItem.name}"?\n\nEsta acción no se puede deshacer.`;
    this.showDeleteModal.set(true);
  }

  confirmDelete(): void {
    if (this.classToDelete?._id) {
      this.classesService.deleteClass(this.classToDelete._id).subscribe({
        next: () => {
          // Recargar las clases del curso actual
          if (this.selectedCourseId) {
            this.loadClassesByCourse(this.selectedCourseId);
          }
          this.classToDelete = null;
        },
        error: (error) => {
          console.error('Error deleting class:', error);
          alert('Error al eliminar la clase. Por favor, inténtalo de nuevo.');
          this.classToDelete = null;
        }
      });
    }
  }

  cancelDelete(): void {
    this.classToDelete = null;
  }

  getClassImageUrl(imageUrl?: string): string {
    if (!imageUrl) return '';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    return `https://cursala.b-cdn.net/class-images/${encodeURIComponent(imageUrl)}`;
  }

  handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }

  getSelectedCourseName(): string {
    if (!this.selectedCourseId) return '';
    const course = this.courses().find(c => c._id === this.selectedCourseId);
    return course?.name || '';
  }
}

