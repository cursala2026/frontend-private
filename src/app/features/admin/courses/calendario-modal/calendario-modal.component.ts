import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCalendar, MatCalendarCellClassFunction } from '@angular/material/datepicker';
import { PublicDataService, PublicData } from '../../../../core/services/public-data.service';
import { InfoService } from '../../../../core/services/info.service';
import { ModalConfig } from '../../../../shared/components/modal-data-table/modal-data-table.component';

const MAX_LOGOS = 6;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

@Component({
  selector: 'app-calendario-modal',
  standalone: true,
  imports: [CommonModule, MatCalendar],
  templateUrl: './calendario-modal.component.html',
})
export class CalendarioModalComponent {
  selectedDate : Date | null = null;
  @Input() config!: ModalConfig;
  @Input() courses: any;
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  @Output() dateSelected = new EventEmitter<Date>();

  // Ejemplo de fechas ocupadas/disponibles
  availableDates = [new Date(2026, 3, 10), new Date(2026, 3, 15)];
  occupiedDates = [new Date(2026, 3, 12), new Date(2026, 3, 20)];

  dateClass: MatCalendarCellClassFunction<Date> = (cellDate, view) => {
    if (view === 'month') {
      const date = cellDate.getDate();
      if (this.availableDates.some(d => d.getDate() === date)) {
        return 'bg-yellow-400 rounded-full';
      }
      if (this.occupiedDates.some(d => d.getDate() === date)) {
        return 'bg-red-500 rounded-full text-white';
      }
    }
    return '';
  }

  onDateSelected(date: Date | null) {
    if (date) {
      this.dateSelected.emit(date);
    }
  }

  onClose(): void {
    this.close.emit();
  }
}
