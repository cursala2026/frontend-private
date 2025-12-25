import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CoursesService, Course } from '../../../core/services/courses.service';
import { ViewModeService } from '../../../core/services/view-mode.service';
import { UserRole } from '../../../core/models/user-role.enum';

@Component({
  selector: 'app-teacher-courses',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './teacher-courses.component.html',
})
export class TeacherCoursesComponent implements OnInit {
  private authService = inject(AuthService);
  private coursesService = inject(CoursesService);
  private router = inject(Router);
  private viewModeService = inject(ViewModeService);
  
  user = this.authService.currentUser;
  courses = signal<any[]>([]);
  loading = signal<boolean>(true);

  ngOnInit(): void {
    this.loadCourses();
  }

  loadCourses(): void {
    const currentUser = this.user();
    if (!currentUser?._id) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    
    // Si el usuario es admin y está en modo profesor, cargar todos los cursos
    // Si es profesor normal, cargar solo sus cursos asignados
    if (this.authService.hasRole(UserRole.ADMIN) && this.viewModeService.isProfesorMode()) {
      // Admin en modo profesor: cargar todos los cursos
      this.coursesService.getCourses({ page: 1, page_size: 1000 }).subscribe({
        next: (response: any) => {
          const data = response?.data || [];
          // Marcar todos los cursos como editables para admin
          const coursesWithEditFlag = Array.isArray(data) 
            ? data.map((course: any) => ({ ...course, isMainTeacher: true }))
            : [];
          this.courses.set(coursesWithEditFlag);
          this.loading.set(false);
        },
        error: (error) => {
          console.error('Error loading courses:', error);
          this.courses.set([]);
          this.loading.set(false);
        }
      });
    } else {
      // Profesor normal: cargar solo sus cursos asignados
      this.coursesService.getTeacherCourses(currentUser._id).subscribe({
        next: (response: any) => {
          const data = response?.data || [];
          // El backend ya incluye isMainTeacher en cada curso
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
  }

  openCourseEdit(course: Course): void {
    // Navegar a la página de edición del curso
    this.router.navigate(['/profesor/courses', course._id, 'edit']);
  }

  getCourseImageUrl(imageUrl?: string): string {
    if (!imageUrl) return '';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    return `https://cursala.b-cdn.net/course-images/${encodeURIComponent(imageUrl)}`;
  }

  formatPrice(price?: number): string {
    if (!price) return 'Gratis';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(price);
  }

  handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }
}

