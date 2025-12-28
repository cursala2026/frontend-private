import { Component, OnInit, signal, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ModalDataTableComponent, ModalConfig } from '../../../shared/components/modal-data-table/modal-data-table.component';
import { TableConfig, PaginationData } from '../../../shared/models/table.interface';
import { CoursesService, Course } from '../../../core/services/courses.service';
import { InfoService } from '../../../core/services/info.service';
import { TeacherAssignmentService } from '../../../core/services/teacher-assignment.service';
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
        key: 'status',
        label: 'Estado',
        type: 'switch',
        align: 'center',
        width: '10%',
        switchColor: 'blue',
        onChange: (row: any, newValue: boolean) => this.handleStatusToggle(row, newValue)
      },
      {
        key: 'isPublished',
        label: 'Publicado',
        type: 'switch',
        align: 'center',
        width: '10%',
        onChange: (row: any, newValue: boolean) => this.handlePublishToggle(row, newValue)
      },
      {
        key: 'showOnHome',
        label: 'En Home',
        type: 'switch',
        align: 'center',
        width: '10%',
        onChange: (row: any, newValue: boolean) => this.handleShowOnHomeToggle(row, newValue)
      },
      {
        key: 'assignedTeachers',
        label: 'Profesor Principal',
        type: 'text',
        formatter: (value: any, row: any) => {
          // Mostrar el profesor principal del curso
          if (row.mainTeacherInfo) {
            return row.mainTeacherInfo.firstName 
              ? `${row.mainTeacherInfo.firstName} ${row.mainTeacherInfo.lastName || ''}`
              : row.mainTeacherInfo.teacherName || row.mainTeacherInfo.email || 'Sin asignar';
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
    private teacherAssignmentService: TeacherAssignmentService
  ) {}

  ngOnInit(): void {
    this.loadCourses();
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

    this.selectedCourse = {
      ...course,
      imageFile: imageFileUrl,
      // Convertir days de array a string para el formulario
      days: course.days && Array.isArray(course.days) ? course.days.join(', ') : course.days
    };
    const isCreate = !course._id;

    this.modalConfig = {
      title: isCreate ? 'Crear Nuevo Curso' : 'Editar Curso',
      mode: isCreate ? 'create' : 'edit',
      size: 'xl',
      fields: [
        {
          key: 'imageFile',
          label: 'Imagen del Curso',
          type: 'image',
          required: isCreate,
          placeholder: 'Seleccionar imagen',
          imageShape: 'rectangle',
          aspectRatio: '3:2 (rectangular)'
        },
        {
          key: 'name',
          label: 'Nombre del Curso',
          type: 'text',
          required: true,
          placeholder: 'Nombre del curso'
        },
        {
          key: 'description',
          label: 'Descripción Corta',
          type: 'textarea',
          placeholder: 'Descripción breve del curso'
        },
        {
          key: 'longDescription',
          label: 'Descripción Larga',
          type: 'textarea',
          placeholder: 'Descripción detallada del curso'
        },
        {
          key: 'modality',
          label: 'Modalidad',
          type: 'select',
          options: [
            { value: 'Presencial', label: 'Presencial' },
            { value: 'Online', label: 'Online' },
            { value: 'Híbrido', label: 'Híbrido' }
          ]
        },
        {
          key: 'price',
          label: 'Precio',
          type: 'number',
          placeholder: '0'
        },
        {
          key: 'maxInstallments',
          label: 'Máximo de Cuotas',
          type: 'number',
          placeholder: '1'
        },
        {
          key: 'interestFree',
          label: 'Sin Interés',
          type: 'checkbox'
        },
        {
          key: 'days',
          label: 'Días de la Semana',
          type: 'text',
          placeholder: 'Lunes, Miércoles, Viernes'
        },
        {
          key: 'time',
          label: 'Horario (HH:mm)',
          type: 'text',
          placeholder: '18:00'
        },
        {
          key: 'startDate',
          label: 'Fecha de Inicio',
          type: 'date'
        },
        {
          key: 'registrationOpenDate',
          label: 'Fecha de Apertura de Inscripciones',
          type: 'date'
        },
        {
          key: 'numberOfClasses',
          label: 'Número de Clases',
          type: 'number',
          placeholder: '0'
        },
        {
          key: 'duration',
          label: 'Duración (horas)',
          type: 'number',
          placeholder: '0'
        },
        {
          key: 'isPublished',
          label: 'Publicado',
          type: 'checkbox'
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
        { key: 'status', label: 'Estado', type: 'text' },
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

    // Procesar los datos antes de enviar
    const processedData = {
      ...formData,
      // Convertir days de string a array si es necesario
      days: formData.days && typeof formData.days === 'string'
        ? formData.days.split(',').map((d: string) => d.trim()).filter((d: string) => d.length > 0)
        : formData.days
    };

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

  handleStatusToggle(course: any, newValue: boolean): void {
    // Actualizar directamente el estado sin confirmación (visual feedback inmediato)
    const newStatus = newValue ? 'ACTIVE' : 'INACTIVE';
    const oldStatus = course.status;
    course.status = newStatus;

    this.coursesService.toggleCourseStatus(course._id, newStatus).subscribe({
      next: () => {
        // Éxito - el cambio ya está reflejado visualmente
        this.infoService.showSuccess(`Curso ${newValue ? 'activado' : 'desactivado'} exitosamente`);
      },
      error: (error) => {
        // Revertir el cambio en caso de error
        course.status = oldStatus;
        console.error('Error toggling course status:', error);
        const errorMsg = error?.error?.message || 'Error al cambiar el estado del curso';
        this.infoService.showError(errorMsg);
        this.loadCourses(); // Recargar para asegurar consistencia
      }
    });
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
