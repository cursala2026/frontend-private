import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CourseEventsService {
  private reloadSubject = new Subject<string>(); // emits courseId

  emitCourseReload(courseId: string) {
    if (courseId) this.reloadSubject.next(courseId);
  }

  onCourseReload(): Observable<string> {
    return this.reloadSubject.asObservable();
  }
}
