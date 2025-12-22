import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ClassesService, ClassData } from '../../../../core/services/classes.service';
import { CoursesService, Course } from '../../../../core/services/courses.service';
import { InfoService } from '../../../../core/services/info.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-teacher-class-edit',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './class-edit.component.html'
})
export class TeacherClassEditComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private classesService = inject(ClassesService);
  private coursesService = inject(CoursesService);
  private info = inject(InfoService);
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  classForm!: FormGroup;
  classData = signal<ClassData | null>(null);
  course = signal<Course | null>(null);
  courses = signal<Course[]>([]);
  loading = signal<boolean>(true);
  saving = signal<boolean>(false);
  error = signal<string | null>(null);

  selectedImageFile: File | null = null;
  imagePreview: string | null = null;

  selectedVideoFile: File | null = null;
  videoPreview: string | null = null;

  classId: string | null = null;
  courseId: string | null = null;
  isEditMode = false;

  ngOnInit(): void {
    this.classId = this.route.snapshot.paramMap.get('id');
    // Si el id es 'new' o no existe, estamos en modo creación
    this.isEditMode = !!this.classId && this.classId !== 'new' && this.classId !== 'edit';

    // Capturar courseId de query params si estamos creando
    const courseIdFromQuery = this.route.snapshot.queryParamMap.get('courseId');
    if (courseIdFromQuery) {
      this.courseId = courseIdFromQuery;
    }

    this.initializeForm();
    this.loadCourses();

    if (this.isEditMode && this.classId) {
      this.loadClass();
    } else {
      // En modo creación, si hay courseId en query params, precargarlo
      if (courseIdFromQuery) {
        this.loadCourse();
        this.classForm.patchValue({ courseId: courseIdFromQuery });
      }
      this.loading.set(false);
    }
  }

  initializeForm(): void {
    this.classForm = this.fb.group({
      name: ['', [Validators.required]],
      description: [''],
      courseId: [this.courseId || '', [Validators.required]],
      linkLive: [''],
      imageFile: [null],
      videoFile: [null]
    });
  }

  loadCourses(): void {
    const currentUser = this.authService.currentUser();
    if (!currentUser?._id) {
      return;
    }

    this.coursesService.getTeacherCourses(currentUser._id).subscribe({
      next: (response: any) => {
        const data = response?.data || [];
        this.courses.set(Array.isArray(data) ? data : []);
      },
      error: (error) => {
        console.error('Error loading courses:', error);
      }
    });
  }

  loadClass(): void {
    if (!this.classId) return;

    this.loading.set(true);
    this.classesService.getClassById(this.classId).subscribe({
      next: (response) => {
        const classData = response?.data || response;
        this.classData.set(classData);

        // Obtener courseId
        if (classData.courseId) {
          if (typeof classData.courseId === 'object') {
            this.courseId = classData.courseId._id || classData.courseId.toString();
          } else {
            this.courseId = classData.courseId.toString();
          }
        }

        // Cargar información del curso
        if (this.courseId) {
          this.loadCourse();
        }

        // Cargar preview de imagen
        if (classData.imageUrl) {
          this.imagePreview = this.getClassImageUrl(classData.imageUrl);
        }

        // Cargar preview de video
        if (classData.videoUrl) {
          this.videoPreview = this.getClassVideoUrl(classData.videoUrl);
        }

        this.classForm.patchValue({
          name: classData.name || '',
          description: classData.description || '',
          linkLive: classData.linkLive || ''
        });

        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading class:', error);
        this.info.showError('Error al cargar la clase');
        this.loading.set(false);
        this.router.navigate(['/profesor/classes']);
      }
    });
  }

  loadCourse(): void {
    if (!this.courseId) return;

    this.coursesService.getCourseById(this.courseId).subscribe({
      next: (response: any) => {
        const courseData = response?.data || response;
        this.course.set(courseData);
      },
      error: (error) => {
        console.error('Error loading course:', error);
      }
    });
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedImageFile = input.files[0];
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imagePreview = e.target.result;
      };
      reader.readAsDataURL(this.selectedImageFile);
    }
  }

  onVideoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedVideoFile = input.files[0];
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.videoPreview = e.target.result;
      };
      reader.readAsDataURL(this.selectedVideoFile);
    }
  }

  getClassImageUrl(imageUrl?: string): string {
    if (!imageUrl) return '';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    return `https://cursala.b-cdn.net/class-images/${encodeURIComponent(imageUrl)}`;
  }

  getClassVideoUrl(videoUrl?: string): string {
    if (!videoUrl) return '';
    if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
      return videoUrl;
    }
    return `https://cursala.b-cdn.net/class-videos/${encodeURIComponent(videoUrl)}`;
  }

  handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }

  onSubmit(): void {
    if (this.classForm.invalid) {
      this.classForm.markAllAsTouched();
      this.info.showError('Por favor, completa todos los campos requeridos');
      return;
    }

    // Validar que se haya incluido una imagen al crear
    if (!this.isEditMode && !this.selectedImageFile) {
      this.info.showError('La imagen es requerida para crear una nueva clase');
      return;
    }

    this.saving.set(true);
    
    const formValue = this.classForm.value;

    const classData: any = {
      name: formValue.name,
      description: formValue.description,
      courseId: formValue.courseId,
      linkLive: formValue.linkLive || undefined
    };

    if (this.selectedImageFile) {
      classData.imageFile = this.selectedImageFile;
    }

    if (this.selectedVideoFile) {
      classData.videoFile = this.selectedVideoFile;
    }

    if (this.isEditMode && this.classId) {
      // Actualizar clase existente
      this.classesService.updateClass(this.classId, classData).subscribe({
        next: () => {
          this.info.showSuccess('Clase actualizada exitosamente');
          this.router.navigate(['/profesor/classes']);
        },
        error: (error) => {
          console.error('Error updating class:', error);
          this.info.showError('Error al actualizar la clase');
          this.saving.set(false);
        }
      });
    } else {
      // Crear nueva clase
      this.classesService.createClass(classData).subscribe({
        next: () => {
          this.info.showSuccess('Clase creada exitosamente');
          this.router.navigate(['/profesor/classes']);
        },
        error: (error) => {
          console.error('Error creating class:', error);
          const errorMsg = error?.error?.message || 'Error al crear la clase';
          this.info.showError(errorMsg);
          this.saving.set(false);
        }
      });
    }
  }

  onCancel(): void {
    this.router.navigate(['/profesor/classes']);
  }
}

