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

  ngOnChanges(): void {
    if (this.isOpen && this.courseId) {
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

    // Agregar timestamp para evitar caché HTTP 304
    const params = {
      page_size: 100,
      _t: Date.now().toString()
    };

    this.usersService.getUsers(params as any).subscribe({
      next: (response: any) => {
        // El backend puede devolver response.data como objeto con diferentes estructuras
        let allUsers: any[] = [];

        if (Array.isArray(response?.data)) {
          // Si data es directamente un array
          allUsers = response.data;
        } else if (response?.data?.data && Array.isArray(response.data.data)) {
          // Si data contiene otro objeto data con el array
          allUsers = response.data.data;
        } else if (response?.data?.users && Array.isArray(response.data.users)) {
          // Si data contiene un objeto users con el array
          allUsers = response.data.users;
        }

        const teachers = allUsers.filter((user: any) => {
          const role = user.role;
          const roles = Array.isArray(user.roles) ? user.roles : [];
          return role === UserRole.PROFESOR || role === 'PROFESOR' ||
                 roles.includes(UserRole.PROFESOR) || roles.includes('PROFESOR');
        });

        this.teachers.set(teachers);
        this.loadingTeachers.set(false);

        if (teachers.length === 0) {
          this.infoService.showError('No se encontraron profesores en el sistema');
        }
      },
      error: (error: any) => {
        console.error('Error loading teachers:', error);
        this.infoService.showError('Error al cargar la lista de profesores');
        this.loadingTeachers.set(false);
      }
    });
  }

  assignTeacher(): void {
    if (!this.selectedTeacherId) {
      this.infoService.showError('Por favor selecciona un profesor');
      return;
    }

    this.isSubmitting.set(true);
    this.coursesService.assignMainTeacher(this.courseId, this.selectedTeacherId).subscribe({
      next: () => {
        this.infoService.showSuccess('Profesor principal asignado exitosamente');
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
    this.close.emit();
  }
}
