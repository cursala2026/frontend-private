import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ModalDataTableComponent, ModalConfig, ModalField } from '../../../shared/components/modal-data-table/modal-data-table.component';
import { TableColumn, TableConfig, PaginationData } from '../../../shared/models/table.interface';
import { UsersService, UserListResponse } from '../../../core/services/users.service';
import { InfoService } from '../../../core/services/info.service';
import { UserRole } from '../../../core/models/user-role.enum';

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

  constructor(
    private usersService: UsersService,
    private infoService: InfoService
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
        type: 'select',
        formatter: (value: string[]) => {
          // Obtener el primer rol del array (ya que ahora usamos un solo rol por usuario)
          return Array.isArray(value) && value.length > 0 ? value[0] : 'ALUMNO';
        },
        selectOptions: [
          { value: UserRole.ALUMNO, label: 'Alumno' },
          { value: UserRole.PROFESOR, label: 'Profesor' },
          { value: UserRole.ADMIN, label: 'Administrador' }
        ],
        onChange: (row: any, newValue: string) => this.handleRoleChange(row, newValue),
        align: 'center',
        width: '12%'
      },
      {
        key: 'status',
        label: 'Estado',
        type: 'switch',
        align: 'center',
        width: '10%',
        onChange: (row: any) => this.toggleUserStatus(row)
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
        label: 'Eliminar',
        iconSvg: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
        handler: (row) => this.deleteUser(row),
        class: 'btn-danger',
        condition: (row) => !row.roles?.includes('ADMIN')
      }
    ]
  };

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
        // Solo mostrar uploader de foto en modo edición, no en creación
        ...(!isCreate ? [{
          key: 'profilePhotoUrl',
          label: 'Foto de Perfil',
          type: 'image' as const,
          imageShape: 'circle' as const,
          aspectRatio: '1:1' as const
        }] : []),
        {
          key: 'email',
          label: 'Email',
          type: 'email' as const,
          required: true,
          placeholder: 'correo@ejemplo.com',
          disabled: !isCreate
        },
        {
          key: 'firstName',
          label: 'Nombre',
          type: 'text' as const,
          required: true,
          placeholder: 'Juan'
        },
        {
          key: 'lastName',
          label: 'Apellido',
          type: 'text' as const,
          required: true,
          placeholder: 'Pérez'
        },
        {
          key: 'dni',
          label: 'DNI',
          type: 'text' as const,
          placeholder: '12345678'
        },
        {
          key: 'phone',
          label: 'Teléfono',
          type: 'text' as const,
          placeholder: '+54 9 11 1234-5678'
        },
        {
          key: 'birthDate',
          label: 'Fecha de Nacimiento',
          type: 'date' as const
        },
        {
          key: 'professionalDescription',
          label: 'Descripción Profesional',
          type: 'textarea' as const,
          placeholder: 'Descripción de la experiencia profesional...'
        },
        {
          key: 'password',
          label: isCreate ? 'Contraseña' : 'Nueva Contraseña (dejar vacío para mantener)',
          type: 'password' as const,
          required: isCreate,
          placeholder: '••••••••'
        },
        {
          key: 'roles',
          label: 'Roles',
          type: 'select' as const,
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
      // Preparar datos de usuario filtrando valores vacíos e inválidos
      const userData: any = {};
      
      Object.keys(formData).forEach(key => {
        const value = formData[key];
        // Excluir File objects, objetos vacíos, null, undefined, strings vacíos
        if (value instanceof File || 
            (typeof value === 'object' && value !== null && Object.keys(value).length === 0) ||
            value === null || 
            value === undefined || 
            value === '') {
          return;
        }
        userData[key] = value;
      });
      
      // Convertir roles a array
      if (userData.roles) {
        userData.roles = Array.isArray(userData.roles) ? userData.roles : [userData.roles];
      }
      
      // Generar username a partir del email si no existe
      if (!userData.username && userData.email) {
        userData.username = userData.email.split('@')[0];
      }
      
      this.usersService.createUser(userData).subscribe({
        next: () => {
          this.infoService.showSuccess('Usuario creado exitosamente');
          this.loadUsers();
          this.onModalClose();
        },
        error: (error) => {
          console.error('Error creating user:', error);
          this.infoService.showError(error.error?.message || 'Error al crear el usuario');
          // El modal se encarga de resetear isSubmitting cuando se cierra
        }
      });
    } else {
      // Update user
      const hasProfilePhoto = formData.profilePhotoUrl instanceof File;
      
      if (hasProfilePhoto) {
        // Si hay foto, usar FormData y endpoint updateUserData
        const formDataToSend = new FormData();
        
        Object.keys(formData).forEach(key => {
          const value = formData[key];
          if (value !== null && value !== undefined && value !== '') {
            if (key === 'profilePhotoUrl' && value instanceof File) {
              formDataToSend.append('photo', value);
            } else if (key === 'roles') {
              // Convertir roles a array
              const rolesArray = Array.isArray(value) ? value : [value];
              formDataToSend.append('roles', JSON.stringify(rolesArray));
            } else if (key !== 'password' || value) {
              formDataToSend.append(key, value);
            }
          }
        });
        
        this.usersService.updateUserData(this.selectedUser._id, formDataToSend).subscribe({
          next: () => {
            this.infoService.showSuccess('Usuario actualizado exitosamente');
            this.loadUsers();
            this.onModalClose();
          },
          error: (error) => {
            console.error('Error updating user with photo:', error);
            this.infoService.showError(error.error?.message || 'Error al actualizar el usuario');
          }
        });
      } else {
        // Sin foto, usar endpoint normal
        const updateData: any = {};
        
        Object.keys(formData).forEach(key => {
          const value = formData[key];
          // Excluir archivos File
          if (value instanceof File) {
            return;
          }
          // Incluir el campo si tiene valor
          if (value !== null && value !== undefined && value !== '') {
            updateData[key] = value;
          }
        });
        
        // Eliminar password si está vacío
        if (!updateData.password) {
          delete updateData.password;
        }
        
        // Convertir roles a array si existe
        if (updateData.roles) {
          updateData.roles = Array.isArray(updateData.roles) ? updateData.roles : [updateData.roles];
        }
        
        this.usersService.updateUser(this.selectedUser._id, updateData).subscribe({
          next: () => {
            this.infoService.showSuccess('Usuario actualizado exitosamente');
            this.loadUsers();
            this.onModalClose();
          },
          error: (error) => {
            console.error('Error updating user:', error);
            console.error('Update data sent:', updateData);
            console.error('User ID:', this.selectedUser._id);
            this.infoService.showError(error.error?.message || 'Error al actualizar el usuario');
          }
        });
      }
    }
  }

  toggleUserStatus(user: any): void {
    const isActive = user.status === 'ACTIVE';
    const userName = `${user.firstName} ${user.lastName}`;
    
    this.usersService.toggleUserStatus(user._id).subscribe({
      next: () => {
        this.infoService.showSuccess(`${userName} ${isActive ? 'desactivado' : 'activado'} exitosamente`);
        this.loadUsers();
      },
      error: (error) => {
        console.error('Error toggling user status:', error);
        this.infoService.showError(error.error?.message || 'Error al cambiar el estado del usuario');
      }
    });
  }

  deleteUser(user: any): void {
    if (confirm(`¿Estás seguro de que quieres eliminar a ${user.email}? Esta acción no se puede deshacer.`)) {
      this.usersService.deleteUser(user._id).subscribe({
        next: () => {
          this.infoService.showSuccess('Usuario eliminado exitosamente');
          this.loadUsers();
        },
        error: (error) => {
          console.error('Error deleting user:', error);
          this.infoService.showError(error.error?.message || 'Error al eliminar el usuario');
        }
      });
    }
  }

  handleRoleChange(user: any, newRole: string): void {
    const oldRole = user.roles && user.roles.length > 0 ? user.roles[0] : null;

    // Actualizar visualmente de inmediato con una nueva referencia del array
    const currentUsers = this.users();
    const userIndex = currentUsers.findIndex(u => u._id === user._id);

    if (userIndex !== -1) {
      currentUsers[userIndex] = {
        ...currentUsers[userIndex],
        roles: [newRole]
      };
      // Crear nuevo array para forzar detección de cambios
      this.users.set([...currentUsers]);
    }

    // Enviar actualización al backend
    this.usersService.updateUser(user._id, { roles: [newRole] }).subscribe({
      next: () => {
        this.infoService.showSuccess(`Rol actualizado a ${this.getRoleLabel(newRole)} exitosamente`);
      },
      error: (error) => {
        console.error('Error updating user role:', error);
        this.infoService.showError(error.error?.message || 'Error al actualizar el rol del usuario');

        // Revertir el cambio visual en caso de error
        if (oldRole && userIndex !== -1) {
          currentUsers[userIndex] = {
            ...currentUsers[userIndex],
            roles: [oldRole]
          };
          this.users.set([...currentUsers]);
        } else {
          this.loadUsers();
        }
      }
    });
  }

  getRoleLabel(role: string): string {
    const roleLabels: Record<string, string> = {
      [UserRole.ADMIN]: 'Administrador',
      [UserRole.PROFESOR]: 'Profesor',
      [UserRole.ALUMNO]: 'Alumno'
    };
    return roleLabels[role] || role;
  }
}
