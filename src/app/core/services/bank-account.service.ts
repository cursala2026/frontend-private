import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { environment } from '../config/environment';
import { PublicDataService } from './public-data.service';

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

  /**
   * Obtiene las cuentas bancarias públicas disponibles para estudiantes
   * Endpoint: GET /api/bank-accounts/public/student
   */
  getPublicStudentBankAccounts(): Observable<{ data: Array<Pick<BankAccount, 'cbu' | 'alias' | '_id'>> }> {
    const url = `${environment.apiUrl}/bank-accounts/public/student`;
    const publicDataApi = `${environment.apiUrl}/companySpecificData/company-specific-data`;

    return this.http.get<{ data: Array<Pick<BankAccount, 'cbu' | 'alias' | '_id'>> }>(url).pipe(
      catchError((err) => {
        // Si el endpoint público no existe (404), hacer fallback a companySpecificData
        if (err?.status === 404) {
          return this.http.get<any>(publicDataApi).pipe(
            map((resp: any) => {
              const bankAccounts = resp?.data?.[0]?.bankAccounts || [];
              const mapped = bankAccounts.map((b: any) => ({ _id: b._id, cbu: b.cbu, alias: b.alias }));
              return { data: mapped };
            }),
            // Si fallback falla (por ejemplo 403), devolver lista vacía en lugar de propagar error
            catchError(() => of({ data: [] }))
          );
        }
        // Para otros errores (403, 500, etc.) devolvemos lista vacía para permitir manejo en UI
        return of({ data: [] });
      })
    );
  }
}

