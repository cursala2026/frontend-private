import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { TableColumn, TableConfig, PaginationData } from '../../../shared/models/table.interface';
import { UsersService } from '../../../core/services/users.service';
import { UserRole } from '../../../core/models/user-role.enum';

@Component({
  selector: 'app-vendedor-users',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent],
  templateUrl: './vendedor-users.component.html'
})
export class VendedorUsersComponent implements OnInit {
  users = signal<any[]>([]);
  loading = signal<boolean>(false);
  pagination = signal<PaginationData | undefined>(undefined);
  
  currentPage = 1;
  pageSize = 10;
  sortColumn = 'createdAt';
  sortDirection: 'ASC' | 'DESC' = 'DESC';
  searchTerm = '';

  private _requestToken = 0;

  constructor(
    private usersService: UsersService
  ) {}

  tableConfig: TableConfig = {
    columns: [
      {
        key: 'profilePhotoUrl',
        label: 'Foto',
        type: 'image',
        width: '60px',
        align: 'center',
        formatter: (value: string) => value || 'https://ui-avatars.com/api/?name=User&background=6366f1&color=fff'
      },
      {
        key: 'firstName',
        label: 'Nombre',
        sortable: true,
        type: 'text',
        width: '15%'
      },
      {
        key: 'lastName',
        label: 'Apellido',
        sortable: true,
        type: 'text',
        width: '15%'
      },
      {
        key: 'email',
        label: 'Email',
        type: 'text',
        width: '20%'
      },
      {
        key: 'phone',
        label: 'Teléfono',
        type: 'html',
        width: '15%',
        formatter: (value: string, row: any) => {
          if (!value) return 'Teléfono no disponible';
          try {
            const fullNumber = row.countryCode ? `${row.countryCode}${value}` : value;
            const normalized = String(fullNumber).replace(/\D+/g, '');

            if (normalized.length < 10) {
              return `<span class="text-red-600">Número inválido</span>`;
            }

            const waLink = `https://web.whatsapp.com/send?phone=${normalized}`;
            return `<a href="${waLink}" rel="noopener noreferrer" class="text-green-600 hover:text-green-800 underline">${normalized}</a>`;
          } catch (e) {
            return `<span>${value}</span>`;
          }
        }
      },
      {
        key: 'createdAt',
        label: 'Fecha de Inscripción',
        type: 'date',
        sortable: true,
        width: '15%'
      }
    ],
    sortBy: this.sortColumn,
    sortDirection: this.sortDirection,
    pageSize: this.pageSize,
    searchable: true,
    selectable: false,
    actions: [] // Sin acciones, solo lectura
  };

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    this._requestToken += 1;
    const currentToken = this._requestToken;

    const paramsForBackend: any = {
      page: this.currentPage,
      page_size: this.pageSize,
      sort: this.sortColumn,
      sort_dir: this.sortDirection,
      dir: this.sortDirection,
      search: this.searchTerm || undefined,
      role: UserRole.ALUMNO
    };

    this.usersService.getUsers(paramsForBackend).subscribe({
      next: (response: any) => {
        if (this._requestToken !== currentToken) return;

        const data = response?.data?.data || response?.data || response || [];
        const pagination = response?.data?.pagination || response?.pagination || {
          page: this.currentPage,
          page_size: this.pageSize,
          total: 0,
          totalPages: 0
        };

        const normalizedData = Array.isArray(data) ? data.map((user: any) => {
          let roles = [];
          if (Array.isArray(user.roles)) roles = user.roles.map((r: any) => String(r).toUpperCase());
          else if (user.roles) roles = [String(user.roles).toUpperCase()];
          else roles = ['ALUMNO'];

          const phone = user.phone ? String(user.phone).replace(/\D+/g, '') : '';
          const countryCode = user.countryCode ? String(user.countryCode).replace(/\D+/g, '') : '';
          const fullPhone = countryCode && phone ? `${countryCode}${phone}` : phone || 'Teléfono no disponible';

          return {
            ...user,
            roles,
            phone: fullPhone
          };
        }) : [];

        this.users.set(normalizedData);
        this.pagination.set(pagination);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading users:', error);
        if (this._requestToken === currentToken) {
          this.users.set([]);
          this.pagination.set({ page: this.currentPage, page_size: this.pageSize, total: 0, totalPages: 0 });
          this.loading.set(false);
        }
      }
    });
  }

  onSortChange(event: { column: string; direction: 'ASC' | 'DESC' }): void {
    this.sortColumn = event.column;
    this.sortDirection = event.direction;
    this.currentPage = 1;
    this.loadUsers();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadUsers();
  }

  onSearchChange(searchTerm: string): void {
    this.searchTerm = searchTerm;
    this.currentPage = 1;
    
    setTimeout(() => {
      if (this.searchTerm === searchTerm) {
        this.loadUsers();
      }
    }, 500);
  }
}
