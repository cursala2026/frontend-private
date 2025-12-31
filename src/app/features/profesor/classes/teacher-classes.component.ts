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
    // Limpiar todas las suscripciones SSE al inicializar
    this.progressSubscriptions.forEach((sub) => {
      sub?.unsubscribe();
    });
    this.progressSubscriptions.clear();
    
    // Limpiar estados de video
    this.videoStatuses.set(new Map());
    this.videoProgress.set(new Map());
    
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
    const currentClassIds = new Set(classes.map(c => c._id));
    
    // PRIMERO: Limpiar TODAS las clases sin videoUrl y sus suscripciones
    const currentStatuses = this.videoStatuses();
    const currentProgress = this.videoProgress();
    let statusesChanged = false;
    let progressChanged = false;
    
    classes.forEach(classItem => {
      if (!classItem.videoUrl && classItem._id) {
        // Limpiar estado si no hay videoUrl
        if (currentStatuses.has(classItem._id)) {
          currentStatuses.delete(classItem._id);
          statusesChanged = true;
        }
        
        // Limpiar progreso
        if (currentProgress.has(classItem._id)) {
          currentProgress.delete(classItem._id);
          progressChanged = true;
        }
        
        // Limpiar suscripción si existe
        if (this.progressSubscriptions.has(classItem._id)) {
          this.progressSubscriptions.get(classItem._id)?.unsubscribe();
          this.progressSubscriptions.delete(classItem._id);
        }
      }
    });
    
    // Actualizar signals si hubo cambios
    if (statusesChanged) {
      this.videoStatuses.set(new Map(currentStatuses));
    }
    if (progressChanged) {
      this.videoProgress.set(new Map(currentProgress));
    }
    
    // Limpiar suscripciones de clases que ya no están en la lista
    // Y también limpiar suscripciones para clases sin videoUrl
    this.progressSubscriptions.forEach((sub, classId) => {
      const classItem = classes.find(c => c._id === classId);
      if ((!currentClassIds.has(classId) && !classId.includes('_reloading')) || 
          (classItem && !classItem.videoUrl)) {
        // Cerrar la suscripción SSE correctamente
        sub?.unsubscribe();
        this.progressSubscriptions.delete(classId);
      }
    });

    // AHORA: Procesar solo las clases que tienen videoUrl
    // Obtener una nueva referencia a los estados después de la limpieza
    let finalStatuses = this.videoStatuses();
    classes.forEach(classItem => {
      // CRÍTICO: Solo procesar si hay videoUrl
      // Si no hay videoUrl, NO establecer ningún estado, incluso si la BD dice 'processing'
      if (!classItem.videoUrl || !classItem._id) {
        // Asegurar que NO hay estado para esta clase sin video
        if (finalStatuses.has(classItem._id)) {
          finalStatuses.delete(classItem._id);
          this.videoStatuses.set(new Map(finalStatuses));
          finalStatuses = this.videoStatuses();
        }
        return; // Saltar clases sin video
      }
      
      // Establecer estado inicial desde la BD (solo si hay videoUrl)
      const currentStatus = classItem.videoStatus || 'ready';
      const previousStatus = finalStatuses.get(classItem._id);
      
      // Si el estado local ya es 'ready', mantenerlo aunque la BD diga 'processing'
      // (esto evita reconexiones cuando el progreso ya terminó pero la BD aún no se actualizó)
      const localStatus = previousStatus;
      if (localStatus === 'ready' && currentStatus === 'processing') {
        // No actualizar el estado, mantener 'ready'
      } else {
        // Solo establecer estado si realmente hay videoUrl (ya verificado arriba)
        finalStatuses.set(classItem._id, currentStatus);
        this.videoStatuses.set(new Map(finalStatuses));
        // Actualizar referencia local
        finalStatuses = this.videoStatuses();
      }

      // Solo conectar al SSE si:
      // 1. Hay videoUrl (ya verificado arriba)
      // 2. La BD dice 'processing'
      // 3. El estado local NO es 'ready' (para evitar reconexiones después de completar)
      // 4. No hay una suscripción activa
      const finalStatus = finalStatuses.get(classItem._id);
      if (currentStatus === 'processing' && 
          classItem._id && 
          classItem.videoUrl && // Verificación adicional redundante pero segura
          !this.progressSubscriptions.has(classItem._id) &&
          finalStatus !== 'ready') {
        this.connectToProgressStream(classItem._id, classItem.videoUrl);
      } else if (finalStatus !== 'processing' && finalStatus !== 'ready') {
        // Si no está procesando ni listo, limpiar cualquier suscripción existente
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
  private connectToProgressStream(classId: string, videoUrl?: string): void {
    // Evitar múltiples conexiones para la misma clase
    if (this.progressSubscriptions.has(classId)) {
      return;
    }

    // Verificar si la clase tiene videoUrl - si no, no conectar
    // Usamos el parámetro videoUrl pasado, o buscamos en la lista actual
    const hasVideo = videoUrl || this.classes().find(c => c._id === classId)?.videoUrl;
    if (!hasVideo) {
      // Limpiar estado si no hay video
      const currentStatuses = this.videoStatuses();
      if (currentStatuses.has(classId)) {
        currentStatuses.delete(classId);
        this.videoStatuses.set(new Map(currentStatuses));
      }
      const currentProgress = this.videoProgress();
      if (currentProgress.has(classId)) {
        currentProgress.delete(classId);
        this.videoProgress.set(new Map(currentProgress));
      }
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
   * IMPORTANTE: Nunca retorna 'processing' o 'error' si no hay videoUrl
   */
  getVideoStatus(classId: string): 'ready' | 'processing' | 'error' | null {
    const classItem = this.classes().find(c => c._id === classId);
    // Si no hay videoUrl, nunca retornar 'processing' o 'error'
    if (!classItem || !classItem.videoUrl) {
      return null;
    }
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

