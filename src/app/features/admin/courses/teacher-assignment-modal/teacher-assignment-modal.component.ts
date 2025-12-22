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
  @Input() currentMainTeacher: any = null;
  @Output() close = new EventEmitter<void>();
  @Output() refreshCourses = new EventEmitter<void>();

  private coursesService = inject(CoursesService);
  private usersService = inject(UsersService);
  private infoService = inject(InfoService);

  teachers = signal<any[]>([]);
  loadingTeachers = signal(false);
  isSubmitting = signal(false);
  selectedTeacherId = '';
  initialTeacherId = '';

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
    this.initialTeacherId = this.resolveCurrentTeacherId();
    this.selectedTeacherId = this.initialTeacherId;
    this.loadTeachers();
  }

  private resolveCurrentTeacherId(): string {
    const t = this.currentMainTeacher;
    if (!t) return '';

    // Si es un string, es directamente el ID
    if (typeof t === 'string') return t;

    // Si es un objeto, buscar el ID en diferentes propiedades
    return t._id || t.teacherId || t.id || '';
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
        this.infoService.showError('Error al cargar la lista de profesores');
        this.loadingTeachers.set(false);
      }
    });
  }

  assignTeacher(): void {
    // Permitir asignar o remover profesor (selectedTeacherId puede estar vacío)
    this.isSubmitting.set(true);
    this.coursesService.assignMainTeacher(this.courseId, this.selectedTeacherId || '').subscribe({
      next: () => {
        const message = this.selectedTeacherId 
          ? 'Profesor principal asignado exitosamente'
          : 'Profesor principal removido exitosamente';
        this.infoService.showSuccess(message);
        this.isSubmitting.set(false);
        this.refreshCourses.emit();
        this.onClose();
      },
      error: (error: any) => {
        console.error('Error assigning teacher:', error);
        const errorMsg = error?.error?.message || 'Error al asignar el profesor';
        this.infoService.showError(errorMsg);
        this.isSubmitting.set(false);
      }
    });
  }

  getSelectedTeacher(): any {
    if (!this.selectedTeacherId) return null;
    return this.teachers().find((t: any) => t._id === this.selectedTeacherId);
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
    return this.selectedTeacherId !== this.initialTeacherId;
  }

  onClose(): void {
    this.selectedTeacherId = '';
    this.initialTeacherId = '';
    this.isSubmitting.set(false);
    // Limpiar la lista de profesores al cerrar para forzar recarga la próxima vez
    this.teachers.set([]);
    this.close.emit();
  }
}
