import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { ViewModeService } from '../../../core/services/view-mode.service';
import { QuestionnairesService } from '../../../core/services/questionnaires.service';
import { UserRole } from '../../../core/models/user-role.enum';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../core/config/environment';

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
  imports: [CommonModule],
  templateUrl: './teacher-students.component.html',
})
export class TeacherStudentsComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private viewModeService = inject(ViewModeService);
  private http = inject(HttpClient);
  private questionnairesService = inject(QuestionnairesService);
  private router = inject(Router);
  
  user = this.authService.currentUser;
  students = signal<Student[]>([]);
  loading = signal<boolean>(true);
  groupedStudents = signal<Map<string, Student[]>>(new Map());
  pendingExams = signal<PendingExam[]>([]);
  pendingExamsByStudent = signal<Map<string, PendingExam[]>>(new Map());
  private routerSubscription?: Subscription;

  ngOnInit(): void {
    this.viewModeService.initializeViewMode();
    this.loadStudents();
    this.loadPendingExams();
    
    // Actualizar cuando se navega (especialmente después de calificar)
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.loadPendingExams();
      });
    
    // También escuchar evento personalizado cuando se califica un examen
    window.addEventListener('exam-graded', () => {
      this.loadPendingExams();
    });
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
    window.removeEventListener('exam-graded', () => {});
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

  loadPendingExams(): void {
    this.questionnairesService.getPendingGradingByTeacher().subscribe({
      next: (response: any) => {
        const exams = response?.data || [];
        this.pendingExams.set(Array.isArray(exams) ? exams : []);
        
        // Agrupar exámenes por estudiante
        const byStudent = new Map<string, PendingExam[]>();
        this.pendingExams().forEach(exam => {
          const studentId = exam.studentId;
          if (!byStudent.has(studentId)) {
            byStudent.set(studentId, []);
          }
          byStudent.get(studentId)!.push(exam);
        });
        this.pendingExamsByStudent.set(byStudent);
      },
      error: (error) => {
        console.error('Error loading pending exams:', error);
        this.pendingExams.set([]);
        this.pendingExamsByStudent.set(new Map());
      }
    });
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
}

