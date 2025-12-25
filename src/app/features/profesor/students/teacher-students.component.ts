import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { ViewModeService } from '../../../core/services/view-mode.service';
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
}

@Component({
  selector: 'app-teacher-students',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './teacher-students.component.html',
})
export class TeacherStudentsComponent implements OnInit {
  private authService = inject(AuthService);
  private viewModeService = inject(ViewModeService);
  private http = inject(HttpClient);
  
  user = this.authService.currentUser;
  students = signal<Student[]>([]);
  loading = signal<boolean>(true);
  groupedStudents = signal<Map<string, Student[]>>(new Map());

  ngOnInit(): void {
    this.viewModeService.initializeViewMode();
    this.loadStudents();
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
}

