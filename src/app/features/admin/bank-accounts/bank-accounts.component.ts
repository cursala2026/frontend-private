import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { BankAccountService, BankAccount, UpdateBankAccountDto } from '../../../core/services/bank-account.service';
import { InfoService } from '../../../core/services/info.service';

@Component({
  selector: 'app-bank-accounts',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './bank-accounts.component.html',
  styleUrl: './bank-accounts.component.css'
})
export class BankAccountsComponent implements OnInit {
  private bankAccountService = inject(BankAccountService);
  private info = inject(InfoService);
  private fb = inject(FormBuilder);

  bankAccounts = signal<BankAccount[]>([]);
  loading = signal<boolean>(true);
  saving = signal<string | null>(null);
  
  // Formularios para cada cuenta (usando un Map para manejar múltiples formularios)
  accountForms: Map<string, FormGroup> = new Map();

  ngOnInit() {
    this.loadBankAccounts();
  }

  loadBankAccounts() {
    this.loading.set(true);
    this.bankAccountService.getAllBankAccounts().subscribe({
      next: (response) => {
        const accounts = response?.data || [];
        this.bankAccounts.set(accounts);
        
        // Inicializar formularios para cada cuenta
        accounts.forEach(account => {
          const form = this.fb.group({
            cbu: [account.cbu, [Validators.required, Validators.pattern(/^\d{22}$/)]],
            alias: [account.alias, [Validators.required, Validators.minLength(3), Validators.maxLength(20)]]
          });
          this.accountForms.set(account._id, form);
        });
        
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading bank accounts:', error);
        this.info.showError('Error al cargar las cuentas bancarias');
        this.loading.set(false);
      }
    });
  }

  getForm(accountId: string): FormGroup | null {
    return this.accountForms.get(accountId) || null;
  }

  updateBankAccount(accountId: string) {
    const form = this.accountForms.get(accountId);
    if (!form || form.invalid) {
      this.info.showError('Por favor, completa todos los campos correctamente');
      return;
    }

    this.saving.set(accountId);
    const updateData: UpdateBankAccountDto = {
      cbu: form.value.cbu,
      alias: form.value.alias
    };

    this.bankAccountService.updateBankAccount(accountId, updateData).subscribe({
      next: (response) => {
        const updatedAccount = response.data;
        // Actualizar la cuenta en la lista
        const accounts = this.bankAccounts();
        const index = accounts.findIndex(a => a._id === accountId);
        if (index !== -1) {
          accounts[index] = updatedAccount;
          this.bankAccounts.set([...accounts]);
        }
        this.info.showSuccess('Cuenta bancaria actualizada exitosamente');
        this.saving.set(null);
      },
      error: (error) => {
        console.error('Error updating bank account:', error);
        const errorMessage = error?.error?.message || 'Error al actualizar la cuenta bancaria';
        this.info.showError(errorMessage);
        this.saving.set(null);
      }
    });
  }

  hasError(form: FormGroup | null, field: string, errorType: string): boolean {
    if (!form) return false;
    const control = form.get(field);
    return !!(control && control.hasError(errorType) && (control.dirty || control.touched));
  }
}

