import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { ViewModeService } from '../../../core/services/view-mode.service';
import { QuestionnairesService } from '../../../core/services/questionnaires.service';
import { CoursesService, Course } from '../../../core/services/courses.service';
import { UserRole } from '../../../core/models/user-role.enum';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../core/config/environment';
import { InfoService } from '../../../core/services/info.service';
import { ConfirmModalComponent, ConfirmModalConfig } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { CertificateService } from '../../../core/services/certificate.service';

interface Student {
  userId: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl?: string;
  courseId: string;
  courseName: string;
  startDate: Date;
  endDate: Date;
  progress: number;
  completedClasses: number;
  totalClasses: number;
  completedQuestionnaires: number;
  totalQuestionnaires: number;
}

interface PendingExam {
  submissionId: string;
  questionnaireId: string;
  questionnaireTitle: string;
  courseId: string;
  courseName: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  submittedAt: Date;
}

@Component({
  selector: 'app-teacher-students',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmModalComponent],
  templateUrl: './teacher-students.component.html',
})
export class TeacherStudentsComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private viewModeService = inject(ViewModeService);
  private http = inject(HttpClient);
  private questionnairesService = inject(QuestionnairesService);
  private route = inject(ActivatedRoute);
  private coursesService = inject(CoursesService);
  private router = inject(Router);
  private info = inject(InfoService);
  private certificateService = inject(CertificateService);
  
  user = this.authService.currentUser;
  students = signal<Student[]>([]);
  loading = signal<boolean>(false);
  groupedStudents = signal<Map<string, Student[]>>(new Map());
  courses = signal<Course[]>([]);
  selectedCourseId = '';
  courseFilter = '';
  showCourseDropdown = signal<boolean>(false);
  searchTerms = signal<Record<string, string>>({});
  pendingExams = signal<PendingExam[]>([]);
  pendingExamsByStudent = signal<Map<string, PendingExam[]>>(new Map());
  private routerSubscription?: Subscription;

  // Modal de confirmación para certificados
  showCertificateModal = signal<boolean>(false);
  studentForCertificate: Student | null = null;
  certificateModalConfig: ConfirmModalConfig = {
    title: 'Generar Certificado Manualmente',
    message: '',
    confirmText: 'Generar',
    cancelText: 'Cancelar',
    confirmButtonClass: 'bg-green-600 hover:bg-green-700',
    icon: 'info'
  };
  generatingCertificate = signal<boolean>(false);

  // Modal de confirmación para resetear progreso
  showResetModal = signal<boolean>(false);
  studentToReset: Student | null = null;
  resetModalConfig: ConfirmModalConfig = {
    title: 'Resetear Progreso del Alumno',
    message: '',
    confirmText: 'Resetear',
    cancelText: 'Cancelar',
    confirmButtonClass: 'bg-red-600 hover:bg-red-700',
    icon: 'danger'
  };
  resettingProgress = signal<boolean>(false);

  // Modal de confirmación para desasociar alumno
  showUnenrollModal = signal<boolean>(false);
  studentToUnenroll: Student | null = null;
  unenrollModalConfig: ConfirmModalConfig = {
    title: 'Desasociar Alumno del Curso',
    message: '',
    confirmText: 'Desasociar',
    cancelText: 'Cancelar',
    confirmButtonClass: 'bg-red-600 hover:bg-red-700',
    icon: 'danger'
  };
  unenrollingStudent = signal<boolean>(false);

  private examGradedHandler = () => {
    this.loadPendingExams();
  };

  ngOnInit(): void {
    // Cargar cursos inicialmente; los estudiantes se cargan por curso cuando se selecciona
    this.loadCourses();

    // Si se pasa courseId por query params, cargar estudiantes de ese curso
    this.route.queryParamMap.subscribe(params => {
      const courseId = params.get('courseId');
      if (courseId) {
        this.selectedCourseId = courseId;
        this.courseFilter = '';
        this.loadStudentsByCourse(courseId);
      }
    });

    // Actualizar cuando se navega (especialmente después de calificar)
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.loadPendingExams();
      });

    // Escuchar evento personalizado cuando se califica un examen
    window.addEventListener('exam-graded', this.examGradedHandler);
  }

  loadCourses(): void {
    const currentUser = this.user();
    if (!currentUser?._id) return;

    // Admin in profesor mode: load all courses (use a large page_size)
    if (this.authService.hasRole(UserRole.ADMIN) && this.viewModeService.isProfesorMode()) {
      this.coursesService.getCourses({ page_size: 1000 }).subscribe({
        next: (response: any) => {
          this.courses.set(response?.data || []);
        },
        error: (error) => {
          console.error('Error loading courses:', error);
          this.courses.set([]);
        }
      });
    } else {
      // Regular teacher: load only their courses
      this.coursesService.getTeacherCourses(currentUser._id).subscribe({
        next: (response: any) => {
          this.courses.set(response?.data || []);
        },
        error: (error) => {
          console.error('Error loading teacher courses:', error);
          this.courses.set([]);
        }
      });
    }
  }

  onCourseChange(): void {
    // no-op additional side effects currently; kept for parity with other components
    // Filtering is applied in getters that read `selectedCourseId`
  }

  filteredCourses(): Course[] {
    const term = this.courseFilter ? this.courseFilter.toLowerCase().trim() : '';
    const list = this.courses();
    if (!term) return list;
    return list.filter(c => (c.name || '').toLowerCase().includes(term));
  }

  selectCourse(courseId: string | '', courseName?: string): void {
    this.selectedCourseId = courseId || '';
    // if an explicit name provided, update the visible filter to that name
    this.courseFilter = courseName || '';
    this.showCourseDropdown.set(false);
    // Load students for the selected course; if empty id, load all students
    if (this.selectedCourseId) {
      this.loadStudentsByCourse(this.selectedCourseId);
    } else {
      this.loadStudents();
    }
  }

  onCourseInputFocus(): void {
    this.showCourseDropdown.set(true);
  }

  onCourseInputBlur(): void {
    // Delay hiding to allow click on dropdown items
    setTimeout(() => this.showCourseDropdown.set(false), 200);
  }

  clearCourseFilter(): void {
    // Limpiar el texto visible en el combobox y dejar la lista vacía (sin recargar).
    this.courseFilter = '';
    this.selectedCourseId = '';
    this.showCourseDropdown.set(false);
    // Vaciar arrays/maps que muestran alumnos y exámenes pendientes
    this.students.set([]);
    this.groupedStudents.set(new Map());
    this.pendingExams.set([]);
    this.pendingExamsByStudent.set(new Map());
  }

  onCourseSearchChange(courseId: string, value: string): void {
    this.searchTerms.update(prev => ({ ...(prev || {}), [courseId]: value }));
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
    window.removeEventListener('exam-graded', this.examGradedHandler);
  }

  loadStudents(): void {
    const currentUser = this.user();
    if (!currentUser?._id) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);

    // Si el usuario es admin y está en modo profesor, cargar estudiantes de todos los cursos
    // Si es profesor normal, cargar solo estudiantes de sus cursos
    if (this.authService.hasRole(UserRole.ADMIN) && this.viewModeService.isProfesorMode()) {
      // Admin en modo profesor: usar el nuevo endpoint que obtiene todos los estudiantes
      this.http.get<any>(`${environment.apiUrl}/user/getAllStudentsFromAllCourses`).subscribe({
        next: (response: any) => {
          const data = response?.data || [];
          this.processStudents(data);
        },
        error: (error) => {
          console.error('Error loading all students:', error);
          this.students.set([]);
          this.loading.set(false);
        }
      });
    } else {
      // Profesor normal: usar el endpoint existente
      this.http.get<any>(`${environment.apiUrl}/user/getStudentsByTeacherCourses/${currentUser._id}`).subscribe({
        next: (response: any) => {
          const data = response?.data || [];
          this.processStudents(data);
        },
        error: (error) => {
          console.error('Error loading students:', error);
          this.students.set([]);
          this.loading.set(false);
        }
      });
    }
  }


  processStudents(data: Student[]): void {
    this.students.set(Array.isArray(data) ? data : []);
    
    // Agrupar estudiantes por curso
    const grouped = new Map<string, Student[]>();
    this.students().forEach(student => {
      const courseName = student.courseName;
      if (!grouped.has(courseName)) {
        grouped.set(courseName, []);
      }
      grouped.get(courseName)!.push(student);
    });
    
    this.groupedStudents.set(grouped);
    
    this.loading.set(false);
  }

  getStudentImageUrl(profilePhotoUrl?: string): string {
    if (!profilePhotoUrl) return '';
    if (profilePhotoUrl.startsWith('http://') || profilePhotoUrl.startsWith('https://')) {
      return profilePhotoUrl;
    }
    return `https://cursala.b-cdn.net/profile-images/${encodeURIComponent(profilePhotoUrl)}`;
  }

  handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }

  formatDate(date: Date | string | undefined): string {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  getGroupedStudentsArray(): Array<{ courseName: string; students: Student[] }> {
    const grouped = this.groupedStudents();
    return Array.from(grouped.entries()).map(([courseName, students]) => ({
      courseName,
      students
    }));
  }

  getFilteredGroupedStudentsArray(): Array<{ courseId: string; courseName: string; students: Student[] }> {
    const selected = this.selectedCourseId ? String(this.selectedCourseId) : '';
    const search = this.searchTerms();
    let list = this.students();
    if (selected) {
      list = list.filter(s => {
        let sid: any = (s as any).courseId;
        if (sid == null) return false;
        if (typeof sid === 'object') {
          sid = sid._id || sid.id || JSON.stringify(sid);
        }
        return String(sid) === selected || String(sid) == selected;
      });
    }

    const grouped = new Map<string, { courseName: string; students: Student[] }>();
    list.forEach(student => {
      const courseId = student.courseId || 'unknown';
      const courseName = student.courseName || 'Sin nombre';
      if (!grouped.has(courseId)) {
        grouped.set(courseId, { courseName, students: [] });
      }
      grouped.get(courseId)!.students.push(student);
    });

    // Apply per-course search filtering but keep courses visible even if no students match
    const result: Array<{ courseId: string; courseName: string; students: Student[] }> = [];
    grouped.forEach((value, courseId) => {
      const term = (search && search[courseId]) ? search[courseId].toLowerCase().trim() : '';
      let students = value.students;
      if (term) {
        students = students.filter(s => {
          const fullName = (s.firstName + ' ' + s.lastName).toLowerCase();
          return fullName.includes(term) || (s.email || '').toLowerCase().includes(term);
        });
      }
      // Always include the course entry; show empty students array if none match
      result.push({ courseId, courseName: value.courseName, students });
    });

    return result;
  }

  getSelectedCourseName(): string {
    if (!this.selectedCourseId) return '';
    const c = this.courses().find(x => x._id === this.selectedCourseId);
    return c ? c.name : '';
  }

  // Notificaciones deshabilitadas temporalmente
  loadPendingExams(): void {
    // this.questionnairesService.getPendingGradingByTeacher().subscribe({
    //   next: (response: any) => {
    //     const exams = response?.data || [];
    //     this.pendingExams.set(Array.isArray(exams) ? exams : []);

    //     // Agrupar exámenes por estudiante
    //     const byStudent = new Map<string, PendingExam[]>();
    //     this.pendingExams().forEach(exam => {
    //       const studentId = exam.studentId;
    //       if (!byStudent.has(studentId)) {
    //         byStudent.set(studentId, []);
    //       }
    //       byStudent.get(studentId)!.push(exam);
    //     });
    //     this.pendingExamsByStudent.set(byStudent);
    //   },
    //   error: (error) => {
    //     console.error('Error loading pending exams:', error);
    //     this.pendingExams.set([]);
    //     this.pendingExamsByStudent.set(new Map());
    //   }
    // });
  }

  getPendingExamsForStudent(studentId: string): PendingExam[] {
    return this.pendingExamsByStudent().get(studentId) || [];
  }

  hasPendingExams(studentId: string): boolean {
    return this.getPendingExamsForStudent(studentId).length > 0;
  }

  goToExam(exam: PendingExam): void {
    // Navegar a la página de resultados del cuestionario para calificar
    this.router.navigate(['/profesor/questionnaires', exam.questionnaireId, 'results']);
  }

  /**
   * Abre el modal de confirmación para resetear el progreso de un estudiante
   */
  openResetProgressModal(student: Student): void {
    this.studentToReset = student;
    this.resetModalConfig = {
      ...this.resetModalConfig,
      message: `¿Estás seguro de que quieres resetear el progreso de ${student.firstName} ${student.lastName} en el curso "${student.courseName}"? Esta acción eliminará:
      
• Todos los videos vistos de las clases
• Todos los cuestionarios completados
• Todas las respuestas de exámenes
• El progreso general del curso

Esta acción no se puede deshacer.`
    };
    this.showResetModal.set(true);
  }

  /**
   * Resetea el progreso completo del estudiante
   */
  confirmResetProgress(): void {
    if (!this.studentToReset) {
      return;
    }

    this.resettingProgress.set(true);
    const student = this.studentToReset;

    this.http.delete<any>(
      `${environment.apiUrl}/courseProgress/${student.courseId}/student/${student.userId}`
    ).subscribe({
      next: (response: any) => {
        this.info.showSuccess(`Progreso de ${student.firstName} ${student.lastName} reseteado exitosamente`);
        this.showResetModal.set(false);
        this.studentToReset = null;
        this.resettingProgress.set(false);
        // Recargar la lista de estudiantes para actualizar el progreso
        this.loadStudents();
      },
      error: (error) => {
        console.error('Error reseteando progreso:', error);
        const errorMsg = error?.error?.message || 'Error al resetear el progreso del estudiante';
        this.info.showError(errorMsg);
        this.resettingProgress.set(false);
      }
    });
  }

  /**
   * Cancela el reseteo de progreso
   */
  cancelResetProgress(): void {
    this.showResetModal.set(false);
    this.studentToReset = null;
  }

  /**   * Abre el modal para generar certificado manualmente
   */
  openCertificateModal(student: Student): void {
    this.studentForCertificate = student;
    this.certificateModalConfig = {
      ...this.certificateModalConfig,
      message: `¿Deseas generar manualmente el certificado para ${student.firstName} ${student.lastName} en el curso "${student.courseName}"? El certificado se enviará por correo electrónico al alumno automáticamente.`
    };
    this.showCertificateModal.set(true);
  }

  /**
   * Genera el certificado y lo envía al alumno
   */
  confirmGenerateCertificate(): void {
    if (!this.studentForCertificate) return;

    this.generatingCertificate.set(true);
    const student = this.studentForCertificate;

    this.certificateService.generateCertificate(student.userId, student.courseId).subscribe({
      next: (response: any) => {
        this.info.showSuccess(`Certificado para ${student.firstName} ${student.lastName} generado y enviado exitosamente`);
        
        // Descargar PDF y abrir vista del certificado en nueva pestaña
        if (response?.data?.verificationCode) {
          const verificationCode = response.data.verificationCode;

          // Descarga del PDF
          this.certificateService.downloadCertificate(verificationCode).subscribe({
            next: (blob: Blob) => {
              const url = window.URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `Certificado_${student.firstName}_${student.lastName}.pdf`;
              link.click();
              window.URL.revokeObjectURL(url);
            },
            error: (err) => console.error('Error al descargar PDF:', err)
          });

          // Abrir vista pública del certificado en nueva pestaña
          window.open(`/certificate/${verificationCode}`, '_blank', 'noopener,noreferrer');
        }

        this.showCertificateModal.set(false);
        this.studentForCertificate = null;
        this.generatingCertificate.set(false);
      },
      error: (error) => {
        console.error('Error generando certificado:', error);
        const errorMsg = error?.error?.message || 'Error al generar el certificado';
        this.info.showError(errorMsg);
        this.generatingCertificate.set(false);
      }
    });
  }

  /**
   * Cancela la generación de certificado
   */
  cancelCertificate(): void {
    this.showCertificateModal.set(false);
    this.studentForCertificate = null;
  }

  /**   * Abre el modal de confirmación para desasociar un estudiante del curso
   */
  openUnenrollModal(student: Student): void {
    this.studentToUnenroll = student;
    this.unenrollModalConfig = {
      ...this.unenrollModalConfig,
      message: `¿Estás seguro de que quieres desasociar a ${student.firstName} ${student.lastName} del curso "${student.courseName}"? Esta acción eliminará:

• La inscripción del alumno al curso
• Todos los videos vistos de las clases
• Todos los cuestionarios completados
• Todas las respuestas de exámenes
• Todas las certificaciones obtenidas
• El progreso general del curso

El alumno ya no tendrá acceso al curso y esta acción no se puede deshacer.`
    };
    this.showUnenrollModal.set(true);
  }

  /**
   * Desasocia al estudiante del curso y elimina todo su progreso
   */
  confirmUnenrollStudent(): void {
    if (!this.studentToUnenroll) {
      return;
    }

    this.unenrollingStudent.set(true);
    const student = this.studentToUnenroll;

    this.coursesService.unenrollStudentCompletely(student.courseId, student.userId).subscribe({
      next: (response: any) => {
        this.info.showSuccess(`${student.firstName} ${student.lastName} ha sido desasociado del curso exitosamente`);
        this.showUnenrollModal.set(false);
        this.studentToUnenroll = null;
        this.unenrollingStudent.set(false);
        // Recargar la lista de estudiantes para actualizar
        this.loadStudents();
      },
      error: (error) => {
        console.error('Error desasociando estudiante:', error);
        const errorMsg = error?.error?.message || 'Error al desasociar al estudiante del curso';
        this.info.showError(errorMsg);
        this.unenrollingStudent.set(false);
      }
    });
  }

  /**
   * Cancela la desasociación del estudiante
   */
  cancelUnenrollStudent(): void {
    this.showUnenrollModal.set(false);
    this.studentToUnenroll = null;
  }

  loadStudentsByCourse(courseId: string): void {
    // Fallback: el backend no expone consistentemente /user/getStudentsByCourse/:id
    // Cargamos la lista general y dejamos que el filtrado por `selectedCourseId` en el cliente
    // muestre solo los alumnos del curso seleccionado.
    this.selectedCourseId = courseId || '';
    // `loadStudents` ya gestiona `loading` y llama a `processStudents`.
    this.loadStudents();
  }

}

