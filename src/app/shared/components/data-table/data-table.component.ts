import { Component, Input, Output, EventEmitter, signal, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableColumn, TableConfig, TableAction, PaginationData } from '../../models/table.interface';

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  searchTerm = signal<string>('');
  selectedRows = signal<Set<any>>(new Set());
  currentSort = signal<{ column: string; direction: 'ASC' | 'DESC' } | null>(null);
  showConfirmModal = signal<boolean>(false);
  pendingAction = signal<{ action: TableAction; row: any } | null>(null);

  // Expose Math for template
  Math = Math;

  constructor(private cdr: ChangeDetectorRef) {}

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
    const classes: Record<string, string> = {
      'btn-primary': 'text-brand-primary hover:bg-brand-primary/10 border border-brand-primary/30',
      'btn-secondary': 'text-gray-600 hover:bg-gray-50 border border-gray-200',
      'btn-danger': 'text-red-600 hover:bg-red-50 border border-red-200',
      'btn-success': 'text-green-600 hover:bg-green-50 border border-green-200'
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
}
