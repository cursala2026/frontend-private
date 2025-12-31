import { Component, OnInit, signal, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ModalDataTableComponent, ModalConfig } from '../../../shared/components/modal-data-table/modal-data-table.component';
import { TableConfig, PaginationData } from '../../../shared/models/table.interface';
import { CoursesService, Course } from '../../../core/services/courses.service';
import { InfoService } from '../../../core/services/info.service';
import { UsersService } from '../../../core/services/users.service';
import { TeacherAssignmentModalComponent } from './teacher-assignment-modal/teacher-assignment-modal.component';

@Component({
  selector: 'app-courses',
  standalone: true,
  imports: [CommonModule, RouterModule, DataTableComponent, ModalDataTableComponent, TeacherAssignmentModalComponent],
  templateUrl: './courses.component.html'
})
export class CoursesComponent implements OnInit {
  @ViewChild(ModalDataTableComponent) modalComponent!: ModalDataTableComponent;

  private router = inject(Router);

  courses = signal<any[]>([]);
  loading = signal<boolean>(false);
  pagination = signal<PaginationData | undefined>(undefined);

  isModalOpen = signal<boolean>(false);
  isTeacherAssignmentModalOpen = signal<boolean>(false);
  modalConfig!: ModalConfig;
  selectedCourse: any = null;
  selectedCourseForAssignment: any = null;
  teachers = signal<any[]>([]);

  currentPage = 1;
  pageSize = 10;
  sortColumn = 'createdAt';
  sortDirection: 'ASC' | 'DESC' = 'DESC';
  searchTerm = '';

  tableConfig: TableConfig = {
    columns: [
      {
        key: 'imageUrl',
        label: 'Imagen',
        type: 'image',
        width: '100px',
        align: 'center',
        imageShape: 'rectangle',
        formatter: (value: string) => {
          if (!value) return 'https://ui-avatars.com/api/?name=Course&background=6366f1&color=fff';
          // Si ya es una URL completa (de Bunny CDN nuevo), usarla directamente
          if (value.startsWith('http')) return value;
          // Si es solo un filename (legacy), construir la URL completa
          return `https://cursala.b-cdn.net/images/${value}`;
        }
      },
      {
        key: 'name',
        label: 'Nombre',
        sortable: true,
        type: 'text',
        width: '30%'
      },
      {
        key: 'modality',
        label: 'Modalidad',
        type: 'text',
        formatter: (value: string) => value || '-',
        width: '15%'
      },
      {
        key: 'price',
        label: 'Precio',
        type: 'text',
        formatter: (value: number) => value ? `$${value}` : '-',
        width: '10%',
        align: 'right'
      },
      {
        key: 'isPublished',
        label: 'Publicado',
        type: 'switch',
        align: 'center',
        width: '10%',
        switchColor: 'green',
        onChange: (row: any, newValue: boolean) => this.handlePublishToggle(row, newValue)
      },
      {
        key: 'showOnHome',
        label: 'En Home',
        type: 'switch',
        align: 'center',
        width: '10%',
        switchColor: 'purple',
        onChange: (row: any, newValue: boolean) => this.handleShowOnHomeToggle(row, newValue)
      },
      {
        key: 'assignedTeachers',
        label: 'Profesores',
        type: 'text',
        formatter: (value: any, row: any) => {
          // Mostrar los profesores del curso (prioridad: teachersInfo > mainTeacherInfo)
          if (row.teachersInfo && Array.isArray(row.teachersInfo) && row.teachersInfo.length > 0) {
            const firstTeacher = row.teachersInfo[0];
            const firstTeacherName = firstTeacher.firstName && firstTeacher.lastName
              ? `${firstTeacher.firstName} ${firstTeacher.lastName}`
              : firstTeacher.teacherName || firstTeacher.email || 'Sin nombre';
            
            // Si hay más de un profesor, mostrar el primero + cantidad adicional
            if (row.teachersInfo.length > 1) {
              const additionalCount = row.teachersInfo.length - 1;
              return `${firstTeacherName} +${additionalCount}`;
            }
            
            return firstTeacherName;
          }
          // Fallback a mainTeacherInfo para compatibilidad
          if (row.mainTeacherInfo) {
            const mainTeacherName = row.mainTeacherInfo.firstName 
              ? `${row.mainTeacherInfo.firstName} ${row.mainTeacherInfo.lastName || ''}`
              : row.mainTeacherInfo.teacherName || row.mainTeacherInfo.email || 'Sin asignar';
            return mainTeacherName;
          }
          return 'Sin asignar';
        },
        onClick: (row: any) => this.openTeacherAssignmentModal(row),
        width: '20%'
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
        handler: (row) => this.editCourse(row),
        class: 'btn-primary'
      },
      {
        label: 'Eliminar',
        iconSvg: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
        handler: (row) => this.deleteCourse(row),
        class: 'btn-danger',
        requireConfirm: true,
        confirmTitle: 'Eliminar Curso',
        confirmMessage: '¿Estás seguro de que quieres eliminar este curso? Esta acción no se puede deshacer.',
        confirmButtonText: 'Eliminar'
      }
    ]
  };

