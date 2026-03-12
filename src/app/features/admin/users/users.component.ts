import { Component, OnInit, signal, inject, ChangeDetectorRef, computed } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ModalDataTableComponent, ModalConfig, ModalField } from '../../../shared/components/modal-data-table/modal-data-table.component';
import { StudentCoursesModalComponent } from '../../../shared/components/student-courses-modal/student-courses-modal.component';
import { TableColumn, TableConfig, PaginationData } from '../../../shared/models/table.interface';
import { UsersService, UserListResponse } from '../../../core/services/users.service';
import { CoursesService } from '../../../core/services/courses.service';
import { InfoService } from '../../../core/services/info.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserRole } from '../../../core/models/user-role.enum';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent, ModalDataTableComponent, StudentCoursesModalComponent],
  templateUrl: './users.component.html'
})
export class UsersComponent implements OnInit {
  private rawUsers = signal<any[]>([]);
  users = computed(() => {
    const raw = this.rawUsers();
    const courses = this.courses();
    // Si no hay cursos cargados aún, no enriquecemos para dejar que el formateador use los campos originales
    if (!courses || courses.length === 0) return raw;
    return this.enrichUsersWithCourses(raw);
  });
  
  loading = signal<boolean>(false);
  pagination = signal<PaginationData | undefined>(undefined);
  courses = signal<any[]>([]);
  
  isModalOpen = signal<boolean>(false);
  modalConfig!: ModalConfig;
  selectedUser: any = null;
  
  // Modal de gestión de cursos
  showCoursesModal = signal<boolean>(false);
  selectedStudentForCourses: any = null;
  
  currentPage = 1;
  pageSize = 10;
  sortColumn = 'createdAt';
  sortDirection: 'ASC' | 'DESC' = 'DESC';
  searchTerm = '';
  selectedRole: string = '';
  selectedCourse: string = '';
  // Guardar total de usuarios sin filtros para detectar respuestas inconsistentes del backend
  private _lastUnfilteredTotal: number | null = null;
  
  
  // Exponer UserRole para usar en el template
  UserRole = UserRole;

