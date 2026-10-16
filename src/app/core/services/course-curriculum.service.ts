import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';
import { Observable, map, filter } from 'rxjs';
import { environment } from '../config/environment';
import { IAttachment, ILesson, IModule, LessonUpdatePayload, ReorderType } from '../models/curriculum.model';

export type AttachmentUploadEvent =
  | { type: 'progress'; percent: number }
  | { type: 'done'; attachment: IAttachment };

@Injectable({ providedIn: 'root' })
export class CourseCurriculumService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/courses`;

  createModule(courseId: string, data: { title: string; order: number }): Observable<IModule> {
    return this.http.post<IModule>(`${this.apiUrl}/${courseId}/modules`, data);
  }

  updateModule(courseId: string, moduleId: string, data: Partial<Pick<IModule, 'title' | 'order'>>): Observable<IModule> {
    return this.http.put<IModule>(`${this.apiUrl}/${courseId}/modules/${moduleId}`, data);
  }

  deleteModule(courseId: string, moduleId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${courseId}/modules/${moduleId}`);
  }

  createLesson(
    courseId: string,
    moduleId: string,
    data: { title: string; order: number; isFreePreview: boolean }
  ): Observable<ILesson> {
    return this.http.post<ILesson>(`${this.apiUrl}/${courseId}/modules/${moduleId}/lessons`, data);
  }

  updateLesson(courseId: string, moduleId: string, lessonId: string, data: LessonUpdatePayload): Observable<ILesson> {
    return this.http.put<ILesson>(`${this.apiUrl}/${courseId}/modules/${moduleId}/lessons/${lessonId}`, data);
  }

  deleteLesson(courseId: string, moduleId: string, lessonId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${courseId}/modules/${moduleId}/lessons/${lessonId}`);
  }

  reorder(courseId: string, type: ReorderType, orderedIds: string[], moduleId?: string): Observable<unknown> {
    return this.http.put(`${this.apiUrl}/${courseId}/reorder`, { type, orderedIds, moduleId });
  }

  uploadAttachment(courseId: string, lessonId: string, file: File): Observable<AttachmentUploadEvent> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('lessonId', lessonId);
    formData.append('title', file.name);

    return this.http
      .post<{ fileUrl: string; title: string; fileType: string }>(
        `${this.apiUrl}/${courseId}/attachments`,
        formData,
        { reportProgress: true, observe: 'events' }
      )
      .pipe(
        filter((event: HttpEvent<unknown>) =>
          event.type === HttpEventType.UploadProgress || event.type === HttpEventType.Response
        ),
        map((event): AttachmentUploadEvent => {
          if (event.type === HttpEventType.UploadProgress) {
            const total = event.total ?? file.size;
            const percent = total > 0 ? Math.round((event.loaded / total) * 100) : 0;
            return { type: 'progress', percent: Math.min(percent, 99) };
          }
          const body = (event as { body: { fileUrl: string; title: string; fileType: string } }).body;
          return {
            type: 'done',
            attachment: { title: body.title, fileUrl: body.fileUrl, fileType: body.fileType },
          };
        })
      );
  }
}
