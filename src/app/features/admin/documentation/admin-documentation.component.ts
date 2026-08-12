import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { DocumentationService } from '../../../core/services/documentation.service';
import { InfoService } from '../../../core/services/info.service';

@Component({
  selector: 'app-admin-documentation',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './admin-documentation.component.html',
})
export class AdminDocumentationComponent {
  private fb = inject(FormBuilder);
  private documentationService = inject(DocumentationService);
  private info = inject(InfoService);

  // lista de documentos que ya existen
  readonly documents = this.documentationService.documents;

  // estado del proceso de carga
  readonly isUploading = signal(false);
  // progreso de la subida (0 a 100)
  readonly uploadProgress = signal(0);

  // categorias permitidas para el select
  readonly categories = ['PLANTILLAS', 'LOGOS', 'IMAGENES', 'OTROS'];

  // archivo que elige el usuario
  selectedFile: File | null = null;

  // formulario reactivo con sus validaciones
  form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    category: ['PLANTILLAS', [Validators.required]],
  });

  // limites del archivo
  private readonly maxSizeMB = 10;
  private readonly allowedExt = ['pdf', 'png', 'jpg', 'jpeg', 'pptx', 'docx', 'xlsx', 'zip'];

  // valida el archivo cuando el usuario lo elige
  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) { this.selectedFile = null; return; }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!this.allowedExt.includes(ext)) {
      this.info.showError('tipo de archivo no permitido');
      this.selectedFile = null; input.value = ''; return;
    }
    if (file.size > this.maxSizeMB * 1024 * 1024) {
      this.info.showError(`el archivo supera los ${this.maxSizeMB} MB`);
      this.selectedFile = null; input.value = ''; return;
    }
    this.selectedFile = file;
  }

  // arma el multipart y lo manda al service
  onSubmit(): void {
    if (this.form.invalid || !this.selectedFile) {
      this.info.showError('completa el formulario y elegi un archivo');
      return;
    }

    const formData = new FormData();
    formData.append('title', this.form.value.title ?? '');
    formData.append('category', this.form.value.category ?? 'PLANTILLAS');
    formData.append('file', this.selectedFile);

    this.isUploading.set(true);
    this.uploadProgress.set(0);
    // simulamos el progreso mientras sube (con el service real vendria de los eventos http)
    const progreso = setInterval(() => {
      this.uploadProgress.update(p => Math.min(p + 20, 90));
    }, 150);

    this.documentationService.uploadDocument(formData).subscribe({
      next: () => {
        clearInterval(progreso);
        this.uploadProgress.set(100);
        this.info.showSuccess('documento subido');
        this.documentationService.refreshDocuments();
        this.form.reset({ category: 'PLANTILLAS' });
        this.selectedFile = null;
        this.isUploading.set(false);
      },
      error: (err) => {
        clearInterval(progreso);
        this.uploadProgress.set(0);
        this.isUploading.set(false);
        if (err.status === 413) this.info.showError('el archivo es demasiado grande');
        else if (err.status === 401) this.info.showError('sesion vencida, volve a iniciar sesion');
        else this.info.showError(err.error?.message || 'error al subir el documento');
      },
    });
    
  }
}