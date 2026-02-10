import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../core/config/environment';

@Component({
  selector: 'app-image-uploader',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-4">
      <!-- Vista previa actual -->
      <div class="flex items-center justify-center p-6 bg-linear-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-300">
        <div class="text-center">
          <div class="relative inline-block group">
            <img
              [src]="imageUrl() || 'https://ui-avatars.com/api/?name=User&background=6366f1&color=fff'"
              [alt]="imageShape === 'rectangle' ? 'Imagen del curso' : 'Foto de perfil'"
              [class]="'object-cover ring-4 ring-white shadow-xl transition-all duration-300 ' +
                (imageShape === 'rectangle' ? 'w-48 h-32 rounded-lg' : 'w-32 h-32 rounded-full')"
              (error)="$event.target.src='https://ui-avatars.com/api/?name=User&background=6366f1&color=fff'"
            />

            <!-- Overlay hover -->
            <div [class]="'absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center cursor-pointer ' +
              (imageShape === 'rectangle' ? 'rounded-lg' : 'rounded-full')" (click)="fileInput.click()">
              <div class="text-center text-white">
                <svg class="w-8 h-8 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                <p class="text-xs font-medium">Cambiar</p>
              </div>
            </div>
            
            <!-- Botón de cámara -->
            @if (!uploading()) {
              <button
                type="button"
                (click)="fileInput.click()"
                class="absolute -bottom-2 -right-2 bg-blue-500 hover:bg-blue-600 text-white p-2.5 rounded-full shadow-lg transition-all duration-300 hover:scale-110 active:scale-95"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </button>
            }
            
            <!-- Loading spinner -->
            @if (uploading()) {
              <div class="absolute -bottom-2 -right-2 bg-blue-500 p-2.5 rounded-full shadow-lg">
                <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
            }
          </div>
          
          @if (!imageUrl() && !uploading()) {
            <p class="mt-3 text-sm text-gray-500">Haz clic para subir una foto</p>
          }
          
          @if (uploading()) {
            <p class="mt-3 text-sm text-blue-600 font-medium">Subiendo imagen...</p>
          }
          
          @if (uploadError()) {
            <p class="mt-2 text-xs text-red-600">{{ uploadError() }}</p>
          }
        </div>
      </div>
      
      <!-- Input file oculto -->
      <input
        #fileInput
        type="file"
        accept="image/*"
        (change)="onFileSelected($event)"
        class="hidden"
      />
      
      <!-- Información adicional -->
      <div class="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <svg class="w-5 h-5 text-blue-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <div class="text-xs text-blue-700">
          <p class="font-medium mb-1">Formato de imagen recomendado:</p>
          <ul class="list-disc list-inside space-y-0.5 text-blue-600">
            <li>Tamaño máximo: 25 MB</li>
            <li>Formatos: JPG, PNG, WebP</li>
            <li>Relación: {{ aspectRatio }}</li>
          </ul>
        </div>
      </div>
    </div>
  `
})
export class ImageUploaderComponent {
  @Input() currentImageUrl?: string;
  @Input() imageShape: 'circle' | 'rectangle' = 'circle'; // Forma de la imagen
  @Input() aspectRatio: string = '1:1'; // Relación de aspecto recomendada
  @Output() imageUploaded = new EventEmitter<string | File>();

  imageUrl = signal<string | undefined>(undefined);
  uploading = signal<boolean>(false);
  uploadError = signal<string | undefined>(undefined);

  constructor(private http: HttpClient) {}

  ngOnInit() {
    if (this.currentImageUrl) {
      this.imageUrl.set(this.currentImageUrl);
    }
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];

    // Validar tamaño
    if (file.size > 25 * 1024 * 1024) {
      this.uploadError.set('La imagen no debe superar los 25 MB');
      return;
    }

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      this.uploadError.set('Solo se permiten archivos de imagen');
      return;
    }

    this.uploadError.set(undefined);

    // Crear preview local
    const reader = new FileReader();
    reader.onload = (e) => {
      this.imageUrl.set(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Emitir el archivo para que el componente padre lo maneje
    this.imageUploaded.emit(file);

    // Limpiar el input para permitir subir el mismo archivo nuevamente
    input.value = '';
  }
}
