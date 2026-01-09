import { Component, forwardRef, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-password-field',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PasswordFieldComponent),
      multi: true
    }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative">
      <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        <svg class="h-5 w-5 text-brand-tertiary-lighten" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
      </div>
      <input
        [type]="inputType"
        [value]="value"
        (input)="onInput($event)"
        (blur)="onTouched()"
        autocomplete="current-password"
        [class.password-hidden]="useManualMask && !showPassword()"
        class="block w-full rounded-lg border border-gray-300 bg-gray-50 py-3 pl-10 pr-10 text-gray-900 placeholder-gray-400 transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
        />

      <button type="button" (click)="toggle()" aria-label="Mostrar contraseña" class="absolute inset-y-0 right-0 cursor-pointer flex items-center pr-3 text-brand-tertiary-lighten hover:text-brand-tertiary">
        <ng-container *ngIf="showPassword(); else hiddenIcon">
          <!-- eye-off / visibility_off SVG -->
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
            <path fill="currentColor" d="M12 6c-3.87 0-7.17 2.19-9 5.5 1.03 2.02 2.7 3.7 4.74 4.73L4 18.97 5.03 20l14-14L18.97 4l-2.81 2.81C14.7 6.3 13.38 6 12 6zM2.1 2.1L.69 3.51 4.9 7.72C3.48 9.1 2.34 10.97 1.6 12.5 3.33 16.89 7.6 20 12 20c2.06 0 3.98-.54 5.66-1.47l2.84 2.84 1.41-1.41L2.1 2.1z"/>
          </svg>
        </ng-container>
        <ng-template #hiddenIcon>
          <!-- eye / visibility SVG -->
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
            <path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zm0 12c-2.48 0-4.5-2.02-4.5-4.5S9.52 7.5 12 7.5s4.5 2.02 4.5 4.5S14.48 16.5 12 16.5zM12 9c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
          </svg>
        </ng-template>
      </button>
    </div>
  `
})
export class PasswordFieldComponent implements ControlValueAccessor {
  value: string = '';
  disabled = false;

  // estado interno
  showPassword = signal<boolean>(false);
  useManualMask = this.detectManualMaskNeeded();

  // ControlValueAccessor hooks
  onChange: (v: any) => void = () => {};
  onTouched: () => void = () => {};

  get inputType(): string {
    // Si forzamos enmascarado manual en dispositivos problemáticos, usamos 'text' y
    // aplicamos CSS para ocultar caracteres; en caso contrario, usamos 'password' cuando corresponde
    if (this.useManualMask && !this.showPassword()) return 'text';
    return this.showPassword() ? 'text' : 'password';
  }

  writeValue(obj: any): void {
    this.value = obj ?? '';
  }
  registerOnChange(fn: any): void { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }
  setDisabledState?(isDisabled: boolean): void { this.disabled = isDisabled; }

  onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.value = target.value;
    this.onChange(this.value);
  }

  toggle(): void {
    this.showPassword.update(v => !v);
  }

  // Detección simple por user-agent para dispositivos Xiaomi/MIUI
  private detectManualMaskNeeded(): boolean {
    try {
      if (typeof navigator === 'undefined') return false;
      const ua = (navigator.userAgent || navigator.vendor || '').toLowerCase();
      if (/xiaomi|redmi|miui|mi\s|mi-/i.test(ua)) return true;
      if (/android/.test(ua) && /chrome/.test(ua) && /mi|xiaomi|redmi/.test(ua)) return true;
    } catch (e) {
      return false;
    }
    return false;
  }
}
