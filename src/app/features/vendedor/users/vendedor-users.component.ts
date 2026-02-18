import { Component, OnInit, signal, ChangeDetectorRef, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { StudentCoursesViewModalComponent } from '../../../shared/components/student-courses-view-modal/student-courses-view-modal.component';
import { TableColumn, TableConfig, PaginationData } from '../../../shared/models/table.interface';
import { UsersService } from '../../../core/services/users.service';
import { CoursesService } from '../../../core/services/courses.service';
import { UserRole } from '../../../core/models/user-role.enum';

@Component({
  selector: 'app-vendedor-users',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent, StudentCoursesViewModalComponent],
  templateUrl: './vendedor-users.component.html'
})
export class VendedorUsersComponent implements OnInit {
  private rawUsers = signal<any[]>([]);
  courses = signal<any[]>([]);
  users = computed(() => {
    const raw = this.rawUsers();
    const courses = this.courses();
    // Si no hay cursos cargados aún, no enriquecemos para dejar que el formateador use los campos originales
    if (!courses || courses.length === 0) return raw;
    return this.enrichUsersWithCourses(raw);
  });
  
  loading = signal<boolean>(false);
  pagination = signal<PaginationData | undefined>(undefined);
  
  currentPage = 1;
  pageSize = 10;
  sortColumn = 'createdAt';
  sortDirection: 'ASC' | 'DESC' = 'DESC';
  searchTerm = '';
  
  // Combobox de cursos
  selectedCourse = '';
  courseFilter = '';
  showCourseDropdown = signal<boolean>(false);
  
  selectedRole: string = '';

  // Guardar total de usuarios sin filtros para detectar respuestas inconsistentes del backend
  private _lastUnfilteredTotal: number | null = null;

  // Modal de gestión/ver cursos
  showCoursesModal = signal<boolean>(false);
  selectedStudentForCourses: any = null;

  private _requestToken = 0;

  constructor(
    private usersService: UsersService
    , private coursesService: CoursesService
    , private cdr: ChangeDetectorRef
  ) {}

  private route = inject(ActivatedRoute);

  tableConfig: TableConfig = {
    columns: [
      {
        key: 'profilePhotoUrl',
        label: 'Foto',
        type: 'image',
        width: '50px',
        align: 'center',
        formatter: (value: string) => value || 'https://ui-avatars.com/api/?name=User&background=6366f1&color=fff'
      },
      {
        key: 'firstName',
        label: 'Alumno',
        sortable: true,
        type: 'html',
        width: '35%',
        formatter: (value: any, row: any) => `<div class="font-bold text-gray-900">${row.firstName || ''} ${row.lastName || ''}</div><div class="text-[10px] text-gray-500">${row.email || ''}</div>`
      },
      {
        key: 'phone',
        label: 'WhatsApp',
        type: 'html',
        width: '20%',
        formatter: (value: string, row: any) => {
          if (!value) return '<span class="text-gray-400">Sin teléfono</span>';
          try {
            const phone = String(row.phone || '').replace(/\D+/g, '');
            const countryCode = String(row.countryCode || '').replace(/\D+/g, '');
            const normalized = countryCode && phone ? `${countryCode}${phone}` : phone;

            if (normalized.length < 10) {
              return `<span class="text-red-600 font-medium">${value}</span>`;
            }

            const waLink = `https://web.whatsapp.com/send?phone=${normalized}`;
            return `<a href="${waLink}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-1 text-green-600 hover:text-green-800 font-medium group">
              <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.246 2.248 3.484 5.232 3.484 8.412-.003 6.557-5.338 11.892-11.893 11.892-1.997-.001-3.951-.5-5.688-1.448l-6.309 1.656zm6.29-4.143c1.589.943 3.197 1.441 5.166 1.441 5.476 0 9.931-4.454 9.934-9.93.001-2.652-1.033-5.145-2.911-7.022-1.878-1.877-4.372-2.912-7.025-2.912-5.476 0-9.931 4.455-9.934 9.93-.001 2.011.524 3.974 1.52 5.723l-.973 3.557 3.654-.959zm11.188-7.14c-.097-.161-.358-.258-.75-.454-.392-.197-2.316-1.142-2.676-1.272-.359-.131-.621-.197-.882.197-.261.393-1.012 1.272-1.24 1.534-.229.261-.458.294-.85.097-.392-.196-1.656-.61-3.153-1.945-1.165-1.04-1.951-2.324-2.179-2.717-.229-.393-.023-.605.174-.801.177-.176.393-.458.588-.687.197-.229.263-.393.393-.654.131-.262.065-.491-.033-.687-.098-.196-.882-2.126-1.21-2.912-.319-.764-.641-.66-.882-.672-.229-.012-.491-.012-.752-.012-.262 0-.687.098-1.047.491-.36.393-1.373 1.342-1.373 3.272 0 1.929 1.405 3.793 1.601 4.055.197.262 2.766 4.223 6.699 5.92.936.404 1.666.646 2.235.827.94.298 1.795.256 2.47.155.752-.113 2.316-.948 2.642-1.864.327-.917.327-1.702.229-1.864z"/></svg>
              ${normalized}
            </a>`;
          } catch (e) {
            return `<span>${value}</span>`;
          }
        }
      },
      {
        key: 'enrolledCourses',
        label: 'Cursos',
        type: 'html',
        width: '30%',
        formatter: (value: any[]) => {
          if (!value || value.length === 0) return '<span class="text-gray-400 text-xs italic">Sin cursos</span>';
          return `<div class="flex flex-wrap gap-1 max-h-[60px] overflow-y-auto pr-1">
            ${value.map(c => `<span class="inline-block px-1.5 py-0.5 text-[10px] bg-brand-primary/10 text-brand-primary rounded-md font-medium border border-brand-primary/20" title="${c.name || c.title || ''}">${c.name || c.title || 'Curso'}</span>`).join('')}
          </div>`;
        }
      },
      {
        key: 'createdAt',
        label: 'Miembro desde',
        type: 'date',
        sortable: true,
        width: '10%'
      }
    ],
    sortBy: this.sortColumn,
    sortDirection: this.sortDirection,
    pageSize: this.pageSize,
    searchable: true,
    selectable: false,
    actions: []
  };

