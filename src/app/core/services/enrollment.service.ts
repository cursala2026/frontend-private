import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../config/environment';
import { EnrolledStudent } from '../models/enrollment.model';

@Injectable({
  providedIn: 'root',
})
export class EnrollmentService {
  private readonly http = inject(HttpClient);

  // Trae los alumnos inscritos de un curso y los REDUCE al contrato minimo.
  // Este .map() es el corazon de la "minimizacion de datos": aunque el backend
  // mande email, dni, telefono, etc., aca solo dejamos pasar name/lastName/education.
  getEnrolledStudents(courseId: string): Observable<EnrolledStudent[]> {
    return this.http
      .get<any>(`${environment.apiUrl}/user/getUsersByAssignedCourses/${courseId}`)
      .pipe(
        map((response) => {
          const raw = Array.isArray(response) ? response : (response?.data ?? []);
          return raw.map(
            (s: any): EnrolledStudent => ({
              name: s.name ?? s.firstName ?? '',
              lastName: s.lastName ?? '',
              education: s.education ?? '',
            }),
          );
        }),
      );
  }
}
