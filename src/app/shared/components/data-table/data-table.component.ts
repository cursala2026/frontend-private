import { Component, Input, Output, EventEmitter, signal, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableColumn, TableConfig, TableAction, PaginationData } from '../../models/table.interface';
import { ConfirmModalComponent, ConfirmModalConfig } from '../confirm-modal/confirm-modal.component';
import { Observable } from 'rxjs';
import * as ExcelJS from 'exceljs';

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmModalComponent, DatePipe],
  templateUrl: './data-table.component.html'
})
export class DataTableComponent {
  @Input() data: any[] = [];
  @Input() config!: TableConfig;
  @Input() loading = false;
  @Input() pagination?: PaginationData;
  
  @Output() sortChange = new EventEmitter<{ column: string; direction: 'ASC' | 'DESC' }>();
  @Output() pageChange = new EventEmitter<number>();
  @Output() searchChange = new EventEmitter<string>();
  @Output() actionClick = new EventEmitter<{ action: string; row: any }>();
  @Output() selectionChange = new EventEmitter<any[]>();
  @Output() switchToggle = new EventEmitter<{ row: any; column: TableColumn; newValue: boolean }>();

  // Export configuration (opcional)
  @Input() showExportButtons: boolean = false;
  @Input() isFiltered: boolean = false;
  // Functions provided por el padre para obtener los datos a exportar.
  // Si no se proveen, la tabla exportará los datos actualmente mostrados.
  @Input() exportFilteredFn?: () => Observable<any[]>;
  @Input() exportAllFn?: () => Observable<any[]>;
  @Input() exportFilenamePrefix: string = 'export';
  @Input() exportFields?: string[];
  @Input() exportFieldLabels?: Record<string, string> | undefined;
  @Input() exportContextLabel?: string | undefined;
  // Permitir que el componente padre pase el término de búsqueda actual para sincronizar la caja de búsqueda
  @Input()
  set externalSearchTerm(val: string | undefined) {
    try {
      this.searchTerm.set(val || '');
    } catch (e) {
      // ignore
    }
  }

  searchTerm = signal<string>('');
  selectedRows = signal<Set<any>>(new Set());
  currentSort = signal<{ column: string; direction: 'ASC' | 'DESC' } | null>(null);
  showConfirmModal = signal<boolean>(false);
  pendingAction = signal<{ action: TableAction; row: any } | null>(null);

  confirmConfig = computed<ConfirmModalConfig>(() => {
    return {
      title: this.getConfirmTitle(),
      message: this.getConfirmMessage(),
      confirmText: this.getConfirmButtonText(),
      cancelText: 'Cancelar',
      icon: 'danger'
    } as ConfirmModalConfig;
  });

  // Expose Math for template
  Math = Math;

  constructor(private cdr: ChangeDetectorRef) {}

  // Tooltip hover control (para mostrar solo el tooltip del botón hovered)
  hoveredTooltip = signal<{ row: any; label: string } | null>(null);
  private _tooltipTimeout: any = null;

  handleTooltipEnter(row: any, label: string, delay = 150): void {
    if (this._tooltipTimeout) clearTimeout(this._tooltipTimeout);
    this._tooltipTimeout = setTimeout(() => {
      this.hoveredTooltip.set({ row, label });
    }, delay);
  }

  handleTooltipLeave(delay = 50): void {
    if (this._tooltipTimeout) clearTimeout(this._tooltipTimeout);
    this._tooltipTimeout = setTimeout(() => {
      this.hoveredTooltip.set(null);
    }, delay);
  }

  allSelected = computed(() => {
    if (this.data.length === 0) return false;
    return this.data.every(row => this.selectedRows().has(row));
  });

  someSelected = computed(() => {
    const selected = this.selectedRows();
    return selected.size > 0 && selected.size < this.data.length;
  });