  openCoursesModal(row: any): void {
    this.selectedStudentForCourses = row;
    this.showCoursesModal.set(true);
  }

  closeCoursesModal(): void {
    this.showCoursesModal.set(false);
    this.selectedStudentForCourses = null;
  }

  ngOnInit(): void {
    this.loadCourses();

    // Suscribirse a cambios en los parámetros de la URL para filtrar por curso
    this.route.queryParamMap.subscribe(params => {
      const courseId = params.get('courseId');
      const courseName = params.get('courseName');
      if (courseId) {
        this.selectedCourse = courseId;
        this.courseFilter = courseName || '';
        this.currentPage = 1;
        this.loadUsers();
      } else {
        this.loadUsers();
      }
    });

    // Obtener total base sin filtros para comparaciones posteriores
    this.usersService.getUsers({ page: 1, page_size: 1, role: UserRole.ALUMNO }).subscribe((resp: any) => {
      const pagination = resp?.data?.pagination || resp?.pagination;
      this._lastUnfilteredTotal = pagination?.total || 0;
    });
  }

  loadCourses(): void {
    this.courses.set([]);
    // Cargar todos los cursos (incluyendo workshops/no publicados) para el filtro
    this.coursesService.getCourses({ page: 1, page_size: 1000 }).subscribe({
      next: (response: any) => {
        const data = response?.data?.data || response?.data || response || [];
        const coursesList = Array.isArray(data) ? data : [];
        this.courses.set(coursesList);

        // Si ya teníamos un curso seleccionado (ej: por query params) pero sin nombre, buscarlo
        if (this.selectedCourse && this.selectedCourse !== 'NO_COURSE' && !this.courseFilter) {
          const found = coursesList.find(c => (c._id || c.id) === this.selectedCourse);
          if (found) {
            this.courseFilter = found.name || found.title || '';
          }
        }
      },
      error: (error) => {
        console.error('Error loading courses (vendedor):', error);
      }
    });
  }

  loadUsers(): void {
    this.loading.set(true);
    this._requestToken += 1;
    const currentToken = this._requestToken;

    const setUsersIfCurrent = (data: any[], paginationData: any) => {
      if (this._requestToken !== currentToken) return false;
      this.rawUsers.set(data);
      this.pagination.set(paginationData || { page: this.currentPage, page_size: this.pageSize, total: 0, totalPages: 0 });
      return true;
    };

    const courseIdParam = this.selectedCourse ? (this.selectedCourse === 'NO_COURSE' ? 'none' : this.selectedCourse) : undefined;

    const params: any = {
      page: this.currentPage,
      page_size: this.pageSize,
      sort: this.sortColumn,
      sort_dir: this.sortDirection,
      dir: this.sortDirection,
      search: this.searchTerm || undefined,
      role: UserRole.ALUMNO,
      courseId: courseIdParam
    };

    const fetchFiltered = (cid: string | undefined, attempt = 0) => {
      const p = { ...params, courseId: cid };
      
      this.usersService.getUsers(p).subscribe({
        next: (resp: any) => {
          const rawData = resp?.data?.data || resp?.data || resp || [];
          const data = Array.isArray(rawData) ? rawData : [];
          const pagination = resp?.data?.pagination || resp?.pagination || { 
            page: this.currentPage, 
            page_size: this.pageSize, 
            total: 0, 
            totalPages: 0 
          };

          // Fix inconsistent total
          if ((!pagination.total || pagination.total === 0) && data.length > 0) {
            pagination.total = data.length;
            pagination.totalPages = Math.ceil(data.length / this.pageSize);
          }

          // If no filter, update baseline
          if (!cid) {
            this._lastUnfilteredTotal = pagination.total;
          }

          const normalizedData = data.map((user: any) => {
            let roles = [];
            if (Array.isArray(user.roles)) roles = user.roles.map((r: any) => String(r).toUpperCase());
            else if (user.roles) roles = [String(user.roles).toUpperCase()];
            else roles = ['ALUMNO'];

            const phone = user.phone ? String(user.phone).replace(/\D+/g, '') : '';
            const countryCode = user.countryCode ? String(user.countryCode).replace(/\D+/g, '') : '';
            const fullPhone = countryCode && phone ? `${countryCode}${phone}` : phone || 'Teléfono no disponible';

            return { ...user, roles, phone: fullPhone };
          });

          // Trust backend response - no fallback logic needed anymore
          if (setUsersIfCurrent(normalizedData, pagination)) {
            this.loading.set(false);
          }
        },
        error: (err) => {
          console.error('Error in loadUsers:', err);
          if (setUsersIfCurrent([], { page: this.currentPage, page_size: this.pageSize, total: 0, totalPages: 0 })) {
            this.loading.set(false);
          }
        }
      });
    };

    fetchFiltered(courseIdParam);
  }

