import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../config/environment';

export interface NoEnrollmentUser {
  id: string;
  name: string;
  email: string;
}

export interface CourseStart {
  id: string;
  userId: string;
  courseName: string;
  userName: string;
  email: string;
  startDate: string;
}

export interface recommendCourse {
  name: string;
  img: string;
  description: string;
  duration: number;
  level: string;
}

export interface NoEnrollmentConfig {
  enabled: boolean;
  senderEmail: string;
  ctaUrl: string;
  interestLink: string;
  unsubscribeLink: string;
}

export interface CourseStartConfig {
  enabled: boolean;
  senderEmail: string;
  timeWindow: {
    start: string;
    end: string;
  };
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  constructor(private http: HttpClient) {}
  
  // Configuración de no inscriptos
  getNoEnrollmentConfig() {
    return this.http.get<NoEnrollmentConfig>(`${environment.apiUrl}/notifications/non-enrolled`);
  }

  updateNoEnrollmentConfig(config: NoEnrollmentConfig) {
    return this.http.put(`${environment.apiUrl}/notifications/non-enrolled`, config);
  }

  // Configuración de cursos que empiezan
  getCourseStartConfig() {
    return this.http.get<CourseStartConfig>(`${environment.apiUrl}/notifications/course-start-config`);
  }

  updateCourseStartConfig(config: CourseStartConfig) {
    return this.http.put(`${environment.apiUrl}/notifications/course-start-config`, config);
  }

  // Usuarios sin cursos
  getNoEnrollmentUsers() {
    return this.http.get<NoEnrollmentUser[]>(`${environment.apiUrl}/notifications/no-enrollment`);
  }

  // Cursos recomendados
  getRecommendCourses(){
    return this.http.get<recommendCourse[]>(`${environment.apiUrl}/notifications/recommended-courses`);
  }

  // Cursos que empiezan
  getCourseStart(){
    return this.http.get<CourseStart[]>(`${environment.apiUrl}/notifications/courses-start`);
  }

  // Enviar email de prueba
  sendTestNoEnrollmentEmail(config: any) {
    return this.http.post(`${environment.apiUrl}/notifications/test-no-enrollment`, config);
  }

  sendTestCourseStartEmail(config: any) {
    return this.http.post(`${environment.apiUrl}/notifications/test-course-start`, config);
  }
}
