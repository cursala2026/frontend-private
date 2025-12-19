import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ModalDataTableComponent, ModalConfig, ModalField } from '../../../shared/components/modal-data-table/modal-data-table.component';
import { TableColumn, TableConfig, PaginationData } from '../../../shared/models/table.interface';
import { UsersService, UserListResponse } from '../../../core/services/users.service';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, DataTableComponent, ModalDataTableComponent],
  templateUrl: './users.component.html'
})
export class UsersComponent implements OnInit {
  users = signal<any[]>([]);
  loading = signal<boolean>(false);
  pagination = signal<PaginationData | undefined>(undefined);
  
  isModalOpen = signal<boolean>(false);
  modalConfig!: ModalConfig;
  selectedUser: any = null;
  
  currentPage = 1;
  pageSize = 10;
  sortColumn = 'createdAt';
  sortDirection: 'ASC' | 'DESC' = 'DESC';
  searchTerm = '';

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
        key: 'email',
        label: 'Email',
        sortable: true,
        type: 'text',
        width: '22%'
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
        key: 'phone',
        label: 'Teléfono',
        type: 'text',
        formatter: (value: string) => value || '-',
        width: '12%'
      },
      {
        key: 'roles',
        label: 'Roles',
        type: 'badge',
        formatter: (value: string[]) => value?.join(', ') || 'Sin roles',
        align: 'center',
        width: '10%'
      },
      {
        key: 'status',
        label: 'Estado',
        type: 'badge',
        formatter: (value: string) => value === 'ACTIVE' ? 'Activo' : 'Inactivo',
        align: 'center',
        width: '10%'
      }
    ],
    sortBy: this.sortColumn,
    sortDirection: this.sortDirection,
    pageSize: this.pageSize,
    searchable: true,
    selectable: false,
    actions: [
      {
        label: 'Editar',
        iconSvg: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
        handler: (row) => this.editUser(row),
        class: 'btn-primary'
      },
      {
        label: 'Cambiar Estado',
        iconSvg: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
        handler: (row) => this.toggleUserStatus(row),
        class: 'btn-secondary'
      },
      {
        label: 'Eliminar',
        iconSvg: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
        handler: (row) => this.deleteUser(row),
        class: 'btn-danger',
        condition: (row) => !row.roles?.includes('ADMIN')
      }
    ]
  };

  constructor(private usersService: UsersService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    
    const params = {
      page: this.currentPage,
      page_size: this.pageSize,
      sort: this.sortColumn,
      sort_dir: this.sortDirection,
      search: this.searchTerm || undefined
    };

    this.usersService.getUsers(params).subscribe({
      next: (response: any) => {
        // Handle backend response format: { status, message, data: { data, pagination } }
        const data = response?.data?.data || response?.data || [];
        const pagination = response?.data?.pagination || response?.pagination || {
          page: this.currentPage,
          page_size: this.pageSize,
          total: 0,
          totalPages: 0
        };
        
        this.users.set(Array.isArray(data) ? data : []);
        this.pagination.set(pagination);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading users:', error);
        this.users.set([]);
        this.loading.set(false);
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
    
    // Debounce search
    setTimeout(() => {
      if (this.searchTerm === searchTerm) {
        this.loadUsers();
      }
    }, 500);
  }

  editUser(user: any): void {
    this.selectedUser = user;
    const isCreate = !user._id;
    
    this.modalConfig = {
      title: isCreate ? 'Crear Nuevo Usuario' : 'Editar Usuario',
      mode: isCreate ? 'create' : 'edit',
      size: 'xl',
      fields: [
        {
          key: 'profilePhotoUrl',
          label: 'URL Foto de Perfil',
          type: 'text',
          placeholder: 'https://ejemplo.com/foto.jpg'
        },
        {
          key: 'email',
          label: 'Email',
          type: 'email',
          required: true,
          placeholder: 'correo@ejemplo.com',
          disabled: !isCreate
        },
        {
          key: 'firstName',
          label: 'Nombre',
          type: 'text',
          required: true,
          placeholder: 'Juan'
        },
        {
          key: 'lastName',
          label: 'Apellido',
          type: 'text',
          required: true,
          placeholder: 'Pérez'
        },
        {
          key: 'dni',
          label: 'DNI',
          type: 'text',
          placeholder: '12345678'
        },
        {
          key: 'phone',
          label: 'Teléfono',
          type: 'text',
          placeholder: '+54 9 11 1234-5678'
        },
        {
          key: 'birthDate',
          label: 'Fecha de Nacimiento',
          type: 'date'
        },
        {
          key: 'professionalDescription',
          label: 'Descripción Profesional',
          type: 'textarea',
          placeholder: 'Descripción de la experiencia profesional...'
        },
        {
          key: 'password',
          label: isCreate ? 'Contraseña' : 'Nueva Contraseña (dejar vacío para mantener)',
          type: 'password',
          required: isCreate,
          placeholder: '••••••••'
        },
        {
          key: 'roles',
          label: 'Roles',
          type: 'select',
          required: true,
          options: [
            { value: 'ALUMNO', label: 'Alumno' },
            { value: 'PROFESOR', label: 'Profesor' },
            { value: 'ADMIN', label: 'Administrador' }
          ]
        }
      ]
    };
    
    this.isModalOpen.set(true);
  }

  viewUser(user: any): void {
    this.selectedUser = user;
    
    this.modalConfig = {
      title: 'Detalles del Usuario',
      mode: 'view',
      size: 'xl',
      fields: [
        { key: 'profilePhotoUrl', label: 'URL Foto de Perfil', type: 'text' },
        { key: 'email', label: 'Email', type: 'email' },
        { key: 'firstName', label: 'Nombre', type: 'text' },
        { key: 'lastName', label: 'Apellido', type: 'text' },
        { key: 'dni', label: 'DNI', type: 'text' },
        { key: 'phone', label: 'Teléfono', type: 'text' },
        { key: 'birthDate', label: 'Fecha de Nacimiento', type: 'date' },
        { key: 'professionalDescription', label: 'Descripción Profesional', type: 'textarea' },
        { key: 'roles', label: 'Roles', type: 'text' },
        { key: 'status', label: 'Estado', type: 'text' },
        { key: 'createdAt', label: 'Fecha de Registro', type: 'date' },
        { key: 'lastConnection', label: 'Última Conexión', type: 'date' }
      ]
    };
    
    this.isModalOpen.set(true);
  }

  onModalClose(): void {
    this.isModalOpen.set(false);
    this.selectedUser = null;
  }

  onModalSave(formData: any): void {
    const isCreate = !this.selectedUser._id;
    
    if (isCreate) {
      // Convert single role to array
      const userData = {
        ...formData,
        roles: Array.isArray(formData.roles) ? formData.roles : [formData.roles]
      };
      
      this.usersService.createUser(userData).subscribe({
        next: () => {
          this.loadUsers();
          this.onModalClose();
        },
        error: (error) => {
          console.error('Error creating user:', error);
          alert('Error al crear el usuario');
          // El modal se encarga de resetear isSubmitting cuando se cierra
        }
      });
    } else {
      // Update user
      const updateData = { ...formData };
      if (!updateData.password) {
        delete updateData.password;
      }
      if (formData.roles) {
        // Si roles ya es un array, usarlo tal cual, si no, convertirlo a array
        updateData.roles = Array.isArray(formData.roles) ? formData.roles : [formData.roles];
      }
      
      this.usersService.updateUser(this.selectedUser._id, updateData).subscribe({
        next: () => {
          this.loadUsers();
          this.onModalClose();
        },
        error: (error) => {
          console.error('Error updating user:', error);
          alert('Error al actualizar el usuario');
          // El modal se encarga de resetear isSubmitting cuando se cierra
        }
      });
    }
  }

  toggleUserStatus(user: any): void {
    const isActive = user.status === 'ACTIVE';
    if (confirm(`¿Estás seguro de que quieres ${isActive ? 'desactivar' : 'activar'} a ${user.email}?`)) {
      this.usersService.toggleUserStatus(user._id).subscribe({
        next: () => {
          this.loadUsers();
        },
        error: (error) => {
          console.error('Error toggling user status:', error);
          alert('Error al cambiar el estado del usuario');
        }
      });
    }
  }

  deleteUser(user: any): void {
    if (confirm(`¿Estás seguro de que quieres eliminar a ${user.email}? Esta acción no se puede deshacer.`)) {
      this.usersService.deleteUser(user._id).subscribe({
        next: () => {
          this.loadUsers();
        },
        error: (error) => {
          console.error('Error deleting user:', error);
          alert('Error al eliminar el usuario');
        }
      });
    }
  }
}
