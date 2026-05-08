import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../config/environment';
export interface TeacherInfo {
  teacherId: string;
  teacherName: string;
  firstName: string;
  lastName: string;
  email: string;
  professionalDescription?: string;
  profilePhotoUrl?: string;
}

export interface CourseStudent {
  userId: string;
  enrolledAt: Date;
  enrollmentType: 'MANUAL' | 'SELF'; // MANUAL = admin | SELF = auto-inscripción
  startDate?: Date; // Solo para inscripciones manuales con fechas
  endDate?: Date;   // Solo para inscripciones manuales con fechas
}

export interface Course {
  _id: string;
  name: string;
  description?: string;
  longDescription?: string;
  status: string;
  order: number;
  imageUrl?: string;
  classes: Class[];
  questionnaires?: any[]; // Array de cuestionarios del curso
  orderedContent?: OrderedContentItem[]; // Array pre-ordenado de clases y cuestionarios
  students?: CourseStudent[]; // Array de estudiantes con metadata de inscripción
  meta?: {
    totalClasses: number;
    popularity: number;
  };
  days?: string[];
  time?: string;
  startDate?: Date;
  registrationOpenDate?: Date;
  modality?: string;
  price?: number;
  programUrl?: string;
  maxInstallments: number;
  interestFree: boolean;
  showOnHome?: boolean;
  
  teachers?: string[]; // Array de IDs de profesores
  teachersInfo?: TeacherInfo[]; // Array de información de profesores
  numberOfClasses?: number;
  duration?: number;
  isPublished?: boolean;
  hasActivePromotionalCode?: boolean; // Indica si el curso tiene un código promocional activo
  isMainTeacher?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OrderedContentItem {
  type: 'CLASS' | 'QUESTIONNAIRE';
  order: number;
  data: any; // Puede ser Class o Questionnaire
}

export interface Class {
  _id?: string;
  name: string;
  status: string;
  imageUrl?: string;
  videoUrl?: string;
  description?: string;
  order?: number;
  linkLive?: string;
}

export interface CourseListResponse {
  data: Course[];
  pagination?: {
    page: number;
    page_size: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateCourseDto {
  name: string;
  description?: string;
  longDescription?: string;
  status?: string;
  order?: number;
  imageFile: File;
  days?: string[] | string;
  time?: string;
  startDate?: Date | string;
  registrationOpenDate?: Date | string;
  modality?: string;
  price?: number;
  programFile?: File;
  maxInstallments?: number;
  interestFree?: boolean;
  isPublished?: boolean;
  teachers?: string[]; // Array de IDs de profesores (1-3)
}

export interface UpdateCourseDto {
  name?: string;
  description?: string;
  longDescription?: string;
  days?: string[] | string;
  time?: string;
  startDate?: Date | string;
  registrationOpenDate?: Date | string;
  modality?: string;
  price?: number;
  maxInstallments?: number;
  interestFree?: boolean;
  numberOfClasses?: number;
  duration?: number;
  imageFile?: File;
  programFile?: File;
  showOnHome?: boolean;
  deleteImage?: boolean;
  teachers?: string[]; // Array de IDs de profesores (1-3)
}
export interface SaveInterestsDto {
  courseIds: string[];
  suggestions: string;
}

@Injectable({
  providedIn: 'root'
})
export class CoursesService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/courses`;

  getCourses(params?: {
    page?: number;
    page_size?: number;
    sort?: string;
    sort_dir?: 'ASC' | 'DESC';
    search?: string;
  }): Observable<any> {
    let httpParams = new HttpParams();

    if (params?.page) httpParams = httpParams.set('page', params.page.toString());
    if (params?.page_size) httpParams = httpParams.set('page_size', params.page_size.toString());
    if (params?.sort) httpParams = httpParams.set('sort', params.sort);
    if (params?.sort_dir) httpParams = httpParams.set('sort_dir', params.sort_dir);
    if (params?.search) httpParams = httpParams.set('search', params.search);

    return this.http.get<any>(this.apiUrl, { params: httpParams });
  }

  getCourseById(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${id}`);
  }

  getPublishedCourses(): Observable<any> {
    return this.http.get(`${this.apiUrl}/published`);
  }

