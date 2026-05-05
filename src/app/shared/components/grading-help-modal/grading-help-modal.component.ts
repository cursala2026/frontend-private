import { Component, input, output, effect, OnDestroy } from '@angular/core';


@Component({
  selector: 'app-grading-help-modal',
  standalone: true,
  imports: [],
  templateUrl: './grading-help-modal.component.html'
})
export class GradingHelpModalComponent implements OnDestroy {
  isOpen = input<boolean>(false);
  closeModal = output<void>();

  private removeBodyLock = () => document.body.classList.remove('overflow-hidden');

  constructor() {
    // When `isOpen()` changes, lock/unlock body scroll and focus the dialog.
    effect(() => {
      const open = this.isOpen?.();
      if (open) {
        document.body.classList.add('overflow-hidden');
        // Try to focus the dialog for accessibility
        setTimeout(() => {
          const dlg = document.querySelector('[aria-label="Explicación de calificación"]') as HTMLElement | null;
          dlg?.focus();
        }, 0);
      } else {
        this.removeBodyLock();
      }
    });
  }

  onClose(): void {
    this.closeModal.emit();
    this.removeBodyLock();
  }

  ngOnDestroy(): void {
    this.removeBodyLock();
  }
}
