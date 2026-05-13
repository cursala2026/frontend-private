import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

// --- Corregimos la ruta al servicio (agregamos 'core') ---
import { CoursesService, Course, SaveInterestsDto } from '../../../../core/services/courses.service';

@Component({
  selector: 'app-course-interests',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    MatCheckboxModule, 
    MatFormFieldModule, 
    MatInputModule, 
    MatButtonModule
  ],
  templateUrl: './course-interests.html',
  styleUrls: ['./course-interests.css']
})
export class CourseInterestsComponent implements OnInit {
  private coursesService = inject(CoursesService);

  courses: Course[] = [];
  selectedCourseIds: string[] = [];
  suggestions: string = '';
  loading = false;

  ngOnInit(): void {
    this.loading = true;
    this.coursesService.getAvailableInterests().subscribe({
      next: (res: any) => {
        // Manejamos si viene el array directo o dentro de .data
        this.courses = Array.isArray(res) ? res : (res.data || []);
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar cursos', err);
        this.loading = false;
      }
    });
  }

  toggleInterest(courseId: string, checked: boolean): void {
    if (checked) {
      this.selectedCourseIds.push(courseId);
    } else {
      this.selectedCourseIds = this.selectedCourseIds.filter(id => id !== courseId);
    }
  }

  onSubmit(): void {
    const payload: SaveInterestsDto = {
      courseIds: this.selectedCourseIds,
      suggestions: this.suggestions
    };

    this.coursesService.saveUserInterests(payload).subscribe({
      next: () => alert('¡Intereses guardados!'),
      error: (err) => alert('Error al guardar. Mirá la consola.')
    });
  }
}