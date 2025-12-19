import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CoursesService, Course } from '../../../core/services/courses.service';

@Component({
  selector: 'app-alumno-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alumno-dashboard.component.html',
  
})
export class AlumnoDashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private coursesService = inject(CoursesService);
  private router = inject(Router);
  
  user = this.authService.currentUser;
  courses = signal<Course[]>([]);
  loading = signal<boolean>(true);

  ngOnInit(): void {
    this.loadCourses();
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
    this.router.navigate(['/alumno/courses', course._id]);
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
