import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupportTicketService } from '../../../core/services/support-ticket.service';

@Component({
  selector: 'app-report-issue',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './report-issue.component.html',
})
export class ReportIssueComponent {
  private supportTicketService = inject(SupportTicketService);
  private router = inject(Router);

  subject = '';
  message = '';
  selectedFile: File | null = null;
  previewUrl: string | null = null;

  isSubmitting = signal(false);
  submitSuccess = signal(false);
  errorMessage = signal('');

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const maxSize = 5 * 1024 * 1024; // 5 MB

    if (!file.type.startsWith('image/')) {
      this.errorMessage.set('Solo se permiten archivos de imagen (JPG, PNG, GIF, WebP).');
      return;
    }

    if (file.size > maxSize) {
      this.errorMessage.set('La imagen no puede superar los 5 MB.');
      return;
    }

    this.errorMessage.set('');
    this.selectedFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
      this.previewUrl = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  removeFile(): void {
    this.selectedFile = null;
    this.previewUrl = null;
  }

  onSubmit(): void {
    if (!this.subject.trim() || !this.message.trim()) {
      this.errorMessage.set('El asunto y el mensaje son obligatorios.');
      return;
    }

    this.errorMessage.set('');
    this.isSubmitting.set(true);

    this.supportTicketService
      .createTicket(this.subject.trim(), this.message.trim(), this.selectedFile ?? undefined)
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.submitSuccess.set(true);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(err?.error?.message || 'Ocurrió un error al enviar el reporte. Intenta nuevamente.');
        },
      });
  }

  goBack(): void {
    this.router.back ? (this.router as any).back() : window.history.back();
  }
}
