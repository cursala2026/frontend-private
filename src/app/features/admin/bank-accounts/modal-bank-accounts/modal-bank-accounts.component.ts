import { Component, Input, Output, EventEmitter, inject, signal, effect, Signal, WritableSignal, Injector, runInInjectionContext } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormGroup } from '@angular/forms';
import { BankAccountService, BankAccount, UpdateBankAccountDto } from '../../../../core/services/bank-account.service';
import { InfoService } from '../../../../core/services/info.service';

@Component({
  selector: 'app-modal-bank-accounts',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './modal-bank-accounts.component.html'
})
export class ModalBankAccountsComponent {
  private bankAccountService = inject(BankAccountService);
  private info = inject(InfoService);
  private fb = inject(FormBuilder);

  private _isOpen: WritableSignal<boolean> = signal(false);
  private _effectInitialized = false;
  private _injector = inject(Injector);

  @Input()
  set isOpen(value: WritableSignal<boolean>) {
    if (!value) return;
    this._isOpen = value;
    if (!this._effectInitialized) {
      this._effectInitialized = true;
      runInInjectionContext(this._injector, () => {
        effect(() => {
          if (this._isOpen() === true) {
            this.loadBankAccounts();
          }
        });
      });
    }
  }
  get isOpen(): WritableSignal<boolean> {
    return this._isOpen;
  }

  @Output() close = new EventEmitter<void>();

  bankAccounts = signal<BankAccount[]>([]);
  loadingAccounts = signal<boolean>(false);
  saving = signal<string | null>(null);

  accountForms: Map<string, FormGroup> = new Map();

  ngOnInit() {
    // Initialization handled by Input setter which creates the effect when the signal is provided.
  }

  open() {
    this.isOpen.set(true);
    this.loadBankAccounts();
  }

  closeModal() {
    this.isOpen.set(false);
    this.close.emit();
  }

  loadBankAccounts() {
    this.loadingAccounts.set(true);
    this.bankAccountService.getAllBankAccounts().subscribe({
      next: (response) => {
        const accounts = response?.data || [];
        this.bankAccounts.set(accounts);

        accounts.forEach(account => {
          const form = this.fb.group({
            cbu: [account.cbu, [Validators.required, Validators.pattern(/^\d{22}$/)]],
            alias: [account.alias, [Validators.required, Validators.minLength(3), Validators.maxLength(20)]]
          });
          this.accountForms.set(account._id, form);
        });

        this.loadingAccounts.set(false);
      },
      error: (error) => {
        console.error('Error loading bank accounts in modal:', error);
        this.info.showError('Error al cargar las cuentas bancarias');
        this.loadingAccounts.set(false);
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
        const accounts = this.bankAccounts();
        const index = accounts.findIndex(a => a._id === accountId);
        if (index !== -1) {
          accounts[index] = updatedAccount;
          this.bankAccounts.set([...accounts]);
        }
        this.info.showSuccess('Cuenta bancaria actualizada exitosamente');
        this.saving.set(null);
        this.closeModal();
      },
      error: (error) => {
        console.error('Error updating bank account in modal:', error);
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
