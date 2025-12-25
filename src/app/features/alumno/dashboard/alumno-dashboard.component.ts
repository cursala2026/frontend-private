import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { CoursesService, Course } from '../../../core/services/courses.service';
import { CourseProgressService, CourseProgress } from '../../../core/services/course-progress.service';

@Component({
  selector: 'app-alumno-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alumno-dashboard.component.html',
  
})
export class AlumnoDashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private coursesService = inject(CoursesService);
  private progressService = inject(CourseProgressService);
  private router = inject(Router);
  
  user = this.authService.currentUser;
  courses = signal<Course[]>([]);
  loading = signal<boolean>(true);
  
  // Estadísticas
  enrolledCoursesCount = signal<number>(0);
  completedCoursesCount = signal<number>(0);
  averageGrade = signal<number | null>(null);

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loading.set(true);
    
    // Cargar cursos publicados y datos del alumno en paralelo
    forkJoin({
      publishedCourses: this.coursesService.getPublishedCourses(),
      studentCourses: this.coursesService.getStudentCourses(),
      progress: this.progressService.getAllProgress()
    }).subscribe({
      next: (results) => {
        // Cursos publicados para mostrar
        const publishedData = results.publishedCourses?.data || [];
        this.courses.set(Array.isArray(publishedData) ? publishedData : []);
        
        // Cursos inscritos del alumno
        const studentCoursesData = results.studentCourses?.data || [];
        this.enrolledCoursesCount.set(Array.isArray(studentCoursesData) ? studentCoursesData.length : 0);
        
        // Progreso de cursos - el backend puede devolver { success, data } o directamente el array
        let progressData = results.progress;
        if (progressData && typeof progressData === 'object' && 'data' in progressData) {
          progressData = (progressData as any).data;
        }
        const progressArray = Array.isArray(progressData) ? progressData : [];
        
        // Calcular cursos completados (overallProgress === 100)
        const completed = progressArray.filter((p: CourseProgress) => p.overallProgress === 100).length;
        this.completedCoursesCount.set(completed);
        
        // Calcular promedio general de calificaciones
        this.calculateAverageGrade(progressArray);
        
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading dashboard data:', error);
        this.courses.set([]);
        this.enrolledCoursesCount.set(0);
        this.completedCoursesCount.set(0);
        this.averageGrade.set(null);
        this.loading.set(false);
      }
    });
  }

  calculateAverageGrade(progressArray: CourseProgress[]): void {
    const allScores: number[] = [];
    
    progressArray.forEach((progress: CourseProgress) => {
      if (progress.questionnairesProgress && progress.questionnairesProgress.length > 0) {
        progress.questionnairesProgress.forEach((qp) => {
          if (qp.bestScore !== undefined && qp.bestScore !== null) {
            allScores.push(qp.bestScore);
          }
        });
      }
    });
    
    if (allScores.length > 0) {
      const sum = allScores.reduce((acc, score) => acc + score, 0);
      const average = Math.round((sum / allScores.length) * 100) / 100; // Redondear a 2 decimales
      this.averageGrade.set(average);
    } else {
      this.averageGrade.set(null);
    }
  }

  loadCourses(): void {
    this.loading.set(true);
    this.coursesService.getPublishedCourses().subscribe({
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

  openCourseDetails(course: Course): void {
    // Navegar a la página de detalles del curso
    this.router.navigate(['/alumno/course-detail', course._id]);
  }

  getCourseImageUrl(imageUrl?: string): string {
    if (!imageUrl) return '';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    return `https://cursala.b-cdn.net/course-images/${imageUrl}`;
  }

  formatPrice(price?: number): string {
    if (!price) return 'Gratis';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(price);
  }
}
