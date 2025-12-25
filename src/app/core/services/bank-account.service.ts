import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../config/environment';

export interface BankAccount {
  _id: string;
  cbu: string;
  alias: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateBankAccountDto {
  cbu?: string;
  alias?: string;
}

@Injectable({
  providedIn: 'root'
})
export class BankAccountService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/bankAccount`;

  /**
   * Obtiene todas las cuentas bancarias
   */
  getAllBankAccounts(): Observable<{ data: BankAccount[] }> {
    return this.http.get<{ data: BankAccount[] }>(`${this.apiUrl}/bank-accounts`);
  }

  /**
   * Actualiza una cuenta bancaria
   */
  updateBankAccount(id: string, updateData: UpdateBankAccountDto): Observable<{ data: BankAccount }> {
    return this.http.patch<{ data: BankAccount }>(`${this.apiUrl}/bank-account/${id}`, updateData);
  }
}

