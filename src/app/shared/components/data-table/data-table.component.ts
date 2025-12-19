import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
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

  searchTerm = signal<string>('');
  selectedRows = signal<Set<any>>(new Set());
  currentSort = signal<{ column: string; direction: 'ASC' | 'DESC' } | null>(null);

  // Expose Math for template
  Math = Math;

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
    this.actionClick.emit({ action: action.label, row });
    action.handler(row);
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
      'ADMIN': 'bg-blue-100 text-blue-800',
      'PROFESOR': 'bg-yellow-100 text-yellow-800',
      'ALUMNO': 'bg-green-100 text-green-800',
      'Activo': 'bg-green-100 text-green-800',
      'Inactivo': 'bg-red-100 text-red-800',
      'ACTIVE': 'bg-green-100 text-green-800',
      'INACTIVE': 'bg-red-100 text-red-800'
    };
    return badgeClasses[value] || 'bg-gray-100 text-gray-800';
  }

  getActionClass(actionClass?: string): string {
    const classes: Record<string, string> = {
      'btn-primary': 'text-blue-600 hover:bg-blue-50 border border-blue-200',
      'btn-secondary': 'text-gray-600 hover:bg-gray-50 border border-gray-200',
      'btn-danger': 'text-red-600 hover:bg-red-50 border border-red-200',
      'btn-success': 'text-green-600 hover:bg-green-50 border border-green-200'
    };
    return classes[actionClass || ''] || 'text-gray-600 hover:bg-gray-50 border border-gray-200';
  }
}
