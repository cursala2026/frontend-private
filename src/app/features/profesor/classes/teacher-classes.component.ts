import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ClassesService, ClassData } from '../../../core/services/classes.service';
import { CoursesService, Course } from '../../../core/services/courses.service';

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
export class TeacherClassesComponent implements OnInit {
  private authService = inject(AuthService);
  private classesService = inject(ClassesService);
  private coursesService = inject(CoursesService);
  router = inject(Router);
  
  user = this.authService.currentUser;
  classes = signal<ClassData[]>([]);
  courses = signal<Course[]>([]);
  selectedCourseId = '';
  loading = signal<boolean>(true);
  loadingClasses = signal<boolean>(false);

  ngOnInit(): void {
    this.loadCourses();
  }

  loadCourses(): void {
    const currentUser = this.user();
    if (!currentUser?._id) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
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

  onCourseChange(): void {
    if (this.selectedCourseId) {
      this.loadClassesByCourse(this.selectedCourseId);
    } else {
      this.classes.set([]);
    }
  }

  loadClassesByCourse(courseId: string): void {
    this.loadingClasses.set(true);
    this.classesService.getClassesByCourse(courseId).subscribe({
      next: (response: any) => {
        const data = response?.data || [];
        this.classes.set(Array.isArray(data) ? data : []);
        this.loadingClasses.set(false);
      },
      error: (error) => {
        console.error('Error loading classes:', error);
        this.classes.set([]);
        this.loadingClasses.set(false);
      }
    });
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

