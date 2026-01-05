import { Component, EventEmitter, Input, Output, signal, OnInit, OnChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CoursesService } from '../../../../core/services/courses.service';
import { UsersService } from '../../../../core/services/users.service';
import { InfoService } from '../../../../core/services/info.service';
import { UserRole } from '../../../../core/models/user-role.enum';

@Component({
  selector: 'app-teacher-assignment-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './teacher-assignment-modal.component.html'
})
export class TeacherAssignmentModalComponent implements OnInit, OnChanges {
  @Input() isOpen = false;
  @Input() courseId = '';
  @Input() courseName = '';
  @Input() currentTeachers: any = null; // Puede ser teachersInfo array o mainTeacherInfo
  @Output() close = new EventEmitter<void>();
  @Output() refreshCourses = new EventEmitter<void>();

  private coursesService = inject(CoursesService);
  private usersService = inject(UsersService);
  private infoService = inject(InfoService);

  teachers = signal<any[]>([]);
  loadingTeachers = signal(false);
  isSubmitting = signal(false);
  selectedTeacherIds = signal<string[]>([]);
  initialTeacherIds = signal<string[]>([]);

  ngOnInit(): void {
    if (this.isOpen && this.courseId) {
      this.initializeModal();
    }
  }

  ngOnChanges(changes: any): void {
    // Solo inicializar si el modal se abre o cambia el courseId
    if (changes.isOpen && changes.isOpen.currentValue && this.courseId) {
      this.initializeModal();
    } else if (changes.courseId && changes.courseId.currentValue) {
      this.initializeModal();
    }
  }

  private initializeModal(): void {
    const initialIds = this.resolveCurrentTeacherIds();
    this.initialTeacherIds.set(initialIds);
    this.selectedTeacherIds.set([...initialIds]);
    this.loadTeachers();
  }

  private resolveCurrentTeacherIds(): string[] {
    const teachers = this.currentTeachers;
    if (!teachers) return [];

    // Si es un array (teachersInfo)
    if (Array.isArray(teachers)) {
      return teachers.map((t: any) => {
        if (typeof t === 'string') return t;
        return t._id || t.teacherId || t.id || '';
      }).filter((id: string) => id !== '');
    }

    // Si es un objeto único (mainTeacherInfo para compatibilidad)
    if (typeof teachers === 'object') {
      const id = teachers._id || teachers.teacherId || teachers.id || '';
      return id ? [id] : [];
    }

    // Si es un string
    if (typeof teachers === 'string') {
      return teachers ? [teachers] : [];
    }

    return [];
  }

  loadTeachers(): void {
    this.loadingTeachers.set(true);

    // Usar el endpoint específico para obtener solo profesores
    this.usersService.getTeachers().subscribe({
      next: (response: any) => {
        // El backend devuelve response.data con el array de profesores
        const teachers = Array.isArray(response?.data) ? response.data : [];
        
        this.teachers.set(teachers);
        this.loadingTeachers.set(false);
      },
      error: (error: any) => {
        console.error('Error loading teachers:', error);
        this.teachers.set([]);
        const statusCode = error?.status || 'desconocido';
        const errorMsg = error?.error?.message || `Error ${statusCode} al cargar la lista de profesores. Por favor, verifica que el servidor esté funcionando correctamente.`;
        this.infoService.showError(errorMsg);
        this.loadingTeachers.set(false);
      }
    });
  }

  assignTeachers(): void {
    const selectedIds = this.selectedTeacherIds();
    
    // Validar que haya entre 1 y 3 profesores
    if (selectedIds.length < 1 || selectedIds.length > 3) {
      this.infoService.showError('El curso debe tener entre 1 y 3 profesores asignados');
      return;
    }

    this.isSubmitting.set(true);
    
    // Usar updateCourse para actualizar los profesores
    const formData = new FormData();
    formData.append('teachers', selectedIds.join(','));
    
    this.coursesService.updateCourse(this.courseId, { teachers: selectedIds }).subscribe({
      next: () => {
        const count = selectedIds.length;
        const message = count === 1 
          ? 'Profesor asignado exitosamente'
          : `${count} profesores asignados exitosamente`;
        this.infoService.showSuccess(message);
        this.isSubmitting.set(false);
        this.refreshCourses.emit();
        this.onClose();
      },
      error: (error: any) => {
        console.error('Error assigning teachers:', error);
        const errorMsg = error?.error?.message || 'Error al asignar los profesores';
        this.infoService.showError(errorMsg);
        this.isSubmitting.set(false);
      }
    });
  }

  onTeacherToggle(teacherId: string, event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    const currentIds = [...this.selectedTeacherIds()];
    
    if (checkbox.checked) {
      // Agregar si no está ya seleccionado y no excede el máximo
      if (!currentIds.includes(teacherId) && currentIds.length < 3) {
        currentIds.push(teacherId);
      } else if (currentIds.length >= 3) {
        checkbox.checked = false;
        this.infoService.showError('Solo puedes seleccionar hasta 3 profesores');
        return;
      }
    } else {
      // Remover si está seleccionado y no baja del mínimo
      if (currentIds.includes(teacherId) && currentIds.length > 1) {
        currentIds.splice(currentIds.indexOf(teacherId), 1);
      } else if (currentIds.length <= 1) {
        checkbox.checked = true;
        this.infoService.showError('El curso debe tener al menos 1 profesor');
        return;
      }
    }
    
    this.selectedTeacherIds.set(currentIds);
  }

  isTeacherSelected(teacherId: string): boolean {
    return this.selectedTeacherIds().includes(teacherId);
  }

  isTeacherDisabled(teacherId: string): boolean {
    const currentIds = this.selectedTeacherIds();
    const isSelected = currentIds.includes(teacherId);
    
    // Si está seleccionado y ya alcanzamos el mínimo, no permitir deseleccionar
    if (isSelected && currentIds.length <= 1) {
      return true;
    }
    
    // Si no está seleccionado y ya alcanzamos el máximo, deshabilitar
    if (!isSelected && currentIds.length >= 3) {
      return true;
    }
    
    return false;
  }

  getTeacherInitials(teacher: any): string {
    if (!teacher) return '?';

    if (teacher.firstName && teacher.lastName) {
      return (teacher.firstName[0] + teacher.lastName[0]).toUpperCase();
    }

    if (teacher.email) {
      return teacher.email.substring(0, 2).toUpperCase();
    }

    return '?';
  }

  hasChanges(): boolean {
    const current = this.selectedTeacherIds().sort().join(',');
    const initial = this.initialTeacherIds().sort().join(',');
    return current !== initial;
  }

  onClose(): void {
    this.selectedTeacherIds.set([]);
    this.initialTeacherIds.set([]);
    this.isSubmitting.set(false);
    // Limpiar la lista de profesores al cerrar para forzar recarga la próxima vez
    this.teachers.set([]);
    this.close.emit();
  }
}