  constructor(
    private coursesService: CoursesService,
    private infoService: InfoService,
    private usersService: UsersService
  ) {}

  ngOnInit(): void {
    this.loadCourses();
    this.loadTeachers();
  }

  loadTeachers(): void {
    this.usersService.getTeachers().subscribe({
      next: (response: any) => {
        const teachers = Array.isArray(response?.data) ? response.data : [];
        this.teachers.set(teachers);
      },
      error: (error) => {
        console.error('Error loading teachers:', error);
      }
    });
  }

  loadCourses(): void {
    this.loading.set(true);

    const params = {
      page: this.currentPage,
      page_size: this.pageSize,
      sort: this.sortColumn,
      sort_dir: this.sortDirection,
      search: this.searchTerm || undefined
    };

    this.coursesService.getCourses(params).subscribe({
      next: (response: any) => {
        // Handle backend response format
        const data = response?.data || [];

        // Since backend returns all courses, we need to implement client-side pagination
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        const paginatedData = Array.isArray(data) ? data.slice(startIndex, endIndex) : [];

        const pagination = {
          page: this.currentPage,
          page_size: this.pageSize,
          total: Array.isArray(data) ? data.length : 0,
          totalPages: Math.ceil((Array.isArray(data) ? data.length : 0) / this.pageSize)
        };

        this.courses.set(paginatedData);
        this.pagination.set(pagination);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading courses:', error);
        this.courses.set([]);
        this.loading.set(false);
      }
    });
  }

  onSortChange(event: { column: string; direction: 'ASC' | 'DESC' }): void {
    this.sortColumn = event.column;
    this.sortDirection = event.direction;
    this.currentPage = 1;
    this.loadCourses();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadCourses();
  }

  onSearchChange(searchTerm: string): void {
    this.searchTerm = searchTerm;
    this.currentPage = 1;

    // Debounce search
    setTimeout(() => {
      if (this.searchTerm === searchTerm) {
        this.loadCourses();
      }
    }, 500);
  }

