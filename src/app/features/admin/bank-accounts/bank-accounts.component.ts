import { Component, inject, OnInit, signal, ViewChild, ChangeDetectorRef } from '@angular/core';

import { InfoService } from '../../../core/services/info.service';
import { MercadoPagoPaymentService } from '../../../core/services/mercadopago-payment.service';
import { ConfirmModalComponent, ConfirmModalConfig } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { ModalBankAccountsComponent } from './modal-bank-accounts/modal-bank-accounts.component';
import { TableComponent, TableColumn, TableAction } from '../../../shared/components/table/table.component';

@Component({
  selector: 'app-bank-accounts',
  standalone: true,
  imports: [ConfirmModalComponent, ModalBankAccountsComponent, TableComponent],
  templateUrl: './bank-accounts.component.html'
})
export class BankAccountsComponent implements OnInit {
  private info = inject(InfoService);
  private mercadoPagoService = inject(MercadoPagoPaymentService);
  private cdr = inject(ChangeDetectorRef);

  // Lista de pagos de Mercado Pago
  payments = signal<any[]>([]);
  loadingPayments = signal<boolean>(true);
  
  // Control para abrir modal de cuentas bancarias
  showBankAccountsModal = signal<boolean>(false);
  @ViewChild(ModalBankAccountsComponent) modalRef?: ModalBankAccountsComponent;
  
  // Eliminación de pagos (solo por item individual)
  deletingPayment = signal<string | null>(null);
  
  // Modal de confirmación para eliminar pago
  showDeleteModal = signal<boolean>(false);
  paymentToDelete = signal<any>(null);
  deleteModalConfig: ConfirmModalConfig = {
    title: 'Eliminar Pago',
    message: '',
    confirmText: 'Eliminar Pago',
    cancelText: 'Cancelar',
    confirmButtonClass: 'bg-red-600',
    icon: 'danger'
  };
  
  // Nota: los formularios y carga de cuentas ahora los maneja el componente modal

  // Configuración de columnas para la tabla
  tableColumns: TableColumn[] = [
    {
      header: 'Usuario',
      render: (row: any) => this.getUsernameForRow(row),
      cellClass: 'font-medium text-gray-900'
    },
    {
      header: 'Estado',
      render: (row: any) => this.getStatusText(row.status),
      cellClass: (row: any) => this.getStatusClass(row.status) + ' inline-flex px-2 py-1 text-xs font-semibold rounded-full'
    },
    {
      header: 'Monto',
      render: (row: any) => `$${row.transactionAmount?.toLocaleString('es-AR') || '0'}`,
      cellClass: 'text-gray-900'
    },
    {
      header: 'Estudiante',
      field: 'studentEmail',
      cellClass: 'text-gray-500'
    },
    {
      header: 'Curso',
      render: (row: any) => row.courseName || row.courseId,
      cellClass: 'text-gray-500'
    },
    {
      header: 'Fecha',
      render: (row: any) => this.formatDate(row.createdAt),
      cellClass: 'text-gray-500'
    }
  ];

  // Acciones disponibles por fila
  tableActions: TableAction[] = [
    {
      tooltip: 'Eliminar pago',
      icon: '<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>',
      onClick: (row: any) => this.deletePayment(row),
      isLoading: (row: any) => {
        const rowId = row._id || row.paymentId || row.id;
        return this.deletingPayment() === rowId;
      },
      disabled: (row: any) => {
        const rowId = row._id || row.paymentId || row.id;
        return this.deletingPayment() === rowId;
      },
      class: 'text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed'
    }
  ];

  ngOnInit() {
    this.loadPayments();
  }

  loadPayments() {
    this.loadingPayments.set(true);
    this.mercadoPagoService.getAllPayments(100).subscribe({
      next: (response) => {
        this.payments.set(response?.data || []);
        this.loadingPayments.set(false);
      },
      error: (error) => {
        console.error('Error loading payments:', error);
        this.info.showError('Error al cargar los pagos');
        this.loadingPayments.set(false);
      }
    });
  }


  deletePayment(payment: any) {
    const idToDelete = payment.paymentId || payment._id || payment.id;
    
    if (this.deletingPayment() === idToDelete || this.showDeleteModal()) {
      return;
    }

    this.paymentToDelete.set(payment);
    const idForDisplay = payment.paymentId || payment._id || payment.id || 'sin-id';

    this.deleteModalConfig = {
      title: 'Eliminar Pago',
      message: `¿Estás seguro de que quieres eliminar el pago ${idForDisplay}?`,
      confirmText: 'Eliminar Pago',
      cancelText: 'Cancelar',
      confirmButtonClass: 'bg-red-600',
      icon: 'danger'
    };
    this.showDeleteModal.set(true);
  }

  confirmDeletePayment() {
    const payment = this.paymentToDelete();
    if (!payment) return;

    const idToDelete = payment.paymentId || payment._id || payment.id;
    const paymentDbId = payment._id;
    
    if (this.deletingPayment() === idToDelete) {
      return;
    }

    if (!idToDelete) {
      this.info.showError('No se pudo identificar el ID del pago a eliminar');
      this.showDeleteModal.set(false);
      this.paymentToDelete.set(null);
      return;
    }
    
    this.showDeleteModal.set(false);
    this.deletingPayment.set(idToDelete);

    this.mercadoPagoService.deletePayment(idToDelete).subscribe({
      next: () => {
        this.info.showSuccess('Pago eliminado exitosamente');
        this.deletingPayment.set(null);
        this.paymentToDelete.set(null);
        this.loadPayments();
      },
      error: (error) => {
        if (error?.status === 404) {
          this.info.showSuccess('Pago ya fue eliminado');
        } else {
          const message = error?.error?.message || 'Error al eliminar el pago';
          this.info.showError(message);
        }
        this.deletingPayment.set(null);
        this.paymentToDelete.set(null);
        this.loadPayments();
      }
    });
  }

  cancelDeletePayment() {
    this.showDeleteModal.set(false);
    this.paymentToDelete.set(null);
  }

  openBankAccountsModal() {
    // Prefer calling modal.open() to ensure it loads accounts immediately
    if (this.modalRef && typeof this.modalRef.open === 'function') {
      this.modalRef.open();
      return;
    }
    this.showBankAccountsModal.set(true);
  }

  closeBankAccountsModal() {
    this.showBankAccountsModal.set(false);
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'rejected':
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  getStatusText(status: string): string {
    switch (status?.toLowerCase()) {
      case 'approved':
        return 'Aprobado';
      case 'pending':
        return 'Pendiente';
      case 'rejected':
        return 'Rechazado';
      case 'cancelled':
        return 'Cancelado';
      default:
        return status || 'Desconocido';
    }
  }

  getUsernameForRow(row: any): string {
    if (!row) return '';
    // Priorizar campos de username posibles según el shape de los datos
    const username = row.username || row.user?.username || row.userName || row.studentUsername;
    if (username) return username;

    // Fallbacks: email del payer, studentEmail, o nombre y apellido
    const payerEmail = row.payer?.email || row.payer?.email_address;
    if (payerEmail) return payerEmail;

    if (row.studentEmail) return row.studentEmail;

    const first = row.payer?.first_name || row.firstName || row.studentFirstName || '';
    const last = row.payer?.last_name || row.lastName || row.studentLastName || '';
    const full = `${first} ${last}`.trim();
    return full || '';
  }

  // Las validaciones de formulario para cuentas bancarias las maneja el componente modal.
}

