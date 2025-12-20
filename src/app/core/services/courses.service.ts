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

export interface Course {
  _id: string;
  name: string;
  description?: string;
  longDescription?: string;
  status: string;
  order: number;
  imageUrl?: string;
  classes: Class[];
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
  mainTeacher?: string;
  mainTeacherInfo?: TeacherInfo;
  teacherInfo?: TeacherInfo[];
  numberOfClasses?: number;
  duration?: number;
  isPublished?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Class {
  title: string;
  status: string;
  imageUrl?: string;
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

    return this.http.patch(`${this.apiUrl}/${id}`, formData);
  }

  toggleCourseStatus(id: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${id}/status`, {});
  }

  togglePublishedStatus(id: string, isPublished: boolean): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${id}/published`, { isPublished });
  }

  deleteCourse(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}/delete`);
  }

  assignMainTeacher(courseId: string, teacherId: string): Observable<any> {
    // Backend accepts PATCH /courses/:id with JSON body. We send only mainTeacher.
    return this.http.patch(`${this.apiUrl}/${courseId}`, { mainTeacher: teacherId });
  }
}
