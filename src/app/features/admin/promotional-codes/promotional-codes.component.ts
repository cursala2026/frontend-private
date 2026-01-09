import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ModalDataTableComponent, ModalConfig, ModalField } from '../../../shared/components/modal-data-table/modal-data-table.component';
import { PromotionalCodesService } from '../../../core/services/promotional-codes.service';
import { CoursesService } from '../../../core/services/courses.service';
import { map } from 'rxjs/operators';
import { InfoService } from '../../../core/services/info.service';

@Component({
  selector: 'app-promotional-codes',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent, ModalDataTableComponent],
  templateUrl: './promotional-codes.component.html'
})
export class PromotionalCodesComponent {
  codes = signal<any[]>([]);
  loading = signal<boolean>(false);
  searchTerm = signal<string>('');
  serverError = signal<string | null>(null);

  isModalOpen = signal<boolean>(false);
  modalConfig!: ModalConfig;
  selectedCode: any = null;

  courses = signal<any[]>([]);

  private service = inject(PromotionalCodesService);
  private info = inject(InfoService);
  private coursesService = inject(CoursesService);

  tableConfig = {
    columns: [
      { key: 'code', label: 'Código', type: 'text', sortable: true, width: '12%' },
      { key: 'name', label: 'Nombre', type: 'text', sortable: true },
      {
        key: 'discountType',
        label: 'Tipo',
        type: 'text',
        width: '10%',
        formatter: (val: any) => {
          if (!val) return '';
          if (String(val).toUpperCase() === 'PERCENTAGE') return 'Porcentaje';
          if (String(val).toUpperCase() === 'FIXED') return 'Monto fijo';
          return String(val);
        }
      },
      {
        key: 'discountValue',
        label: 'Descuento',
        type: 'text',
        width: '10%',
        formatter: (val: any, row: any) => {
          const v = Number(val);
          if (row && String(row.discountType).toUpperCase() === 'PERCENTAGE') {
            return isNaN(v) ? '' : `${v}%`;
          }
          // Formatear como moneda en peso chileno sin decimales
          const nf = new Intl.NumberFormat('es-CL');
          return isNaN(v) ? '' : `$${nf.format(v)}`;
        }
      },
      { key: 'isGlobal', label: 'Código Global', type: 'boolean', width: '8%' },
      { key: 'usedCount', label: 'Usos', type: 'text', width: '8%' }
    ],
    searchable: true,
    selectable: false,
    actions: [
      {
        label: 'Editar',
        handler: (row: any) => this.editCode(row),
        class: 'btn-secondary',
        iconSvg: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z'
      },
      {
        label: 'Eliminar',
        handler: (row: any) => this.deleteCode(row),
        class: 'btn-danger',
        iconSvg: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
        requireConfirm: true,
        confirmTitle: (r: any) => `Eliminar código ${r.code}`,
        confirmMessage: (r: any) => `¿Seguro quieres eliminar el código "${r.code}"?`,
        confirmButtonText: 'Eliminar'
      }
    ]
  } as any;

  constructor() {
    this.loadCodes();
    this.loadCourses();
  }

  loadCourses(): void {
    // Intentar cargar un listado amplio de cursos para el combo
    this.coursesService.getCourses({ page: 1, page_size: 1000 }).subscribe({
      next: (res) => {
        const data = res?.data || res || [];
        const arr = Array.isArray(data) ? data : [];
        this.courses.set(arr);

        // Si ya hay un modal abierto con campos, actualizar las opciones del campo courseId
        if (this.modalConfig && this.modalConfig.fields) {
          const field = this.modalConfig.fields.find(f => f.key === 'courseId');
          if (field) {
            field.options = arr.map(c => ({ value: c._id || c.id, label: c.name }));
            // Si existe selectedCode con courseId, setear valor por defecto
            if (this.selectedCode && (this.selectedCode.courseId || this.selectedCode.course)) {
              const val = this.selectedCode.courseId || this.selectedCode.course?._id || this.selectedCode.course;
              field.value = val || '';
            }
          }
        }
      },
      error: () => {
        // No bloquear la creación/edición si falla la carga de cursos
        this.courses.set([]);
      }
    });
  }

  onSearchChange(term: string): void {
    this.searchTerm.set(term || '');
  }

  loadCodes(): void {
    this.loading.set(true);
    this.service.getPromotionalCodes().subscribe({
      next: (res) => {
        const data = res?.data || res || [];
        this.codes.set(Array.isArray(data) ? data : []);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading promotional codes', err);
        this.info.showError('Error al cargar códigos promocionales');
        this.codes.set([]);
        this.loading.set(false);
      }
    });
  }