  editCourse(course: any): void {
    // Preparar el curso con la URL completa de la imagen para el modal
    let imageFileUrl = null;
    if (course.imageUrl) {
      // Si ya es una URL completa (de Bunny CDN nuevo), usarla directamente
      if (course.imageUrl.startsWith('http')) {
        imageFileUrl = course.imageUrl;
      } else {
        // Si es solo un filename (legacy), construir la URL completa
        imageFileUrl = `https://cursala.b-cdn.net/images/${course.imageUrl}`;
      }
    }

    // Preparar el programa del curso con la URL completa para el modal
    let programFileUrl = null;
    if (course.programUrl) {
      // Si ya es una URL completa (de Bunny CDN nuevo), usarla directamente
      if (course.programUrl.startsWith('http')) {
        programFileUrl = course.programUrl;
      } else {
        // Si es solo un filename (legacy), construir la URL completa
        programFileUrl = `https://cursala.b-cdn.net/course-programs/${course.programUrl}`;
      }
    }

    // Preparar teachers: puede venir como array de IDs o como array de objetos con _id
    let teachersIds: string[] = [];
    if (course.teachers && Array.isArray(course.teachers)) {
      teachersIds = course.teachers.map((t: any) => typeof t === 'string' ? t : (t._id || t.teacherId || t));
    } else if (course.teachersInfo && Array.isArray(course.teachersInfo)) {
      teachersIds = course.teachersInfo.map((t: any) => t._id || t.teacherId || t);
    } else if (course.mainTeacher) {
      // Compatibilidad: si solo hay mainTeacher, usarlo
      teachersIds = [typeof course.mainTeacher === 'string' ? course.mainTeacher : (course.mainTeacher._id || course.mainTeacher)];
    }

    this.selectedCourse = {
      ...course,
      imageFile: imageFileUrl,
      programFile: programFileUrl,
      // Convertir days de array a string para el formulario
      days: course.days && Array.isArray(course.days) ? course.days.join(', ') : course.days,
      teachers: teachersIds
    };
    const isCreate = !course._id;

    this.modalConfig = {
      title: isCreate ? 'Crear Nuevo Curso' : 'Editar Curso',
      mode: isCreate ? 'create' : 'edit',
      size: 'xl',
      fields: [
        // Sección 1: Datos Básicos del Curso
        {
          key: 'imageFile',
          label: 'Imagen del Curso',
          type: 'image',
          required: isCreate,
          placeholder: 'Seleccionar imagen',
          imageShape: 'rectangle',
          aspectRatio: '3:2 (rectangular)',
          section: 'Datos Básicos del Curso'
        },
        {
          key: 'programFile',
          label: 'Programa del Curso (PDF)',
          type: 'file',
          required: false,
          placeholder: 'Formatos soportados: PDF. Tamaño máximo: 50MB',
          accept: '.pdf,application/pdf',
          section: 'Datos Básicos del Curso'
        },
        {
          key: 'name',
          label: 'Nombre del Curso',
          type: 'text',
          required: true,
          placeholder: 'Nombre del curso',
          section: 'Datos Básicos del Curso'
        },
        {
          key: 'description',
          label: 'Descripción Corta',
          type: 'textarea',
          placeholder: 'Descripción breve del curso',
          section: 'Datos Básicos del Curso'
        },
        {
          key: 'longDescription',
          label: 'Descripción Larga',
          type: 'textarea',
          placeholder: 'Descripción detallada del curso',
          section: 'Datos Básicos del Curso'
        },
        // Sección 2: Datos del Cursado
        {
          key: 'modality',
          label: 'Modalidad',
          type: 'select',
          options: [
            { value: 'Presencial', label: 'Presencial' },
            { value: 'Online', label: 'Online' },
            { value: 'Híbrido', label: 'Híbrido' }
          ],
          section: 'Datos del Cursado'
        },
        {
          key: 'days',
          label: 'Días de la Semana',
          type: 'text',
          placeholder: 'Lunes, Miércoles, Viernes',
          section: 'Datos del Cursado'
        },
        {
          key: 'time',
          label: 'Horario (HH:mm)',
          type: 'text',
          placeholder: '18:00',
          section: 'Datos del Cursado'
        },
        {
          key: 'startDate',
          label: 'Fecha de Inicio',
          type: 'date',
          section: 'Datos del Cursado'
        },
        {
          key: 'registrationOpenDate',
          label: 'Fecha de Apertura de Inscripciones',
          type: 'date',
          section: 'Datos del Cursado'
        },
        {
          key: 'numberOfClasses',
          label: 'Número de Clases',
          type: 'number',
          placeholder: '0',
          section: 'Datos del Cursado'
        },
        {
          key: 'duration',
          label: 'Duración (horas)',
          type: 'number',
          placeholder: '0',
          section: 'Datos del Cursado'
        },
        {
          key: 'isPublished',
          label: 'Publicado',
          type: 'checkbox',
          section: 'Datos del Cursado'
        },
        {
          key: 'teachers',
          label: 'Profesores',
          type: 'multiselect',
          required: true,
          options: (() => {
            const teachersList = this.teachers();
            return teachersList.map(teacher => ({
              value: teacher._id,
              label: `${teacher.firstName} ${teacher.lastName || ''}${teacher.email ? ` (${teacher.email})` : ''}`
            }));
          })(),
          minSelections: 1,
          maxSelections: 3,
          placeholder: 'Selecciona entre 1 y 3 profesores',
          section: 'Datos del Cursado'
        },
        // Sección 3: Precio y Financiación (al final como solicitó el usuario)
        {
          key: 'price',
          label: 'Precio',
          type: 'number',
          placeholder: '0',
          section: 'Precio y Financiación'
        },
        {
          key: 'maxInstallments',
          label: 'Máximo de Cuotas',
          type: 'number',
          placeholder: '1',
          section: 'Precio y Financiación'
        },
        {
          key: 'interestFree',
          label: 'Sin Interés',
          type: 'checkbox',
          section: 'Precio y Financiación'
        }
      ]
    };

    this.isModalOpen.set(true);
  }

