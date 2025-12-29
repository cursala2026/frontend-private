import { Component, Input, Output, EventEmitter, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, FormBuilder } from '@angular/forms';
import { ImageUploaderComponent } from '../image-uploader/image-uploader.component';

export interface ModalField {
  key: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox' | 'password' | 'image' | 'file';
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  options?: { value: any; label: string }[]; // For select
  validators?: any[];
  value?: any;
  rows?: number; // For textarea
  imageShape?: 'circle' | 'rectangle'; // For image fields
  aspectRatio?: string; // For image fields
  accept?: string; // For file fields (e.g., '.pdf', 'application/pdf')
}

export interface ModalConfig {
  title: string;
  mode: 'view' | 'edit' | 'create';
  fields: ModalField[];
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

@Component({
  selector: 'app-modal-data-table',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ImageUploaderComponent],
  templateUrl: './modal-data-table.component.html'
})
export class ModalDataTableComponent {
  @Input() isOpen = signal<boolean>(false);
  @Input() config!: ModalConfig;
  @Input() data: any = {};
  
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<any>();
  
  form!: FormGroup;
  isSubmitting = signal<boolean>(false);

  constructor(private fb: FormBuilder) {
    effect(() => {
      if (this.isOpen() && this.config) {
        this.isSubmitting.set(false); // Resetear estado al abrir el modal
        this.initializeForm();
      }
    });
  }

  initializeForm(): void {
    const formControls: any = {};
    
    this.config.fields.forEach(field => {
      const value = this.data?.[field.key] ?? field.value ?? '';
      formControls[field.key] = [
        { value, disabled: field.disabled || this.config.mode === 'view' }
      ];
    });

    this.form = this.fb.group(formControls);
  }

  getSizeClass(): string {
    const sizes = {
      'sm': 'max-w-sm sm:max-w-md',
      'md': 'max-w-lg sm:max-w-2xl',
      'lg': 'max-w-2xl sm:max-w-4xl',
      'xl': 'max-w-3xl sm:max-w-6xl'
    };
    return sizes[this.config?.size || 'md'];
  }

  onClose(): void {
    this.isSubmitting.set(false);
    this.isOpen.set(false);
    this.close.emit();
  }

  onSave(): void {
    if (this.config.mode === 'view') {
      this.onClose();
      return;
    }

    if (this.form.valid) {
      this.isSubmitting.set(true);
      this.save.emit(this.form.value);
    } else {
      // Mark all fields as touched to show validation errors
      Object.keys(this.form.controls).forEach(key => {
        this.form.controls[key].markAsTouched();
      });
    }
  }

  getFieldValue(field: ModalField): any {
    if (this.config.mode === 'view') {
      const value = this.data?.[field.key];
      
      if (field.type === 'select' && field.options) {
        const option = field.options.find(opt => opt.value === value);
        return option?.label || value;
      }
      
      if (field.type === 'checkbox') {
        return value ? 'Sí' : 'No';
      }
      
      if (field.type === 'date' && value) {
        return new Date(value).toLocaleDateString('es-ES');
      }
      
      return value || '-';
    }
    
    return this.form?.get(field.key)?.value;
  }

  isFieldInvalid(field: ModalField): boolean {
    const control = this.form?.get(field.key);
    return !!(control && control.invalid && control.touched);
  }

  stopPropagation(event: Event): void {
    event.stopPropagation();
  }

  onImageUploaded(imageData: string | File, fieldKey: string): void {
    if (this.form) {
      this.form.patchValue({ [fieldKey]: imageData });
    }
  }

  onFileSelected(event: Event, fieldKey: string): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (this.form) {
        this.form.patchValue({ [fieldKey]: file });
      }
    }
  }

  getProgramUrl(value: any): string {
    if (!value) return '';
    if (typeof value === 'string') {
      // Si ya es una URL completa (de Bunny CDN), usarla directamente
      if (value.startsWith('http://') || value.startsWith('https://')) {
        return value;
      }
      // Si es solo un filename (legacy), construir la URL completa
      return `https://cursala.b-cdn.net/course-programs/${encodeURIComponent(value)}`;
    }
    return '';
  }

  getFileName(value: any): string {
    if (!value) return '';
    if (value instanceof File) {
      return value.name;
    }
    if (typeof value === 'string') {
      // Extraer solo el nombre del archivo sin la ruta
      const urlParts = value.split('/');
      return decodeURIComponent(urlParts[urlParts.length - 1]);
    }
    return '';
  }

  isFile(value: any): boolean {
    return value instanceof File;
  }

  removeFile(fieldKey: string): void {
    if (this.form) {
      this.form.patchValue({ [fieldKey]: null });
      // Resetear el input file
      const fileInput = document.querySelector(`input[type="file"][data-field="${fieldKey}"]`) as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
    }
  }
}
