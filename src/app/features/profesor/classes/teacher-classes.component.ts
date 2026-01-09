import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ClassesService, ClassData } from '../../../core/services/classes.service';
import { CoursesService, Course } from '../../../core/services/courses.service';
import { ViewModeService } from '../../../core/services/view-mode.service';
import { UserRole } from '../../../core/models/user-role.enum';
import { ConfirmModalComponent, ConfirmModalConfig } from '../../../shared/components/confirm-modal/confirm-modal.component';
// Los servicios de progreso de video ahora son gestionados por componentes/servicios globales

interface ClassWithCourse extends Omit<ClassData, 'courseId'> {
  courseName?: string;
  courseId?: string;
}

@Component({
  selector: 'app-teacher-classes',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmModalComponent],
  templateUrl: './teacher-classes.component.html',
})
export class TeacherClassesComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private classesService = inject(ClassesService);
  private coursesService = inject(CoursesService);
  private viewModeService = inject(ViewModeService);
  private route = inject(ActivatedRoute);
  // inyecciones de progreso eliminadas; el componente global maneja las subidas
  router = inject(Router);
  
  user = this.authService.currentUser;
  classes = signal<ClassData[]>([]);
  courses = signal<Course[]>([]);
  selectedCourseId = '';
  courseFilter = '';
  showCourseDropdown = false;
  loading = signal<boolean>(true);
  loadingClasses = signal<boolean>(false);
  
  // Tracking de progreso de videos por clase
  // El progreso por tarjeta ahora lo maneja el componente global de subidas

  // Modal de confirmación
  showDeleteModal = signal<boolean>(false);
  classToDelete: ClassData | null = null;
  deleteModalConfig: ConfirmModalConfig = {
    title: 'Eliminar Clase',
    message: '',
    confirmText: 'Eliminar',
    cancelText: 'Cancelar',
    confirmButtonClass: 'bg-red-600 hover:bg-red-700',
    icon: 'danger'
  };

  ngOnInit(): void {
    // Inicialización básica
    this.loadCourses();

    // Verificar si hay un courseId en los query params
    this.route.queryParamMap.subscribe(params => {
      const courseIdFromQuery = params.get('courseId');
      if (courseIdFromQuery) {
        this.selectedCourseId = courseIdFromQuery;
        this.loadClassesByCourse(courseIdFromQuery);
      }
    });
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
          this.courses.set(Array.isArray(data) ? data : []);
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

  onCourseChange(): void {
    if (this.selectedCourseId) {
      this.loadClassesByCourse(this.selectedCourseId);
    } else {
      this.classes.set([]);
    }
  }

  filteredCourses(): Course[] {
    const term = this.courseFilter ? this.courseFilter.toLowerCase().trim() : '';
    const list = this.courses();
    if (!term) return list;
    return list.filter(c => (c.name || '').toLowerCase().includes(term));
  }

  selectCourse(courseId: string | '', courseName?: string): void {
    this.selectedCourseId = courseId || '';
    if (courseName) this.courseFilter = courseName;
    this.showCourseDropdown = false;
    this.onCourseChange();
  }

  onCourseInputFocus(): void {
    this.showCourseDropdown = true;
  }

  onCourseInputBlur(event: FocusEvent): void {
    setTimeout(() => this.showCourseDropdown = false, 150);
  }

  clearCourseFilter(): void {
    this.courseFilter = '';
    this.selectCourse('', '');
    this.showCourseDropdown = false;
  }

  private isReloading = false;

  loadClassesByCourse(courseId: string): void {
    // Evitar recargas múltiples simultáneas
    if (this.isReloading) {
      return;
    }
    
    this.isReloading = true;
    this.loadingClasses.set(true);
    this.classesService.getClassesByCourse(courseId).subscribe({
      next: (response: any) => {
        const data = response?.data || [];
        this.classes.set(Array.isArray(data) ? data : []);
        
        // El manejo de progreso por tarjeta fue movido al componente global; no conectar SSE aquí
        
        this.loadingClasses.set(false);
        this.isReloading = false;
      },
      error: (error) => {
        console.error('Error loading classes:', error);
        this.classes.set([]);
        this.loadingClasses.set(false);
        this.isReloading = false;
      }
    });
  }

  // El manejo de progreso por tarjeta fue movido al componente global

  ngOnDestroy(): void {
    // No hay suscripciones locales de progreso por tarjeta que limpiar
  }

  openClassEdit(classItem: ClassData): void {
    // Navegar a la página de edición de la clase
    this.router.navigate(['/profesor/classes', classItem._id, 'edit']);
  }

  openClassCreate(): void {
    if (this.selectedCourseId) {
      // Navegar a la página de creación de clase con el courseId como query param
      this.router.navigate(['/profesor/classes/new'], { queryParams: { courseId: this.selectedCourseId } });
    }
  }

  deleteClass(event: Event, classItem: ClassData): void {
    event.stopPropagation(); // Evitar que se dispare el click de la tarjeta

    // Configurar el modal con la información de la clase
    this.classToDelete = classItem;
    this.deleteModalConfig.message = `¿Estás seguro de que deseas eliminar la clase "${classItem.name}"?\n\nEsta acción no se puede deshacer.`;
    this.showDeleteModal.set(true);
  }

  confirmDelete(): void {
    if (this.classToDelete?._id) {
      this.classesService.deleteClass(this.classToDelete._id).subscribe({
        next: () => {
          // Recargar las clases del curso actual
          if (this.selectedCourseId) {
            this.loadClassesByCourse(this.selectedCourseId);
          }
          this.classToDelete = null;
        },
        error: (error) => {
          console.error('Error deleting class:', error);
          alert('Error al eliminar la clase. Por favor, inténtalo de nuevo.');
          this.classToDelete = null;
        }
      });
    }
  }

  cancelDelete(): void {
    this.classToDelete = null;
  }

  getClassImageUrl(imageUrl?: string): string {
    if (!imageUrl) return '';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    return `https://cursala.b-cdn.net/class-images/${encodeURIComponent(imageUrl)}`;
  }

  handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }

  getSelectedCourseName(): string {
    if (!this.selectedCourseId) return '';
    const course = this.courses().find(c => c._id === this.selectedCourseId);
    return course?.name || '';
  }
}