  getPages(): number[] {
    if (!this.pagination) return [];
    const totalPages = this.pagination.totalPages;
    const current = this.pagination.page;
    const delta = 2;
    const range: number[] = [];
    const rangeWithDots: number[] = [];
    let l: number | undefined;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= current - delta && i <= current + delta)) {
        range.push(i);
      }
    }

    for (let i of range) {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push(-1); // -1 represents dots
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    return rangeWithDots;
  }

  onSort(column: TableColumn): void {
    if (!column.sortable) return;
    
    const currentSort = this.currentSort();
    let direction: 'ASC' | 'DESC' = 'ASC';
    
    if (currentSort && currentSort.column === column.key) {
      direction = currentSort.direction === 'ASC' ? 'DESC' : 'ASC';
    }
    
    this.currentSort.set({ column: column.key, direction });
    this.sortChange.emit({ column: column.key, direction });
  }

  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
    this.searchChange.emit(value);
  }

  onPageChange(page: number): void {
    if (!this.pagination) return;
    if (page < 1 || page > this.pagination.totalPages) return;
    this.pageChange.emit(page);
  }

  toggleRow(row: any): void {
    const selected = new Set(this.selectedRows());
    if (selected.has(row)) {
      selected.delete(row);
    } else {
      selected.add(row);
    }
    this.selectedRows.set(selected);
    this.selectionChange.emit(Array.from(selected));
  }

  toggleAll(): void {
    if (this.allSelected()) {
      this.selectedRows.set(new Set());
      this.selectionChange.emit([]);
    } else {
      this.selectedRows.set(new Set(this.data));
      this.selectionChange.emit(this.data);
    }
  }

  handleAction(action: TableAction, row: any): void {
    if (action.condition && !action.condition(row)) return;

    // Si la acción requiere confirmación, mostrar modal
    if (action.requireConfirm) {
      this.pendingAction.set({ action, row });
      this.showConfirmModal.set(true);
      return;
    }

    // Si no requiere confirmación, ejecutar directamente
    this.actionClick.emit({ action: action.label, row });
    action.handler(row);
  }

  confirmAction(): void {
    const pending = this.pendingAction();
    if (pending) {
      this.actionClick.emit({ action: pending.action.label, row: pending.row });
      pending.action.handler(pending.row);
    }
    this.cancelAction();
  }

  cancelAction(): void {
    this.showConfirmModal.set(false);
    this.pendingAction.set(null);
  }

  getCellValue(row: any, column: TableColumn): any {
    const value = row[column.key];
    if (column.formatter) {
      return column.formatter(value, row);
    }
    return value;
  }

  getSortIcon(column: TableColumn): string {
    if (!column.sortable) return '';
    const currentSort = this.currentSort();
    if (!currentSort || currentSort.column !== column.key) {
      return '↕';
    }
    return currentSort.direction === 'ASC' ? '↑' : '↓';
  }

  getBadgeClass(value: string): string {
    const badgeClasses: Record<string, string> = {
      'ADMIN': 'bg-brand-primary/20 text-brand-primary',
      'PROFESOR': 'bg-brand-secondary/30 text-brand-secondary-text',
      'ALUMNO': 'bg-green-100 text-green-800',
      'Activo': 'bg-green-100 text-green-800',
      'Inactivo': 'bg-red-100 text-red-800',
      'ACTIVE': 'bg-green-100 text-green-800',
      'INACTIVE': 'bg-red-100 text-red-800',
      'Sí': 'bg-green-100 text-green-800',
      'No': 'bg-red-100 text-red-800',
      'Presencial': 'bg-brand-primary/20 text-brand-primary ring-1 ring-brand-primary/30',
      'Online': 'bg-brand-secondary/30 text-brand-secondary-text ring-1 ring-brand-secondary/40',
      'Híbrido': 'bg-purple-100 text-purple-800 ring-1 ring-purple-300'
    };
    return badgeClasses[value] || 'bg-gray-100 text-gray-800 ring-1 ring-gray-300';
  }

  getActionClass(actionClass?: string): string {
    // Si se pasa una cadena de clases completa (p. ej. utilidades Tailwind), devolverla directamente
    if (actionClass && (actionClass.includes(' ') || actionClass.startsWith('bg-') || actionClass.includes('text-') || actionClass.includes('border-'))) {
      return actionClass;
    }

    const classes: Record<string, string> = {
      'btn-primary': 'text-brand-primary hover:bg-brand-primary/10 border-1 border-brand-primary/30',
      'btn-secondary': 'text-gray-600 hover:bg-gray-50 border-1 border-gray-200',
      'btn-danger': 'text-red-600 hover:bg-red-50 border-1 border-red-200',
      'btn-success': 'text-green-600 hover:bg-green-50 border-1 border-green-200',
      'btn-info': 'text-blue-600 hover:bg-blue-50 border-1 border-blue-200'
    };
    return classes[actionClass || ''] || 'text-gray-600 hover:bg-gray-50 border border-gray-200';
  }

  handleSwitchToggle(row: any, column: TableColumn, event: Event): void {
    event.stopPropagation();
    const currentValue = row[column.key];
    
    // Determinar el valor booleano basado en el tipo de dato
    let boolValue: boolean;
    if (typeof currentValue === 'string') {
      // Para estados como 'ACTIVE', 'INACTIVE', 'active', 'inactive'
      boolValue = currentValue.toUpperCase() === 'ACTIVE';
    } else {
      boolValue = !!currentValue;
    }
    
    const newValue = !boolValue;

    // Emitir evento para que el componente padre maneje el cambio
    this.switchToggle.emit({ row, column, newValue });

    // Si la columna tiene un onChange handler, ejecutarlo
    if (column.onChange) {
      column.onChange(row, newValue);
    }
  }

  isSwitchActive(row: any, column: TableColumn): boolean {
    const value = row[column.key];
    if (typeof value === 'string') {
      return value.toUpperCase() === 'ACTIVE';
    }
    return !!value;
  }

  getSwitchClasses(row: any, column: TableColumn): string {
    const isActive = this.isSwitchActive(row, column);
    const color = column.switchColor || 'green';
    
    const colorClasses: Record<string, { active: string; focus: string }> = {
      green: { active: 'bg-green-600', focus: 'focus:ring-green-500' },
      blue: { active: 'bg-brand-primary', focus: 'focus:ring-brand-primary' },
      purple: { active: 'bg-purple-600', focus: 'focus:ring-purple-500' },
      indigo: { active: 'bg-indigo-600', focus: 'focus:ring-indigo-500' },
      yellow: { active: 'bg-brand-secondary', focus: 'focus:ring-brand-secondary' },
      red: { active: 'bg-red-600', focus: 'focus:ring-red-500' }
    };

    const colors = colorClasses[color] || colorClasses['green'];
    return isActive ? colors.active + ' ' + colors.focus : 'bg-gray-400' + ' ' + colors.focus;
  }

  getSelectValue(row: any, column: TableColumn): string {
    const value = row[column.key];
    let result = '';

    // Para selects, siempre usar el valor real, NO el formatter
    // El formatter es solo para mostrar texto, no para el binding del select
    
    // Si es un array, tomar el primer elemento
    if (Array.isArray(value)) {
      result = value.length > 0 ? String(value[0]) : '';
    } else if (typeof value === 'string') {
      result = value;
    } else if (value == null) {
      result = '';
    } else {
      result = String(value);
    }

    // Normalizar a mayúsculas para roles y asegurar que coincida con las opciones
    if (column.key === 'roles') {
      result = result.toUpperCase().trim();
      // Asegurar que sea uno de los valores válidos
      if (!result || (result !== 'ADMIN' && result !== 'PROFESOR' && result !== 'ALUMNO')) {
        result = 'ALUMNO'; // Valor por defecto
      }
    }

    return result;
  }

  handleSelectChange(row: any, column: TableColumn, event: Event): void {
    event.stopPropagation();
    const selectElement = event.target as HTMLSelectElement;
    const newValue = selectElement.value;

    // Actualizar el valor en el objeto row inmediatamente para reflejar el cambio visual
    // Siempre usar array para roles para mantener consistencia
    if (column.key === 'roles') {
      row[column.key] = [newValue];
    } else if (Array.isArray(row[column.key])) {
      row[column.key] = [newValue];
    } else {
      row[column.key] = newValue;
    }

    // Forzar detección de cambios para actualizar el select visualmente
    this.cdr.detectChanges();

    // Si la columna tiene un onChange handler, ejecutarlo
    if (column.onChange) {
      column.onChange(row, newValue);
    }
  }

  getSelectClass(value: string): string {
    // Normalizar el valor a mayúsculas para comparar
    const normalizedValue = value ? String(value).toUpperCase() : '';
    
    const selectClasses: Record<string, string> = {
      'ADMIN': 'bg-brand-primary/20 text-brand-primary ring-1 ring-brand-primary/30 focus:ring-brand-primary',
      'PROFESOR': 'bg-brand-secondary/30 text-brand-secondary-text ring-1 ring-brand-secondary/40 focus:ring-brand-secondary',
      'ALUMNO': 'bg-green-100 text-green-800 ring-1 ring-green-600/20 focus:ring-green-500'
    };
    return selectClasses[normalizedValue] || 'bg-gray-100 text-gray-800 ring-1 ring-gray-600/20 focus:ring-gray-500';
  }

  getConfirmTitle(): string {
    const pending = this.pendingAction();
    if (!pending) return 'Confirmar acción';

    const title = pending.action.confirmTitle;
    if (typeof title === 'function') {
      return title(pending.row);
    }
    return title || 'Confirmar acción';
  }

  getConfirmMessage(): string {
    const pending = this.pendingAction();
    if (!pending) return '¿Estás seguro de que quieres realizar esta acción?';

    const message = pending.action.confirmMessage;
    if (typeof message === 'function') {
      return message(pending.row);
    }
    return message || '¿Estás seguro de que quieres realizar esta acción?';
  }

  getConfirmButtonText(): string {
    const pending = this.pendingAction();
    return pending?.action?.confirmButtonText || 'Eliminar';
  }

  // Export helpers
  onExportFiltered(): void {
    const filename = this.buildExportFilename();
    if (this.exportFilteredFn) {
      this.exportFilteredFn().subscribe({
        next: (data: any[]) => this.generateExcelFromData(data, filename),
        error: (err) => console.error('Error exportFilteredFn:', err)
      });
      return;
    }

    // Fallback: exportar los datos actualmente mostrados
    this.generateExcelFromData(this.data, filename);
  }

  onExportAll(): void {
    const filename = this.buildExportFilename();
    if (this.exportAllFn) {
      this.exportAllFn().subscribe({
        next: (data: any[]) => this.generateExcelFromData(data, filename),
        error: (err) => console.error('Error exportAllFn:', err)
      });
      return;
    }

    // Si no hay exportAllFn, intentar exportar la página actual como fallback
    this.generateExcelFromData(this.data, filename);
  }

  // Único handler para el botón de exportación: decide si pedir filtrado o todo
  onExportButtonClick(): void {
    if (this.isFiltered) {
      this.onExportFiltered();
      return;
    }

    // Si no está filtrado, preferir exportAllFn si existe
    if (this.exportAllFn) {
      this.onExportAll();
      return;
    }

    // Fallback: exportar los datos actualmente mostrados
    this.generateExcelFromData(this.data, this.buildExportFilename());
  }

  private buildExportFilename(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`; // YYYYMMDD
    const base = (this.exportFilenamePrefix || 'export').toString().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_\-]/gi, '');
    return `${base}_${datePart}.xlsx`;
  }

  private async generateExcelFromData(items: any[], filename: string): Promise<void> {
    if (!Array.isArray(items) || items.length === 0) {
      console.warn('No hay datos para exportar');
      return;
    }

    // Determinar campos a exportar: usar `exportFields` si se provee, sino las columnas de la tabla
    const fields = Array.isArray(this.exportFields) && this.exportFields.length > 0
      ? this.exportFields
      : (Array.isArray(this.config?.columns) ? this.config.columns.map(c => c.key) : []);

    const defaultLabels: Record<string, string> = {
      firstName: 'Nombre',
      lastName: 'Apellido',
      phone: 'Teléfono',
      email: 'Email',
      courses: 'Curso',
      course: 'Curso',
      username: 'Usuario'
    };

    const headers = fields.map(f => (this.exportFieldLabels && this.exportFieldLabels[f]) || defaultLabels[f] || f);

    const rows = items.map(item => fields.map(field => {
      let val: any = undefined;

      // Extraer valor según campo conocido
      if (field === 'courses' || field === 'course') {
        const c = item.courses || item.course || item.enrolledCourses || item.studentCourses || item.courseIds;
        if (Array.isArray(c)) {
          // intentar obtener título/nombre de cada curso
          const titles = c.map((x: any) => (typeof x === 'string' ? x : (x.title || x.name || x._id || x.id || ''))).filter(Boolean);
          val = titles.join(' | ');
        } else if (c && typeof c === 'object') {
          val = c.title || c.name || c._id || c.id || '';
        } else {
          val = c || '';
        }
      } else {
        val = item[field];
      }

      // Si la columna tiene formatter en config, intentar aplicarlo
      const colDef = Array.isArray(this.config?.columns) ? this.config.columns.find(c => c.key === field) : undefined;
      if (colDef && colDef.formatter) {
        try { val = colDef.formatter(val, item); } catch (e) { /* ignore */ }
      }

      // Para el campo `phone`, limpiar HTML (por ejemplo anchors de WhatsApp) y dejar solo el número
      if (field === 'phone' && typeof val === 'string') {
        // Eliminar etiquetas HTML
        const stripped = val.replace(/<[^>]*>/g, '');
        // Mantener solo dígitos y signo +
        const onlyNumber = stripped.replace(/[^+\d]/g, '');
        val = onlyNumber;
      }

      if (Array.isArray(val)) return val.join(' | ');
      if (val instanceof Date) return val.toISOString();
      return val ?? '';
    }));

    // Use ExcelJS to create a styled workbook (supports fills, fonts, borders, autofilter and freeze)
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Cursala';
      const sheet = workbook.addWorksheet('Sheet1', { properties: { defaultRowHeight: 20 } });

      let currentRow = 1;

      // Always include a title. If parent provided a context label (filters), use it;
      // otherwise fall back to a default list title.
      const titleLabel = this.exportContextLabel && String(this.exportContextLabel).trim().length > 0
        ? String(this.exportContextLabel)
        : 'Lista de usuarios de Cursala';

      const titleRow = sheet.getRow(currentRow);
      titleRow.getCell(1).value = titleLabel;
      titleRow.height = 24;
      titleRow.getCell(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D9CDB' } };
      if (headers.length > 1) sheet.mergeCells(currentRow, 1, currentRow, headers.length);
      currentRow++;

      // Always include generation date below the title
      const genDate = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const dateStr = `Generado: ${genDate.getFullYear()}-${pad(genDate.getMonth() + 1)}-${pad(genDate.getDate())}`;
      const dateRow = sheet.getRow(currentRow);
      dateRow.getCell(1).value = dateStr;
      dateRow.getCell(1).font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF333333' } };
      dateRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      if (headers.length > 1) sheet.mergeCells(currentRow, 1, currentRow, headers.length);
      currentRow++;

      // Header row
      const headerRow = sheet.getRow(currentRow);
      headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F6FEB' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
        };
      });
      headerRow.height = 20;
      currentRow++;

      // Add data rows
      const phoneColIndex = fields.indexOf('phone');
      rows.forEach(r => {
        const row = sheet.getRow(currentRow);
        r.forEach((val: any, idx: number) => {
          const cell = row.getCell(idx + 1);
          // Ensure phone is text
          if (idx === phoneColIndex) {
            cell.value = val != null ? String(val) : '';
          } else {
            cell.value = val;
          }
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
          cell.border = { bottom: { style: 'hair', color: { argb: 'FFEEEEEE' } } } as any;
        });
        row.commit();
        currentRow++;
      });

      // Set column widths (do not set the `header` property to avoid ExcelJS overwriting rows)
      headers.forEach((h, idx) => {
        const col = sheet.getColumn(idx + 1);
        col.width = h.length < 10 ? 18 : Math.min(Math.max(h.length + 8, 12), 40);
      });

      // Autofilter and freeze header
      const headerRowNumber = currentRow - rows.length - 1; // header row was the one before data rows
      try {
        sheet.autoFilter = {
          from: { row: headerRowNumber, column: 1 },
          to: { row: headerRowNumber, column: headers.length }
        } as any;
      } catch (e) { /* ignore */ }

      try {
        sheet.views = [{ state: 'frozen', ySplit: headerRowNumber } as any];
      } catch (e) { /* ignore */ }

      // Write workbook to buffer and trigger download
      const buf = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generando Excel con ExcelJS', err);
      // Fallback: try previous XLSX export if available
    }
  }
 
}
