import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../config/environment';

export interface ClassProgress {
  classId: string;
  watchTime: number; // Tiempo en segundos donde se quedó
  duration: number; // Duración total del video en segundos
  completed: boolean;
  completedAt?: Date;
  lastWatchedAt: Date;
}

export interface CourseProgress {
  _id?: string;
  userId: string;
  courseId: string;
  classesProgress: ClassProgress[];
  currentClassId?: string;
  overallProgress: number; // 0-100
  startedAt: Date;
  lastAccessedAt: Date;
}

export interface UpdateProgressDto {
  classId: string;
  watchTime?: number;
  duration?: number;
  completed?: boolean;
}

export interface CanAccessResponse {
  canAccess: boolean;
  reason?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CourseProgressService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/courseProgress`;

  /**
   * Obtener todos los progresos del usuario actual
   */
  getAllProgress(): Observable<CourseProgress[]> {
    return this.http.get<CourseProgress[]>(this.apiUrl);
  }

  /**
   * Obtener progreso en un curso específico
   */
  getProgress(courseId: string): Observable<CourseProgress | null> {
    return this.http.get<CourseProgress | null>(`${this.apiUrl}/${courseId}`);
  }

  /**
   * Actualizar el progreso de un video (tiempo de visualización)
   */
  updateProgress(courseId: string, data: UpdateProgressDto): Observable<CourseProgress> {
    return this.http.post<CourseProgress>(`${this.apiUrl}/${courseId}`, data);
  }

  /**
   * Marcar una clase como completada
   */
  markCompleted(courseId: string, classId: string): Observable<CourseProgress> {
    return this.http.post<CourseProgress>(`${this.apiUrl}/${courseId}/complete/${classId}`, {});
  }

  /**
   * Obtener el progreso de una clase específica
   */
  getClassProgress(courseId: string, classId: string): Observable<ClassProgress | null> {
    return this.http.get<ClassProgress | null>(`${this.apiUrl}/${courseId}/class/${classId}`);
  }

  /**
   * Verificar si el usuario puede acceder a una clase
   */
  canAccessClass(courseId: string, classId: string): Observable<CanAccessResponse> {
    return this.http.get<CanAccessResponse>(`${this.apiUrl}/${courseId}/can-access/${classId}`);
  }
}
