import { Component, inject, signal, OnInit } from '@angular/core';

import { RouterModule, Router } from '@angular/router';
import { CoursesService, Course } from '../../../core/services/courses.service';

@Component({
  selector: 'app-student-courses',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './student-courses.component.html'
})
export class StudentCoursesComponent implements OnInit {
  private coursesService = inject(CoursesService);
  private router = inject(Router);

  courses = signal<Course[]>([]);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadStudentCourses();
  }

  loadStudentCourses(): void {
    this.loading.set(true);
    this.error.set(null);

    this.coursesService.getStudentCourses().subscribe({
      next: (response: any) => {
        const coursesData = response?.data || response || [];
        this.courses.set(Array.isArray(coursesData) ? coursesData : []);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading student courses:', error);
        this.error.set('No se pudieron cargar tus cursos. Por favor, intenta nuevamente.');
        this.loading.set(false);
      }
    });
  }

  viewCourse(course: Course): void {
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

  formatDate(date?: Date | string): string {
    if (!date) return '';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(dateObj);
  }
}
