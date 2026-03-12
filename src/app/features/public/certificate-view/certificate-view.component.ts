import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../core/config/environment';

interface CertificateTeacher {
  _id: string;
  firstName: string;
  lastName: string;
  professionalSignatureUrl?: string;
}

interface CertificateData {
  isValid: boolean;
  message?: string;
  certificateLogos?: string[];
  student?: {
    firstName: string;
    lastName: string;
    dni?: string;
  };
  course?: {
    name: string;
    duration?: number;
  };
  teachers?: CertificateTeacher[];
  certificateInfo?: {
    certificateId: string;
    generatedAt: string;
  };
}

@Component({
  selector: 'app-certificate-view',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './certificate-view.component.html',

})
export class CertificateViewComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  
  certificateData = signal<CertificateData | null>(null);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  verificationCode = signal<string | null>(null);

  ngOnInit() {
    this.route.params.subscribe(params => {
      const code = params['verificationCode'];
      if (code) {
        this.verificationCode.set(code);
        this.validateCertificate(code);
      } else {
        this.error.set('Código de verificación no proporcionado');
        this.loading.set(false);
      }
    });
  }

  validateCertificate(verificationCode: string) {
    this.loading.set(true);
    this.error.set(null);
    
    this.http.get<{ status: number; message: string; data: CertificateData }>(`${environment.apiUrl}/certificate/validate/${verificationCode}`)
      .subscribe({
        next: (response) => {
          if (response.data?.isValid) {
            this.certificateData.set(response.data);
          } else {
            this.error.set(response.data?.message || response.message || 'Certificado no válido');
          }
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Error validating certificate:', err);
          const errorMessage = err?.error?.message || err?.error?.data?.message || 'Error al validar el certificado';
          this.error.set(errorMessage);
          this.loading.set(false);
        }
      });
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  getQRCodeUrl(): string {
    const code = this.verificationCode();
    if (!code) return '';
    const publicUrl = `${window.location.origin}/certificate/${code}`;
    // Usar un servicio de QR code online
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(publicUrl)}`;
  }

  handleQRError(event: Event): void {
    // Si falla la carga del QR, intentar con otro servicio o mostrar placeholder
    const img = event.target as HTMLImageElement;
    img.src = `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(`${window.location.origin}/certificate/${this.verificationCode()}`)}`;
  }
}