  viewCourse(course: any): void {
    this.selectedCourse = course;

    this.modalConfig = {
      title: 'Detalles del Curso',
      mode: 'view',
      size: 'xl',
      fields: [
        { key: 'name', label: 'Nombre', type: 'text' },
        { key: 'description', label: 'Descripción', type: 'textarea' },
        { key: 'longDescription', label: 'Descripción Larga', type: 'textarea' },
        { key: 'modality', label: 'Modalidad', type: 'text' },
        { key: 'price', label: 'Precio', type: 'number' },
        { key: 'isPublished', label: 'Publicado', type: 'checkbox' },
        { key: 'createdAt', label: 'Fecha de Creación', type: 'date' }
      ]
    };

    this.isModalOpen.set(true);
  }

  onModalClose(): void {
    this.isModalOpen.set(false);
    this.selectedCourse = null;
  }

  onModalSave(formData: any): void {
    const isCreate = !this.selectedCourse._id;

    // Validar que se haya incluido una imagen al crear
    if (isCreate && !formData.imageFile) {
      this.infoService.showError('Por favor, incluye una imagen para el curso');
      this.modalComponent.isSubmitting.set(false);
      return;
    }

    // Validar campos requeridos
    if (!formData.name || !formData.name.trim()) {
      this.infoService.showError('El nombre del curso es requerido');
      this.modalComponent.isSubmitting.set(false);
      return;
    }

    if (!formData.description || !formData.description.trim()) {
      this.infoService.showError('La descripción del curso es requerida');
      this.modalComponent.isSubmitting.set(false);
      return;
    }

    // Validar profesores
    const teachers = Array.isArray(formData.teachers) ? formData.teachers : [];
    if (teachers.length < 1 || teachers.length > 3) {
      this.infoService.showError('El curso debe tener entre 1 y 3 profesores asignados');
      this.modalComponent.isSubmitting.set(false);
      return;
    }

    // Procesar los datos antes de enviar
    const processedData: any = {
      ...formData,
      // Convertir days de string a array si es necesario
      days: formData.days && typeof formData.days === 'string'
        ? formData.days.split(',').map((d: string) => d.trim()).filter((d: string) => d.length > 0)
        : formData.days,
      // Asegurar que siempre se cree con estado activo
      status: 'ACTIVE',
      // Asegurar que teachers sea un array
      teachers: teachers.filter((t: string) => t && t.trim() !== '')
    };

    // Manejar programFile: incluir solo si es un File, o si es null (para eliminarlo)
    if (formData.programFile instanceof File) {
      processedData.programFile = formData.programFile;
    } else if (formData.programFile === null || formData.programFile === undefined) {
      // Si es null, significa que el usuario quiere eliminar el programa
      // Enviar null o undefined para que el backend lo elimine (depende de cómo esté implementado)
      // Por ahora, no incluimos programFile si es null para mantener el comportamiento actual
      delete processedData.programFile;
    } else {
      // Si es una URL string, no incluir programFile (no hay cambios en el programa)
      delete processedData.programFile;
    }

    // Solo incluir imageFile si es un File (no una URL string)
    if (formData.imageFile instanceof File) {
      processedData.imageFile = formData.imageFile;
    } else {
      // Mantener la imagen si no hay cambios (el backend maneja esto)
      delete processedData.imageFile;
    }

    if (isCreate) {
      this.coursesService.createCourse(processedData).subscribe({
        next: () => {
          this.infoService.showSuccess('Curso creado exitosamente');
          this.loadCourses();
          this.onModalClose();
        },
        error: (error) => {
          console.error('Error creating course:', error);
          const errorMsg = error?.error?.message || 'Error al crear el curso';
          this.infoService.showError(errorMsg);
          this.modalComponent.isSubmitting.set(false);
        }
      });
    } else {
      this.coursesService.updateCourse(this.selectedCourse._id, processedData).subscribe({
        next: () => {
          this.infoService.showSuccess('Curso actualizado exitosamente');
          this.loadCourses();
          this.onModalClose();
        },
        error: (error) => {
          console.error('Error updating course:', error);
          const errorMsg = error?.error?.message || 'Error al actualizar el curso';
          this.infoService.showError(errorMsg);
          this.modalComponent.isSubmitting.set(false);
        }
      });
    }
  }


