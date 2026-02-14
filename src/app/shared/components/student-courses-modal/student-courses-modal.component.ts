import { Component, Input, Output, EventEmitter, signal, OnInit, OnChanges, SimpleChanges, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CoursesService } from '../../../core/services/courses.service';
import { InfoService } from '../../../core/services/info.service';

export interface StudentCourse {
  _id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  isEnrolled: boolean;
  enrollmentType?: 'MANUAL' | 'SELF';
  enrolledAt?: Date;
  startDate?: string;
  endDate?: string;
}

@Component({
  selector: 'app-student-courses-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './student-courses-modal.component.html'
})
export class StudentCoursesModalComponent implements OnChanges {
  @Input() isOpen = signal<boolean>(false);
  @Input() studentId: string = '';
  @Input() studentName: string = '';
  @Input() isReadOnly: boolean = false;
  
  @Output() close = new EventEmitter<void>();
  @Output() coursesUpdated = new EventEmitter<void>();

  private coursesService = inject(CoursesService);
  private info = inject(InfoService);

  courses = signal<StudentCourse[]>([]);
  loading = signal<boolean>(false);
  processingCourseId = signal<string | null>(null);

  constructor() {
    // Observar cambios en isOpen para cargar cursos
    effect(() => {
      if (this.isOpen() && this.studentId) {
        this.loadCourses();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Cargar cursos cuando el modal se abre o cambia el estudiante
    if ((changes['isOpen'] && this.isOpen()) || (changes['studentId'] && this.studentId)) {
      if (this.isOpen() && this.studentId) {
        this.loadCourses();
      }
    }
  }

  loadCourses(): void {
    this.loading.set(true);
    
    // Cargar cursos publicados
    this.coursesService.getPublishedCourses().subscribe({
      next: (response: any) => {
        const publishedCourses = response?.data || response || [];
        
        // Verificar cuáles cursos ya tiene el estudiante
        const coursesWithEnrollment: StudentCourse[] = publishedCourses.map((course: any) => {
          const students = course.students || [];
          const enrollment = students.find((s: any) => {
            const studentId = typeof s === 'string' ? s : 
                            (typeof s.userId === 'string' ? s.userId : s.userId?._id || s._id);
            return studentId === this.studentId;
          });
          
          return {
            _id: course._id,
            name: course.name,
            description: course.description,
            imageUrl: course.imageUrl,
            isEnrolled: !!enrollment,
            enrollmentType: enrollment?.enrollmentType,
            enrolledAt: enrollment?.enrolledAt,
            startDate: enrollment?.startDate,
            endDate: enrollment?.endDate
          };
        });
        
        this.courses.set(coursesWithEnrollment);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading courses:', error);
        this.info.showError('Error al cargar los cursos');
        this.loading.set(false);
      }
    });
  }

  toggleCourseEnrollment(course: StudentCourse): void {
    if (this.processingCourseId()) return;
    
    this.processingCourseId.set(course._id);
    
    if (course.isEnrolled) {
      // Desasociar
      this.coursesService.unenrollStudentCompletely(course._id, this.studentId).subscribe({
        next: () => {
          this.info.showSuccess(`Estudiante desasociado de "${course.name}"`);
          course.isEnrolled = false;
          course.enrollmentType = undefined;
          course.enrolledAt = undefined;
          this.processingCourseId.set(null);
          this.coursesUpdated.emit();
        },
        error: (error) => {
          console.error('Error unenrolling student:', error);
          this.info.showError(error?.error?.message || 'Error al desasociar estudiante');
          this.processingCourseId.set(null);
        }
      });
    } else {
      // Asociar
      this.coursesService.enrollStudentManually(course._id, this.studentId).subscribe({
        next: () => {
          this.info.showSuccess(`Estudiante inscrito en "${course.name}"`);
          course.isEnrolled = true;
          course.enrollmentType = 'MANUAL';
          course.enrolledAt = new Date();
          this.processingCourseId.set(null);
          this.coursesUpdated.emit();
        },
        error: (error) => {
          console.error('Error enrolling student:', error);
          this.info.showError(error?.error?.message || 'Error al inscribir estudiante');
          this.processingCourseId.set(null);
        }
      });
    }
  }

  getCourseImageUrl(imageUrl?: string): string {
    if (!imageUrl) return 'https://ui-avatars.com/api/?name=Course&background=6366f1&color=fff';
    if (imageUrl.startsWith('http')) return imageUrl;
    return `https://cursala.b-cdn.net/images/${imageUrl}`;
  }

  onClose(): void {
    this.close.emit();
  }

  stopPropagation(event: Event): void {
    event.stopPropagation();
  }

  getEnrolledCount(): number {
    return this.courses().filter(c => c.isEnrolled).length;
  }

  getEnrollmentTypeLabel(type?: 'MANUAL' | 'SELF'): string {
    if (!type) return '';
    return type === 'MANUAL' ? '(Manual)' : '(Auto)';
  }

  formatDate(date?: Date | string): string {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('es-AR', { year: 'numeric', month: 'short', day: 'numeric' });
  }
}
