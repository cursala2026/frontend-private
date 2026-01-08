import { Component, inject, signal, computed, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ClassesService } from '../../../core/services/classes.service';
import { CoursesService } from '../../../core/services/courses.service';
import { CourseProgressService, ClassProgress } from '../../../core/services/course-progress.service';
import { QuestionnairesService, Questionnaire } from '../../../core/services/questionnaires.service';
import { InfoService } from '../../../core/services/info.service';
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
  private questionnairesService = inject(QuestionnairesService);
  private info = inject(InfoService);
  private sanitizer = inject(DomSanitizer);
  private destroy$ = new Subject<void>();

  @ViewChild('videoPlayer') videoPlayerRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('bunnyStreamIframe') bunnyStreamIframeRef!: ElementRef<HTMLIFrameElement>;

  classData = signal<any>(null);
  courseData = signal<any>(null);
  questionnaires = signal<Questionnaire[]>([]);
  // Items ordenados del curso (clases + cuestionarios) si el backend provee `orderedContent`
  courseItems = signal<Array<{ type: 'class'|'questionnaire'; data: any; index: number }>>([]);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  errorReason = signal<string | null>(null);
  courseId = signal<string>('');
  classId = signal<string>('');
  Math = Math;
  
  // Cache para la URL del video embebido
  private videoEmbedUrlCache = new Map<string, SafeResourceUrl>();

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
  materials = computed(() => {
    const materials = this.classData()?.supportMaterials || [];
    // Eliminar duplicados usando Set
    return [...new Set(materials)] as string[];
  });

  // Tracking para videos de Bunny Stream (iframe) usando Player.js API
  private bunnyStreamPlayer: any = null;
  private bunnyStreamPlayerReady: boolean = false;

  private lastSavedTime = 0;
  private saveInterval = 10; // Guardar cada 10 segundos de cambio
  private pendingVideoRestore: HTMLVideoElement | null = null;

  ngOnInit(): void {
    // Listener para postMessage desde el iframe de Bunny Stream
    window.addEventListener('message', this.handleIframeMessage.bind(this));
    
    this.route.params.subscribe(params => {
      const courseId = params['courseId'];
      const classId = params['classId'];
      
      if (courseId && classId) {
        // Destruir Player.js anterior si existe
        this.destroyBunnyStreamPlayer();
        
        this.courseId.set(courseId);
        this.classId.set(classId);
        this.loadClassData(courseId, classId);
        this.loadClassProgress(courseId, classId);
        this.loadQuestionnaires(courseId);
      } else {
        this.error.set('Parámetros inválidos');
        this.loading.set(false);
      }
    });
  }

  /**
   * Normaliza un ID a string (puede ser ObjectId, string, o objeto con _id)
   */
  private normalizeId(id: any): string {
    if (!id) return '';
    if (typeof id === 'string') return id;
    if (id._id) return String(id._id);
    if (id.toString) return id.toString();
    return String(id);
  }

  ngAfterViewInit(): void {
    // Se inicializa después de que la vista esté lista
    // Inicializar Player.js para Bunny Stream si hay un iframe
    setTimeout(() => {
      this.initBunnyStreamPlayer();
    }, 500);
  }

  ngOnDestroy(): void {
    // Guardar progreso antes de salir
    this.saveProgress(true);
    
    // Limpiar Player.js de Bunny Stream
    this.destroyBunnyStreamPlayer();
    
    // Remover listener de postMessage
    window.removeEventListener('message', this.handleIframeMessage.bind(this));
    
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadClassProgress(courseId: string, classId: string): void {
    // No cargar progreso si es un curso tipo workshop
    if (this.isWorkshopType()) {
      this.progressLoaded.set(true);
      return;
    }

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
          
          // Si es un video de Bunny Stream, inicializar Player.js
          if (this.classData()?.videoUrl && this.isBunnyStreamUrl(this.classData().videoUrl)) {
            // Pequeño delay para asegurar que el iframe esté cargado
            setTimeout(() => {
              this.initBunnyStreamPlayer();
            }, 1000);
          }
          
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

    // También cargar el progreso general del curso (solo si no es workshop)
    if (!this.isWorkshopType()) {
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
  }

  loadClassData(courseId: string, classId: string): void {
    this.loading.set(true);
    this.error.set(null);

    // Cargar datos del curso primero para verificar si es workshop
    this.coursesService.getCourseById(courseId).subscribe({
      next: (response: any) => {
        const course = response?.data || response;
        console.debug('[class-detail] loadClassData: course received', course?._id || course);
        this.courseData.set(course);
        // Construir courseItems a partir de orderedContent si está disponible
        this.buildCourseItemsFromCourse(course);
        
        // Encontrar la clase en el curso
        if (course.classes && course.classes.length > 0) {
          const foundClass = course.classes.find((c: any) => c._id === classId);
          if (foundClass) {
            this.classData.set(foundClass);
            
            // Si es workshop, no verificar acceso ni progreso
            if (this.isWorkshopType()) {
              this.loading.set(false);
              return;
            }
          } else {
            this.error.set('Clase no encontrada');
            this.loading.set(false);
            return;
          }
        }
        
        // Si no es workshop, verificar acceso
        this.progressService.canAccessClass(courseId, classId).subscribe({
          next: (response: any) => {
            const accessResult = response?.data || response;
            if (!accessResult.canAccess) {
              this.error.set('No puedes acceder a esta clase');
              this.errorReason.set(accessResult.reason || 'Debes completar las clases anteriores');
              this.loading.set(false);
              return;
            }
            this.loading.set(false);
          },
          error: (err) => {
            console.error('Error checking access:', err);
            this.loading.set(false);
          }
        });
      },
      error: (err) => {
        console.error('Error loading class:', err);
        this.error.set('No se pudo cargar la clase');
        this.loading.set(false);
      }
    });
  }

  loadQuestionnaires(courseId: string): void {
    this.questionnairesService.getQuestionnairesByCourse(courseId).subscribe({
      next: (response: any) => {
        const questionnaires = response?.data || [];
        // Solo cuestionarios activos
        this.questionnaires.set(questionnaires.filter((q: Questionnaire) => q.status === 'ACTIVE'));
        // Reconstruir courseItems ahora que tenemos cuestionarios
        this.buildCourseItemsFromCourse(this.courseData());
      },
      error: (err) => {
        console.error('Error loading questionnaires:', err);
        this.questionnaires.set([]);
      }
    });
  }

  /**
   * Construye `courseItems` a partir del objeto `course` soportando `orderedContent`
   */
  private buildCourseItemsFromCourse(course: any): void {
    if (!course) {
      this.courseItems.set([]);
      return;
    }

    // orderedContent puede venir como array o como { items: [...] }
    const ordered = Array.isArray(course.orderedContent)
      ? course.orderedContent
      : (course.orderedContent && Array.isArray((course.orderedContent as any).items) ? (course.orderedContent as any).items : null);

    if (ordered && Array.isArray(ordered)) {
      const mapped = ordered
        .filter((it: any) => {
          if (it.type === 'CLASS') return it.data?.status === 'ACTIVE';
          if (it.type === 'QUESTIONNAIRE') return it.data?.status === 'ACTIVE';
          return false;
        })
        .map((it: any, idx: number) => ({ type: (it.type === 'CLASS' ? 'class' : 'questionnaire'), data: it.data, index: idx }));

      const items: Array<{ type: 'class'|'questionnaire'; data: any; index: number }> = mapped as Array<{ type: 'class'|'questionnaire'; data: any; index: number }>; 

      console.debug('[class-detail] buildCourseItemsFromCourse: using orderedContent, items=', items.length);
      this.courseItems.set(items);
      return;
    }

    // Fallback: usar course.classes y cuestionarios entre clases
    const classes = (course.classes || []).filter((c: any) => c.status === 'ACTIVE');
    const items: Array<{ type: 'class'|'questionnaire'; data: any; index: number }> = [];

    classes.forEach((c: any) => {
      items.push({ type: 'class', data: c, index: items.length });

      // insertar cuestionarios BETWEEN_CLASSES después de la clase correspondiente
      const qAfter = this.questionnaires().filter(q => q.position?.type === 'BETWEEN_CLASSES' && q.position?.afterClassId === c._id);
      qAfter.forEach(q => items.push({ type: 'questionnaire', data: q, index: items.length }));
    });

    // añadir cuestionarios restantes
    const addedQIds = new Set(items.filter(i => i.type === 'questionnaire').map(i => i.data._id));
    this.questionnaires().forEach(q => {
      if (!addedQIds.has(q._id)) items.push({ type: 'questionnaire', data: q, index: items.length });
    });

    this.courseItems.set(items);
    console.debug('[class-detail] buildCourseItemsFromCourse: fallback items=', items.length);
  }

  /**
   * Helpers para navegar usando `courseItems` en vez de `course.classes`
   */
  private getOrderedClassIndexes(): number[] {
    return this.courseItems().map((it, idx) => (it.type === 'class' ? idx : -1)).filter(i => i !== -1);
  }

  private findCurrentItemIndex(): number {
    const items = this.courseItems();
    const currentClassId = this.classId();
    return items.findIndex(it => it.type === 'class' && this.normalizeId(it.data._id) === this.normalizeId(currentClassId));
  }

  goBack(): void {
    this.router.navigate(['/alumno/course-detail', this.courseId()]);
  }

  goToNextClass(): void {
    const items = this.courseItems();
    if (!items || items.length === 0) return;

    const currentIndex = this.findCurrentItemIndex();
    // buscar siguiente item que sea clase
    for (let i = currentIndex + 1; i < items.length; i++) {
      if (items[i].type === 'class') {
        this.router.navigate(['/alumno/course-detail', this.courseId(), 'class', items[i].data._id]);
        return;
      }
    }
  }

  getPreviousClassId(): string | null {
    const items = this.courseItems();
    const currentIndex = this.findCurrentItemIndex();
    if (currentIndex <= 0) return null;

    // buscar anterior que sea clase
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (items[i].type === 'class') return items[i].data._id;
    }
    return null;
  }

  goToPreviousClass(): void {
    const prevClassId = this.getPreviousClassId();
    if (prevClassId) {
      this.router.navigate(['/alumno/course-detail', this.courseId(), 'class', prevClassId]);
    } else {
      this.goBack();
    }
  }

  getPendingQuestionnaireId(): string | null {
    // Buscar cuestionario que está entre la clase anterior y la actual, usando courseItems
    const currentIndex = this.findCurrentItemIndex();
    if (currentIndex <= 0) return null;

    // Buscar hacia atrás por la clase anterior
    let prevClassId: string | null = null;
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (this.courseItems()[i].type === 'class') {
        prevClassId = this.courseItems()[i].data._id;
        break;
      }
    }
    if (!prevClassId) return null;

    const questionnaires = this.questionnaires();
    const pendingQuestionnaire = questionnaires.find((q: Questionnaire) => q.position?.type === 'BETWEEN_CLASSES' && q.position?.afterClassId === prevClassId);
    return pendingQuestionnaire?._id || null;
  }

  goToPendingQuestionnaire(): void {
    const questionnaireId = this.getPendingQuestionnaireId();
    if (questionnaireId) {
      this.router.navigate(['/alumno/course-detail', this.courseId(), 'questionnaire', questionnaireId]);
    } else {
      this.goBack();
    }
  }

  getCurrentClassNumber(): number {
    const items = this.courseItems();
    if (!items || items.length === 0) return 0;
    // contar cuántas clases aparecen hasta la actual
    let count = 0;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type === 'class') {
        if (this.normalizeId(items[i].data._id) === this.normalizeId(this.classId())) return count + 1;
        count++;
      }
    }
    return 0;
  }

  getTotalClasses(): number {
    return this.courseItems().filter(i => i.type === 'class').length || 0;
  }

  getCompletedClassesCount(): number {
    return this.completedClassesCount();
  }

  hasNextClass(): boolean {
    const items = this.courseItems();
    if (!items || items.length === 0) return false;
    const currentIndex = this.findCurrentItemIndex();
    for (let i = currentIndex + 1; i < items.length; i++) {
      if (items[i].type === 'class') return true;
    }
    return false;
  }

  hasPreviousClass(): boolean {
    const items = this.courseItems();
    const currentIndex = this.findCurrentItemIndex();
    if (currentIndex <= 0) return false;
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (items[i].type === 'class') return true;
    }
    return false;
  }

  getCourseImageUrl(imageUrl: string | null | undefined): string {
    if (!imageUrl) return '';
    if (imageUrl.startsWith('http')) return imageUrl;
    return `${environment.apiUrl}/static/covers/${imageUrl}`;
  }

  getClassImageUrl(imageUrl: string | null | undefined): string {
    if (!imageUrl) return '';
    if (imageUrl.startsWith('http')) return imageUrl;
    return `${environment.apiUrl}/static/classes/${imageUrl}`;
  }

  /**
   * Obtiene la URL del video, convirtiendo URLs de Bunny Stream al reproductor embebido
   */
  getVideoUrl(videoUrl: string | null | undefined): SafeResourceUrl {
    if (!videoUrl) return this.sanitizer.bypassSecurityTrustResourceUrl('');
    
    // Usar caché para evitar recalcular múltiples veces
    if (this.videoEmbedUrlCache.has(videoUrl)) {
      return this.videoEmbedUrlCache.get(videoUrl)!;
    }
    
    // Si es una URL de Bunny Stream (vz-*.b-cdn.net), convertir al reproductor embebido
    if (videoUrl.includes('vz-') && videoUrl.includes('.b-cdn.net')) {
      // Extraer libraryId y videoId de la URL
      // Formato: https://vz-{libraryId}.b-cdn.net/{videoId}/play_480p.mp4
      // o: https://vz-{libraryId}.b-cdn.net/{videoId}
      let match = videoUrl.match(/vz-(\d+)\.b-cdn\.net\/([a-f0-9-]+)(?:\/|$)/i);
      
      // Si no coincide, intentar sin el trailing slash
      if (!match) {
        match = videoUrl.match(/vz-(\d+)\.b-cdn\.net\/([a-f0-9-]+)/i);
      }
      
      if (match && match.length >= 3) {
        const libraryId = match[1];
        let videoId = match[2];
        
        // Limpiar el videoId
        videoId = videoId.split('/')[0];
        
        // Usar el reproductor embebido de Bunny Stream (iframe)
        // Nota: Para que funcione, necesitas agregar tu dominio a "Allowed Domains" en Bunny Stream
        // Si estás en desarrollo, agrega "localhost" a los dominios permitidos
        const embedUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`;
        const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
        
        // Guardar en caché
        this.videoEmbedUrlCache.set(videoUrl, safeUrl);
        
        return safeUrl;
      }
    }
    
    // Si no es Bunny Stream, devolver la URL original sanitizada
    const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(videoUrl);
    this.videoEmbedUrlCache.set(videoUrl, safeUrl);
    return safeUrl;
  }

  /**
   * Verifica si la URL del video es de Bunny Stream (requiere iframe)
   */
  isBunnyStreamUrl(videoUrl: string | null | undefined): boolean {
    if (!videoUrl) return false;
    return videoUrl.includes('vz-') && videoUrl.includes('.b-cdn.net');
  }

  /**
   * Maneja mensajes postMessage desde el iframe de Bunny Stream
   * (Mantenido por compatibilidad, pero ahora usamos Player.js API)
   */
  handleIframeMessage(event: MessageEvent): void {
    // Este método ahora está deprecated, usamos Player.js API en su lugar
  }

  /**
   * Inicializa Player.js para controlar el reproductor de Bunny Stream
   */
  initBunnyStreamPlayer(): void {
    // No inicializar si es workshop
    if (this.isWorkshopType()) return;

    // No inicializar si ya hay un player activo
    if (this.bunnyStreamPlayer) return;

    // Verificar si hay un iframe de Bunny Stream
    if (!this.bunnyStreamIframeRef?.nativeElement) {
      // Reintentar después de un breve delay
      setTimeout(() => this.initBunnyStreamPlayer(), 500);
      return;
    }

    // Verificar que Player.js esté disponible (se carga desde el script en index.html)
    const playerjs = (window as any).playerjs;
    if (!playerjs || typeof playerjs.Player === 'undefined') {
      console.warn('Player.js no está disponible. Asegúrate de que el script esté cargado.');
      // Reintentar después de un breve delay
      setTimeout(() => this.initBunnyStreamPlayer(), 500);
      return;
    }

    try {
      const iframe = this.bunnyStreamIframeRef.nativeElement;
      this.bunnyStreamPlayer = new playerjs.Player(iframe);

      this.bunnyStreamPlayer.on('ready', () => {
        this.bunnyStreamPlayerReady = true;

        this.bunnyStreamPlayer.getDuration((duration: number) => {
          if (duration && duration > 0) {
            this.videoDuration.set(duration);
            
            const progress = this.classProgress();
            if (progress && progress.watchTime > 0 && progress.watchTime < duration) {
              this.bunnyStreamPlayer.setCurrentTime(progress.watchTime);
            }
          }
        });

        this.bunnyStreamPlayer.on('ended', () => {
            console.debug('[class-detail] bunnyStreamPlayer ended event');
            this.markAsCompleted();
        });

        this.bunnyStreamPlayer.on('timeupdate', (data: any) => {
          if (data && typeof data.seconds === 'number') {
            this.currentWatchTime.set(data.seconds);
              // Log timeupdate for debugging
              if (Math.abs(data.seconds - this.lastSavedTime) >= this.saveInterval) {
                console.debug('[class-detail] bunnyStreamPlayer timeupdate, seconds=', data.seconds, 'lastSaved=', this.lastSavedTime);
                this.saveProgress();
              }
          }
        });
      });
    } catch (error) {
      console.error('Error inicializando Player.js:', error);
    }
  }

  /**
   * Destruye la instancia de Player.js
   */
  destroyBunnyStreamPlayer(): void {
    if (this.bunnyStreamPlayer) {
      try {
        // Verificar si el iframe aún existe y tiene contentWindow antes de intentar limpiar
        const iframe = this.bunnyStreamIframeRef?.nativeElement;
        if (iframe && iframe.contentWindow) {
          try {
            this.bunnyStreamPlayer.off('ready');
            this.bunnyStreamPlayer.off('ended');
            this.bunnyStreamPlayer.off('timeupdate');
          } catch (cleanupError) {
            // Silenciar errores de limpieza si el iframe ya no está disponible
            // Esto es normal cuando el componente se destruye mientras el iframe se está limpiando
          }
        }
      } catch (error) {
        // Silenciar errores si el iframe ya no existe
        // Esto es normal cuando el componente se destruye
      } finally {
        this.bunnyStreamPlayer = null;
        this.bunnyStreamPlayerReady = false;
      }
    }
  }

  downloadMaterial(materialUrl: string): void {
    if (materialUrl) {
      window.open(materialUrl, '_blank');
    }
  }

  getMaterials(): string[] {
    return this.materials();
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
    // No guardar progreso si es un curso tipo workshop
    if (this.isWorkshopType()) return;

    const video = event.target as HTMLVideoElement;
    this.currentWatchTime.set(video.currentTime);
    console.debug('[class-detail] onVideoTimeUpdate currentTime=', video.currentTime);

    // Guardar progreso cada N segundos de cambio
    if (Math.abs(video.currentTime - this.lastSavedTime) >= this.saveInterval) {
      console.debug('[class-detail] onVideoTimeUpdate triggering saveProgress, current=', video.currentTime, 'lastSaved=', this.lastSavedTime);
      this.saveProgress();
    }
  }

  /**
   * Se ejecuta cuando el video se pausa
   */
  onVideoPause(): void {
    // Guardar progreso inmediatamente cuando se pausa
    console.debug('[class-detail] onVideoPause, currentTime=', this.currentWatchTime());
    this.saveProgress(true);
  }

  /**
   * Se ejecuta cuando el video termina
   */
  onVideoEnded(): void {
    console.debug('[class-detail] onVideoEnded HTML5');
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

    this.lastSavedTime = currentTime;

    // Calcular si se considera completado (90% o más visto)
    const percentWatched = duration > 0 ? (currentTime / duration) * 100 : 0;
    const completed = percentWatched >= 90;

    // Guardar en silencio sin mostrar el cartel
    const payload = {
      classId: this.classId(),
      watchTime: currentTime,
      duration: duration,
      completed: completed
    };
    console.debug('[class-detail] saveProgress payload=', payload, 'force=', force);
    this.progressService.updateProgress(this.courseId(), payload).subscribe({
      next: (courseProgress) => {
        console.debug('[class-detail] saveProgress response overall=', courseProgress?.overallProgress);
        this.overallProgress.set(courseProgress.overallProgress);
        // Actualizar conteo de clases completadas
        const completedCount = courseProgress.classesProgress?.filter(cp => cp.completed).length || 0;
        this.completedClassesCount.set(completedCount);
        if (completed && !this.isClassCompleted()) {
          console.debug('[class-detail] saveProgress marking local isClassCompleted=true');
          this.isClassCompleted.set(true);
        }
      },
      error: (err) => {
        console.error('[class-detail] Error saving progress:', err);
      }
    });
  }

  /**
   * Marcar la clase como completada manualmente
   */
  markAsCompleted(): void {
    if (this.isClassCompleted()) return;
    console.debug('[class-detail] markAsCompleted called for classId=', this.classId());

    this.progressService.markCompleted(this.courseId(), this.classId()).subscribe({
      next: (courseProgress) => {
        console.debug('[class-detail] markAsCompleted response overall=', courseProgress?.overallProgress);
        this.isClassCompleted.set(true);
        this.overallProgress.set(courseProgress.overallProgress);
        // Actualizar conteo de clases completadas
        const completedCount = courseProgress.classesProgress?.filter(cp => cp.completed).length || 0;
        this.completedClassesCount.set(completedCount);
      },
      error: (err) => {
        console.error('[class-detail] Error marking as completed:', err);
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
   * Verificar si hay un cuestionario después de la clase actual
   */
  getQuestionnaireAfterClass(): Questionnaire | null {
    const questionnaires = this.questionnaires();
    const currentClassId = this.classId();
    
    if (!questionnaires || questionnaires.length === 0) {
      return null;
    }

    // Buscar cuestionarios que van después de esta clase
    const questionnaireAfter = questionnaires.find(q =>
      q.position.type === 'BETWEEN_CLASSES' &&
      q.position.afterClassId === currentClassId
    );

    if (questionnaireAfter) {
      return questionnaireAfter;
    }

    // Si no hay cuestionario entre clases y es la última clase, buscar cuestionarios finales u otros
    const isLastClass = !this.hasNextClass();
    if (isLastClass) {
      const finalOrRemaining = questionnaires.find(q => q.position.type !== 'BETWEEN_CLASSES');
      return finalOrRemaining || null;
    }

    return null;
  }

  /**
   * Verificar si la clase tiene video
   */
  hasVideo(): boolean {
    return !!this.classData()?.videoUrl;
  }

  /**
   * Verificar si es un curso tipo workshop (una sola clase con enlace externo y sin video)
   */
  isWorkshopType(): boolean {
    const course = this.courseData();
    const classData = this.classData();
    
    if (!course || !classData) return false;
    
    // Debe tener exactamente una clase
    const classes = course.classes || [];
    if (classes.length !== 1) return false;
    
    // La clase debe tener linkLive (enlace externo)
    if (!classData.linkLive) return false;
    
    // La clase NO debe tener videoUrl (solo imagen)
    if (classData.videoUrl) return false;
    
    return true;
  }

  /**
   * Verificar si la fecha de inicio del curso ya pasó
   */
  isCourseStartDateReached(): boolean {
    const course = this.courseData();
    if (!course || !course.startDate) return true; // Si no hay fecha, permitir acceso
    
    const startDate = new Date(course.startDate);
    const now = new Date();
    
    return now >= startDate;
  }

  /**
   * Obtener la fecha de inicio formateada
   */
  getFormattedStartDate(): string {
    const course = this.courseData();
    if (!course || !course.startDate) return '';
    
    const startDate = new Date(course.startDate);
    return startDate.toLocaleDateString('es-AR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Manejar el clic en el botón de clase en vivo (workshop)
   */
  handleWorkshopLinkClick(event: Event): void {
    if (!this.isCourseStartDateReached()) {
      event.preventDefault();
      const formattedDate = this.getFormattedStartDate();
      this.info.showError(
        `La clase aún no está activa. La clase comenzará el ${formattedDate}.`
      );
      return;
    }
    // Si la fecha ya pasó, permitir el comportamiento normal del enlace
  }

  /**
   * Verificar si el botón continuar debe estar habilitado
   */
  canContinue(): boolean {
    // Si no hay siguiente clase ni cuestionario, no puede continuar
    if (!this.hasNextClass() && !this.getQuestionnaireAfterClass()) {
      return false;
    }

    // Si la clase tiene video, solo puede continuar si está completada
    if (this.hasVideo()) {
      return this.isClassCompleted();
    }

    // Si no tiene video, puede continuar siempre
    return true;
  }

  /**
   * Ir a la siguiente clase con verificación de completado
   */
  goToNextClassWithCheck(): void {
    // Verificar si hay un cuestionario después de esta clase
    const questionnaireAfter = this.getQuestionnaireAfterClass();
    
    if (questionnaireAfter) {
      // Navegar al cuestionario
      this.router.navigate([
        '/alumno/course-detail',
        this.courseId(),
        'questionnaire',
        questionnaireAfter._id
      ]);
      return;
    }

    // Si no hay cuestionario, ir a la siguiente clase
    if (!this.hasNextClass()) return;

    // Si no está completada la clase actual, guardar progreso antes de cambiar
    if (!this.isClassCompleted()) {
      this.saveProgress(true);
    }

    this.goToNextClass();
  }
}
