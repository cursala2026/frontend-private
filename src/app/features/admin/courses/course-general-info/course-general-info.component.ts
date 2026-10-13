import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ImageUploaderComponent } from '../../../../shared/components/image-uploader/image-uploader.component';
import { CourseAdminService, AsyncCourseData } from '../../../../core/services/course-admin.service';
import { CoursesService } from '../../../../core/services/courses.service';
import { ComponentCanDeactivate } from '../../../../core/guards/unsaved-changes.guard';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-course-general-info',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ImageUploaderComponent],
  template: `
    <div class="max-w-2xl mx-auto p-6">
      <h1 class="text-3xl font-bold mb-2">Crear Curso Asincronico</h1>

      <!-- estado badge -->
      <div class="mb-6">
        <span [class]="'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ' +
          (courseStatus() === 'DRAFT' ? 'bg-gray-100 text-gray-800' :
           courseStatus() === 'PENDING_REVIEW' ? 'bg-yellow-100 text-yellow-800' :
           'bg-green-100 text-green-800')">
          {{ getBadgeText() }}
        </span>
      </div>

      <form [formGroup]="courseForm" (ngSubmit)="onSubmit()" class="space-y-6">
        <!-- titulo -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Titulo del Curso</label>
          <input
            type="text"
            formControlName="titulo"
            placeholder="Ej: Desarrollo Web Avanzado"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxlength="120"
          />
          <div class="flex justify-between mt-1">
            <span class="text-xs text-gray-500">{{ getTituloLength() }}/120 caracteres</span>
            @if (courseForm.get('titulo')?.invalid && courseForm.get('titulo')?.touched) {
              <span class="text-xs text-red-600">Campo obligatorio</span>
            }
          </div>
        </div>

        <!-- modalidad -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Modalidad</label>
          <input
            type="text"
            value="ASYNC"
            disabled
            class="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
          />
          <p class="text-xs text-gray-500 mt-1">Modalidad bloqueada en Asincronico</p>
        </div>

        <!-- descripcion -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Descripcion/Resumen</label>
          <textarea
            formControlName="descripcion"
            placeholder="Describe el contenido y objetivos del curso..."
            rows="5"
            maxlength="2000"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          ></textarea>
          <div class="flex justify-between mt-1">
            <span class="text-xs text-gray-500">{{ getDescripcionLength() }}/2000 caracteres</span>
            @if (courseForm.get('descripcion')?.invalid && courseForm.get('descripcion')?.touched) {
              <span class="text-xs text-red-600">Campo obligatorio</span>
            }
          </div>
        </div>

        <!-- portada -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-3">Portada/Thumbnail</label>
          <app-image-uploader
            [imageShape]="'rectangle'"
            [aspectRatio]="'16:9'"
            (imageUploaded)="onThumbnailUploaded($event)"
          ></app-image-uploader>
        </div>

        <!-- botones -->
        <div class="flex gap-4 pt-6 border-t">
          <button
            type="button"
            (click)="onSaveDraft()"
            class="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
          >
            Guardar Borrador
          </button>
          <button
            type="submit"
            [disabled]="!courseForm.valid || submitting() || !hasContent()"
            class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {{ submitting() ? 'Solicitando...' : 'Solicitar Aprobacion' }}
          </button>
        </div>
        @if (!hasContent()) {
          <p class="text-xs text-gray-500 text-right">Para solicitar aprobacion, el curso necesita al menos un modulo con lecciones.</p>
        }

        @if (successMessage()) {
          <div class="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
            {{ successMessage() }}
          </div>
        }

        @if (errorMessage()) {
          <div class="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            {{ errorMessage() }}
          </div>
        }
      </form>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class CourseGeneralInfoComponent implements OnInit, ComponentCanDeactivate {
  private fb = inject(FormBuilder);
  private courseAdminService = inject(CourseAdminService);
  private coursesService = inject(CoursesService);
  private route = inject(ActivatedRoute, { optional: true });

  courseForm!: FormGroup;
  courseStatus = signal<'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED'>('DRAFT');
  hasContent = signal(false);
  submitting = signal(false);
  successMessage = signal('');
  errorMessage = signal('');

  private courseId: string | null = null;
  private thumbnail: File | null = null;

  ngOnInit() {
    this.initializeForm();
    this.courseId = this.route?.snapshot.paramMap.get('courseId') ?? null;
    if (this.courseId) {
      this.loadCourse(this.courseId);
    }
  }

  private initializeForm() {
    this.courseForm = this.fb.group({
      titulo: ['', [Validators.required, Validators.maxLength(120)]],
      descripcion: ['', [Validators.required, Validators.maxLength(2000)]]
    });
  }

  private loadCourse(courseId: string) {
    this.coursesService.getCourseById(courseId).subscribe({
      next: (response) => {
        const course = response?.data ?? response;
        this.courseForm.patchValue({
          titulo: course.name ?? '',
          descripcion: course.description ?? ''
        });
        this.courseStatus.set(course.status ?? 'DRAFT');
        this.hasContent.set(this.hasModulesWithLessons(course));
        this.courseForm.markAsPristine();
      },
      error: () => {
        this.errorMessage.set('Error al cargar el curso');
      }
    });
  }

  private hasModulesWithLessons(course: any): boolean {
    return (course?.modules ?? []).some((m: any) => (m.lessons ?? []).length > 0);
  }

  getTituloLength(): number {
    return this.courseForm.get('titulo')?.value?.length || 0;
  }

  getDescripcionLength(): number {
    return this.courseForm.get('descripcion')?.value?.length || 0;
  }

  onThumbnailUploaded(file: File | string) {
    if (file instanceof File) {
      this.thumbnail = file;
    }
  }

  onSaveDraft() {
    this.save('DRAFT', 'Curso guardado como borrador', 'Error al guardar el curso');
  }

  onSubmit() {
    if (!this.hasContent()) {
      this.errorMessage.set('Agrega al menos un modulo con lecciones antes de solicitar aprobacion');
      return;
    }
    this.save('PENDING_REVIEW', 'Solicitud de aprobacion enviada', 'Error al solicitar aprobacion');
  }

  private save(status: 'DRAFT' | 'PENDING_REVIEW', successMsg: string, errorMsg: string) {
    if (!this.courseForm.valid) {
      this.errorMessage.set('Completa todos los campos requeridos');
      return;
    }

    this.submitting.set(true);
    const data: AsyncCourseData = {
      title: this.courseForm.get('titulo')?.value,
      modality: 'ASYNC',
      description: this.courseForm.get('descripcion')?.value,
      thumbnail: this.thumbnail || undefined,
      status
    };

    const request$: Observable<any> = this.courseId
      ? this.courseAdminService.updateAsyncCourse(this.courseId, data)
      : this.courseAdminService.createAsyncCourse(data);

    request$.subscribe({
      next: (response) => {
        if (!this.courseId) {
          this.courseId = (response?.data ?? response)?._id ?? null;
        }
        this.successMessage.set(successMsg);
        this.courseStatus.set(status);
        this.submitting.set(false);
        this.courseForm.markAsPristine();
      },
      error: () => {
        this.errorMessage.set(errorMsg);
        this.submitting.set(false);
      }
    });
  }

  getBadgeText(): string {
    const status = this.courseStatus();
    return status === 'DRAFT' ? 'Borrador' :
           status === 'PENDING_REVIEW' ? 'En Revision' :
           'Publicado';
  }

  canDeactivate(): boolean {
    return this.courseForm.pristine;
  }
}
