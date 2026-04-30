import { Component, EventEmitter, Input, Output } from '@angular/core';

import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';

@Component({
  selector: 'app-signature-cropper',
  standalone: true,
  imports: [ImageCropperComponent],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div class="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <!-- Header -->
        <div class="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div>
            <h3 class="text-xl font-bold text-gray-900">Ajustar Firma</h3>
            <p class="text-sm text-gray-500 mt-1">Encuadra el trazo para que se vea claro en el certificado</p>
          </div>
          <button (click)="onCancel()" class="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="p-8">
          <div class="bg-white rounded-2xl overflow-hidden border-2 border-dashed border-gray-200 min-h-[300px] flex items-center justify-center" style="touch-action: none;">
            @if (imageChangedEvent?.originalBase64) {
              <image-cropper
                [imageBase64]="imageChangedEvent.originalBase64"
                [maintainAspectRatio]="true"
                [aspectRatio]="80 / 38"
                [resizeToWidth]="400"
                [format]="'png'"
                (imageCropped)="imageCropped($event)"
                (imageLoaded)="onImageLoaded()"
                (loadImageFailed)="onLoadImageFailed()"
                class="max-h-[400px]"
              ></image-cropper>
            } @else {
              <image-cropper
                [imageChangedEvent]="imageChangedEvent"
                [maintainAspectRatio]="true"
                [aspectRatio]="80 / 38"
                [resizeToWidth]="400"
                [format]="'png'"
                (imageCropped)="imageCropped($event)"
                (imageLoaded)="onImageLoaded()"
                (loadImageFailed)="onLoadImageFailed()"
                class="max-h-[400px]"
              ></image-cropper>
            }
          </div>

          <!-- Recommendations -->
          <div class="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="flex items-start gap-3 p-3 rounded-xl bg-blue-50 border border-blue-100 text-blue-700">
              <p class="text-[11px] leading-tight font-medium">Sube archivos en formato PNG, JPG o JPEG (máx. 25MB).</p>
            </div>
            <div class="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-700">
              <p class="text-[11px] leading-tight font-medium">Usa imágenes con buen contraste y alta resolución.</p>
            </div>
            <div class="flex items-start gap-3 p-3 rounded-xl bg-green-50 border border-green-100 text-green-700">
              <p class="text-[11px] leading-tight font-medium">Ajusta el zoom para que el trazo ocupe todo el área azul.</p>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-8 py-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button (click)="onCancel()"
            class="px-6 py-2.5 text-sm font-bold text-gray-600 hover:text-gray-900 transition-colors uppercase">
            Cancelar
          </button>
          <button (click)="onConfirm()" [disabled]="!croppedImageBase64"
            class="px-8 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg active:scale-95 uppercase">
            Aplicar Recorte
          </button>
        </div>
      </div>
    </div>
  `
})
export class SignatureCropperComponent {
  @Input() imageChangedEvent: any = '';
  @Output() cropped = new EventEmitter<Blob>();
  @Output() cancel = new EventEmitter<void>();

  croppedImageBase64: any = '';

  onImageLoaded() {
    console.log('Firma cargada en el cropper exitosamente');
  }

  onLoadImageFailed() {
    console.log('Error al cargar la firma en el cropper');
  }

  imageCropped(event: ImageCroppedEvent) {
    this.croppedImageBase64 = event.objectUrl || event.base64;
  }

  onCancel() {
    this.cancel.emit();
  }

  onConfirm() {
    if (this.croppedImageBase64) {
      if (typeof this.croppedImageBase64 === 'string' && this.croppedImageBase64.startsWith('blob:')) {
        fetch(this.croppedImageBase64)
          .then(res => res.blob())
          .then(blob => this.cropped.emit(blob));
      } else if (typeof this.croppedImageBase64 === 'string' && this.croppedImageBase64.startsWith('data:')) {
        const byteString = atob(this.croppedImageBase64.split(',')[1]);
        const mimeString = this.croppedImageBase64.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: mimeString });
        this.cropped.emit(blob);
      }
    }
  }
}
