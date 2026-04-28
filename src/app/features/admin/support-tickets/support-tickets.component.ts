import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  SupportTicketService,
  SupportTicket,
  TicketStatus,
} from '../../../core/services/support-ticket.service';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { PaginationData, TableConfig } from '../../../shared/models/table.interface';

@Component({
  selector: 'app-support-tickets',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent],
  templateUrl: './support-tickets.component.html',
})
export class SupportTicketsComponent implements OnInit {
  private supportTicketService = inject(SupportTicketService);

  tickets = signal<SupportTicket[]>([]);
  loading = signal(false);
  errorMessage = signal('');

  // Paginación
  currentPage = signal(1);
  totalPages = signal(1);
  totalTickets = signal(0);
  readonly pageSize = 20;

  pagination = computed<PaginationData>(() => ({
    page: this.currentPage(),
    total: this.totalTickets(),
    totalPages: this.totalPages(),
    page_size: this.pageSize
  }));

  // Filtro
  filterStatus = signal<TicketStatus | ''>('');

  // Estadísticas
  stats = signal<{ total: number; pending: number; inProgress: number; resolved: number } | null>(null);

  // Detalle
  selectedTicket: SupportTicket | null = null;
  adminNotesInput = '';
  savingNotes = signal(false);
  updatingStatus = signal(false);

  TicketStatus = TicketStatus;

  tableConfig: TableConfig = {
    columns: [
      {
        key: 'userName',
        label: 'Usuario',
        sortable: true,
      },
      {
        key: 'subject',
        label: 'Asunto',
        sortable: true,
      },
      {
        key: 'imageUrl',
        label: 'Imagen',
        type: 'badge',
        formatter: (val) => val ? 'Sí' : 'No',
      },
      {
        key: 'status',
        label: 'Estado',
        type: 'badge',
        formatter: (val: TicketStatus) => this.statusLabel(val),
      },
      {
        key: 'createdAt',
        label: 'Fecha',
        type: 'date',
        sortable: true
      }
    ],
    actions: [
      {
        label: 'Ver detalle',
        iconSvg: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
        handler: (row) => this.openTicket(row)
      },
      {
        label: 'Eliminar',
        iconSvg: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
        class: 'text-red-600',
        requireConfirm: true,
        confirmTitle: 'Eliminar reporte',
        confirmMessage: (row) => `¿Está seguro de que desea eliminar el reporte "${row.subject}"? Esta acción no se puede deshacer.`,
        handler: (row) => this.deleteTicket(row)
      }
    ]
  };

  ngOnInit(): void {
    this.loadStats();
    this.loadTickets();
  }

  loadStats(): void {
    this.supportTicketService.getStats().subscribe({
      next: (res: any) => this.stats.set(res.data),
      error: () => {},
    });
  }

  loadTickets(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    const status = this.filterStatus() || undefined;

    this.supportTicketService
      .getAllTickets({ page: this.currentPage(), limit: this.pageSize, status: status as any })
      .subscribe({
        next: (res) => {
          this.tickets.set(res.data);
          this.totalPages.set(res.pagination.totalPages);
          this.totalTickets.set(res.pagination.total);
          this.loading.set(false);
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message || 'Error al cargar los reportes.');
          this.loading.set(false);
        },
      });
  }

  onFilterChange(): void {
    this.currentPage.set(1);
    this.loadTickets();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadTickets();
  }

  onSortChange(event: { column: string; direction: 'ASC' | 'DESC' }): void {
    // Implementar si el backend soporta ordenamiento
    // Por ahora solo recargamos
    this.loadTickets();
  }

  onActionClick(event: { action: string; row: SupportTicket }): void {
    if (event.action === 'Ver detalle') {
      this.openTicket(event.row);
    } else if (event.action === 'Eliminar') {
      this.deleteTicket(event.row);
    }
  }

  openTicket(ticket: SupportTicket): void {
    this.selectedTicket = ticket;
    this.adminNotesInput = ticket.adminNotes || '';
  }

  closeDetail(): void {
    this.selectedTicket = null;
    this.adminNotesInput = '';
  }

  markAsRead(ticket: SupportTicket): void {
    if (ticket.status !== TicketStatus.PENDING) return;
    this.updatingStatus.set(true);
    this.supportTicketService.updateStatus(ticket._id, TicketStatus.IN_PROGRESS).subscribe({
      next: (res) => {
        this.patchTicket(res.data);
        this.updatingStatus.set(false);
        this.loadStats();
      },
      error: () => this.updatingStatus.set(false),
    });
  }

  markAsResolved(ticket: SupportTicket): void {
    this.updatingStatus.set(true);
    this.supportTicketService.resolveTicket(ticket._id, this.adminNotesInput || undefined).subscribe({
      next: (res) => {
        this.patchTicket(res.data);
        this.updatingStatus.set(false);
        this.loadStats();
      },
      error: () => this.updatingStatus.set(false),
    });
  }

  saveNotes(ticket: SupportTicket): void {
    if (!this.adminNotesInput.trim()) return;
    this.savingNotes.set(true);
    this.supportTicketService.updateNotes(ticket._id, this.adminNotesInput.trim()).subscribe({
      next: (res) => {
        this.patchTicket(res.data);
        this.savingNotes.set(false);
      },
      error: () => this.savingNotes.set(false),
    });
  }

  deleteTicket(ticket: SupportTicket): void {
    this.supportTicketService.deleteTicket(ticket._id).subscribe({
      next: () => {
        this.tickets.update((list) => list.filter((t) => t._id !== ticket._id));
        if (this.selectedTicket?._id === ticket._id) this.closeDetail();
        this.loadStats();
      },
      error: () => {},
    });
  }

  private patchTicket(updated: SupportTicket): void {
    this.tickets.update((list) =>
      list.map((t) => (t._id === updated._id ? { ...t, ...updated } : t))
    );
    if (this.selectedTicket?._id === updated._id) {
      this.selectedTicket = { ...this.selectedTicket!, ...updated };
    }
  }

  statusLabel(status: TicketStatus): string {
    const map: Record<TicketStatus, string> = {
      [TicketStatus.PENDING]: 'Pendiente',
      [TicketStatus.IN_PROGRESS]: 'Leído',
      [TicketStatus.RESOLVED]: 'Resuelto',
    };
    return map[status] ?? status;
  }

  statusClasses(status: TicketStatus): string {
    const map: Record<TicketStatus, string> = {
      [TicketStatus.PENDING]: 'bg-yellow-100 text-yellow-800',
      [TicketStatus.IN_PROGRESS]: 'bg-blue-100 text-blue-800',
      [TicketStatus.RESOLVED]: 'bg-green-100 text-green-800',
    };
    return map[status] ?? 'bg-gray-100 text-gray-700';
  }

  trackById(_: number, ticket: SupportTicket): string {
    return ticket._id;
  }
}