  private loadUsersLocally(filterMode: string): void {
    const currentToken = this._requestToken;
    this.usersService.getAllUsers().subscribe({
      next: (resp: any) => {
        if (this._requestToken !== currentToken) return;
        
        const allUsers = resp?.data || resp || [];
        const normalizedAll = (Array.isArray(allUsers) ? allUsers : []).map((u: any) => {
          let roles = [];
          if (Array.isArray(u.roles)) roles = u.roles.map((r:any)=>String(r).toUpperCase());
          else if (u.roles) roles = [String(u.roles).toUpperCase()];
          else roles = ['ALUMNO'];
          return { ...u, roles };
        });

        const hasAnyCourse = (u: any) => {
          const courses = u.enrolledCourses || u.studentCourses || u.courses || u.enrollments || u.course || u.courseIds;
          return !!(
            (Array.isArray(courses) && courses.length > 0) ||
            (!Array.isArray(courses) && !!courses)
          );
        };

        let filtered: any[] = [];
        if (filterMode === 'none') {
          filtered = normalizedAll.filter(u => !hasAnyCourse(u));
        } else {
          filtered = normalizedAll.filter(u => {
            // Buscamos si el usuario tiene el curso en su data
            const userCourses = u.enrolledCourses || u.studentCourses || u.courses || u.enrollments || u.course || u.courseIds || [];
            const coursesArray = Array.isArray(userCourses) ? userCourses : [userCourses].filter(Boolean);
            const hasInUserData = coursesArray.some((c: any) => {
              const id = String(c._id || c.id || c);
              return id === filterMode;
            });

            if (hasInUserData) return true;

            // Buscamos si el usuario está en la lista de estudiantes del curso específico
            const targetCourse = this.courses().find(c => String(c._id || c.id) === filterMode);
            if (targetCourse && targetCourse.students) {
              const userId = String(u._id || u.id || '');
              const userEmail = String(u.email || '').toLowerCase();
              
              return targetCourse.students.some((s: any) => {
                const sId = String(typeof s === 'string' ? s : (s.userId?._id || s.userId || s._id || s.user || ''));
                if (sId && userId && sId === userId) return true;
                
                const sEmail = String(s.email || s.userId?.email || '').toLowerCase();
                if (sEmail && userEmail && sEmail === userEmail) return true;
                
                return false;
              });
            }

            return false;
          });
        }

        // Apply pagination locally
        const total = filtered.length;
        const totalPages = Math.ceil(total / this.pageSize);
        const start = (this.currentPage - 1) * this.pageSize;
        const pageData = filtered.slice(start, start + this.pageSize);
        
        this.rawUsers.set(pageData);
        this.pagination.set({ 
          page: this.currentPage, 
          page_size: this.pageSize, 
          total, 
          totalPages 
        });
        this.loading.set(false);
      },
      error: () => {
        if (this._requestToken === currentToken) {
          this.rawUsers.set([]);
          this.loading.set(false);
        }
      }
    });
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
      
      return { ...user, enrolledCourses: finalCourses };
    });
  }

  onCourseFilterChange(course: string): void {
    this.selectedCourse = course;
    this.currentPage = 1;
    if (this.selectedCourse) {
      this.selectedRole = UserRole.ALUMNO;
      setTimeout(() => {
        this.cdr.detectChanges();
        this.loadUsers();
      }, 0);
      return;
    }
    this.loadUsers();
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

  // Métodos para el combobox de cursos
  filteredCourses(): any[] {
    const term = this.courseFilter ? this.courseFilter.toLowerCase().trim() : '';
    const list = this.courses();
    if (!term) return list;
    return list.filter(c => (c.name || c.title || '').toLowerCase().includes(term));
  }

  onCourseInputFocus(): void {
    this.showCourseDropdown.set(true);
  }

  onCourseInputBlur(): void {
    // Pequeño delay para permitir el click en las opciones
    setTimeout(() => {
      this.showCourseDropdown.set(false);
    }, 200);
  }

  clearCourseFilter(): void {
    this.courseFilter = '';
    this.selectedCourse = '';
    this.currentPage = 1;
    this.loadUsers();
  }

  selectCourse(courseId: string, courseName: string): void {
    this.selectedCourse = courseId;
    this.courseFilter = courseName;
    this.showCourseDropdown.set(false);
    this.currentPage = 1;
    this.loadUsers();
  }
}
