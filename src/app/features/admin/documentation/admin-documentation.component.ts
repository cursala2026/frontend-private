import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DocumentationService } from '../../../core/services/documentation.service';
import { InfoService } from '../../../core/services/info.service';

@Component({
  selector: 'app-admin-documentation',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-documentation.component.html',
})
export class AdminDocumentationComponent implements OnInit {
  private fb = inject(FormBuilder);
  private documentationService = inject(DocumentationService);
  private info = inject(InfoService);

  readonly documents = this.documentationService.documents;
  readonly isUploading = signal(false);
  readonly uploadProgress = signal(0);

  // Documento actualmente seleccionado en la vista
  readonly selectedDocument = signal<any | null>(null);

  readonly searchTerm = signal<string>('');
  readonly extensions = ['TODAS', '.pdf', '.png', '.docx', '.xlsx', '.pptx', '.zip'];
  readonly selectedExtension = signal<string>('TODAS');
  readonly categories = ['PLANTILLAS', 'LOGOS', 'IMAGENES', 'OTROS'];

  selectedFile: File | null = null;

  form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    category: ['PLANTILLAS', [Validators.required]],
  });

  private readonly maxSizeMB = 10;
  private readonly allowedExt = ['pdf', 'png', 'jpg', 'jpeg', 'pptx', 'docx', 'xlsx', 'zip'];

  // Carga inicial obligatoria al inicializar el componente
  ngOnInit(): void {
    this.documentationService.getDocuments().subscribe();
  }

  // Filtrado reactivo normalizado con el esquema de MongoDB
  readonly finalFilteredDocuments = computed(() => {
    const rawDocs = this.documents();
    if (!Array.isArray(rawDocs)) return [];

    const term = this.searchTerm().trim().toLowerCase();
    const ext = this.selectedExtension().toLowerCase();

    return rawDocs.filter((doc: any) => {
      const displayName = (doc.name || doc.fileName || doc.originalFileName || doc.title || '').toLowerCase();
      const matchesName = displayName.includes(term);
      const matchesExt = ext === 'todas' || displayName.endsWith(ext);
      return matchesName && matchesExt;
    });
  });

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  selectExtension(ext: string): void {
    this.selectedExtension.set(ext);
  }

  // Acción para seleccionar un documento en el panel
  selectDoc(doc: any): void {
    this.selectedDocument.set(doc);
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) {
      this.selectedFile = null;
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!this.allowedExt.includes(ext)) {
      this.info.showError('Tipo de archivo no permitido');
      this.selectedFile = null;
      input.value = '';
      return;
    }
    if (file.size > this.maxSizeMB * 1024 * 1024) {
      this.info.showError(`El archivo supera los ${this.maxSizeMB} MB`);
      this.selectedFile = null;
      input.value = '';
      return;
    }
    this.selectedFile = file;
  }

  private mapExtensionToCategory(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    switch (ext) {
      case 'doc':
      case 'docx':
        return 'word';
      case 'xls':
      case 'xlsx':
        return 'excel';
      case 'pdf':
        return 'pdf';
      case 'ppt':
      case 'pptx':
        return 'powerpoint';
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'svg':
        return 'image';
      default:
        return 'other';
    }
  }

  private mapCategoryToType(uiCategory: string): string {
    switch (uiCategory) {
      case 'PLANTILLAS':
        return 'template';
      case 'OTROS':
        return 'support_document';
      default:
        return 'educational_material';
    }
  }

  onSubmit(): void {
    if (this.form.invalid || !this.selectedFile) {
      this.info.showError('Completá el formulario y seleccioná un archivo');
      return;
    }

    const file = this.selectedFile;
    const uiCategory = this.form.value.category ?? 'PLANTILLAS';
    const schemaType = this.mapCategoryToType(uiCategory);
    const schemaCategory = this.mapExtensionToCategory(file.name);

    const formData = new FormData();
    formData.append('materialFile', file);
    formData.append('name', this.form.value.title ?? file.name);
    formData.append('type', schemaType);
    formData.append('category', schemaCategory);
    formData.append('isPublic', 'true');

    this.isUploading.set(true);
    this.uploadProgress.set(0);

    const progreso = setInterval(() => {
      this.uploadProgress.update((p) => Math.min(p + 20, 90));
    }, 150);

    this.documentationService.uploadDocument(formData).subscribe({
      next: () => {
        clearInterval(progreso);
        this.uploadProgress.set(100);
        this.info.showSuccess('Documento subido exitosamente');
        this.documentationService.refreshDocuments();
        this.form.reset({ category: 'PLANTILLAS' });
        this.selectedFile = null;
        this.isUploading.set(false);
      },
      error: (err) => {
        clearInterval(progreso);
        this.uploadProgress.set(0);
        this.isUploading.set(false);
        if (err.status === 413) {
          this.info.showError('El archivo es demasiado grande');
        } else if (err.status === 401) {
          this.info.showError('Sesión vencida, volvé a iniciar sesión');
        } else {
          this.info.showError(err.error?.message || 'Error al subir el documento');
        }
      },
    });
  }
}