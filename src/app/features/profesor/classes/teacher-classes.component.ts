import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ClassesService, ClassData } from '../../../core/services/classes.service';
import { CoursesService, Course } from '../../../core/services/courses.service';
import { ViewModeService } from '../../../core/services/view-mode.service';
import { UserRole } from '../../../core/models/user-role.enum';
// Los servicios de progreso de video ahora son gestionados por componentes/servicios globales

interface ClassWithCourse extends Omit<ClassData, 'courseId'> {
  courseName?: string;
  courseId?: string;
}

@Component({
  selector: 'app-teacher-classes',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  onCourseInputBlur(): void {
    setTimeout(() => this.showCourseDropdown = false, 200);
  }

  clearCourseFilter(): void {
    this.courseFilter = '';
    this.selectCourse('', '');
    this.showCourseDropdown = false;
  }

  getCardTheme(index: number) {
    const themes = [
      { bg: 'bg-blue-50', border: 'border-blue-200', title: 'text-blue-900', button: 'bg-blue-600', hover: 'hover:bg-blue-700', badge: 'bg-blue-100 text-blue-700' },
      { bg: 'bg-purple-50', border: 'border-purple-200', title: 'text-purple-900', button: 'bg-purple-600', hover: 'hover:bg-purple-700', badge: 'bg-purple-100 text-purple-700' },
      { bg: 'bg-amber-50', border: 'border-amber-200', title: 'text-amber-900', button: 'bg-amber-600', hover: 'hover:bg-amber-700', badge: 'bg-amber-100 text-amber-700' },
      { bg: 'bg-emerald-50', border: 'border-emerald-200', title: 'text-emerald-900', button: 'bg-emerald-600', hover: 'hover:bg-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
      { bg: 'bg-indigo-50', border: 'border-indigo-200', title: 'text-indigo-900', button: 'bg-indigo-600', hover: 'hover:bg-indigo-700', badge: 'bg-indigo-100 text-indigo-700' },
      { bg: 'bg-rose-50', border: 'border-rose-200', title: 'text-rose-900', button: 'bg-rose-600', hover: 'hover:bg-rose-700', badge: 'bg-rose-100 text-rose-700' }
    ];
    return themes[index % themes.length];
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

  moveClassUp(index: number): void {
    if (index === 0) return;
    const list = [...this.classes()];
    const temp = list[index];
    list[index] = list[index - 1];
    list[index - 1] = temp;
    this.saveOrder(list);
  }

  moveClassDown(index: number): void {
    const list = [...this.classes()];
    if (index === list.length - 1) return;
    const temp = list[index];
    list[index] = list[index + 1];
    list[index + 1] = temp;
    this.saveOrder(list);
  }

  private saveOrder(newList: ClassData[]): void {
    this.classes.set(newList);
    const reorderData = newList.map((c, i) => ({ id: c._id, order: i + 1 }));
    this.classesService.reorderClasses(reorderData, this.selectedCourseId).subscribe({
      next: () => {
        console.log('Orden de clases actualizado');
      },
      error: (error) => {
        console.error('Error actualizando el orden de las clases:', error);
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

