import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CoursesService, Course } from '../../../core/services/courses.service';
import { ClassesService } from '../../../core/services/classes.service';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Component({
  selector: 'app-profesor-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './profesor-dashboard.component.html',
  
})
export class ProfesorDashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private coursesService = inject(CoursesService);
  private classesService = inject(ClassesService);

  user = this.authService.currentUser;
  today = new Date();

  // Estadísticas
  totalCourses = signal<number>(0);
  totalClasses = signal<number>(0);
  totalStudents = signal<number>(0);
  loading = signal<boolean>(true);

  ngOnInit(): void {
    this.loadStatistics();
  }

  loadStatistics(): void {
    const currentUser = this.user();
    if (!currentUser?._id) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);

    // Cargar cursos del profesor
    this.coursesService.getTeacherCourses(currentUser._id).subscribe({
      next: (response: any) => {
        const courses: Course[] = response?.data || [];
        this.totalCourses.set(courses.length);

        if (courses.length === 0) {
          this.loading.set(false);
          return;
        }

        // Calcular total de estudiantes únicos
        const allStudentIds = new Set<string>();
        courses.forEach(course => {
          if (course.students && Array.isArray(course.students)) {
            course.students.forEach((student: any) => {
              const studentId = typeof student === 'object' ? student._id : student;
              if (studentId) {
                allStudentIds.add(studentId.toString());
              }
            });
          }
        });
        this.totalStudents.set(allStudentIds.size);

        // Cargar clases de todos los cursos
        const classRequests = courses.map(course =>
          this.classesService.getClassesByCourse(course._id).pipe(
            map((res: any) => res?.data || []),
            catchError(() => of([]))
          )
        );

        forkJoin(classRequests).subscribe({
          next: (classesArrays) => {
            const totalClassCount = classesArrays.reduce((sum, classes) => sum + classes.length, 0);
            this.totalClasses.set(totalClassCount);
            this.loading.set(false);
          },
          error: (error) => {
            console.error('Error loading classes:', error);
            this.loading.set(false);
          }
        });
      },
      error: (error) => {
        console.error('Error loading courses:', error);
        this.loading.set(false);
      }
    });
  }
}
