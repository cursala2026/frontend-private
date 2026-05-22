import { Component, EventEmitter, Input, Output, ViewEncapsulation, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCalendar, MatCalendarCellClassFunction, MatDatepickerModule } from '@angular/material/datepicker';
import { DateAdapter, MatNativeDateModule } from '@angular/material/core';
import { ModalConfig } from '../../../../shared/components/modal-data-table/modal-data-table.component';
import { BunnyConfigService } from '../../../../core/services/bunny-config.service';
import { CustomDateAdapter } from './custom-date-adapter';


@Component({
  selector: 'app-calendario-modal',
  standalone: true,
  imports: [CommonModule, MatCalendar, MatDatepickerModule, MatNativeDateModule],
  templateUrl: './calendario-modal.component.html',
  styleUrls: ['./calendario-modal.component.scss'],
  encapsulation: ViewEncapsulation.None,
  // Bug 3 fix: usar CustomDateAdapter para abreviaciones correctas (M en vez de X)
  providers: [
    { provide: DateAdapter, useClass: CustomDateAdapter }
  ]
})
export class CalendarioModalComponent {
  @ViewChild(MatCalendar) calendar!: MatCalendar<Date>;

  constructor(public bunnyConfigService: BunnyConfigService) {}
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
      // Forzar que mat-calendar re-aplique dateClass creando una nueva referencia
      this.refreshDateClass();
      
      // Forzar actualización visual del calendario
      if (this.calendar) {
        this.calendar.updateTodaysDate();
      }
    }
  }

  private refreshDateClass(): void {
    this.dateClass = (cellDate: Date, view: string) => {
      if (view === 'month') {
        const normalizedCell = this.normalizeDate(cellDate);
        if (this.occupiedDates.some(o => this.isSameDay(o.date, normalizedCell))) {
          return 'occupied-date';
        }
        if (this.availableDates.some(d => this.isSameDay(d, normalizedCell))) {
          return 'available-date';
        }
      }
      return '';
    };
  }

   private normalizeDate(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private mapAvailableDates(courses: any[]) {
    this.availableDates = [];
    const today = this.normalizeDate(new Date()); // Desde hoy normalizado
    
    // Proyectar fechas disponibles hasta 1 año hacia adelante
    const endOfYear = new Date(today);
    endOfYear.setFullYear(endOfYear.getFullYear() + 1);

    for (let d = new Date(today); d <= endOfYear; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      // Solo Lunes (1) a Viernes (5)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        const isOccupied = this.occupiedDates.some(o => this.isSameDay(o.date, d));
        if (!isOccupied) {
          this.availableDates.push(new Date(d));
        }
      }
    }
  }

  private mapOccupiedDates(courses: any[]) {
    this.occupiedDates = [];
    const dayMap: Record<string, number> = {
      'domingo': 0, 'lunes': 1, 'martes': 2,
      'miércoles': 3, 'miercoles': 3, 'jueves': 4, 'viernes': 5, 'sábado': 6, 'sabado': 6
    };

    courses.forEach((course: any) => {
      if (!course.startDate) return; // Si no tiene fecha de inicio, no podemos ubicarlo en el calendario

      const startRaw = new Date(course.startDate);
      if (isNaN(startRaw.getTime())) return; // Fecha inválida

      // Ajustar a medianoche local (corrige el corrimiento por UTC)
      const start = new Date(
        startRaw.getUTCFullYear(),
        startRaw.getUTCMonth(),
        startRaw.getUTCDate()
      );

      // SIEMPRE garantizamos que la fecha de inicio esté ocupada, sin importar si
      // definieron correctamente los días de la semana o la cantidad de clases.
      this.occupiedDates.push({ date: this.normalizeDate(start), course });

      let daysArray = [];
      if (Array.isArray(course.days)) {
        daysArray = course.days;
      } else if (typeof course.days === 'string') {
        daysArray = course.days.split(',');
      }

      const courseDays = daysArray
        .map((d: any) => String(d).trim().toLowerCase())
        .filter((d: string) => d.length > 0)
        .map((d: string) => dayMap[d])
        .filter((d: number | undefined) => d !== undefined);
      
      // Si no especificaron días válidos, nos conformamos con haber agregado la fecha de inicio
      if (courseDays.length === 0) return;

      // Por defecto asumimos que al menos hay 1 clase (la de inicio ya agregada)
      let targetClasses = parseInt(course.numberOfClasses, 10);
      if (isNaN(targetClasses) || targetClasses <= 0) {
        targetClasses = 1;
      }

      // Prevenir loops infinitos limitando el maximo a 365 clases (1 año)
      targetClasses = Math.min(targetClasses, 365);

      let classesAdded = 1; // Ya agregamos la fecha de inicio
      let d = new Date(start);
      d.setDate(d.getDate() + 1); // Empezar a buscar desde el día siguiente

      while (classesAdded < targetClasses) { 
        if (courseDays.includes(d.getDay())) {
          const normalized = this.normalizeDate(d);
          this.occupiedDates.push({ date: normalized, course });
          classesAdded++;
        }
        d.setDate(d.getDate() + 1);
      }
    });
    console.log('Fechas ocupadas mapeadas:', this.occupiedDates);
  }

  private isSameDay(d1: Date, d2: Date): boolean {
    return d1.getFullYear() === d2.getFullYear() &&
          d1.getMonth() === d2.getMonth() &&
          d1.getDate() === d2.getDate();
  }

  dateClass: MatCalendarCellClassFunction<Date> = (cellDate: Date, view: string) => {
    if (view === 'month') {
      const normalizedCell = this.normalizeDate(cellDate);
      if (this.occupiedDates.some(o => this.isSameDay(o.date, normalizedCell))) {
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
      // Bug 2 fix: normalizar la fecha seleccionada para evitar desfase UTC
      const normalizedSelected = this.normalizeDate(date);
      this.dateSelected.emit(normalizedSelected);

      this.selectedCourses = this.occupiedDates
      .filter(o => this.isSameDay(o.date, normalizedSelected))
      .map(o => o.course);

    console.log('Cursos para la fecha seleccionada:', this.selectedCourses);
    }
  }

  onClose(): void {
    this.close.emit();
  }
}
