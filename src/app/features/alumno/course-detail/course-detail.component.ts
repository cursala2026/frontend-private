import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CoursesService, Course } from '../../../core/services/courses.service';

@Component({
  selector: 'app-course-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './course-detail.component.html',
})
export class CourseDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private coursesService = inject(CoursesService);

  course = signal<Course | null>(null);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    const courseId = this.route.snapshot.paramMap.get('courseId');
    if (courseId) {
      this.loadCourse(courseId);
    } else {
      this.error.set('ID de curso no válido');
      this.loading.set(false);
    }
  }

  loadCourse(courseId: string): void {
    this.loading.set(true);
    this.error.set(null);
    
    this.coursesService.getCourseById(courseId).subscribe({
      next: (response: any) => {
        const courseData = response?.data || response;
        this.course.set(courseData);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading course:', error);
        this.error.set('No se pudo cargar el curso. Por favor, intenta nuevamente.');
        this.loading.set(false);
      }
    });
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
    this.router.navigate(['/alumno']);
  }
}

