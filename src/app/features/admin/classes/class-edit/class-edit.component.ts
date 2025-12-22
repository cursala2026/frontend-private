import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ClassesService, ClassData } from '../../../../core/services/classes.service';
import { CoursesService, Course } from '../../../../core/services/courses.service';
import { InfoService } from '../../../../core/services/info.service';

@Component({
  selector: 'app-class-edit',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './class-edit.component.html'
})
export class ClassEditComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private classesService = inject(ClassesService);
  private coursesService = inject(CoursesService);
  private info = inject(InfoService);
  private fb = inject(FormBuilder);

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

  selectedSupportFiles: File[] = [];
  existingSupportMaterials: string[] = [];
  supportMaterialsToDelete: string[] = [];

  classId: string | null = null;
  courseId: string | null = null;
  isEditMode = false;

  ngOnInit(): void {
    this.classId = this.route.snapshot.paramMap.get('id');
    // Si el id es 'new', estamos en modo creación
    this.isEditMode = !!this.classId && this.classId !== 'new';

    // Capturar courseId de query params
    const courseIdFromQuery = this.route.snapshot.queryParamMap.get('courseId');
    if (courseIdFromQuery) {
      this.courseId = courseIdFromQuery;
    }

    this.initializeForm();
    this.loadCourses();

    if (this.isEditMode && this.classId) {
      this.loadClass();
    } else {
      // En modo creación, verificar si hay un courseId en query params
      if (courseIdFromQuery) {
        this.classForm.patchValue({ courseId: courseIdFromQuery });
      }
      this.loading.set(false);
    }
  }

  initializeForm(): void {
    this.classForm = this.fb.group({
      name: ['', [Validators.required]],
      description: [''],
      courseId: ['', [Validators.required]],
      linkLive: [''],
      imageFile: [null]
    });
  }

  loadCourses(): void {
    this.coursesService.getCourses({ page: 1, page_size: 1000 }).subscribe({
      next: (response) => {
        this.courses.set(response.data || []);
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

        // Convertir courseId a string si es un objeto
        let courseIdValue = '';
        if (classData.courseId) {
          if (typeof classData.courseId === 'object') {
            // Si es un objeto con _id (populated)
            if (classData.courseId._id) {
              courseIdValue = classData.courseId._id.toString();
            }
            // Si es un ObjectId de mongoose
            else if (classData.courseId.toString) {
              courseIdValue = classData.courseId.toString();
            }
          } else {
            // Si ya es un string
            courseIdValue = String(classData.courseId);
          }
        }

        // Guardar el courseId para navegación posterior
        this.courseId = courseIdValue;

        // Cargar información del curso
        if (courseIdValue) {
          this.coursesService.getCourseById(courseIdValue).subscribe({
            next: (courseResponse) => {
              const courseData = courseResponse?.data || courseResponse;
              this.course.set(courseData);
            },
            error: (error) => {
              console.error('Error loading course:', error);
            }
          });
        }
        
        // Llenar el formulario
        this.classForm.patchValue({
          name: classData.name || '',
          description: classData.description || '',
          courseId: courseIdValue,
          linkLive: classData.linkLive || ''
        });

        // Deshabilitar el campo courseId en modo edición
        if (this.isEditMode) {
          this.classForm.get('courseId')?.disable();
        }

        // Cargar preview de imagen si existe
        if (classData.imageUrl) {
          this.imagePreview = this.getClassImageUrl(classData.imageUrl);
        }

        // Cargar preview de video si existe
        if (classData.videoUrl) {
          this.videoPreview = this.getClassVideoUrl(classData.videoUrl);
        }

        // Cargar materiales de apoyo existentes
        if (classData.supportMaterials && classData.supportMaterials.length > 0) {
          this.existingSupportMaterials = [...classData.supportMaterials];
        }

        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading class:', error);
        this.error.set('Error al cargar la clase. Verifica que el ID sea válido.');
        this.loading.set(false);
      }
    });
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.selectedImageFile = file;

      // Crear preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.imagePreview = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  onVideoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];

      // Validar tamaño de video (máximo 2GB - límite del backend)
      const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
      if (file.size > maxSize) {
        this.info.showError('El video no puede superar los 2GB');
        input.value = '';
        return;
      }

      this.selectedVideoFile = file;

      // Crear URL para preview de video
      const videoUrl = URL.createObjectURL(file);
      this.videoPreview = videoUrl;
    }
  }

  onSupportFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const newFiles = Array.from(input.files);
      this.selectedSupportFiles = [...this.selectedSupportFiles, ...newFiles];
      this.classForm.markAsDirty();
      input.value = '';
    }
  }

  removeSupportFile(index: number): void {
    this.selectedSupportFiles.splice(index, 1);
    this.classForm.markAsDirty();
  }

  removeExistingSupportMaterial(material: string): void {
    this.supportMaterialsToDelete.push(material);
    this.existingSupportMaterials = this.existingSupportMaterials.filter(m => m !== material);
    this.classForm.markAsDirty();
  }

  getSupportMaterialUrl(fileName: string): string {
    if (fileName.startsWith('http://') || fileName.startsWith('https://')) {
      return fileName;
    }
    return `https://cursala.b-cdn.net/support-materials/${encodeURIComponent(fileName)}`;
  }

  getSupportMaterialName(fileName: string): string {
    return fileName.split('/').pop() || fileName;
  }

  downloadSupportMaterial(fileName: string): void {
    const url = this.getSupportMaterialUrl(fileName);
    window.open(url, '_blank');
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

  onSubmit(): void {
    if (this.classForm.invalid) {
      this.classForm.markAllAsTouched();
      this.info.showError('Por favor, completa todos los campos requeridos');
      return;
    }

    this.saving.set(true);
    
    // Habilitar el campo courseId temporalmente para obtener su valor
    if (this.isEditMode) {
      this.classForm.get('courseId')?.enable();
    }
    
    const formValue = this.classForm.value;
    
    // Volver a deshabilitar si es modo edición
    if (this.isEditMode) {
      this.classForm.get('courseId')?.disable();
    }

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

    // Agregar archivos de apoyo
    if (this.selectedSupportFiles.length > 0) {
      classData.supportMaterials = this.selectedSupportFiles;
    }

    // En modo edición, mantener los materiales existentes que no se eliminaron
    if (this.isEditMode && this.supportMaterialsToDelete.length > 0) {
      const remainingMaterials = this.existingSupportMaterials.filter(
        m => !this.supportMaterialsToDelete.includes(m)
      );
      classData.supportMaterialIds = remainingMaterials;
    } else if (this.isEditMode && this.existingSupportMaterials.length > 0) {
      classData.supportMaterialIds = this.existingSupportMaterials;
    }

    if (this.isEditMode && this.classId) {
      // Actualizar clase existente
      this.classesService.updateClass(this.classId, classData).subscribe({
        next: () => {
          this.info.showSuccess('Clase actualizada exitosamente');
          this.navigateBackToCourse();
        },
        error: (error) => {
          console.error('Error updating class:', error);
          this.info.showError('Error al actualizar la clase');
          this.saving.set(false);
        }
      });
    } else {
      // Crear nueva clase
      if (!this.selectedImageFile) {
        this.info.showError('La imagen es requerida para crear una nueva clase');
        this.saving.set(false);
        return;
      }

      this.classesService.createClass(classData).subscribe({
        next: () => {
          this.info.showSuccess('Clase creada exitosamente');
          this.navigateBackToCourse();
        },
        error: (error) => {
          console.error('Error creating class:', error);
          this.info.showError('Error al crear la clase');
          this.saving.set(false);
        }
      });
    }
  }

  onCancel(): void {
    this.navigateBackToCourse();
  }

  private navigateBackToCourse(): void {
    if (this.courseId) {
      this.router.navigate(['/admin/classes'], { queryParams: { courseId: this.courseId } });
    } else {
      this.router.navigate(['/admin/classes']);
    }
  }
}

