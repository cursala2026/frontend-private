import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CertificateService, Certificate } from '../../../core/services/certificate.service';
import { AuthService } from '../../../core/services/auth.service';
import { InfoService } from '../../../core/services/info.service';

@Component({
  selector: 'app-student-certificates',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './student-certificates.component.html',
  styleUrl: './student-certificates.component.css'
})
export class StudentCertificatesComponent implements OnInit {
  private certificateService = inject(CertificateService);
  private authService = inject(AuthService);
  private info = inject(InfoService);

  certificates = signal<Certificate[]>([]);
  loading = signal<boolean>(true);
  downloading = signal<string | null>(null);

  ngOnInit() {
    this.loadCertificates();
  }

  loadCertificates() {
    const user = this.authService.currentUser();
    if (!user?._id) {
      this.info.showError('Error: No se pudo obtener la información del usuario');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.certificateService.getCertificatesByStudent(user._id).subscribe({
      next: (response) => {
        const certs = response?.data || [];
        this.certificates.set(certs);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading certificates:', error);
        this.info.showError('Error al cargar los certificados');
        this.loading.set(false);
      }
    });
  }

  downloadCertificate(certificate: Certificate) {
    this.downloading.set(certificate.verificationCode);
    
    this.certificateService.downloadCertificate(certificate.verificationCode).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const courseName = certificate.courseName || 'curso';
        link.download = `certificado-${courseName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        this.downloading.set(null);
        this.info.showSuccess('Certificado descargado exitosamente');
      },
      error: (error) => {
        console.error('Error downloading certificate:', error);
        this.info.showError('Error al descargar el certificado');
        this.downloading.set(null);
      }
    });
  }

  viewPublicUrl(certificate: Certificate) {
    const publicUrl = `/certificate/${certificate.verificationCode}`;
    window.open(publicUrl, '_blank');
  }

  formatDate(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  getPublicUrl(certificate: Certificate): string {
    return `${window.location.origin}/certificate/${certificate.verificationCode}`;
  }
}