  openCreate(): void {
    this.selectedCode = null;
    this.modalConfig = this.buildModalConfig(null, true);
    this.serverError.set(null);
    this.isModalOpen.set(true);
  }

  editCode(code: any): void {
    this.selectedCode = code;
    this.modalConfig = this.buildModalConfig(code, false);
    this.serverError.set(null);
    this.isModalOpen.set(true);
  }

  buildModalConfig(code: any, isCreate: boolean): ModalConfig {
    const fields: ModalField[] = [
      { 
        key: 'code', 
        label: 'Código', 
        type: 'text', 
        required: true,
        placeholder: 'DESCUENTO2026',
        disabled: !isCreate,
        value: code?.code || ''
      },
      { 
        key: 'name', 
        label: 'Nombre del Código', 
        type: 'text', 
        required: true,
        placeholder: 'Promoción Verano 2026'
      , value: code?.name || '' },
      { 
        key: 'description', 
        label: 'Descripción', 
        type: 'textarea', 
        rows: 3,
        placeholder: 'Descripción del código promocional...'
      , value: code?.description || '' },
      {
        key: 'courseId',
        label: 'Curso asociado (opcional)',
        type: 'autocomplete-multiselect',
        placeholder: 'Buscar curso por nombre (opcional)',
        // Filtrado en cliente usando la lista cargada en `this.courses`.
        options: (term: string) => {
          const q = String(term || '').trim().toLowerCase();
          const arr = this.courses().filter(c => !q || (c.name || '').toLowerCase().includes(q));
          return arr.map((c: any) => ({ value: c._id || c.id, label: c.name }));
        },
        // Normalizar valor inicial a array de IDs (puede venir como objetos poblados desde el backend)
        value: (() => {
          const raw = code?.courseIds ?? code?.applicableCourses ?? (code?.courseId ? [code.courseId] : (code?.course ? [code.course._id || code.course] : []));
          if (!raw) return [];
          if (!Array.isArray(raw)) return [raw && (raw._id || raw.id) ? (raw._id || raw.id) : raw];
          return raw.map((r: any) => (r && (r._id || r.id) ? (r._id || r.id) : r));
        })()
      },
      { 
        key: 'discountType', 
        label: 'Tipo de Descuento', 
        type: 'select', 
        required: true, 
        options: [
          { value: 'PERCENTAGE', label: 'Porcentaje (%)' },
          { value: 'FIXED', label: 'Monto fijo ($)' }
        ] 
      , value: code?.discountType || 'PERCENTAGE' },
      { 
        key: 'discountValue', 
        label: 'Valor del Descuento', 
        type: 'number', 
        required: true,
        placeholder: 'Ej: 10 (porcentaje) o 5000 (monto fijo)'
      , value: code?.discountValue ?? '' },
      { 
        key: 'maxUses', 
        label: 'Máximo de usos totales (opcional)', 
        type: 'number',
        placeholder: 'Dejar vacío para ilimitado'
      , value: code?.maxUses ?? '' },
      { 
        key: 'maxUsesPerUser', 
        label: 'Máximo de usos por usuario', 
        type: 'number',
        placeholder: '1',
        value: code?.maxUsesPerUser ?? 1
      },
      { 
        key: 'minimumPurchaseAmount', 
        label: 'Monto mínimo de compra (opcional)', 
        type: 'number',
        placeholder: 'Ej: 10000'
      , value: code?.minimumPurchaseAmount ?? '' },
      { 
        key: 'isGlobal', 
        label: 'Código Global (Activo)', 
        type: 'checkbox',
        value: code?.isGlobal !== undefined ? !!code.isGlobal : true
      },
      { 
        key: 'validFrom', 
        label: 'Válido desde (opcional)', 
        type: 'date'
      , value: code?.validFrom ? code.validFrom.split('T')[0] : '' },
      { 
        key: 'validUntil', 
        label: 'Válido hasta (opcional)', 
        type: 'date'
      , value: code?.validUntil ? code.validUntil.split('T')[0] : '' }
    ];

    return {
      title: isCreate ? 'Crear Código Promocional' : `Editar Código ${code?.code}`,
      mode: isCreate ? 'create' : 'edit',
      fields,
      size: 'md'
    } as ModalConfig;
  }

  onModalClose(): void {
    this.isModalOpen.set(false);
    this.selectedCode = null;
  }

