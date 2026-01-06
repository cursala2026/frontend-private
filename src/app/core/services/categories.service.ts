import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../config/environment';

export interface Category {
  id?: string;
  _id?: string;
  name: string;
  description?: string;
}

@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}`;

  getCategories(): Observable<any> {
    return this.http.get(`${this.base}/categories`);
  }

  getCategoryById(id: string): Observable<any> {
    return this.http.get(`${this.base}/category/${id}`);
  }

  createCategory(payload: { name: string; description?: string }): Observable<any> {
    return this.http.post(`${this.base}/category`, payload);
  }

  updateCategory(id: string, payload: Partial<{ name: string; description: string }>): Observable<any> {
    return this.http.patch(`${this.base}/category/${id}`, payload);
  }

  deleteCategory(id: string): Observable<any> {
    return this.http.delete(`${this.base}/category/${id}/delete`);
  }

  // Extra: endpoint util para selects
  getCoursesCategories(): Observable<any> {
    // El endpoint correcto para categorías es /categories
    return this.http.get(`${this.base}/categories`);
  }
}
