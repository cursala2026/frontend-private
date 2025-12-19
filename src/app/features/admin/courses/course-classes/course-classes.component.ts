import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ClassesService, ClassData } from '../../../../core/services/classes.service';
import { CoursesService, Course } from '../../../../core/services/courses.service';
import { InfoService } from '../../../../core/services/info.service';

@Component({
  selector: 'app-course-classes',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './course-classes.component.html'
})
export class CourseClassesComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private classesService = inject(ClassesService);
  private coursesService = inject(CoursesService);
  private info = inject(InfoService);

  course = signal<Course | null>(null);
  classes = signal<ClassData[]>([]);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);

  courseId: string | null = null;

  ngOnInit(): void {
    this.courseId = this.route.snapshot.paramMap.get('courseId');
    if (this.courseId) {
      this.loadCourse();
      this.loadClasses();
    } else {
      this.error.set('ID de curso no válido');
      this.loading.set(false);
    }
  }

  loadCourse(): void {
    if (!this.courseId) return;

    this.coursesService.getCourseById(this.courseId).subscribe({
      next: (response) => {
        const courseData = response?.data || response;
        this.course.set(courseData);
      },
      error: (error) => {
        console.error('Error loading course:', error);
      }
    });
  }

  loadClasses(): void {
    if (!this.courseId) return;

    this.loading.set(true);
    this.error.set(null);

    this.classesService.getClassesByCourse(this.courseId).subscribe({
      next: (response) => {
        const classesData = response?.data || response || [];
        // Asegurar que cada clase tenga _id
        const classesWithId = classesData.map((cls: any) => {
          if (!cls._id && cls.id) {
            cls._id = cls.id;
          }
          return cls;
        });
        this.classes.set(classesWithId);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading classes:', error);
        this.error.set('Error al cargar las clases');
        this.loading.set(false);
      }
    });
  }

  getClassImageUrl(imageUrl?: string): string {
    if (!imageUrl) return '';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    return `https://cursala.b-cdn.net/class-images/${encodeURIComponent(imageUrl)}`;
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'INACTIVE':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'Activa';
      case 'INACTIVE':
        return 'Inactiva';
      default:
        return status;
    }
  }

  getClassId(classItem: ClassData): string {
    return classItem._id || (classItem as any).id || '';
  }

  deleteClass(classId: string): void {
    if (!confirm('¿Estás seguro de que deseas eliminar esta clase?')) {
      return;
    }

    this.classesService.deleteClass(classId).subscribe({
      next: () => {
        this.info.showSuccess('Clase eliminada exitosamente');
        this.loadClasses();
      },
      error: (error) => {
        console.error('Error deleting class:', error);
        this.info.showError('Error al eliminar la clase');
      }
    });
  }

  toggleClassStatus(classId: string): void {
    this.classesService.toggleClassStatus(classId).subscribe({
      next: () => {
        this.info.showSuccess('Estado de la clase actualizado');
        this.loadClasses();
      },
      error: (error) => {
        console.error('Error toggling class status:', error);
        this.info.showError('Error al actualizar el estado de la clase');
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/admin/courses']);
  }
}