  // Token para evitar sobrescribir resultados con respuestas antiguas
  private _requestToken = 0;

  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  constructor(
    private usersService: UsersService,
    private infoService: InfoService,
    private coursesService: CoursesService,
    private authService: AuthService
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
        key: 'phone',
        label: 'Teléfono',
        type: 'html',
        width: '15%',
        formatter: (value: string, row: any) => {
          if (!value) return 'Teléfono no disponible';
          try {
            // Combinar código de país y número local si están presentes
            const fullNumber = row.countryCode ? `${row.countryCode}${value}` : value;

            // Normalizar número: eliminar todo lo que no sea dígito
            const normalized = String(fullNumber).replace(/\D+/g, '');

            // Validar que el número tenga al menos 10 dígitos
            if (normalized.length < 10) {
              return `<span class="text-red-600">Número inválido</span>`;
            }

            // Generar enlace directo a WhatsApp Web sin abrir nueva pestaña
            const waLink = `https://web.whatsapp.com/send?phone=${normalized}`;

            return `<a href="${waLink}" rel="noopener noreferrer" class="text-green-600 hover:text-green-800 underline">${normalized}</a>`;
          } catch (e) {
            return `<span>${value}</span>`;
          }
        }
      },
      {
        key: 'enrolledCourses',
        label: 'Cursos',
        type: 'html',
        width: '20%',
        formatter: (value: any[]) => {
          if (!value || value.length === 0) return '<span class="text-gray-400 text-xs italic">Sin cursos</span>';
          return `<div class="flex flex-wrap gap-1 max-h-[60px] overflow-y-auto pr-1">
            ${value.map(c => `<span class="inline-block px-1.5 py-0.5 text-[10px] bg-brand-primary/10 text-brand-primary rounded-md font-medium border border-brand-primary/20" title="${c.name || c.title || ''}">${c.name || c.title || 'Curso'}</span>`).join('')}
          </div>`;
        }
      },
      {
        key: 'createdAt',
        label: 'Fecha de Inscripción',
        type: 'date',
        sortable: true,
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
          { value: UserRole.ADMIN, label: 'Administrador' },
          { value: UserRole.VENDEDOR, label: 'Vendedor' }
        ],
        onChange: (row: any, newValue: string) => this.handleRoleChange(row, newValue),
        editable: () => this.authService.hasRole(UserRole.ADMIN),
        align: 'center',
        width: '12%'
      },
      
    ],
    sortBy: this.sortColumn,
    sortDirection: this.sortDirection,
    pageSize: this.pageSize,
    searchable: true,
    selectable: false,
    actions: [
      {
        label: 'Gestionar Cursos',
        iconSvg: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
        handler: (row) => this.openCoursesModal(row),
        class: 'btn-info',
        condition: (row) => {
          const isStudent = row.roles?.includes('ALUMNO') || row.roles?.includes(UserRole.ALUMNO);
          const isAdmin = this.authService.hasRole(UserRole.ADMIN);
          return isStudent && isAdmin;
        }
      },
      {
        label: 'Editar',
        iconSvg: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
        handler: (row) => this.editUser(row),
        class: 'btn-primary',
        condition: () => this.authService.hasRole(UserRole.ADMIN)
      },
      {
        label: 'Eliminar',
        iconSvg: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
        handler: (row) => this.deleteUser(row),
        class: 'btn-danger',
        condition: (row) => {
          const isNotAdmin = !row.roles?.includes('ADMIN');
          const hasAdminRole = this.authService.hasRole(UserRole.ADMIN);
          return isNotAdmin && hasAdminRole;
        }
      }
    ]
  };

  ngOnInit(): void {
    // Leer el parámetro 'role' de la URL si existe
    this.route.queryParamMap.subscribe(params => {
      const roleFromQuery = params.get('role');
      const courseFromQuery = params.get('course');
      if (roleFromQuery) {
        this.selectedRole = roleFromQuery;
      }
        if (courseFromQuery) {
          this.selectedCourse = courseFromQuery;
          if (this.selectedCourse) {
            // Si hay cualquier filtro por curso (incluyendo 'NO_COURSE'), seleccionar rol Alumno
            this.selectedRole = UserRole.ALUMNO;
            // Defer to next tick to ensure bindings update on first render
            setTimeout(() => this.cdr.detectChanges(), 0);
          }
        }
      // Cargar lista de cursos y luego usuarios
      this.loadCourses();
      this.loadUsers();
    });
  }

  loadCourses(): void {
    // Cargar cursos para el filtro (cargar muchos resultados razonables)
    this.courses.set([]);
    const params = { page: 1, page_size: 1000 };
    this.coursesService.getCourses(params).subscribe({
      next: (response: any) => {
        const data = response?.data?.data || response?.data || response || [];
        const coursesList = Array.isArray(data) ? data : [];
        
        this.courses.set(coursesList);
      },
      error: (error) => {
        console.error('Error loading courses for filter:', error);
      }
    });
  }

  loadUsers(): void {
    this.loading.set(true);
    this._requestToken += 1;
    const currentToken = this._requestToken;

    const setUsersIfCurrent = (data: any[], paginationData: any, tag?: string) => {
      if (this._requestToken !== currentToken) {
        return false;
      }
      this.rawUsers.set(Array.isArray(data) ? data : []);
      this.pagination.set(paginationData || { page: this.currentPage, page_size: this.pageSize, total: 0, totalPages: 0 });
      
      return true;
    };

    // Delegar filtrado por curso al backend usando el parámetro `courseId`.
    const courseIdParam = this.selectedCourse ? (this.selectedCourse === 'NO_COURSE' ? 'none' : this.selectedCourse) : undefined;

    const paramsForBackend: any = {
      page: this.currentPage,
      page_size: this.pageSize,
      sort: this.sortColumn,
      sort_dir: this.sortDirection,
      dir: this.sortDirection,
      search: this.searchTerm || undefined,
      role: this.selectedRole || undefined,
      courseId: courseIdParam
    };

    const fetchWithCourseParam = (courseIdValue?: string, attempt = 0) => {
      const p: any = { ...paramsForBackend, courseId: courseIdValue };

      const extractUserId = (s: any): string | null => {
        if (!s && s !== 0) return null;
        if (typeof s === 'string') return s;
        if (typeof s === 'number') return String(s);
        if (s._id) return String(s._id);
        if (s.id) return String(s.id);
        if (s.userId) return String(s.userId);
        if (s.user && typeof s.user === 'string') return s.user;
        if (s.user && (s.user._id || s.user.id)) return String(s.user._id || s.user.id);
        if (s.student && (s.student._id || s.student.id)) return String(s.student._id || s.student.id);
        if (s.student && typeof s.student === 'string') return s.student;
        return null;
      };

      this.usersService.getUsers(p).subscribe({
        next: (response: any) => {
          
          const data = response?.data?.data || response?.data || response || [];
          const pagination = response?.data?.pagination || response?.pagination || response?.pagination || {
            page: this.currentPage,
            page_size: this.pageSize,
            total: 0,
            totalPages: 0
          };

          // Si esta fue la petición sin filtro por curso, guardar total para comparar luego
          if (!courseIdValue) {
            this._lastUnfilteredTotal = pagination?.total || 0;
          }

          

          const normalizedData = Array.isArray(data) ? data.map((user: any) => {
            let roles = [];
            if (Array.isArray(user.roles)) roles = user.roles.map((r: any) => String(r).toUpperCase());
            else if (user.roles) roles = [String(user.roles).toUpperCase()];
            else roles = ['ALUMNO'];

            // Validar y normalizar el número de teléfono y el código de país
            const phone = user.phone ? String(user.phone).replace(/\D+/g, '') : '';
            const countryCode = user.countryCode ? String(user.countryCode).replace(/\D+/g, '') : '';

            // Si falta el código de país, mostrar un mensaje de advertencia
            const fullPhone = countryCode && phone ? `${countryCode}${phone}` : phone || 'Teléfono no disponible';

            return {
              ...user,
              roles,
              phone: fullPhone
            };
          }) : [];

          // Si pedimos 'none' y no vienen resultados, reintentar con 'unassigned' una vez
          if (courseIdValue === 'none' && Array.isArray(normalizedData) && normalizedData.length === 0 && attempt === 0) {
            
            fetchWithCourseParam('unassigned', 1);
            return;
          }

          // Si pedimos 'none' y el backend devolvió el mismo total que sin filtro,
          // interpretamos que el backend no está aplicando el filtro 'none' correctamente.
          if (courseIdValue === 'none' && this._lastUnfilteredTotal !== null && pagination?.total === this._lastUnfilteredTotal) {
            
            // Obtener lista de cursos para construir set de usuarios inscritos
            const courseParams = { page: 1, page_size: 1000 };
            this.coursesService.getCourses(courseParams).subscribe({
              next: (coursesResp: any) => {
                // Obtener todos los usuarios y filtrar localmente usando heurística por usuario
                this.usersService.getAllUsers().subscribe({
                  next: (allResp: any) => {
                    const allUsers = allResp?.data || allResp || [];
                    const normalizedAll = Array.isArray(allUsers) ? allUsers.map((u: any) => {
                      let roles = [];
                      if (Array.isArray(u.roles)) roles = u.roles.map((r:any)=>String(r).toUpperCase());
                      else if (u.roles) roles = [String(u.roles).toUpperCase()];
                      else roles = ['ALUMNO'];
                      return { ...u, roles };
                    }) : [];

                    const hasAnyCourse = (user: any) => {
                      return !!(
                        (Array.isArray(user.courses) && user.courses.length > 0) ||
                        (Array.isArray(user.enrolledCourses) && user.enrolledCourses.length > 0) ||
                        (Array.isArray(user.studentCourses) && user.studentCourses.length > 0) ||
                        (Array.isArray(user.enrollments) && user.enrollments.length > 0) ||
                        (Array.isArray(user.courseIds) && user.courseIds.length > 0) ||
                        (user.course && (Array.isArray(user.course) ? user.course.length > 0 : !!user.course))
                      );
                    };

                    const filtered = normalizedAll.filter((u:any) => !hasAnyCourse(u));
                    const total = filtered.length;
                    const totalPages = Math.max(1, Math.ceil(total / this.pageSize));
                    const start = (this.currentPage - 1) * this.pageSize;
                    const pageData = filtered.slice(start, start + this.pageSize);

                    if (setUsersIfCurrent(pageData, { page: this.currentPage, page_size: this.pageSize, total, totalPages }, `NONE-FALLBACK`)) {
                    }
                    this.loading.set(false);
                  },
                  error: (err) => {
                    console.error('Error loading all users for NONE fallback:', err);
                    this.rawUsers.set([]);
                    this.loading.set(false);
                  }
                });
              },
              error: (err) => {
                console.error('Error loading courses for NONE fallback:', err);
                this.rawUsers.set([]);
                this.loading.set(false);
              }
            });
            return;
          }

          // Si pedimos un curso específico y no vienen resultados, loguear RAW para diagnóstico
          if (courseIdValue && Array.isArray(normalizedData) && normalizedData.length === 0) {
            
            // Intentar fallback cliente: usar cursos en caché si están disponibles, si no pedir curso por id
            if (attempt === 0) {
              
              const cachedCourses = Array.isArray(this.courses()) ? this.courses() : [];
              const courseData = cachedCourses.find((c: any) => (c._id || c.id) === courseIdValue);
              const handleStudents = (students: any[]) => {
                const studentIds = new Set<string>();
                students.forEach((s: any) => {
                  const id = extractUserId(s);
                  if (id) studentIds.add(id.toString());
                });
                this.usersService.getAllUsers().subscribe({
                  next: (allResp: any) => {
                    const allUsers = allResp?.data || allResp || [];
                    const normalizedAll = Array.isArray(allUsers) ? allUsers.map((u: any) => {
                      let roles = [];
                      if (Array.isArray(u.roles)) roles = u.roles.map((r:any)=>String(r).toUpperCase());
                      else if (u.roles) roles = [String(u.roles).toUpperCase()];
                      else roles = ['ALUMNO'];
                      return { ...u, roles };
                    }) : [];

                    const filtered = normalizedAll.filter((u:any) => studentIds.has((u._id||u.id||'').toString()));
                    const total = filtered.length;
                    const totalPages = Math.max(1, Math.ceil(total / this.pageSize));
                    const start = (this.currentPage - 1) * this.pageSize;
                    const pageData = filtered.slice(start, start + this.pageSize);

                    if (setUsersIfCurrent(pageData, { page: this.currentPage, page_size: this.pageSize, total, totalPages }, `FALLBACK-${courseIdValue}`)) {
                    }
                    this.loading.set(false);
                  },
                  error: (err) => {
                    console.error('Error in fallback getAllUsers:', err);
                    this.rawUsers.set([]);
                    this.loading.set(false);
                  }
                });
              };

              if (courseData) {
                const students = Array.isArray(courseData.students) ? courseData.students : (courseData.students || []);
                handleStudents(students);
              } else {
                this.coursesService.getCourseById(courseIdValue).subscribe({
                  next: (courseResp: any) => {
                    const cd = courseResp?.data || courseResp || {};
                    const students = Array.isArray(cd.students) ? cd.students : (cd.students || []);
                    handleStudents(students);
                  },
                  error: (err2) => {
                    console.error('Error loading course for fallback:', err2);
                    this.rawUsers.set([]);
                    this.loading.set(false);
                  }
                });
              }
              return;
            }
          }

          if (setUsersIfCurrent(normalizedData, pagination, `BACKEND${courseIdValue ? '-' + courseIdValue : ''}`)) {
        }
          this.loading.set(false);
        },
        error: (error) => {
          console.error('Error loading users (backend):', error);
          this.rawUsers.set([]);
          this.loading.set(false);
        }
      });
    };

    fetchWithCourseParam(courseIdParam, 0);

    // No additional requests: ya delegamos todo al backend incluyendo `courseId`.
  }

  private enrichUsersWithCourses(users: any[]): any[] {
    const allCourses = this.courses();
    if (!allCourses || allCourses.length === 0) return users;

    return users.map(user => {
      const userId = String(user._id || user.id || '');
      const userEmail = String(user.email || '').toLowerCase();
      
      let userCourses = user.enrolledCourses || user.courses || user.studentCourses || user.enrollments || user.course || user.courseIds || [];
      let coursesArray = Array.isArray(userCourses) ? userCourses : [userCourses].filter(Boolean);
      
      // 1. Intentar encontrar cursos en la lista global buscando al estudiante
      const foundFromStudentsList = allCourses.filter(course => {
        const students = course.students || [];
        return students.some((s: any) => {
          // Comparar por ID
          const sId = String(typeof s === 'string' ? s : (s.userId?._id || s.userId || s._id || s.user || ''));
          if (sId && userId && sId === userId) return true;
          
          // Comparar por Email (si está disponible en la metadata del estudiante)
          const sEmail = String(s.email || s.userId?.email || '').toLowerCase();
          if (sEmail && userEmail && sEmail === userEmail) return true;
          
          return false;
        });
      });

      let finalCourses = coursesArray;

      // 2. Priorizar lo encontrado en el mapeo global de estudiantes
      if (foundFromStudentsList.length > 0) {
        finalCourses = foundFromStudentsList;
      } 
      // 3. Fallback: Si no hay nada o son solo IDs, intentar resolverlos
      else if (coursesArray.length === 0 || typeof coursesArray[0] === 'string') {
        if (coursesArray.length > 0 && typeof coursesArray[0] === 'string') {
          finalCourses = coursesArray.map((id: string) => {
            const found = allCourses.find(c => String(c._id || c.id) === String(id));
            return found || { title: 'Curso ID: ' + id, _id: id };
          });
        }
      }
      // 4. Fallback: Si son objetos pero sin nombre/título, resolver el curso por ID
      else if (coursesArray.length > 0 && typeof coursesArray[0] === 'object' && !coursesArray[0].name && !coursesArray[0].title) {
        finalCourses = coursesArray.map((item: any) => {
          const cId = item.courseId || item.course || item._id || item.id;
          if (cId) {
            const found = allCourses.find(c => String(c._id || c.id) === String(cId));
            return found || item;
          }
          return item;
        });
      }

      return {
        ...user,
        enrolledCourses: finalCourses
      };
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

  onRoleFilterChange(role: string): void {
    this.selectedRole = role;
    this.currentPage = 1;
    this.loadUsers();
  }

  onCourseFilterChange(course: string): void {
    this.selectedCourse = course;
    this.currentPage = 1;
    if (this.selectedCourse) {
      // Aplicar rol Alumno también para 'NO_COURSE'
      this.selectedRole = UserRole.ALUMNO;
      // Defer detection and load to next tick so the role select reflects the change immediately
      setTimeout(() => {
        this.cdr.detectChanges();
        this.loadUsers();
      }, 0);
      return;
    }
    this.loadUsers();
  }

  

  editUser(user: any): void {
    this.selectedUser = user;
    this.buildEditModal(user, !user._id);
  }

  private buildEditModal(user: any, isCreate: boolean): void {
    let fields: ModalField[] = [
      // Sección 1: Información Personal
      ...(!isCreate ? [{
        key: 'profilePhotoUrl',
        label: 'Foto de Perfil',
        type: 'image' as const,
        imageShape: 'circle' as const,
        aspectRatio: '1:1' as const,
        section: 'Información Personal'
      }] : []),
      {
        key: 'firstName',
        label: 'Nombre',
        type: 'text' as const,
        required: true,
        placeholder: 'Juan',
        section: 'Información Personal'
      },
      {
        key: 'lastName',
        label: 'Apellido',
        type: 'text' as const,
        required: true,
        placeholder: 'Pérez',
        section: 'Información Personal'
      },
      {
        key: 'dni',
        label: 'DNI',
        type: 'text' as const,
        placeholder: '12345678',
        section: 'Información Personal'
      },
      {
        key: 'phone',
        label: 'Teléfono',
        type: 'text' as const,
        placeholder: '+54 9 11 1234-5678',
        section: 'Información Personal'
      },
      {
        key: 'birthDate',
        label: 'Fecha de Nacimiento',
        type: 'date' as const,
        section: 'Información Personal'
      },
      // Sección 2: Información de Cuenta
      {
        key: 'email',
        label: 'Email',
        type: 'email' as const,
        required: true,
        placeholder: 'correo@ejemplo.com',
        disabled: !isCreate,
        section: 'Información de Cuenta'
      },
      {
        key: 'username',
        label: 'Nombre de Usuario',
        type: 'text' as const,
        required: true,
        placeholder: 'usuario123',
        section: 'Información de Cuenta'
      },
      {
        key: 'password',
        label: isCreate ? 'Contraseña' : 'Nueva Contraseña (dejar vacío para mantener)',
        type: 'password' as const,
        required: isCreate,
        placeholder: '••••••••',
        section: 'Información de Cuenta'
      },
      {
        key: 'roles',
        label: 'Roles',
        type: 'select' as const,
        required: true,
        options: [
          { value: 'ALUMNO', label: 'Alumno' },
          { value: 'PROFESOR', label: 'Profesor' },
          { value: 'ADMIN', label: 'Administrador' },
          { value: 'VENDEDOR', label: 'Vendedor' }
        ],
        section: 'Información de Cuenta'
      },
      // Sección 3: Información Profesional
      {
        key: 'professionalDescription',
        label: 'Descripción Profesional',
        type: 'textarea' as const,
        maxlength: 500,
        placeholder: 'Descripción de la experiencia profesional...',
        section: 'Información Profesional'
      }
    ];

    // Agregar firma solo para profesores y admins
    if (user.roles?.includes('PROFESOR') || user.roles?.includes('ADMIN')) {
      fields.push({
        key: 'professionalSignatureUrl',
        label: 'Firma Digital',
        type: 'image' as const,
        imageShape: 'rectangle' as const,
        aspectRatio: '3:1' as const,
        section: 'Información Profesional'
      });
    }

    this.modalConfig = {
      title: isCreate ? 'Crear Nuevo Usuario' : 'Editar Usuario',
      mode: isCreate ? 'create' : 'edit',
      size: 'xl',
      fields: fields
    };
    
    this.isModalOpen.set(true);
  }

  viewUser(user: any): void {
    this.selectedUser = user;
    
    let fields: ModalField[] = [
      { key: 'profilePhotoUrl', label: 'URL Foto de Perfil', type: 'text' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'username', label: 'Nombre de Usuario', type: 'text' },
      { key: 'firstName', label: 'Nombre', type: 'text' },
      { key: 'lastName', label: 'Apellido', type: 'text' },
      { key: 'dni', label: 'DNI', type: 'text' },
      { key: 'phone', label: 'Teléfono', type: 'text' },
      { key: 'birthDate', label: 'Fecha de Nacimiento', type: 'date' },
      { key: 'professionalDescription', label: 'Descripción Profesional', type: 'textarea' },
      { key: 'roles', label: 'Roles', type: 'text' },
      { key: 'createdAt', label: 'Fecha de Registro', type: 'date' },
      { key: 'lastConnection', label: 'Última Conexión', type: 'date' }
    ];

    // Agregar firma solo para profesores y admins
    if (user.roles?.includes('PROFESOR') || user.roles?.includes('ADMIN')) {
      fields.push({ key: 'professionalSignatureUrl', label: 'Firma Digital', type: 'image' });
    }

    this.modalConfig = {
      title: 'Detalles del Usuario',
      mode: 'view',
      size: 'xl',
      fields: fields
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
      
      // Asegurar que siempre se cree con estado activo
      userData.status = 'ACTIVE';
      
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
      const hasSignature = formData.professionalSignatureUrl instanceof File;
      
      if (hasProfilePhoto || hasSignature) {
        // Si hay foto o firma, usar FormData y endpoint updateUserData
        const formDataToSend = new FormData();
        
        Object.keys(formData).forEach(key => {
          const value = formData[key];
          if (value !== null && value !== undefined && value !== '') {
            if (key === 'profilePhotoUrl' && value instanceof File) {
              formDataToSend.append('photo', value);
            } else if (key === 'professionalSignatureUrl' && value instanceof File) {
              formDataToSend.append('signatureFile', value);
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
            console.error('Error updating user with photo/signature:', error);
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

    // Obtener el array actual de usuarios
    const currentUsers = this.rawUsers();
    const userIndex = currentUsers.findIndex((u: any) => u._id === user._id);

    // Actualizar visualmente de inmediato - crear nuevo objeto para forzar detección de cambios
    if (userIndex !== -1) {
      // Crear una copia profunda del usuario con el nuevo rol
      const updatedUser = {
        ...currentUsers[userIndex],
        roles: [newRole]
      };
      
      // Actualizar también el objeto original que se pasa como parámetro
      user.roles = [newRole];
      
      // Crear nuevo array con el usuario actualizado
      const newUsers = [...currentUsers];
      newUsers[userIndex] = updatedUser;
      this.rawUsers.set(newUsers);
    }

    // Enviar actualización al backend
    this.usersService.updateUser(user._id, { roles: [newRole] }).subscribe({
      next: (response: any) => {
        this.infoService.showSuccess(`Rol actualizado a ${this.getRoleLabel(newRole)} exitosamente`);
        
        // Actualizar el usuario con la respuesta del backend si está disponible
        if (response?.data && userIndex !== -1) {
          const updatedUsers = [...this.rawUsers()];
          updatedUsers[userIndex] = {
            ...updatedUsers[userIndex],
            ...response.data,
            roles: Array.isArray(response.data.roles) ? response.data.roles : [response.data.roles || newRole]
          };
          this.rawUsers.set(updatedUsers);
        } else {
          // Recargar la lista de usuarios para asegurar que los datos estén sincronizados
          this.loadUsers();
        }
      },
      error: (error) => {
        console.error('Error updating user role:', error);
        this.infoService.showError(error.error?.message || 'Error al actualizar el rol del usuario');

        // Revertir el cambio visual en caso de error
        if (oldRole && userIndex !== -1) {
          const revertedUsers = [...this.rawUsers()];
          revertedUsers[userIndex] = {
            ...revertedUsers[userIndex],
            roles: [oldRole]
          };
          user.roles = [oldRole];
          this.rawUsers.set(revertedUsers);
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

  openCoursesModal(user: any): void {
    this.selectedStudentForCourses = user;
    this.showCoursesModal.set(true);
  }

  closeCoursesModal(): void {
    this.showCoursesModal.set(false);
    this.selectedStudentForCourses = null;
  }

  onCoursesUpdated(): void {
    // Opcional: recargar la lista de usuarios si es necesario
    // this.loadUsers();
  }
  // Proveer funciones reutilizables para export (la generación/descarga se realiza en data-table)
  private buildExportParams(): any {
    const courseIdParam = this.selectedCourse ? (this.selectedCourse === 'NO_COURSE' ? 'none' : this.selectedCourse) : undefined;
    return {
      page: 1,
      page_size: 10000,
      sort: this.sortColumn,
      sort_dir: this.sortDirection,
      dir: this.sortDirection,
      search: this.searchTerm || undefined,
      role: this.selectedRole || undefined,
      courseId: courseIdParam,
      _t: String(Date.now())
    };
  }

  // Función que devuelve un Observable con los usuarios filtrados (para que data-table los solicite)
  getFilteredUsersForExport = (): Observable<any[]> => {
    const params = this.buildExportParams();
    return this.usersService.getUsers(params).pipe(map((resp: any) => {
      const data = resp?.data?.data || resp?.data || resp || [];
      return Array.isArray(data) ? data.map((u: any) => ({ ...u, roles: Array.isArray(u.roles) ? u.roles.map((r:any)=>String(r).toUpperCase()) : (u.roles ? [String(u.roles).toUpperCase()] : ['ALUMNO']) })) : [];
    }));
  }

  // Función que devuelve un Observable con todos los usuarios (para export todo)
  getAllUsersForExport = (): Observable<any[]> => {
    return this.usersService.getAllUsers().pipe(map((resp: any) => {
      const data = resp?.data || resp || [];
      return Array.isArray(data) ? data.map((u: any) => ({ ...u, roles: Array.isArray(u.roles) ? u.roles.map((r:any)=>String(r).toUpperCase()) : (u.roles ? [String(u.roles).toUpperCase()] : ['ALUMNO']) })) : [];
    }));
  }

  // Construir una etiqueta de contexto para la exportación, por ejemplo "Alumnos del curso 'Nombre'"
  getExportContextLabel(): string {
    // Si hay filtro por curso, intentar obtener su nombre
    if (this.selectedCourse) {
      if (this.selectedCourse === 'NO_COURSE') {
        return 'Alumnos sin cursos asignados';
      }
      const cachedCourses = Array.isArray(this.courses()) ? this.courses() : [];
      const course = cachedCourses.find((c: any) => (c._id || c.id) === this.selectedCourse);
      const courseName = course ? (course.title || course.name || course._id || course.id) : this.selectedCourse;
      // Si además se filtró por rol y es alumno, usar 'Alumnos del curso'
      if (this.selectedRole && this.selectedRole.toUpperCase() === 'ALUMNO') {
        return `Alumnos del curso "${courseName}"`;
      }
      return `Usuarios del curso "${courseName}"`;
    }

    // Si hay filtro por rol pero no por curso
    if (this.selectedRole) {
      return `Usuarios con rol: ${this.getRoleLabel(this.selectedRole)}`;
    }

    // Si hay búsqueda, mostrarla
    if (this.searchTerm) {
      return `Resultados de búsqueda: "${this.searchTerm}"`;
    }

    return '';
  }

  // Construir prefijo para el nombre del archivo: rol_filtro (usado por data-table)
  getExportFilenamePrefix(): string {
    const sanitize = (s: string) => String(s || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');

    const rolePart = this.selectedRole ? sanitize(this.selectedRole) : 'todos';

    let filterPart = 'todos';
    if (this.selectedCourse) {
      if (this.selectedCourse === 'NO_COURSE') {
        filterPart = 'sin-curso';
      } else {
        const cachedCourses = Array.isArray(this.courses()) ? this.courses() : [];
        const course = cachedCourses.find((c: any) => (c._id || c.id) === this.selectedCourse);
        filterPart = course ? sanitize(course.title || course.name || course._id || course.id) : sanitize(String(this.selectedCourse));
      }
    } else if (this.searchTerm) {
      filterPart = 'busqueda-' + sanitize(this.searchTerm);
    }

    return `${rolePart}_${filterPart}`;
  }
}
