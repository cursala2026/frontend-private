import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
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
  private apiUrl = `${environment.apiUrl}/companySpecificData/company-specific-data`;

  /**
   * Obtiene todas las cuentas bancarias desde companySpecificData
   */
  getAllBankAccounts(): Observable<{ data: BankAccount[] }> {
    return this.http.get<any>(this.apiUrl).pipe(
      map((response: any) => {
        // Extraer bankAccounts del primer elemento del array data
        const bankAccounts = response?.data?.[0]?.bankAccounts || [];
        return { data: bankAccounts };
      })
    );
  }

  /**
   * Actualiza una cuenta bancaria
   */
  updateBankAccount(id: string, updateData: UpdateBankAccountDto): Observable<{ data: BankAccount }> {
    return this.http.patch<{ data: BankAccount }>(`${this.apiUrl}/bank-account/${id}`, updateData);
  }
}

