import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface CourseStart {
  id: number;
  name: string;
  startDate: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private apiUrl = 'https://app.cursala.com.ar';
  constructor(private http: HttpClient) {}

  getConfig(type: string) {
    return this.http.get(`/api/notifications/config/${type}`);
  }

  updateConfig(type: string, config: any) {
    return this.http.put(`/api/notifications/config/${type}`, config);
  }

  sendTestEmail(config: any) {
    return this.http.post('/api/notifications/test', config);
  }

  getNoEnrollmentUsers() {
    return this.http.get<User[]>('/api/notifications/no-enrollment');
  }

  getCourseStart(): Observable<CourseStart[]> {
    return this.http.get<CourseStart[]>(`${this.apiUrl}/courses-start`);
  }
}