  getTeacherCourses(teacherId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/teacher/${teacherId}`);
  }

  private toISOString(date: Date | string | undefined): string | undefined {
    if (!date) return undefined;
    if (typeof date === 'string') {
      return new Date(date).toISOString();
    }
    return date.toISOString();
  }

  createCourse(course: CreateCourseDto): Observable<any> {
    const formData = new FormData();

    formData.append('name', course.name);
    if (course.description) formData.append('description', course.description);
    if (course.longDescription) formData.append('longDescription', course.longDescription);
    if (course.status) formData.append('status', course.status);
    if (course.order !== undefined) formData.append('order', course.order.toString());
    if (course.imageFile) formData.append('imageFile', course.imageFile);
    if (course.days) {
      const daysStr = Array.isArray(course.days) ? course.days.join(',') : course.days;
      formData.append('days', daysStr);
    }
    if (course.time) formData.append('time', course.time);

    const startDateISO = this.toISOString(course.startDate);
    if (startDateISO) formData.append('startDate', startDateISO);

    const regDateISO = this.toISOString(course.registrationOpenDate);
    if (regDateISO) formData.append('registrationOpenDate', regDateISO);

    if (course.modality) formData.append('modality', course.modality);
    if (course.price !== undefined) formData.append('price', course.price.toString());
    if (course.programFile) formData.append('programFile', course.programFile);
    if (course.maxInstallments !== undefined) formData.append('maxInstallments', course.maxInstallments.toString());
    if (course.interestFree !== undefined) formData.append('interestFree', course.interestFree.toString());
    if (course.isPublished !== undefined) formData.append('isPublished', course.isPublished.toString());
    if (course.teachers && Array.isArray(course.teachers) && course.teachers.length > 0) {
      // Enviar como array separado por comas
      formData.append('teachers', course.teachers.join(','));
    }

    return this.http.post(`${this.apiUrl}/course`, formData);
  }

  updateCourse(id: string, course: UpdateCourseDto): Observable<any> {
    const formData = new FormData();

    if (course.name) formData.append('name', course.name);
    if (course.description !== undefined) formData.append('description', course.description);
    if (course.longDescription !== undefined) formData.append('longDescription', course.longDescription);
    if (course.days) {
      const daysStr = Array.isArray(course.days) ? course.days.join(',') : course.days;
      formData.append('days', daysStr);
    }
    if (course.time !== undefined) formData.append('time', course.time);

    const startDateISO = this.toISOString(course.startDate);
    if (startDateISO) formData.append('startDate', startDateISO);

    const regDateISO = this.toISOString(course.registrationOpenDate);
    if (regDateISO) formData.append('registrationOpenDate', regDateISO);

    if (course.modality !== undefined) formData.append('modality', course.modality);
    if (course.price !== undefined) formData.append('price', course.price.toString());
    if (course.maxInstallments !== undefined) formData.append('maxInstallments', course.maxInstallments.toString());
    if (course.interestFree !== undefined) formData.append('interestFree', course.interestFree.toString());
    if (course.numberOfClasses !== undefined) formData.append('numberOfClasses', course.numberOfClasses.toString());
    if (course.duration !== undefined) formData.append('duration', course.duration.toString());
    if (course.imageFile) formData.append('imageFile', course.imageFile);
    if (course.programFile) formData.append('programFile', course.programFile);
    if (course.showOnHome !== undefined) formData.append('showOnHome', course.showOnHome.toString());
    if (course.deleteImage !== undefined) formData.append('deleteImage', course.deleteImage.toString());
    if (course.teachers !== undefined) {
      if (Array.isArray(course.teachers) && course.teachers.length > 0) {
        // Enviar como array separado por comas
        formData.append('teachers', course.teachers.join(','));
      } else {
        // Si es un array vacío, enviar como string vacío para limpiar
        formData.append('teachers', '');
      }
    }

    return this.http.patch(`${this.apiUrl}/${id}`, formData);
  }

  // Patch with a plain JSON payload (useful for updating single fields)
  updateCoursePartial(id: string, payload: Record<string, any>): Observable<any> {
    // Enviar como FormData para mantener coherencia con el endpoint PATCH que
    // generalmente espera multipart/form-data (igual que `updateCourse`).
    const formData = new FormData();
    Object.keys(payload || {}).forEach((key) => {
      const value = payload[key];
      if (value === undefined || value === null) {
        // Para indicar borrado explícito, enviar cadena vacía
        formData.append(key, '');
      } else if (value instanceof File) {
        formData.append(key, value);
      } else if (Array.isArray(value)) {
        formData.append(key, value.join(','));
      } else if (value instanceof Date) {
        formData.append(key, value.toISOString());
      } else {
        formData.append(key, String(value));
      }
    });

    return this.http.patch(`${this.apiUrl}/${id}`, formData);
  }

  toggleCourseStatus(id: string, status: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${id}/status`, { status });
  }

  togglePublishedStatus(id: string, isPublished: boolean): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${id}/published`, { isPublished });
  }

  updateShowOnHome(id: string, showOnHome: boolean): Observable<any> {
    const formData = new FormData();
    formData.append('showOnHome', showOnHome.toString());
    return this.http.patch(`${this.apiUrl}/${id}`, formData);
  }

  deleteCourse(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}/delete`);
  }

  assignMainTeacher(courseId: string, teacherId: string): Observable<any> {
    // Backend expects PATCH /courses/:courseId/main-teacher with mainTeacherId in body
    return this.http.patch(`${this.apiUrl}/${courseId}/main-teacher`, { mainTeacherId: teacherId });
  }

  // Actualizar asignación de profesores de forma atómica
  // Endpoint: PATCH /courses/:courseId/teachers
  updateCourseTeachers(courseId: string, payload: { add?: string[]; remove?: string[] } ): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${courseId}/teachers`, payload);
  }

  enrollInCourse(courseId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${courseId}/enroll`, {});
  }

  unenrollFromCourse(courseId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${courseId}/unenroll`, {});
  }

  // Métodos para administradores: inscripción/desinscripción manual
  enrollStudentManually(courseId: string, userId: string, data?: { startDate?: string; endDate?: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/${courseId}/enroll/${userId}`, data || {});
  }

  unenrollStudentCompletely(courseId: string, userId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${courseId}/unenroll/${userId}`);
  }

  getStudentCourses(): Observable<any> {
    return this.http.get(`${this.apiUrl}/me/courses`);
  }

  duplicateCourse(courseId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${courseId}/duplicate`, {});
  }
  getAvailableInterests(): Observable<Course[]> {
    return this.http.get<Course[]>(`${this.apiUrl}/active`);
  }

  saveUserInterests(payload: SaveInterestsDto): Observable<any> {
    return this.http.post(`${environment.apiUrl}/users/interests`, payload);
  }
}
