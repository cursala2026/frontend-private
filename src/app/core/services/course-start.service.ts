import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CourseStartConfig } from './notifications.service';
import { InfoService } from './info.service';

@Injectable({providedIn: 'root'})
export class CourseStartStateService {
  private readonly STORAGE_KEY = 'courseStartState';
  private courseStartStateSubject = new BehaviorSubject<CourseStartConfig | null>(null);
  courseStartState$ = this.courseStartStateSubject.asObservable();

  constructor(private infoService: InfoService) {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (raw) {
      this.courseStartStateSubject.next(JSON.parse(raw));
    }
  }

  setCourseStartState(config: CourseStartConfig) {
    this.courseStartStateSubject.next(config);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(config));
    this.infoService.showSuccess('Cambios guardados');
  }

  getCourseStartState(): CourseStartConfig | null {
    return this.courseStartStateSubject.value;
  }

  clearCourseStartState() {
    this.courseStartStateSubject.next(null);
    localStorage.removeItem(this.STORAGE_KEY);
  }
}