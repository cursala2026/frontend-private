import { Component, EventEmitter, Input, Output, ViewEncapsulation  } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCalendar, MatCalendarCellClassFunction } from '@angular/material/datepicker';
import { ModalConfig } from '../../../../shared/components/modal-data-table/modal-data-table.component';

@Component({
  selector: 'app-calendario-modal',
  standalone: true,
  imports: [CommonModule, MatCalendar],
  templateUrl: './calendario-modal.component.html',
  styleUrls: ['./calendario-modal.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class CalendarioModalComponent {
  selectedDate : Date | null = null;
  @Input() config!: ModalConfig;
  @Input() courses: any[] = [];
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  @Output() dateSelected = new EventEmitter<Date>();
  selectedCourses: any[] = [];
  availableDates: Date[] = [];
  occupiedDates: { date: Date, course: any }[] = [];

  ngOnChanges() {
    if (this.courses && Array.isArray(this.courses)) {
      this.mapOccupiedDates(this.courses);
      this.mapAvailableDates(this.courses);
    }
  }

   private normalizeDate(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private mapAvailableDates(courses: any[]) {
    this.availableDates = [];
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const endOfYear = new Date(today.getFullYear(), 11, 31);

    for (let d = new Date(startOfYear); d <= endOfYear; d.setDate(d.getDate() + 1)) {
      const isOccupied = this.occupiedDates.some(o => this.isSameDay(o.date, d));
      if (!isOccupied) {
        this.availableDates.push(new Date(d));
      }
    }
  }

  private mapOccupiedDates(courses: any[]) {
    this.occupiedDates = [];
    const dayMap: Record<string, number> = {
      'Domingo': 0, 'Lunes': 1, 'Martes': 2,
      'Miércoles': 3, 'Jueves': 4, 'Viernes': 5, 'Sábado': 6
    };

    courses.forEach((course: any) => {
      if (course.startDate && course.days && course.days.length > 0) {
        const startRaw = new Date(course.startDate);
        // Ajustar a medianoche local (corrige el corrimiento por UTC)
        const start = new Date(
          startRaw.getUTCFullYear(),
          startRaw.getUTCMonth(),
          startRaw.getUTCDate()
        );

        const courseDays = course.days
          .filter((d: string) => d.trim().length > 0)
          .map((d: string) => dayMap[d]);
        
        let classesAdded = 0;
        let d = new Date(start);

        while (classesAdded < course.numberOfClasses) { 
          if (courseDays.includes(d.getDay())) {
            const normalized = this.normalizeDate(d);
            this.occupiedDates.push({ date: normalized, course });
            classesAdded++;
          }
          d.setDate(d.getDate() + 1);
        }
      }
    });
    console.log('Fechas ocupadas mapeadas:', this.occupiedDates);
  }

  private isSameDay(d1: Date, d2: Date): boolean {
    return d1.getFullYear() === d2.getFullYear() &&
          d1.getMonth() === d2.getMonth() &&
          d1.getDate() === d2.getDate();
  }

  dateClass: MatCalendarCellClassFunction<Date> = (cellDate, view) => {
    if (view === 'month') {
      const normalizedCell = this.normalizeDate(cellDate);
      if (this.occupiedDates.some(o => this.isSameDay(o.date, normalizedCell))) {
        console.log('Fecha ocupada encontrada para:', normalizedCell);
        return 'occupied-date';
      }
      if (this.availableDates.some(d => this.isSameDay(d, normalizedCell))) {
        return 'available-date';
      }
    }
    return '';
  };

  onDateSelected(date: Date | null) {
    if (date) {
      this.dateSelected.emit(date);

      this.selectedCourses = this.occupiedDates
      .filter(o => this.isSameDay(o.date, date))
      .map(o => o.course);

    console.log('Cursos para la fecha seleccionada:', this.selectedCourses);
    }
  }

  onClose(): void {
    this.close.emit();
  }
}
