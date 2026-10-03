import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../config/environment';

export interface AsyncCourseData {
  title: string;
  modality: string; // ASYNC
  description: string;
  thumbnail?: File;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'REJECTED';
}

@Injectable({
  providedIn: 'root'
})
export class CourseAdminService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/courses`;

  createAsyncCourse(data: AsyncCourseData): Observable<any> {
    const formData = new FormData();
    formData.append('name', data.title);
    formData.append('modality', 'ASYNC');
    formData.append('description', data.description);
    formData.append('status', data.status || 'DRAFT');
    if (data.thumbnail) {
      formData.append('imageFile', data.thumbnail);
    }

    return this.http.post(`${this.apiUrl}/async`, formData);
  }

  updateAsyncCourse(courseId: string, data: Partial<AsyncCourseData>): Observable<any> {
    const formData = new FormData();
    if (data.title) formData.append('name', data.title);
    if (data.description) formData.append('description', data.description);
    if (data.status) formData.append('status', data.status);
    if (data.thumbnail) formData.append('imageFile', data.thumbnail);

    return this.http.patch(`${this.apiUrl}/${courseId}`, formData);
  }

  updateCourseStatus(courseId: string, status: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${courseId}/status`, { status });
  }
}