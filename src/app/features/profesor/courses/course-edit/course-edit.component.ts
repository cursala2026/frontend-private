import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CoursesService, Course } from '../../../../core/services/courses.service';
import { InfoService } from '../../../../core/services/info.service';

@Component({
  selector: 'app-course-edit',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './course-edit.component.html',
})
export class CourseEditComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private coursesService = inject(CoursesService);
  private infoService = inject(InfoService);

  courseForm!: FormGroup;
  course = signal<Course | null>(null);
  loading = signal<boolean>(true);
  saving = signal<boolean>(false);
  courseId: string | null = null;
  imagePreview: string | null = null;
  selectedImageFile: File | null = null;

  ngOnInit(): void {
    this.courseId = this.route.snapshot.paramMap.get('courseId');
    if (this.courseId) {
      this.initForm();
      this.loadCourse();
    } else {
      this.infoService.showError('ID de curso no válido');
      this.router.navigate(['/profesor/courses']);
    }
  }

  initForm(): void {
    this.courseForm = this.fb.group({
      name: ['', [Validators.required]],
      description: [''],
      longDescription: [''],
      modality: [''],
      price: [0],
      maxInstallments: [1],
      interestFree: [false],
      days: [''],
      time: [''],
      startDate: [''],
      registrationOpenDate: [''],
      numberOfClasses: [0],
      duration: [0],
      imageFile: [null]
    });
  }

  loadCourse(): void {
    if (!this.courseId) return;

    this.loading.set(true);
    this.coursesService.getCourseById(this.courseId).subscribe({
      next: (response: any) => {
        const courseData = response?.data || response;
        this.course.set(courseData);
        
        // Convertir days de array a string si es necesario
        const daysValue = courseData.days && Array.isArray(courseData.days) 
          ? courseData.days.join(', ') 
          : courseData.days || '';

        // Formatear fechas para el input date
        const formatDate = (date: string | Date | undefined): string => {
          if (!date) return '';
          const d = new Date(date);
          if (isNaN(d.getTime())) return '';
          return d.toISOString().split('T')[0];
        };

        this.courseForm.patchValue({
          name: courseData.name || '',
          description: courseData.description || '',
          longDescription: courseData.longDescription || '',
          modality: courseData.modality || '',
          price: courseData.price || 0,
          maxInstallments: courseData.maxInstallments || 1,
          interestFree: courseData.interestFree || false,
          days: daysValue,
          time: courseData.time || '',
          startDate: formatDate(courseData.startDate),
          registrationOpenDate: formatDate(courseData.registrationOpenDate),
          numberOfClasses: courseData.numberOfClasses || 0,
          duration: courseData.duration || 0
        });

        // Cargar preview de imagen
        if (courseData.imageUrl) {
          this.imagePreview = this.getCourseImageUrl(courseData.imageUrl);
        }

        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading course:', error);
        this.infoService.showError('Error al cargar el curso');
        this.loading.set(false);
        this.router.navigate(['/profesor/courses']);
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

  getCourseImageUrl(imageUrl?: string): string {
    if (!imageUrl) return '';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    return `https://cursala.b-cdn.net/course-images/${encodeURIComponent(imageUrl)}`;
  }

  handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }

  onSubmit(): void {
    if (this.courseForm.invalid) {
      this.infoService.showError('Por favor, completa todos los campos requeridos');
      return;
    }

    this.saving.set(true);
    const formData = this.courseForm.value;

    // Procesar los datos antes de enviar
    const processedData: any = {
      ...formData,
      // Convertir days de string a array si es necesario
      days: formData.days && typeof formData.days === 'string'
        ? formData.days.split(',').map((d: string) => d.trim()).filter((d: string) => d.length > 0)
        : formData.days
    };

    // Agregar archivo de imagen si se seleccionó uno nuevo
    if (this.selectedImageFile) {
      processedData.imageFile = this.selectedImageFile;
    }

    if (this.courseId) {
      this.coursesService.updateCourse(this.courseId, processedData).subscribe({
        next: () => {
          this.infoService.showSuccess('Curso actualizado exitosamente');
          this.router.navigate(['/profesor/courses']);
        },
        error: (error) => {
          console.error('Error updating course:', error);
          const errorMsg = error?.error?.message || 'Error al actualizar el curso';
          this.infoService.showError(errorMsg);
          this.saving.set(false);
        }
      });
    }
  }

  cancel(): void {
    this.router.navigate(['/profesor/courses']);
  }
}

