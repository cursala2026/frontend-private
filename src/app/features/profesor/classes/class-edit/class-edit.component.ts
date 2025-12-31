import { Component, OnInit, OnDestroy, AfterViewInit, signal, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ClassesService, ClassData } from '../../../../core/services/classes.service';
import { CoursesService, Course } from '../../../../core/services/courses.service';
import { InfoService } from '../../../../core/services/info.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ViewModeService } from '../../../../core/services/view-mode.service';
import { UserRole } from '../../../../core/models/user-role.enum';
import { VideoUploadProgressService } from '../../../../core/services/video-upload-progress.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-teacher-class-edit',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './class-edit.component.html'
})
export class TeacherClassEditComponent implements OnInit, OnDestroy, AfterViewInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private classesService = inject(ClassesService);
  private coursesService = inject(CoursesService);
  private info = inject(InfoService);
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private viewModeService = inject(ViewModeService);
  private videoUploadProgressService = inject(VideoUploadProgressService);
  private sanitizer = inject(DomSanitizer);

  classForm!: FormGroup;
  classData = signal<ClassData | null>(null);
  course = signal<Course | null>(null);
  courses = signal<Course[]>([]);
  loading = signal<boolean>(true);
  saving = signal<boolean>(false);
  error = signal<string | null>(null);

  // Signals para progreso de video
  videoUploadProgress = signal<number>(0);
  videoStatus = signal<'ready' | 'processing' | 'error' | null>(null);
  isUploadingVideo = signal<boolean>(false);

  selectedImageFile: File | null = null;
  imagePreview: string | null = null;
  originalImageUrl: string | null = null; // URL de la imagen original
  deleteCurrentImage: boolean = false; // Flag para eliminar la imagen original

  selectedVideoFile: File | null = null;
  videoPreview: string | null = null;
  originalVideoUrl: string | null = null; // URL del video original subido
  deleteCurrentVideo: boolean = false; // Flag para eliminar el video original

  selectedSupportFiles: File[] = [];
  existingSupportMaterials: string[] = [];
  supportMaterialsToDelete: string[] = [];

  classId: string | null = null;
  courseId: string | null = null;
  isEditMode = false;

  private progressSubscription: Subscription | null = null;
  
  // Cache para URLs de video embebido de Bunny Stream
  private videoEmbedUrlCache = new Map<string, SafeResourceUrl>();
  
  // ViewChild para el iframe de Bunny Stream
  @ViewChild('bunnyStreamIframe') bunnyStreamIframeRef!: ElementRef<HTMLIFrameElement>;
  
  // Player.js instance para Bunny Stream
  private bunnyStreamPlayer: any = null;

  ngOnInit(): void {
    this.classId = this.route.snapshot.paramMap.get('id');
    // Si el id es 'new' o no existe, estamos en modo creación
    this.isEditMode = !!this.classId && this.classId !== 'new' && this.classId !== 'edit';

    // Capturar courseId de query params si estamos creando
    const courseIdFromQuery = this.route.snapshot.queryParamMap.get('courseId');
    if (courseIdFromQuery) {
      this.courseId = courseIdFromQuery;
    }

    this.initializeForm();
    this.loadCourses();
    
    // Resetear flags
    this.deleteCurrentVideo = false;
    this.deleteCurrentImage = false;
    this.originalVideoUrl = null;
    this.originalImageUrl = null;
    
    // Limpiar estado de video
    this.videoStatus.set(null);
    this.videoUploadProgress.set(0);
    this.isUploadingVideo.set(false);
    this.cleanupProgressSubscription();

    if (this.isEditMode && this.classId) {
      this.loadClass();
    } else {
      // En modo creación, si hay courseId en query params, precargarlo
      if (courseIdFromQuery) {
        this.loadCourse();
        this.classForm.patchValue({ courseId: courseIdFromQuery });
      }
      this.loading.set(false);
    }
  }

  ngAfterViewInit(): void {
    // Inicializar Player.js para Bunny Stream si hay un video preview
    setTimeout(() => {
      if (this.videoPreview && this.isBunnyStreamUrl(this.videoPreview)) {
        this.initBunnyStreamPlayer();
      }
    }, 500);
  }

  initializeForm(): void {
    this.classForm = this.fb.group({
      name: ['', [Validators.required]],
      description: [''],
      courseId: [this.courseId || '', [Validators.required]],
      linkLive: [''],
      imageFile: [null],
      videoFile: [null]
    });
  }

  loadCourses(): void {
    const currentUser = this.authService.currentUser();
    if (!currentUser?._id) {
      return;
    }

    // Si el usuario es admin y está en modo profesor, cargar todos los cursos
    // Si es profesor normal, cargar solo sus cursos asignados
    if (this.authService.hasRole(UserRole.ADMIN) && this.viewModeService.isProfesorMode()) {
      // Admin en modo profesor: cargar todos los cursos
      this.coursesService.getCourses({ page: 1, page_size: 1000 }).subscribe({
        next: (response: any) => {
          const data = response?.data || [];
          this.courses.set(Array.isArray(data) ? data : []);
        },
        error: (error) => {
          console.error('Error loading courses:', error);
        }
      });
    } else {
      // Profesor normal: cargar solo sus cursos asignados
      this.coursesService.getTeacherCourses(currentUser._id).subscribe({
        next: (response: any) => {
          const data = response?.data || [];
          this.courses.set(Array.isArray(data) ? data : []);
        },
        error: (error) => {
          console.error('Error loading courses:', error);
        }
      });
    }
  }

  loadClass(): void {
    if (!this.classId) return;

    this.loading.set(true);
    this.classesService.getClassById(this.classId).subscribe({
      next: (response) => {
        const classData = response?.data || response;
        this.classData.set(classData);

        // Obtener courseId
        if (classData.courseId) {
          if (typeof classData.courseId === 'object') {
            this.courseId = classData.courseId._id || classData.courseId.toString();
          } else {
            this.courseId = classData.courseId.toString();
          }
        }

        // Cargar información del curso
        if (this.courseId) {
          this.loadCourse();
        }

        // Cargar preview de imagen
        if (classData.imageUrl) {
          this.imagePreview = this.getClassImageUrl(classData.imageUrl);
          this.originalImageUrl = classData.imageUrl;
        }

        // PRIMERO: Limpiar estado completamente antes de cargar datos
        // Esto previene estados residuales
        this.videoStatus.set(null);
        this.videoUploadProgress.set(0);
        this.isUploadingVideo.set(false);
        this.cleanupProgressSubscription();
        
        // Cargar preview de video
        if (classData.videoUrl) {
          this.originalVideoUrl = this.getClassVideoUrl(classData.videoUrl);
          this.deleteCurrentVideo = false; // Resetear flag al cargar
          // Solo mostrar el video original si no hay un video local seleccionado
          if (!this.selectedVideoFile) {
            this.videoPreview = this.originalVideoUrl;
          }
          
          // Verificar estado del video (solo si hay videoUrl)
          if ((classData as any).videoStatus) {
            this.videoStatus.set((classData as any).videoStatus);
            // Si está procesando, conectar al SSE
            if ((classData as any).videoStatus === 'processing') {
              this.connectToProgressStream(classData._id);
            }
          }
        } else {
          // Si no hay videoUrl, asegurarse de que todo esté limpio
          this.originalVideoUrl = null;
          this.videoPreview = null;
          // El estado ya fue limpiado arriba, pero lo hacemos explícitamente aquí también
          this.videoStatus.set(null);
          this.videoUploadProgress.set(0);
          this.isUploadingVideo.set(false);
          this.cleanupProgressSubscription();
        }

        // Cargar materiales de apoyo existentes
        if (classData.supportMaterials && classData.supportMaterials.length > 0) {
          this.existingSupportMaterials = [...classData.supportMaterials];
        }

        this.classForm.patchValue({
          name: classData.name || '',
          description: classData.description || '',
          courseId: this.courseId || '',
          linkLive: classData.linkLive || ''
        });

        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading class:', error);
        this.info.showError('Error al cargar la clase');
        this.loading.set(false);
        this.router.navigate(['/profesor/classes']);
      }
    });
  }

  loadCourse(): void {
    if (!this.courseId) return;

    this.coursesService.getCourseById(this.courseId).subscribe({
      next: (response: any) => {
        const courseData = response?.data || response;
        this.course.set(courseData);
      },
      error: (error) => {
        console.error('Error loading course:', error);
      }
    });
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedImageFile = input.files[0];
      this.deleteCurrentImage = false; // Si se selecciona nueva imagen, no eliminar la original
      this.classForm.patchValue({ imageFile: this.selectedImageFile });
      this.classForm.markAsDirty(); // Marcar formulario como modificado
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imagePreview = e.target.result;
      };
      reader.readAsDataURL(this.selectedImageFile);
    }
  }

  removeImage(): void {
    this.imagePreview = null;
    this.selectedImageFile = null;
    this.deleteCurrentImage = true;
    this.classForm.patchValue({ imageFile: null });
    this.classForm.markAsDirty();
  }

  onVideoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      // Limpiar el blob URL anterior si existe (solo si es un blob URL)
      if (this.videoPreview && this.videoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(this.videoPreview);
      }
      
      this.selectedVideoFile = input.files[0];
      this.classForm.patchValue({ videoFile: this.selectedVideoFile });
      this.classForm.markAsDirty(); // Marcar formulario como modificado
      this.deleteCurrentVideo = false; // Si se selecciona un video nuevo, no eliminar el original
      
      // Usar createObjectURL en lugar de FileReader para videos grandes
      // Esto evita cargar todo el video en memoria como base64
      // Mostrar el video local seleccionado (tiene prioridad sobre el video original)
      this.videoPreview = URL.createObjectURL(this.selectedVideoFile);
      
      // Limpiar Player.js anterior si existe (ya que cambiamos a un video local)
      this.destroyBunnyStreamPlayer();
    }
  }

  clearVideoPreview(): void {
    // Limpiar Player.js si existe
    this.destroyBunnyStreamPlayer();
    
    // Limpiar blob URL si existe para evitar memory leaks
    if (this.videoPreview && this.videoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(this.videoPreview);
    }
    this.selectedVideoFile = null;
    this.classForm.patchValue({ videoFile: null });
    
    // Si había un video original y no está marcado para eliminar, restaurarlo
    if (this.originalVideoUrl && !this.deleteCurrentVideo) {
      this.videoPreview = this.originalVideoUrl;
      // Inicializar Player.js si es Bunny Stream
      setTimeout(() => {
        if (this.isBunnyStreamUrl(this.videoPreview)) {
          this.initBunnyStreamPlayer();
        }
      }, 500);
    } else {
      this.videoPreview = null;
    }
  }

  toggleDeleteVideo(): void {
    this.deleteCurrentVideo = !this.deleteCurrentVideo;
    this.classForm.markAsDirty();
    
    // Si se marca para eliminar, ocultar el video
    // Si se desmarca y hay video original, mostrarlo
    if (this.deleteCurrentVideo) {
      // Limpiar Player.js si existe
      this.destroyBunnyStreamPlayer();
      // Si hay un blob URL, limpiarlo
      if (this.videoPreview && this.videoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(this.videoPreview);
      }
      this.videoPreview = null;
    } else if (this.originalVideoUrl && !this.selectedVideoFile) {
      // Restaurar el video original si se desmarca y no hay video local
      this.videoPreview = this.originalVideoUrl;
      // Inicializar Player.js si es Bunny Stream
      setTimeout(() => {
        if (this.isBunnyStreamUrl(this.videoPreview)) {
          this.initBunnyStreamPlayer();
        }
      }, 500);
    }
  }

  getClassImageUrl(imageUrl?: string): string {
    if (!imageUrl) return '';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    return `https://cursala.b-cdn.net/class-images/${encodeURIComponent(imageUrl)}`;
  }

  getClassVideoUrl(videoUrl?: string): string {
    if (!videoUrl) return '';
    // Si ya es una URL completa (incluye http/https), devolverla tal cual
    if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
      return videoUrl;
    }
    // Si es una URL de Bunny Stream (vz-*.b-cdn.net), devolverla tal cual
    if (videoUrl.includes('vz-') && videoUrl.includes('.b-cdn.net')) {
      return videoUrl;
    }
    // Si es una URL antigua de storage, no intentar construir la URL (ya no existe)
    // Esto evita errores de CORS cuando el video fue eliminado
    return '';
  }

  /**
   * Verifica si la URL del video es de Bunny Stream (requiere iframe)
   */
  isBunnyStreamUrl(videoUrl: string | null | undefined): boolean {
    if (!videoUrl) return false;
    return videoUrl.includes('vz-') && videoUrl.includes('.b-cdn.net');
  }

  /**
   * Obtiene la URL del video, convirtiendo URLs de Bunny Stream al reproductor embebido
   */
  getVideoUrl(videoUrl: string | null | undefined): SafeResourceUrl {
    if (!videoUrl) return this.sanitizer.bypassSecurityTrustResourceUrl('');
    
    // Si no es Bunny Stream, devolver la URL original sanitizada
    if (!this.isBunnyStreamUrl(videoUrl)) {
      const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(videoUrl);
      return safeUrl;
    }
    
    // Usar caché para evitar recalcular múltiples veces
    if (this.videoEmbedUrlCache.has(videoUrl)) {
      return this.videoEmbedUrlCache.get(videoUrl)!;
    }
    
    // Si es una URL de Bunny Stream (vz-*.b-cdn.net), convertir al reproductor embebido
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
      // Sin autoplay para preview
      const embedUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?autoplay=false`;
      const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
      
      // Guardar en caché
      this.videoEmbedUrlCache.set(videoUrl, safeUrl);
      
      return safeUrl;
    }
    
    // Fallback: devolver la URL original sanitizada
    const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(videoUrl);
    this.videoEmbedUrlCache.set(videoUrl, safeUrl);
    return safeUrl;
  }

  handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }

  onSupportFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      // Agregar los archivos seleccionados al array
      const newFiles = Array.from(input.files);
      this.selectedSupportFiles = [...this.selectedSupportFiles, ...newFiles];
      this.classForm.markAsDirty();
      // Limpiar el input para permitir seleccionar el mismo archivo nuevamente
      input.value = '';
    }
  }

  removeSupportFile(index: number): void {
    this.selectedSupportFiles.splice(index, 1);
    this.classForm.markAsDirty();
  }

  removeExistingSupportMaterial(material: string): void {
    this.supportMaterialsToDelete.push(material);
    this.existingSupportMaterials = this.existingSupportMaterials.filter(m => m !== material);
    this.classForm.markAsDirty();
  }

  getSupportMaterialUrl(fileName: string): string {
    if (fileName.startsWith('http://') || fileName.startsWith('https://')) {
      return fileName;
    }
    return `https://cursala.b-cdn.net/support-materials/${encodeURIComponent(fileName)}`;
  }

  getSupportMaterialName(fileName: string): string {
    // Extraer solo el nombre del archivo sin la ruta
    return fileName.split('/').pop() || fileName;
  }

  downloadSupportMaterial(fileName: string): void {
    const url = this.getSupportMaterialUrl(fileName);
    window.open(url, '_blank');
  }

  hasChanges(): boolean {
    // En modo edición, verificar si hay cambios en el formulario o archivos seleccionados
    if (this.isEditMode) {
      return this.classForm.dirty ||
             this.selectedImageFile !== null ||
             this.selectedVideoFile !== null ||
             this.selectedSupportFiles.length > 0 ||
             this.supportMaterialsToDelete.length > 0;
    }
    // En modo creación, siempre hay cambios si el formulario es válido
    return true;
  }

  canSubmit(): boolean {
    // Verificar que el formulario sea válido
    if (this.classForm.invalid) {
      return false;
    }
    // En modo edición, verificar que haya cambios
    if (this.isEditMode && !this.hasChanges()) {
      return false;
    }
    return true;
  }

  onSubmit(): void {
    if (this.classForm.invalid) {
      this.classForm.markAllAsTouched();
      this.info.showError('Por favor, completa todos los campos requeridos');
      return;
    }

    this.saving.set(true);
    
    const formValue = this.classForm.value;

    const classData: any = {
      name: formValue.name,
      description: formValue.description,
      courseId: formValue.courseId,
      linkLive: formValue.linkLive || undefined
    };

    if (this.selectedImageFile) {
      classData.imageFile = this.selectedImageFile;
    }
    
    // Si se debe eliminar la imagen y no hay nueva imagen
    if (this.isEditMode && this.deleteCurrentImage && !this.selectedImageFile) {
      classData.deleteCurrentImage = 'true';
    }

    if (this.selectedVideoFile) {
      classData.videoFile = this.selectedVideoFile;
    }

    // Si se marca para eliminar el video original (solo en modo edición)
    if (this.isEditMode && this.deleteCurrentVideo && !this.selectedVideoFile) {
      classData.deleteCurrentVideo = 'true';
    }

    // Agregar archivos de apoyo
    if (this.selectedSupportFiles.length > 0) {
      classData.supportMaterials = this.selectedSupportFiles;
    }

    // En modo edición, mantener los materiales existentes que no se eliminaron
    if (this.isEditMode && this.supportMaterialsToDelete.length > 0) {
      // Filtrar los materiales eliminados
      const remainingMaterials = this.existingSupportMaterials.filter(
        m => !this.supportMaterialsToDelete.includes(m)
      );
      classData.supportMaterialIds = remainingMaterials;
    } else if (this.isEditMode && this.existingSupportMaterials.length > 0) {
      classData.supportMaterialIds = this.existingSupportMaterials;
    }

    if (this.isEditMode && this.classId) {
      // Actualizar clase existente
      this.classesService.updateClass(this.classId, classData).subscribe({
        next: (response) => {
          const classResponse = response?.data || response;
          const hasVideo = !!this.selectedVideoFile;
          
          if (hasVideo && classResponse?._id) {
            // Si hay video, mostrar mensaje y navegar a la lista donde se verá el progreso
            this.info.showSuccess('Clase actualizada. El video se está procesando en segundo plano...');
          } else {
            this.info.showSuccess('Clase actualizada exitosamente');
          }
          // Siempre navegar a la lista de clases
          this.router.navigate(['/profesor/classes'], {
            queryParams: { courseId: this.courseId }
          });
        },
        error: (error) => {
          console.error('Error updating class:', error);
          this.info.showError('Error al actualizar la clase');
          this.saving.set(false);
        }
      });
    } else {
      // Crear nueva clase
      this.classesService.createClass(classData).subscribe({
        next: (response) => {
          const classResponse = response?.data || response;
          const hasVideo = !!this.selectedVideoFile;
          
          if (hasVideo && classResponse?._id) {
            // Si hay video, mostrar mensaje y navegar a la lista donde se verá el progreso
            this.info.showSuccess('Clase creada. El video se está procesando en segundo plano...');
          } else {
            this.info.showSuccess('Clase creada exitosamente');
          }
          // Siempre navegar a la lista de clases
          this.router.navigate(['/profesor/classes'], {
            queryParams: { courseId: classData.courseId }
          });
        },
        error: (error) => {
          console.error('Error creating class:', error);
          const errorMsg = error?.error?.message || 'Error al crear la clase';
          this.info.showError(errorMsg);
          this.saving.set(false);
        }
      });
    }
  }

  onCancel(): void {
    // Limpiar suscripción si existe
    this.cleanupProgressSubscription();
    
    // Navegar de vuelta con el curso seleccionado si existe
    if (this.courseId) {
      this.router.navigate(['/profesor/classes'], {
        queryParams: { courseId: this.courseId }
      });
    } else {
      this.router.navigate(['/profesor/classes']);
    }
  }

  /**
   * Conecta al stream SSE para recibir actualizaciones de progreso
   */
  private connectToProgressStream(classId: string): void {
    // No conectar si no hay classId
    if (!classId) return;
    
    // IMPORTANTE: No conectar si no hay videoUrl (original o seleccionado)
    // Esto previene conexiones SSE cuando el video fue eliminado
    if (!this.originalVideoUrl && !this.selectedVideoFile) {
      // Limpiar estado si no hay video
      this.videoStatus.set(null);
      this.videoUploadProgress.set(0);
      this.isUploadingVideo.set(false);
      this.cleanupProgressSubscription();
      return;
    }
    
    // Limpiar suscripción anterior si existe
    if (this.progressSubscription) {
      this.progressSubscription.unsubscribe();
      this.progressSubscription = null;
    }

    this.videoUploadProgress.set(0);
    this.isUploadingVideo.set(true);

    this.progressSubscription = this.videoUploadProgressService.getUploadProgress(classId).subscribe({
      next: (event) => {
        if (event.error) {
          this.videoStatus.set('error');
          this.isUploadingVideo.set(false);
          this.info.showError('Error al procesar el video: ' + event.error);
          this.cleanupProgressSubscription();
        } else {
          this.videoUploadProgress.set(event.percent);
          if (event.percent >= 100) {
            this.videoStatus.set('ready');
            this.isUploadingVideo.set(false);
            this.info.showSuccess('Video procesado exitosamente');
            // Recargar datos de la clase para obtener el videoUrl actualizado
            if (classId) {
              this.loadClass();
            }
            this.cleanupProgressSubscription();
          }
        }
      },
      error: (error) => {
        // Solo mostrar error si realmente hay un video que se está procesando
        // Si el video fue eliminado, silenciar el error
        if (this.originalVideoUrl || this.selectedVideoFile) {
          console.error('Error en stream de progreso:', error);
          this.videoStatus.set('error');
          this.isUploadingVideo.set(false);
          this.info.showError('Error al conectar con el servidor para el progreso del video');
        } else {
          // Si no hay video, simplemente limpiar el estado
          this.videoStatus.set(null);
          this.isUploadingVideo.set(false);
        }
        this.cleanupProgressSubscription();
      }
    });
  }

  /**
   * Limpia la suscripción al stream de progreso
   */
  private cleanupProgressSubscription(): void {
    if (this.progressSubscription) {
      this.progressSubscription.unsubscribe();
      this.progressSubscription = null;
    }
  }

  /**
   * Inicializa Player.js para controlar el reproductor de Bunny Stream
   */
  initBunnyStreamPlayer(): void {
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

      // Esperar a que el reproductor esté listo
      this.bunnyStreamPlayer.on('ready', () => {
        console.log('Bunny Stream Player.js listo para preview');
        // No hacer autoplay, solo mostrar el preview
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
      }
    }
  }

  ngOnDestroy(): void {
    // Limpiar suscripción al destruir el componente
    this.cleanupProgressSubscription();
    
    // Limpiar Player.js
    this.destroyBunnyStreamPlayer();
    
    // Limpiar blob URLs para evitar memory leaks
    if (this.videoPreview && this.videoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(this.videoPreview);
      this.videoPreview = null;
    }
  }
}

