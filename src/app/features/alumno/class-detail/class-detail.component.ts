import { Component, inject, signal, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ClassesService } from '../../../core/services/classes.service';
import { CoursesService } from '../../../core/services/courses.service';
import { CourseProgressService, ClassProgress } from '../../../core/services/course-progress.service';
import { environment } from '../../../core/config/environment';
import { Subject, interval, takeUntil } from 'rxjs';

@Component({
  selector: 'app-class-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './class-detail.component.html',
})
export class ClassDetailComponent implements OnInit, OnDestroy, AfterViewInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private classesService = inject(ClassesService);
  private coursesService = inject(CoursesService);
  private progressService = inject(CourseProgressService);
  private destroy$ = new Subject<void>();

  @ViewChild('videoPlayer') videoPlayerRef!: ElementRef<HTMLVideoElement>;

  classData = signal<any>(null);
  courseData = signal<any>(null);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  courseId = signal<string>('');
  classId = signal<string>('');
  Math = Math;

  // Estado del progreso
  classProgress = signal<ClassProgress | null>(null);
  isClassCompleted = signal<boolean>(false);
  videoDuration = signal<number>(0);
  currentWatchTime = signal<number>(0);
  isSavingProgress = signal<boolean>(false);
  overallProgress = signal<number>(0);
  completedClassesCount = signal<number>(0);
  progressLoaded = signal<boolean>(false);
  
  // Modal de materiales
  showMaterialsModal = signal<boolean>(false);

  private lastSavedTime = 0;
  private saveInterval = 10; // Guardar cada 10 segundos de cambio
  private pendingVideoRestore: HTMLVideoElement | null = null;

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const courseId = params['courseId'];
      const classId = params['classId'];
      
      if (courseId && classId) {
        this.courseId.set(courseId);
        this.classId.set(classId);
        this.loadClassData(courseId, classId);
        this.loadClassProgress(courseId, classId);
      } else {
        this.error.set('Parámetros inválidos');
        this.loading.set(false);
      }
    });
  }

  ngAfterViewInit(): void {
    // Se inicializa después de que la vista esté lista
  }

  ngOnDestroy(): void {
    // Guardar progreso antes de salir
    this.saveProgress(true);
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadClassProgress(courseId: string, classId: string): void {
    this.progressLoaded.set(false);
    this.progressService.getClassProgress(courseId, classId).subscribe({
      next: (response: any) => {
        // La respuesta viene envuelta en { success, data }
        const progress = response?.data || response;
        this.classProgress.set(progress);
        this.progressLoaded.set(true);
        if (progress) {
          this.isClassCompleted.set(progress.completed);
          this.currentWatchTime.set(progress.watchTime);
          this.videoDuration.set(progress.duration);
          this.lastSavedTime = progress.watchTime;
          
          // Si el video ya cargó sus metadatos, restaurar la posición ahora
          if (this.pendingVideoRestore && progress.watchTime > 0) {
            this.pendingVideoRestore.currentTime = progress.watchTime;
            this.pendingVideoRestore = null;
          }
        }
      },
      error: (err) => {
        console.error('Error loading class progress:', err);
        this.progressLoaded.set(true);
      }
    });

    // También cargar el progreso general del curso
    this.progressService.getProgress(courseId).subscribe({
      next: (courseProgress) => {
        if (courseProgress) {
          this.overallProgress.set(courseProgress.overallProgress);
          // Contar clases completadas
          const completedCount = courseProgress.classesProgress?.filter(cp => cp.completed).length || 0;
          this.completedClassesCount.set(completedCount);
        }
      }
    });
  }

  loadClassData(courseId: string, classId: string): void {
    this.loading.set(true);
    this.error.set(null);

    // Cargar datos del curso
    this.coursesService.getCourseById(courseId).subscribe({
      next: (response: any) => {
        const course = response?.data || response;
        this.courseData.set(course);
        
        // Encontrar la clase en el curso
        if (course.classes && course.classes.length > 0) {
          const foundClass = course.classes.find((c: any) => c._id === classId);
          if (foundClass) {
            this.classData.set(foundClass);
          } else {
            this.error.set('Clase no encontrada');
          }
        }
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading class:', err);
        this.error.set('No se pudo cargar la clase');
        this.loading.set(false);
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/alumno/course-detail', this.courseId()]);
  }

  goToNextClass(): void {
    const classes = this.courseData()?.classes;
    if (!classes) return;

    const currentIndex = classes.findIndex((c: any) => c._id === this.classId());
    if (currentIndex < classes.length - 1) {
      const nextClass = classes[currentIndex + 1];
      this.router.navigate(['/alumno/course-detail', this.courseId(), 'class', nextClass._id]);
    }
  }

  goToPreviousClass(): void {
    const classes = this.courseData()?.classes;
    if (!classes) return;

    const currentIndex = classes.findIndex((c: any) => c._id === this.classId());
    if (currentIndex > 0) {
      const previousClass = classes[currentIndex - 1];
      this.router.navigate(['/alumno/course-detail', this.courseId(), 'class', previousClass._id]);
    }
  }

  getCurrentClassNumber(): number {
    const classes = this.courseData()?.classes;
    if (!classes) return 0;
    return classes.findIndex((c: any) => c._id === this.classId()) + 1;
  }

  getTotalClasses(): number {
    return this.courseData()?.classes?.length || 0;
  }

  getCompletedClassesCount(): number {
    return this.completedClassesCount();
  }

  hasNextClass(): boolean {
    const classes = this.courseData()?.classes;
    if (!classes) return false;
    const currentIndex = classes.findIndex((c: any) => c._id === this.classId());
    return currentIndex < classes.length - 1;
  }

  hasPreviousClass(): boolean {
    const classes = this.courseData()?.classes;
    if (!classes) return false;
    const currentIndex = classes.findIndex((c: any) => c._id === this.classId());
    return currentIndex > 0;
  }

  getCourseImageUrl(imageUrl: string | null | undefined): string {
    if (!imageUrl) return '';
    if (imageUrl.startsWith('http')) return imageUrl;
    return `${environment.apiUrl}/static/covers/${imageUrl}`;
  }

  downloadMaterial(materialUrl: string): void {
    if (materialUrl) {
      window.open(materialUrl, '_blank');
    }
  }

  getMaterials(): string[] {
    if (!this.classData()?.supportMaterials) return [];
    return this.classData().supportMaterials;
  }

  getMaterialFileName(url: string): string {
    if (!url) return 'Material';
    // Extraer el nombre del archivo de la URL
    const parts = url.split('/');
    const fileName = parts[parts.length - 1];
    // Decodificar caracteres URL y quitar extensión si es muy larga
    try {
      return decodeURIComponent(fileName);
    } catch {
      return fileName;
    }
  }

  openMaterialsModal(): void {
    this.showMaterialsModal.set(true);
  }

  closeMaterialsModal(): void {
    this.showMaterialsModal.set(false);
  }

  // === Video Progress Tracking Methods ===

  /**
   * Se ejecuta cuando el video carga sus metadatos (duración disponible)
   */
  onVideoLoadedMetadata(event: Event): void {
    const video = event.target as HTMLVideoElement;
    this.videoDuration.set(video.duration);

    // Restaurar la posición del video si hay progreso guardado
    const progress = this.classProgress();
    if (this.progressLoaded() && progress && progress.watchTime > 0) {
      video.currentTime = progress.watchTime;
    } else if (!this.progressLoaded()) {
      // El progreso aún no se ha cargado, guardar referencia al video para restaurar después
      this.pendingVideoRestore = video;
    }
  }

  /**
   * Se ejecuta cada vez que cambia el tiempo del video
   */
  onVideoTimeUpdate(event: Event): void {
    const video = event.target as HTMLVideoElement;
    this.currentWatchTime.set(video.currentTime);

    // Guardar progreso cada N segundos de cambio
    if (Math.abs(video.currentTime - this.lastSavedTime) >= this.saveInterval) {
      this.saveProgress();
    }
  }

  /**
   * Se ejecuta cuando el video se pausa
   */
  onVideoPause(): void {
    // Guardar progreso inmediatamente cuando se pausa
    this.saveProgress(true);
  }

  /**
   * Se ejecuta cuando el video termina
   */
  onVideoEnded(): void {
    this.markAsCompleted();
  }

  /**
   * Guardar el progreso actual del video
   */
  saveProgress(force: boolean = false): void {
    const currentTime = this.currentWatchTime();
    const duration = this.videoDuration();

    // No guardar si no hay cambios significativos (a menos que sea forzado)
    if (!force && Math.abs(currentTime - this.lastSavedTime) < 2) {
      return;
    }

    // No guardar si no hay tiempo válido
    if (currentTime <= 0 && !force) {
      return;
    }

    this.isSavingProgress.set(true);
    this.lastSavedTime = currentTime;

    // Calcular si se considera completado (90% o más visto)
    const percentWatched = duration > 0 ? (currentTime / duration) * 100 : 0;
    const completed = percentWatched >= 90;

    this.progressService.updateProgress(this.courseId(), {
      classId: this.classId(),
      watchTime: currentTime,
      duration: duration,
      completed: completed
    }).subscribe({
      next: (courseProgress) => {
        this.isSavingProgress.set(false);
        this.overallProgress.set(courseProgress.overallProgress);
        // Actualizar conteo de clases completadas
        const completedCount = courseProgress.classesProgress?.filter(cp => cp.completed).length || 0;
        this.completedClassesCount.set(completedCount);
        if (completed && !this.isClassCompleted()) {
          this.isClassCompleted.set(true);
        }
      },
      error: (err) => {
        console.error('Error saving progress:', err);
        this.isSavingProgress.set(false);
      }
    });
  }

  /**
   * Marcar la clase como completada manualmente
   */
  markAsCompleted(): void {
    if (this.isClassCompleted()) return;

    this.progressService.markCompleted(this.courseId(), this.classId()).subscribe({
      next: (courseProgress) => {
        this.isClassCompleted.set(true);
        this.overallProgress.set(courseProgress.overallProgress);
        // Actualizar conteo de clases completadas
        const completedCount = courseProgress.classesProgress?.filter(cp => cp.completed).length || 0;
        this.completedClassesCount.set(completedCount);
      },
      error: (err) => {
        console.error('Error marking as completed:', err);
      }
    });
  }

  /**
   * Verificar si puede acceder a la siguiente clase
   */
  canAccessNextClass(): boolean {
    // Si la clase actual está completada, puede avanzar
    return this.isClassCompleted();
  }

  /**
   * Obtener el porcentaje de video visto
   */
  getVideoProgress(): number {
    const duration = this.videoDuration();
    if (duration === 0) return 0;
    return Math.round((this.currentWatchTime() / duration) * 100);
  }

  /**
   * Ir a la siguiente clase con verificación de completado
   */
  goToNextClassWithCheck(): void {
    if (!this.hasNextClass()) return;

    // Si no está completada la clase actual, mostrar advertencia pero permitir avanzar
    // (el backend validará si realmente puede acceder)
    if (!this.isClassCompleted()) {
      // Guardar progreso actual antes de cambiar
      this.saveProgress(true);
    }

    this.goToNextClass();
  }
}
