import { Component, EventEmitter, inject, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PublicDataService, PublicData } from '../../../../core/services/public-data.service';
import { InfoService } from '../../../../core/services/info.service';

const MAX_LOGOS = 6;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

@Component({
  selector: 'app-certificate-logos-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './certificate-logos-modal.component.html',
})
export class CertificateLogosModalComponent {
  private publicDataService = inject(PublicDataService);
  private info = inject(InfoService);

  /** El documento de companySpecificData */
  @Input() companyData: PublicData | null = null;
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  /** Emite el documento actualizado para que el parent lo sincronice */
  @Output() dataUpdated = new EventEmitter<PublicData>();

  uploading = signal(false);
  removingIndex = signal<number | null>(null);

  get logos(): string[] {
    return this.companyData?.certificateLogos ?? [];
  }

  get canAddMore(): boolean {
    return this.logos.length < MAX_LOGOS;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // reset para permitir reseleccionar mismo archivo

    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      this.info.showError('Solo se permiten imágenes PNG o JPG');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      this.info.showError('La imagen no debe superar los 5 MB');
      return;
    }
    if (!this.companyData?._id) {
      this.info.showError('No se encontró el documento de configuración. Recarga la página.');
      return;
    }

    this.uploading.set(true);
    this.publicDataService.uploadCertificateLogo(this.companyData._id, file).subscribe({
      next: (res) => {
        this.dataUpdated.emit(res.data);
        this.info.showSuccess('Logo agregado exitosamente');
        this.uploading.set(false);
      },
      error: (err) => {
        const msg = err?.error?.message || 'Error al subir el logo';
        this.info.showError(msg);
        this.uploading.set(false);
      },
    });
  }

  removeLogo(index: number): void {
    if (!this.companyData?._id) return;

    this.removingIndex.set(index);
    this.publicDataService.removeCertificateLogo(this.companyData._id, index).subscribe({
      next: (res) => {
        this.dataUpdated.emit(res.data);
        this.info.showSuccess('Logo eliminado');
        this.removingIndex.set(null);
      },
      error: (err) => {
        const msg = err?.error?.message || 'Error al eliminar el logo';
        this.info.showError(msg);
        this.removingIndex.set(null);
      },
    });
  }

  onClose(): void {
    this.close.emit();
  }
}