  onModalSave(formData: any): void {
    const isCreate = !this.selectedCode;
    
    // Validaciones frontend
    const validationErrors: string[] = [];

    // 1. Código requerido y formato
    if (isCreate) {
      if (!formData.code || formData.code.trim() === '') {
        validationErrors.push('El código es obligatorio');
      } else {
        if (formData.code.trim().length < 3) {
          validationErrors.push('El código debe tener al menos 3 caracteres');
        }
        if (!/^[A-Z0-9_-]+$/i.test(formData.code.trim())) {
          validationErrors.push('El código solo puede contener letras, números, guiones y guiones bajos');
        }
      }
    } else {
      // Edición: si el form incluye el code (p. ej. usuario lo edita manualmente), validar formato
      if (formData.code && formData.code.trim() !== '') {
        if (formData.code.trim().length < 3) {
          validationErrors.push('El código debe tener al menos 3 caracteres');
        }
        if (!/^[A-Z0-9_-]+$/i.test(formData.code.trim())) {
          validationErrors.push('El código solo puede contener letras, números, guiones y guiones bajos');
        }
      }
    }

    // 2. Nombre requerido
    if (!formData.name || formData.name.trim() === '') {
      validationErrors.push('El nombre del código es obligatorio');
    }

    // 3. Tipo de descuento requerido
    if (!formData.discountType) {
      validationErrors.push('El tipo de descuento es obligatorio');
    }

    // 4. Valor del descuento
    const discountValue = Number(formData.discountValue);
    if (!formData.discountValue || isNaN(discountValue) || discountValue <= 0) {
      validationErrors.push('El valor del descuento debe ser mayor a 0');
    } else if (formData.discountType === 'PERCENTAGE' && discountValue > 100) {
      validationErrors.push('El porcentaje de descuento no puede ser mayor a 100');
    }

    // 5. Límites de uso
    if (formData.maxUses !== undefined && formData.maxUses !== '' && formData.maxUses !== null) {
      const maxUses = parseInt(String(formData.maxUses), 10);
      if (isNaN(maxUses) || maxUses < 1) {
        validationErrors.push('El máximo de usos debe ser un número entero positivo');
      }
    }
    if (formData.maxUsesPerUser !== undefined && formData.maxUsesPerUser !== '') {
      const maxUsesPerUser = parseInt(String(formData.maxUsesPerUser), 10);
      if (isNaN(maxUsesPerUser) || maxUsesPerUser < 1) {
        validationErrors.push('El máximo de usos por usuario debe ser un número entero positivo');
      }
    }

    // 6. Validación de fechas
    if (formData.validFrom && formData.validUntil) {
      const start = new Date(formData.validFrom);
      const end = new Date(formData.validUntil);
      if (start > end) {
        validationErrors.push('La fecha de inicio no puede ser posterior a la fecha de término');
      }
    }

    // Si hay errores de validación, mostrarlos y detener
    if (validationErrors.length > 0) {
      const errorMsg = validationErrors.join('. ');
      this.serverError.set(errorMsg);
      this.info.showError(errorMsg);
      return;
    }

    console.log('Modal formData ->', JSON.stringify(formData, null, 2));

    // Normalizar y convertir tipos antes de enviar al backend
    const payload: any = { ...formData };

    // Si el campo 'code' no viene (por ejemplo, está deshabilitado en edición),
    // usar el valor del código seleccionado para evitar la validación "obligatorio".
    if ((!payload.code || payload.code === '') && this.selectedCode) {
      payload.code = this.selectedCode.code || this.selectedCode._id || '';
    }

    // Código en mayúsculas y sin espacios
    if (typeof payload.code === 'string') payload.code = payload.code.trim().toUpperCase();

    // Nombre sin espacios extra
    if (typeof payload.name === 'string') payload.name = payload.name.trim();

    // Convertir campos numéricos
    if (payload.discountValue !== undefined) {
      payload.discountValue = Number(payload.discountValue);
    }
    if (payload.maxUses !== undefined && payload.maxUses !== '' && payload.maxUses !== null) {
      payload.maxUses = parseInt(String(payload.maxUses), 10);
    } else {
      payload.maxUses = null;
    }
    if (payload.maxUsesPerUser !== undefined && payload.maxUsesPerUser !== '') {
      payload.maxUsesPerUser = parseInt(String(payload.maxUsesPerUser), 10);
    } else {
      payload.maxUsesPerUser = 1; // Valor por defecto
    }
    if (payload.minimumPurchaseAmount !== undefined && payload.minimumPurchaseAmount !== '' && payload.minimumPurchaseAmount !== null) {
      payload.minimumPurchaseAmount = Number(payload.minimumPurchaseAmount);
    } else {
      payload.minimumPurchaseAmount = null;
    }

    // Asegurar booleano
    payload.isGlobal = !!payload.isGlobal;

    // Convertir fechas a formato ISO datetime usando UTC para evitar efectos de zona horaria
    if (payload.validFrom) {
      const parts = String(payload.validFrom).split('-').map(p => Number(p));
      if (parts.length === 3) {
        const [y, m, d] = parts;
        const startUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
        payload.validFrom = startUtc.toISOString();
      } else {
        payload.validFrom = new Date(payload.validFrom).toISOString();
      }
    } else {
      payload.validFrom = null;
    }

    if (payload.validUntil) {
      const parts = String(payload.validUntil).split('-').map(p => Number(p));
      if (parts.length === 3) {
        const [y, m, d] = parts;
        const endUtc = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
        payload.validUntil = endUtc.toISOString();
      } else {
        const endDate = new Date(payload.validUntil);
        endDate.setHours(23, 59, 59, 999);
        payload.validUntil = endDate.toISOString();
      }
    } else {
      payload.validUntil = null;
    }

    // Eliminar campos vacíos (strings vacíos)
    Object.keys(payload).forEach(k => {
      if (payload[k] === '' || payload[k] === undefined) {
        delete payload[k];
      }
    });

    // Ajustar campo de cursos: normalizar a `applicableCourses` esperado por el backend
    if (payload.courseId !== undefined) {
      if (Array.isArray(payload.courseId)) {
        payload.applicableCourses = payload.courseId;
      } else if (payload.courseId) {
        payload.applicableCourses = [payload.courseId];
      }
      delete payload.courseId;
    }

    // Si se proporcionó courseIds (nomenclatura previa), mapear a applicableCourses
    if (payload.courseIds !== undefined) {
      payload.applicableCourses = Array.isArray(payload.courseIds) ? payload.courseIds : [payload.courseIds];
      delete payload.courseIds;
    }

    // Si se especificaron cursos aplicables, asegurar isGlobal = false
    if (payload.applicableCourses !== undefined && Array.isArray(payload.applicableCourses) && payload.applicableCourses.length > 0) {
      payload.isGlobal = false;
    }

    // Si el código es global y no hay cursos aplicables, enviar un arreglo vacío para applicableCourses
    if (payload.isGlobal && (!payload.applicableCourses || payload.applicableCourses.length === 0)) {
      payload.applicableCourses = [];
    }

    // Asegurar que siempre enviamos `applicableCourses` (array) para el backend
    if (!Array.isArray(payload.applicableCourses)) {
      payload.applicableCourses = [];
    }

    // payload ready to send
    // payload ready to send
    console.log('PromotionalCode payload ->', JSON.stringify(payload, null, 2));
    if (isCreate) {
      this.service.createPromotionalCode(payload).subscribe({
        next: (res) => {
          this.info.showSuccess('Código creado');
          this.loadCodes();
          this.onModalClose();
        },
        error: (err) => {
          console.error('Error creating code - Full error object:', err);
          console.error('Error creating code - error.error:', err?.error);
          const serverBody = err?.error || err?.message || 'Error al crear código';
          const serverMsg = typeof serverBody === 'string' ? serverBody : (serverBody.message || JSON.stringify(serverBody, null, 2));
          this.serverError.set(serverMsg);
          this.info.showError(serverMsg);
          // Cerrar modal para evitar que quede en estado "guardando"
          this.isModalOpen.set(false);
        }
      });
    } else {
      const id = this.selectedCode._id || this.selectedCode.id;
      this.service.updatePromotionalCode(id, payload).subscribe({
        next: (res) => {
          this.info.showSuccess('Código actualizado');
          this.loadCodes();
          this.onModalClose();
        },
        error: (err) => {
          console.error('Error updating code - Full error object:', err);
          console.error('Error updating code - error.error:', err?.error);
          const serverBody = err?.error || err?.message || 'Error al actualizar código';
          const serverMsg = typeof serverBody === 'string' ? serverBody : (serverBody.message || JSON.stringify(serverBody, null, 2));
          this.serverError.set(serverMsg);
          this.info.showError(serverMsg);
          this.isModalOpen.set(false);
        }
      });
    }
  }

  deleteCode(row: any): void {
    const id = row._id || row.id;
    this.service.deletePromotionalCode(id).subscribe({
      next: () => {
        this.info.showSuccess('Código eliminado');
        this.loadCodes();
      },
      error: (err) => {
        console.error('Error deleting code', err);
        this.info.showError(err.error?.message || 'Error al eliminar código');
      }
    });
  }
}
