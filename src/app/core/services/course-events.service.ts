import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CourseEventsService {
  private reloadSubject = new Subject<string>(); // emits courseId
  private questionnaireResetSubject = new Subject<string>(); // emits questionnaireId when attempts are reset

  emitCourseReload(courseId: string) {
    if (courseId) this.reloadSubject.next(courseId);
  }

  emitQuestionnaireReset(questionnaireId: string) {
    if (questionnaireId) this.questionnaireResetSubject.next(questionnaireId);
  }

  onCourseReload(): Observable<string> {
    return this.reloadSubject.asObservable();
  }

  onQuestionnaireReset(): Observable<string> {
    return this.questionnaireResetSubject.asObservable();
  }
}
