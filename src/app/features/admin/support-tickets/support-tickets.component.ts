import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  SupportTicketService,
  SupportTicket,
  TicketStatus,
} from '../../../core/services/support-ticket.service';

@Component({
  selector: 'app-support-tickets',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  // Filtro
  filterStatus = signal<TicketStatus | ''>('');

  // Estadísticas
  stats = signal<{ total: number; pending: number; inProgress: number; resolved: number } | null>(null);

  // Detalle
  selectedTicket = signal<SupportTicket | null>(null);
  adminNotesInput = '';
  savingNotes = signal(false);
  updatingStatus = signal(false);

  TicketStatus = TicketStatus;

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

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadTickets();
  }

  openTicket(ticket: SupportTicket): void {
    this.selectedTicket.set(ticket);
    this.adminNotesInput = ticket.adminNotes || '';
  }

  closeDetail(): void {
    this.selectedTicket.set(null);
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
    if (!confirm(`¿Eliminár el reporte "${ticket.subject}"? Esta acción no se puede deshacer.`)) return;
    this.supportTicketService.deleteTicket(ticket._id).subscribe({
      next: () => {
        this.tickets.update((list) => list.filter((t) => t._id !== ticket._id));
        if (this.selectedTicket()?._id === ticket._id) this.closeDetail();
        this.loadStats();
      },
      error: () => {},
    });
  }

  private patchTicket(updated: SupportTicket): void {
    this.tickets.update((list) =>
      list.map((t) => (t._id === updated._id ? { ...t, ...updated } : t))
    );
    if (this.selectedTicket()?._id === updated._id) {
      this.selectedTicket.set({ ...this.selectedTicket()!, ...updated });
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
