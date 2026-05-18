import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

// --- Corregimos la ruta al servicio (agregamos 'core') ---
import { CoursesService, Course, SaveInterestsDto } from '../../../../core/services/courses.service';
import { AuthService } from '../../../../core/services/auth.service';
import { InfoService } from '../../../../core/services/info.service';

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
  private authService = inject(AuthService);
  private router = inject(Router);
  private infoService = inject(InfoService);

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
    const user = this.authService.currentUser();
    if (!user?._id) {
      this.infoService.showError('No se pudo encontrar la información del usuario.');
      return;
    }

    const payload: SaveInterestsDto = {
      courseIds: this.selectedCourseIds,
      suggestions: this.suggestions
    };

    this.coursesService.saveUserInterests(user._id, payload).subscribe({
      next: (response: any) => {
        // El backend devuelve { status: 200, message: '...', data: { ... } } 
        const updatedUser = response?.data;
        
        if (updatedUser) {
          this.authService.updateCurrentUser(updatedUser);
        }
        
        this.infoService.showSuccess('¡Intereses guardados! Ya podés acceder a la plataforma.');
        this.router.navigate(['/alumno']);
      },
      error: (err) => {
        console.error('Error al guardar intereses:', err);
        this.infoService.showError('Error al guardar los intereses. Por favor, intenta de nuevo.');
      }
    });
  }
}