  togglePublishedStatus(course: any): void {
    const isPublished = course.isPublished;
    if (confirm(`¿Estás seguro de que quieres ${isPublished ? 'despublicar' : 'publicar'} el curso "${course.name}"?`)) {
      this.coursesService.togglePublishedStatus(course._id, !isPublished).subscribe({
        next: () => {
          this.infoService.showSuccess(`Curso ${!isPublished ? 'publicado' : 'despublicado'} exitosamente`);
          this.loadCourses();
        },
        error: (error) => {
          console.error('Error toggling published status:', error);
          const errorMsg = error?.error?.message || 'Error al cambiar el estado de publicación del curso';
          this.infoService.showError(errorMsg);
        }
      });
    }
  }

  handlePublishToggle(course: any, newValue: boolean): void {
    // Actualizar directamente el estado sin confirmación (visual feedback inmediato)
    course.isPublished = newValue;

    this.coursesService.togglePublishedStatus(course._id, newValue).subscribe({
      next: () => {
        // Éxito - el cambio ya está reflejado visualmente
        this.infoService.showSuccess(`Curso ${newValue ? 'publicado' : 'despublicado'} exitosamente`);
      },
      error: (error) => {
        // Revertir el cambio en caso de error
        course.isPublished = !newValue;
        console.error('Error toggling published status:', error);
        const errorMsg = error?.error?.message || 'Error al cambiar el estado de publicación del curso';
        this.infoService.showError(errorMsg);
        this.loadCourses(); // Recargar para asegurar consistencia
      }
    });
  }

  handleShowOnHomeToggle(course: any, newValue: boolean): void {
    // Actualizar directamente el estado sin confirmación (visual feedback inmediato)
    course.showOnHome = newValue;

    this.coursesService.updateShowOnHome(course._id, newValue).subscribe({
      next: () => {
        // Éxito - el cambio ya está reflejado visualmente
        this.infoService.showSuccess(`Curso ${newValue ? 'mostrado en home' : 'ocultado de home'} exitosamente`);
      },
      error: (error) => {
        // Revertir el cambio en caso de error
        course.showOnHome = !newValue;
        console.error('Error toggling show on home status:', error);
        const errorMsg = error?.error?.message || 'Error al cambiar la visibilidad en home del curso';
        this.infoService.showError(errorMsg);
        this.loadCourses(); // Recargar para asegurar consistencia
      }
    });
  }

  deleteCourse(course: any): void {
    this.coursesService.deleteCourse(course._id).subscribe({
      next: () => {
        this.infoService.showSuccess('Curso eliminado exitosamente');
        this.loadCourses();
      },
      error: (error) => {
        console.error('Error deleting course:', error);
        const errorMsg = error?.error?.message || 'Error al eliminar el curso';
        this.infoService.showError(errorMsg);
      }
    });
  }

  openTeacherAssignmentModal(course: any): void {
    this.selectedCourseForAssignment = course;
    this.isTeacherAssignmentModalOpen.set(true);
  }

  onTeacherAssignmentModalClose(): void {
    this.isTeacherAssignmentModalOpen.set(false);
    this.selectedCourseForAssignment = null;
  }

  onTeacherAssignmentRefresh(): void {
    this.loadCourses();
  }
}
