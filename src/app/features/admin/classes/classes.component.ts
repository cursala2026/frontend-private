import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ClassesService, ClassData } from '../../../core/services/classes.service';
import { CoursesService, Course } from '../../../core/services/courses.service';
import { InfoService } from '../../../core/services/info.service';

interface ClassWithCourse extends ClassData {
  courseName?: string;
}

@Component({
  selector: 'app-classes',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './classes.component.html'
})
export class ClassesComponent implements OnInit {
  private classesService = inject(ClassesService);
  private coursesService = inject(CoursesService);
  private info = inject(InfoService);
  private route = inject(ActivatedRoute);

  allClasses = signal<ClassWithCourse[]>([]);
  filteredClasses = signal<ClassWithCourse[]>([]);
  courses = signal<Course[]>([]);
  selectedCourseId = '';
  loading = signal<boolean>(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    // Verificar si hay un courseId en los query params
    this.route.queryParams.subscribe(params => {
      if (params['courseId']) {
        this.selectedCourseId = params['courseId'];
      }
    });
    
    this.loadCourses();
    this.loadAllClasses();
  }

  loadCourses(): void {
    this.coursesService.getCourses({ page: 1, page_size: 1000 }).subscribe({
      next: (response) => {
        this.courses.set(response.data || []);
      },
      error: (error) => {
        console.error('Error loading courses:', error);
      }
    });
  }

  loadAllClasses(): void {
    this.loading.set(true);
    this.error.set(null);

    // Cargar todos los cursos primero
    this.coursesService.getCourses({ page: 1, page_size: 1000 }).subscribe({
      next: (response) => {
        const courses = response.data || [];
        const coursesMap = new Map<string, Course>();
        courses.forEach((course: Course) => {
          coursesMap.set(course._id, course);
        });

        // Luego cargar las clases para cada curso
        const classPromises = courses.map((course: Course) => 
          this.classesService.getClassesByCourse(course._id).toPromise()
            .then((classResponse: any) => {
              const classes = classResponse?.data || [];
              return classes.map((cls: any) => ({
                ...cls,
                courseName: course.name,
                courseId: cls.courseId || course._id,
                _id: cls._id || cls.id
              }));
            })
            .catch(() => [])
        );

        Promise.all(classPromises).then((allClassesArrays) => {
          // Aplanar todas las clases en un solo array
          const allClasses = allClassesArrays.flat();
          this.allClasses.set(allClasses);
          this.applyFilter();
          this.loading.set(false);
        }).catch((error) => {
          console.error('Error loading classes:', error);
          this.error.set('Error al cargar las clases');
          this.loading.set(false);
        });
      },
      error: (error) => {
        console.error('Error loading courses:', error);
        this.error.set('Error al cargar los cursos');
        this.loading.set(false);
      }
    });
  }

  onCourseFilterChange(): void {
    this.applyFilter();
  }

  applyFilter(): void {
    const selectedId = this.selectedCourseId;
    if (!selectedId) {
      // Si no hay curso seleccionado, no mostrar clases
      this.filteredClasses.set([]);
    } else {
      const filtered = this.allClasses().filter(cls => cls.courseId === selectedId);
      this.filteredClasses.set(filtered);
    }
  }

  getClassImageUrl(imageUrl?: string): string {
    if (!imageUrl) return '';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    // Codificar el nombre del archivo para manejar caracteres especiales
    const encodedFileName = encodeURIComponent(imageUrl);
    return `https://cursala.b-cdn.net/class-images/${encodedFileName}`;
  }

  handleImageError(event: Event, classId: string): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    // Mostrar el placeholder
    const placeholder = document.getElementById(`placeholder-${classId}`);
    if (placeholder) {
      placeholder.classList.remove('hidden');
    }
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

  getClassId(classItem: ClassWithCourse): string {
    return classItem._id || (classItem as any).id || '';
  }

  deleteClass(classId: string): void {
    if (!confirm('¿Estás seguro de que deseas eliminar esta clase?')) {
      return;
    }

    this.classesService.deleteClass(classId).subscribe({
      next: () => {
        this.info.showSuccess('Clase eliminada exitosamente');
        this.loadAllClasses();
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
        this.loadAllClasses();
      },
      error: (error) => {
        console.error('Error toggling class status:', error);
        this.info.showError('Error al actualizar el estado de la clase');
      }
    });
  }
}
