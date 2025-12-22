import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-unenroll-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './unenroll-modal.component.html'
})
export class UnenrollModalComponent {
  isOpen = input<boolean>(false);
  courseName = input<string>('');
  isLoading = input<boolean>(false);

  closeModal = output<void>();
  confirmUnenroll = output<void>();

  onClose(): void {
    this.closeModal.emit();
  }

  onConfirm(): void {
    this.confirmUnenroll.emit();
  }
}
