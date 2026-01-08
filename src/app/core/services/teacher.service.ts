import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, forkJoin } from 'rxjs';
import { environment } from '../config/environment';
import { UsersService } from './users.service';

@Injectable({
  providedIn: 'root'
})
export class TeacherAssignmentService {
  private apiUrl = `${environment.apiUrl}/users`;
  private usersService = inject(UsersService);

  constructor(private http: HttpClient) {}

  // Obtener cursos asignados al profesor
  getAssignedCourses(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/getAssignedCoursesEdit/${userId}`);
  }

  // Obtener cursos disponibles para asignar al profesor
  getUnassignedCourses(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/getUnassignedCoursesEdit/${userId}`);
  }

  // Obtener todos los profesores con sus cursos asignados
  getAllTeachersWithCourses(): Observable<any[]> {
    return this.usersService.getUsers({ page_size: 100 }).pipe(
      map((response: any) => {
        const teachers = response?.data?.filter((user: any) => user.role === 'teacher' || user.role === 'TEACHER') || [];
        return teachers;
      })
    );
  }

  // Obtener mapeo de cursos a profesores asignados
  getCourseTeacherMapping(): Observable<{ [courseId: string]: any[] }> {
    return this.getAllTeachersWithCourses().pipe(
      map((teachers: any[]) => {
        const mapping: { [courseId: string]: any[] } = {};

        teachers.forEach((teacher: any) => {
          if (teacher.courses && Array.isArray(teacher.courses)) {
            teacher.courses.forEach((courseId: string) => {
              if (!mapping[courseId]) {
                mapping[courseId] = [];
              }
              mapping[courseId].push(teacher);
            });
          }
        });

        return mapping;
      })
    );
  }
}
