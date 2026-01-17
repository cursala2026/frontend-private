import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../config/environment';

export interface UserListResponse {
  data: any[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  roles: string[];
  phone?: string;
}

export interface UpdateUserDto {
  email?: string;
  firstName?: string;
  lastName?: string;
  roles?: string[];
  phone?: string;
  isActive?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/user`;

  getUsers(params: {
    page?: number;
    page_size?: number;
    sort?: string;
    sort_dir?: 'ASC' | 'DESC';
    search?: string;
    role?: string;
    _t?: string;
    courseId?: string;
    dir?: 'ASC' | 'DESC';
  }): Observable<UserListResponse> {
    let httpParams = new HttpParams();

    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.page_size) {
      httpParams = httpParams.set('page_size', params.page_size.toString());
      // También enviar limit por si el backend lo usa
      httpParams = httpParams.set('limit', params.page_size.toString());
    }
    if (params.sort) httpParams = httpParams.set('sort', params.sort);
    // Mantener compatibilidad con ambos nombres: sort_dir y dir
    if (params.sort_dir) httpParams = httpParams.set('sort_dir', params.sort_dir);
    if (params.dir) httpParams = httpParams.set('dir', params.dir);
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.role) httpParams = httpParams.set('role', params.role);
    if (params.courseId) {
      // Enviar varias claves por compatibilidad con distintos backends
      httpParams = httpParams.set('courseId', params.courseId);
      httpParams = httpParams.set('course', params.courseId);
      httpParams = httpParams.set('course_id', params.courseId);
    }
    if (params._t) httpParams = httpParams.set('_t', params._t);

    return this.http.get<UserListResponse>(this.apiUrl, { params: httpParams });
  }

  getAllUsers(): Observable<any> {
    return this.http.get(`${this.apiUrl}/getAllUsers`);
  }

  getTeachers(): Observable<any> {
    return this.http.get(`${this.apiUrl}/getTeachers`);
  }

  getUserById(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${id}`);
  }

  createUser(user: CreateUserDto): Observable<any> {
    return this.http.post(`${this.apiUrl}/create`, user);
  }

  updateUser(id: string, user: UpdateUserDto): Observable<any> {
    return this.http.patch(`${this.apiUrl}/updateUser/${id}`, user);
  }

  updateUserData(id: string, formData: FormData): Observable<any> {
    return this.http.patch(`${this.apiUrl}/updateUserData/${id}`, formData);
  }

  toggleUserStatus(id: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${id}/toggle-status`, {});
  }

  deleteUser(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/deleteUser/${id}`);
  }
}
