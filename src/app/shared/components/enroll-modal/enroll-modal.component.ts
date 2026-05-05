import { Component, signal, inject, input, output } from '@angular/core';


@Component({
  selector: 'app-enroll-modal',
  standalone: true,
  imports: [],
  templateUrl: './enroll-modal.component.html'
})
export class EnrollModalComponent {
  isOpen = input.required<boolean>();
  courseName = input<string>('');
  isLoading = input<boolean>(false);
  
  onConfirm = output<void>();
  onCancel = output<void>();

  confirm(): void {
    this.onConfirm.emit();
  }

  cancel(): void {
    this.onCancel.emit();
  }
}
