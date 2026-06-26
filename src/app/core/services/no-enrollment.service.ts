import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { NoEnrollmentConfig } from './notifications.service';
import { InfoService } from './info.service';

@Injectable({ providedIn: 'root' })
export class NoEnrollmentStateService {
  private readonly STORAGE_KEY = 'noEnrollmentState';
  private noEnrollmentStateSubject = new BehaviorSubject<NoEnrollmentConfig | null>(null);
  noEnrollmentState$ = this.noEnrollmentStateSubject.asObservable();

  constructor(private infoService: InfoService) {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (raw) {
      this.noEnrollmentStateSubject.next(JSON.parse(raw));
    }
  }

  setNoEnrollmentState(config: NoEnrollmentConfig) {
    this.noEnrollmentStateSubject.next(config);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(config));
    this.infoService.showSuccess('Cambios guardados');
  }

  getNoEnrollmentState(): NoEnrollmentConfig | null {
    return this.noEnrollmentStateSubject.value;
  }

  clearNoEnrollmentState() {
    this.noEnrollmentStateSubject.next(null);
    localStorage.removeItem(this.STORAGE_KEY);
  }
}