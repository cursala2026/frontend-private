import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../config/environment';

export enum TicketStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
}

export interface SupportTicket {
  _id: string;
  userId: string;
  userEmail: string;
  userName: string;
  subject: string;
  message: string;
  imageUrl?: string;
  status: TicketStatus;
  priority?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  adminNotes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TicketListResponse {
  data: SupportTicket[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    totalPages: number;
  };
}

export interface TicketStatsResponse {
  total: number;
  pending: number;
  inProgress: number;
  resolved: number;
}

@Injectable({
  providedIn: 'root',
})
export class SupportTicketService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/support-tickets`;

  createTicket(subject: string, message: string, imageFile?: File): Observable<any> {
    const formData = new FormData();
    formData.append('subject', subject);
    formData.append('message', message);
    if (imageFile) {
      formData.append('image', imageFile);
    }
    return this.http.post(this.apiUrl, formData);
  }

  getMyTickets(params: { page?: number; limit?: number; status?: TicketStatus }): Observable<TicketListResponse> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params.status) httpParams = httpParams.set('status', params.status);
    return this.http.get<TicketListResponse>(`${this.apiUrl}/my-tickets`, { params: httpParams });
  }

  getAllTickets(params: { page?: number; limit?: number; status?: TicketStatus }): Observable<TicketListResponse> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params.status) httpParams = httpParams.set('status', params.status);
    return this.http.get<TicketListResponse>(this.apiUrl, { params: httpParams });
  }

  getTicketById(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${id}`);
  }

  updateStatus(id: string, status: TicketStatus): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${id}/status`, { status });
  }

  resolveTicket(id: string, adminNotes?: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${id}/resolve`, { adminNotes });
  }

  updateNotes(id: string, adminNotes: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${id}/notes`, { adminNotes });
  }

  deleteTicket(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  getStats(): Observable<{ data: TicketStatsResponse }> {
    return this.http.get<{ data: TicketStatsResponse }>(`${this.apiUrl}/stats`);
  }
}
