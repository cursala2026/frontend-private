import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { EnrollmentService } from '../../../core/services/enrollment.service';
import { EnrolledStudent } from '../../../core/models/enrollment.model';

@Component({
  selector: 'app-enrolled-students',
  standalone: true,
  imports: [],
  templateUrl: './enrolled-students.component.html',
})
export class EnrolledStudentsComponent implements OnInit {
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly route = inject(ActivatedRoute);

  // Estado reactivo con signals
  readonly students = signal<EnrolledStudent[]>([]);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const courseId = this.route.snapshot.paramMap.get('courseId');
    if (!courseId) {
      this.error.set('No se especifico el curso.');
      return;
    }
    this.loadStudents(courseId);
  }

  loadStudents(courseId: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.enrollmentService.getEnrolledStudents(courseId).subscribe({
      next: (students) => {
        this.students.set(students);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los alumnos inscriptos.');
        this.loading.set(false);
      },
    });
  }
}