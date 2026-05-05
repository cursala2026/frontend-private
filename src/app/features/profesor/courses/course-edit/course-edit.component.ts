import { Component, inject, signal, OnInit } from '@angular/core';

import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CoursesService, Course } from '../../../../core/services/courses.service';
import { InfoService } from '../../../../core/services/info.service';

@Component({
  selector: 'app-course-edit',
  standalone: true,
  imports: [ReactiveFormsModule],
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
  deleteImage: boolean = false;
  originalImageUrl: string | null = null;

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
      description: ['', [Validators.maxLength(350)]],
      longDescription: ['', [Validators.maxLength(850)]],
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
          this.originalImageUrl = courseData.imageUrl;
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
      this.deleteImage = false; // Si se selecciona nueva imagen, no eliminar
      this.courseForm.markAsDirty();
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imagePreview = e.target.result;
      };
      reader.readAsDataURL(this.selectedImageFile);
    }
  }

  longDescriptionLength(): number {
    const val = this.courseForm.get('longDescription')?.value || '';
    return typeof val === 'string' ? val.length : 0;
  }

  updateLongDescriptionCount(): void {
    const ctrl = this.courseForm.get('longDescription');
    if (!ctrl) return;
    let val = ctrl.value || '';
    if (val && val.length > 850) {
      val = val.slice(0, 850);
      ctrl.setValue(val);
    }
    this.courseForm.markAsDirty();
  }

  descriptionLength(): number {
    const val = this.courseForm.get('description')?.value || '';
    return typeof val === 'string' ? val.length : 0;
  }

  updateDescriptionCount(): void {
    const ctrl = this.courseForm.get('description');
    if (!ctrl) return;
    let val = ctrl.value || '';
    if (val && val.length > 350) {
      val = val.slice(0, 350);
      ctrl.setValue(val);
    }
    this.courseForm.markAsDirty();
  }

  removeImage(): void {
    this.imagePreview = null;
    this.selectedImageFile = null;
    this.deleteImage = true;
    this.courseForm.markAsDirty();
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
    
    // Obtener valores del formulario (getRawValue incluye campos deshabilitados)
    const formValue = this.courseForm.getRawValue();
    
    // Procesar los datos antes de enviar
    const processedData: any = {
      ...formValue,
      // Convertir days de string a array si es necesario
      days: formValue.days && typeof formValue.days === 'string'
        ? formValue.days.split(',').map((d: string) => d.trim()).filter((d: string) => d.length > 0)
        : formValue.days
    };
    
    // Excluir campos de precio y financiación del envío (profesores no pueden editarlos)
    delete processedData.price;
    delete processedData.maxInstallments;
    delete processedData.interestFree;

    // Agregar archivo de imagen si se seleccionó uno nuevo
    if (this.selectedImageFile) {
      processedData.imageFile = this.selectedImageFile;
    }
    
    // Si se debe eliminar la imagen, enviar señal al backend
    if (this.deleteImage && !this.selectedImageFile) {
      processedData.deleteImage = true;
    }

    if (this.courseId) {
      // Asegurar que description y longDescription no excedan sus límites antes de enviar
      if (processedData.description) {
        processedData.description = processedData.description.slice(0, 350);
      }
      if (processedData.longDescription) {
        processedData.longDescription = processedData.longDescription.slice(0, 850);
      }
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

