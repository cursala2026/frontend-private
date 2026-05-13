import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ConfirmModalConfig {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClass?: string;
  cancelButtonClass?: string;
  icon?: 'warning' | 'danger' | 'info' | 'success';
}

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-modal.component.html',
  styleUrl: './confirm-modal.component.css'
})
export class ConfirmModalComponent {
  @Input() isOpen = signal<boolean>(false);
  @Input() config: ConfirmModalConfig = {
    title: 'Confirmar acción',
    message: '¿Estás seguro de que deseas continuar?',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    icon: 'warning'
  };

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  stopPropagation(event: Event): void {
    event.stopPropagation();
  }

  onConfirm(): void {
    this.isOpen.set(false);
    this.confirm.emit();
  }

  onCancel(): void {
    this.isOpen.set(false);
    this.cancel.emit();
  }

  getIconClasses(): string {
    const baseClasses = 'mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full sm:mx-0 sm:h-10 sm:w-10';
    const iconClasses = {
      'warning': 'bg-yellow-100',
      'danger': 'bg-red-100',
      'info': 'bg-blue-100',
      'success': 'bg-green-100'
    };
    return `${baseClasses} ${iconClasses[this.config.icon || 'warning']}`;
  }

  getIconColorClasses(): string {
    const colorClasses = {
      'warning': 'text-yellow-600',
      'danger': 'text-red-600',
      'info': 'text-blue-600',
      'success': 'text-green-600'
    };
    return colorClasses[this.config.icon || 'warning'];
  }
}
