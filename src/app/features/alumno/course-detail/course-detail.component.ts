import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { CoursesService, Course } from '../../../core/services/courses.service';
import { CourseProgressService, CourseProgress } from '../../../core/services/course-progress.service';
import { QuestionnairesService, Questionnaire } from '../../../core/services/questionnaires.service';
import { CertificateService } from '../../../core/services/certificate.service';
import { InfoService } from '../../../core/services/info.service';
import { AuthService } from '../../../core/services/auth.service';
import { EnrollModalComponent } from '../../../shared/components/enroll-modal/enroll-modal.component';
import { UnenrollModalComponent } from '../../../shared/components/unenroll-modal/unenroll-modal.component';
import { PurchaseModalComponent } from '../../../shared/components/purchase-modal/purchase-modal.component';

interface CourseItem {
  type: 'class' | 'questionnaire';
  data: any;
  index: number;
}

@Component({
  selector: 'app-course-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, EnrollModalComponent, UnenrollModalComponent, PurchaseModalComponent],
  templateUrl: './course-detail.component.html',
})
export class CourseDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private routerSubscription?: Subscription;
  private coursesService = inject(CoursesService);
  private progressService = inject(CourseProgressService);
  private questionnairesService = inject(QuestionnairesService);
  private certificateService = inject(CertificateService);
  private info = inject(InfoService);
  private authService = inject(AuthService);

  course = signal<Course | null>(null);
  courseProgress = signal<CourseProgress | null>(null);
  questionnaires = signal<Questionnaire[]>([]);
  courseItems = signal<CourseItem[]>([]);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  showEnrollModal = signal<boolean>(false);
  showPurchaseModal = signal<boolean>(false);
  showUnenrollModal = signal<boolean>(false);
  isEnrolling = signal<boolean>(false);
  isUnenrolling = signal<boolean>(false);
  enrollError = signal<string | null>(null);
  
  // Certificate state
  certificateExists = signal<boolean>(false);
  certificateLoading = signal<boolean>(false);
  certificateVerificationCode = signal<string | null>(null);

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

        // Construir items del curso inmediatamente después de cargar el curso
        // Esto asegura que las clases se muestren incluso si no hay cuestionarios
        this.buildCourseItems();

        // Cargar cuestionarios del curso
        this.loadQuestionnaires(courseId);

        // Cargar progreso del curso si el usuario está inscrito
        if (this.isEnrolled()) {
          this.loadCourseProgress(courseId);
          // Verificar si existe certificado si el curso está completado
          this.checkCertificateExists(courseId);
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
    // Filtrar solo clases activas
    const classes = (course.classes || []).filter((c: any) => c.status === 'ACTIVE');

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

  /**
   * Verificar si es un curso tipo workshop (una sola clase con enlace externo y sin video)
   */
  isWorkshopType(): boolean {
    const course = this.course();
    if (!course) return false;
    
    const classes = course.classes || [];
    // Debe tener exactamente una clase
    if (classes.length !== 1) return false;
    
    const singleClass = classes[0];
    // La clase debe tener linkLive (enlace externo)
    if (!singleClass.linkLive) return false;
    
    // La clase NO debe tener videoUrl (solo imagen)
    if (singleClass.videoUrl) return false;
    
    return true;
  }

  loadCourseProgress(courseId: string): void {
    // No cargar progreso si es un curso tipo workshop
    if (this.isWorkshopType()) {
      this.loading.set(false);
      return;
    }

    this.progressService.getProgress(courseId).subscribe({
      next: (response: any) => {
        const progress = response?.data || response;
        this.courseProgress.set(progress);
        this.loading.set(false);
        // Si el curso está completado (>= 100%), verificar certificado
        if (progress?.overallProgress >= 100) {
          this.checkCertificateExists(courseId);
        }
      },
      error: (error) => {
        console.error('Error loading course progress:', error);
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

  /**
   * Verifica si una clase está completada
   */
  isClassCompleted(classId: string): boolean {
    const progress = this.courseProgress();
    if (!progress || !progress.classesProgress) return false;
    
    const normalizedClassId = this.normalizeId(classId);
    const classProgress = progress.classesProgress.find(cp => {
      const cpClassId = this.normalizeId(cp.classId);
      return cpClassId === normalizedClassId;
    });
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
    this.router.navigate(['/alumno/courses']);
  }

  openEnrollModal(): void {
    const courseData = this.course();
    if (courseData && (!courseData.price || courseData.price === 0)) {
      this.showEnrollModal.set(true);
      this.enrollError.set(null);
    }
  }

  openPurchaseModal(): void {
    const courseData = this.course();
    if (courseData && courseData.price && courseData.price > 0) {
      this.showPurchaseModal.set(true);
    }
  }

  closePurchaseModal(): void {
    this.showPurchaseModal.set(false);
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
    // No mostrar progreso si es un workshop
    if (this.isWorkshopType()) return false;

    const progress = this.courseProgress();
    if (!progress) return false;

    const hasClassProgress = progress.classesProgress && progress.classesProgress.length > 0;
    const hasQuestionnaireProgress = progress.questionnairesProgress && progress.questionnairesProgress.length > 0;

    return hasClassProgress || hasQuestionnaireProgress || false;
  }

  /**
   * Obtiene el número de clases completadas (filtrando duplicados)
   */
  getCompletedClassesCount(): number {
    const progress = this.courseProgress();
    const course = this.course();
    if (!progress || !progress.classesProgress || !course || !course.classes) return 0;
    
    // Obtener IDs únicos de clases del curso (solo activas)
    const courseClassIds = new Set(
      course.classes
        .filter((c: any) => c.status === 'ACTIVE')
        .map((c: any) => this.normalizeId(c._id))
    );
    
    // Filtrar clases completadas que realmente existen en el curso y eliminar duplicados
    const completedClassIds = new Set<string>();
    progress.classesProgress.forEach(cp => {
      if (cp.completed) {
        const classId = this.normalizeId(cp.classId);
        if (courseClassIds.has(classId)) {
          completedClassIds.add(classId);
        }
      }
    });
    
    return completedClassIds.size;
  }

  /**
   * Obtiene el número de cuestionarios completados (filtrando duplicados)
   */
  getCompletedQuestionnairesCount(): number {
    const progress = this.courseProgress();
    const questionnaires = this.questionnaires();
    if (!progress || !progress.questionnairesProgress || !questionnaires) return 0;
    
    // Obtener IDs únicos de cuestionarios activos
    const activeQuestionnaireIds = new Set(
      questionnaires
        .filter(q => q.status === 'ACTIVE')
        .map(q => this.normalizeId(q._id))
    );
    
    // Filtrar cuestionarios completados que realmente existen y eliminar duplicados
    const completedQuestionnaireIds = new Set<string>();
    progress.questionnairesProgress.forEach(qp => {
      if (qp.completed) {
        const questionnaireId = this.normalizeId(qp.questionnaireId);
        if (activeQuestionnaireIds.has(questionnaireId)) {
          completedQuestionnaireIds.add(questionnaireId);
        }
      }
    });
    
    return completedQuestionnaireIds.size;
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
    // No mostrar progreso si es un workshop
    if (this.isWorkshopType()) return 0;
    
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

  goToClass(classData: any, itemIndex: number): void {
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

    // Verificar si puede acceder a esta clase usando canAccessItem que considera cuestionarios
    if (!this.canAccessItem(itemIndex)) {
      this.info.showInfo('Debes completar los elementos anteriores (clases y cuestionarios) para acceder a esta clase');
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

    const normalizedQuestionnaireId = this.normalizeId(questionnaireId);
    const questionnaireProgress = progress.questionnairesProgress.find((qp: any) => {
      const qpQuestionnaireId = this.normalizeId(qp.questionnaireId);
      return qpQuestionnaireId === normalizedQuestionnaireId;
    });
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

  checkCertificateExists(courseId: string): void {
    const user = this.currentUser();
    if (!user?._id) return;

    this.certificateService.checkCertificateExists(user._id, courseId).subscribe({
      next: (response: any) => {
        const check = response?.data;
        if (check?.exists && check?.certificate) {
          this.certificateExists.set(true);
          this.certificateVerificationCode.set(check.certificate.verificationCode);
        } else {
          this.certificateExists.set(false);
        }
      },
      error: (error) => {
        console.error('Error checking certificate:', error);
        // Si hay error, asumimos que no existe
        this.certificateExists.set(false);
      }
    });
  }

  async downloadCertificate(): Promise<void> {
    const user = this.currentUser();
    const course = this.course();
    
    if (!user?._id || !course?._id) {
      this.info.showError('Error: No se pudo obtener la información del usuario o curso');
      return;
    }

    this.certificateLoading.set(true);

    try {
      // Si ya existe un certificado, descargarlo directamente
      if (this.certificateExists() && this.certificateVerificationCode()) {
        await this.downloadCertificatePDF(this.certificateVerificationCode()!);
        this.certificateLoading.set(false);
        return;
      }

      // Si no existe, generar uno nuevo
      const teacherId = course.mainTeacher || course.mainTeacherInfo?.teacherId;
      if (!teacherId) {
        this.info.showError('Error: No se encontró el profesor del curso');
        this.certificateLoading.set(false);
        return;
      }

      // Generar el certificado
      this.certificateService.generateCertificate(user._id, course._id, teacherId).subscribe({
        next: async (response: any) => {
          const certificate = response?.data;
          if (certificate?.verificationCode) {
            this.certificateExists.set(true);
            this.certificateVerificationCode.set(certificate.verificationCode);
            // Descargar el certificado
            await this.downloadCertificatePDF(certificate.verificationCode);
            this.info.showSuccess('Certificado generado y descargado exitosamente');
            
            // Abrir la URL pública del certificado en una nueva pestaña
            const publicUrl = `/certificate/${certificate.verificationCode}`;
            window.open(publicUrl, '_blank');
          } else {
            this.info.showError('Error: No se pudo generar el certificado');
          }
          this.certificateLoading.set(false);
        },
        error: (error) => {
          console.error('Error generating certificate:', error);
          let errorMessage = 'Error al generar el certificado';
          if (error?.error?.message) {
            errorMessage = error.error.message;
          }
          this.info.showError(errorMessage);
          this.certificateLoading.set(false);
        }
      });
    } catch (error) {
      console.error('Error in downloadCertificate:', error);
      this.info.showError('Error al procesar la solicitud del certificado');
      this.certificateLoading.set(false);
    }
  }

  private downloadCertificatePDF(verificationCode: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.certificateService.downloadCertificate(verificationCode).subscribe({
        next: (blob: Blob) => {
          // Crear un enlace temporal para descargar el PDF
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          const courseName = this.course()?.name || 'curso';
          link.download = `certificado-${courseName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          resolve();
        },
        error: (error) => {
          console.error('Error downloading certificate:', error);
          this.info.showError('Error al descargar el certificado');
          reject(error);
        }
      });
    });
  }

  getCertificatePublicUrl(): string {
    const verificationCode = this.certificateVerificationCode();
    if (!verificationCode) return '';
    return `${window.location.origin}/certificate/${verificationCode}`;
  }

  openCertificatePublicUrl(): void {
    const verificationCode = this.certificateVerificationCode();
    if (!verificationCode) return;
    const publicUrl = `/certificate/${verificationCode}`;
    window.open(publicUrl, '_blank');
  }
}

