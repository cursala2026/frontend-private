import { Component, Input, Output, EventEmitter, signal, effect, Signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, FormBuilder } from '@angular/forms';
import { ImageUploaderComponent } from '../image-uploader/image-uploader.component';
import { Subject, of, Observable, from, isObservable } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';

export interface ModalField {
  key: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'date' | 'select' | 'multiselect' | 'textarea' | 'checkbox' | 'password' | 'image' | 'file' | 'autocomplete' | 'autocomplete-multiselect';
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  // For select/multiselect: array of options. For autocomplete: can be an array or a function that
  // receives a search term and returns an Observable/Promise/array of options.
  options?: { value: any; label: string }[] | ((term: string) => Observable<{ value: any; label: string }[]> | Promise<{ value: any; label: string }[]> | { value: any; label: string }[]);
  validators?: any[];
  value?: any;
  rows?: number; // For textarea
  maxlength?: number; // Optional maxlength for text/textarea
  imageShape?: 'circle' | 'rectangle'; // For image fields
  aspectRatio?: string; // For image fields
  accept?: string; // For file fields (e.g., '.pdf', 'application/pdf')
  maxSelections?: number; // For multiselect
  minSelections?: number; // For multiselect
  section?: string; // Optional section name for grouping fields
}

export interface ModalConfig {
  title: string;
  mode: 'view' | 'edit' | 'create';
  fields: ModalField[];
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

@Component({
  selector: 'app-modal-data-table',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ImageUploaderComponent],
  templateUrl: './modal-data-table.component.html'
})
export class ModalDataTableComponent {
  @Input() isOpen = signal<boolean>(false);
  @Input() config!: ModalConfig;
  @Input() data: any = {};
  
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<any>();
  
  form!: FormGroup;
  isSubmitting = signal<boolean>(false);
  // Cache and subjects for autocomplete fields
  private optionsSignals: Record<string, WritableSignal<{ value: any; label: string }[]>> = {};
  private searchSubjects: Record<string, Subject<string>> = {};
  private searchValueSignals: Record<string, WritableSignal<string>> = {};
  // Backwards-compatible alias used by older template references
  searchValues: Record<string, string> = {};
  private focusSignals: Record<string, WritableSignal<boolean>> = {};

  getFocusSignal(key: string): WritableSignal<boolean> {
    if (!this.focusSignals[key]) this.focusSignals[key] = signal<boolean>(false);
    return this.focusSignals[key];
  }

  private getOptionsSignal(key: string): WritableSignal<{ value: any; label: string }[]> {
    if (!this.optionsSignals[key]) this.optionsSignals[key] = signal<{ value: any; label: string }[]>([]);
    return this.optionsSignals[key];
  }

  private getSearchSignal(key: string): WritableSignal<string> {
    if (!this.searchValueSignals[key]) this.searchValueSignals[key] = signal<string>('');
    return this.searchValueSignals[key];
  }

  constructor(private fb: FormBuilder) {
    effect(() => {
      if (this.isOpen() && this.config) {
        this.isSubmitting.set(false); // Resetear estado al abrir el modal
        this.initializeForm();
      }
    });
  }


  initializeForm(): void {
    const formControls: any = {};
    
    this.config.fields.forEach(field => {
      let value = this.data?.[field.key] ?? field.value ?? '';
      
      // Para multiselect y autocomplete-multiselect, asegurar que sea un array
      if (field.type === 'multiselect' || field.type === 'autocomplete-multiselect') {
        if (!Array.isArray(value)) {
          value = value ? [value] : [];
        }
      }
      
      // Para campos de fecha, formatear al formato YYYY-MM-DD para input[type="date"]
      if (field.type === 'date' && value) {
        if (value instanceof Date) {
          value = value.toISOString().split('T')[0];
        } else if (typeof value === 'string') {
          // Intentar parsear diferentes formatos de fecha
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            value = date.toISOString().split('T')[0];
          }
        }
      }
      
      formControls[field.key] = [
        { value, disabled: field.disabled || this.config.mode === 'view' }
      ];

      // Si el campo es autocomplete o autocomplete-multiselect y define una función o lista, preparar el subject
      if (field.type === 'autocomplete' || field.type === 'autocomplete-multiselect') {
        if (!this.searchSubjects[field.key]) {
          this.searchSubjects[field.key] = new Subject<string>();
          this.searchSubjects[field.key].pipe(
            debounceTime(300),
            distinctUntilChanged(),
            switchMap(term => {
              try {
                const fn = (field.options as any);
                const optsOrObs = fn ? fn(term) : [];
                let obs$: Observable<any[]>;
                if (isObservable(optsOrObs)) {
                  obs$ = optsOrObs as Observable<any[]>;
                } else if (optsOrObs && typeof (optsOrObs as any).then === 'function') {
                  obs$ = from(optsOrObs as Promise<any[]>);
                } else {
                  obs$ = of(optsOrObs || []);
                }
                return obs$.pipe(catchError(() => of([])));
              } catch (e) {
                return of([]);
              }
            })
          ).subscribe(opts => {
            this.getOptionsSignal(field.key).set(Array.isArray(opts) ? opts : []);
            // Si el formulario tiene un valor ya seleccionado para este campo, y encontramos la etiqueta, actualizar el texto mostrado
            const currentVal = this.form?.get(field.key)?.value ?? field.value;
            if (currentVal) {
              const found = (Array.isArray(opts) ? opts : []).find((o: any) => String(o.value) === String(currentVal));
              if (found) {
                // No setear la señal raw de búsqueda para evitar que la lista se abra automáticamente.
                this.searchValues[field.key] = found.label;
              }
            }
          });
          // Lanzar una búsqueda inicial vacía para precargar opciones si es necesario
          this.searchSubjects[field.key].next('');
          // Pre-cargar las opciones invocando la función `field.options('')` si existe
          try {
            const fn = (field.options as any);
            if (fn) {
              const res = fn('');
              if (isObservable(res)) {
                (res as Observable<any[]>).pipe(catchError(() => of([]))).subscribe(opts => {
                  this.getOptionsSignal(field.key).set(Array.isArray(opts) ? opts : []);
                });
              } else if (res && typeof (res as any).then === 'function') {
                from(res as Promise<any[]>).pipe(catchError(() => of([]))).subscribe(opts => {
                  this.getOptionsSignal(field.key).set(Array.isArray(opts) ? opts : []);
                });
              } else {
                this.getOptionsSignal(field.key).set(Array.isArray(res) ? res : []);
              }
            }
          } catch (e) {
            // ignore
          }
        }
      }
    });

    this.form = this.fb.group(formControls);
  }

  searchOptions(fieldKey: string, term: string): void {
    const subj = this.searchSubjects[fieldKey];
    this.getSearchSignal(fieldKey).set(term);
    this.searchValues[fieldKey] = term;
    if (subj) subj.next(term);
  }

  onInputFocus(fieldKey: string): void {
    this.getFocusSignal(fieldKey).set(true);
    const subj = this.searchSubjects[fieldKey];
    // trigger a fetch using current raw value
    const current = this.getSearchSignal(fieldKey)();
    if (subj) subj.next(current || '');
  }

  onInputBlur(fieldKey: string): void {
    // Delay hiding to allow click on option
    setTimeout(() => {
      this.getFocusSignal(fieldKey).set(false);
    }, 150);
  }

  getAutocompleteOptions(fieldKey: string): { value: any; label: string }[] {
    return this.getOptionsSignal(fieldKey)() || [];
  }

  selectAutocompleteOption(fieldKey: string, option: { value: any; label: string }): void {
    if (this.form) {
      this.form.patchValue({ [fieldKey]: option.value });
      // Optionally mark as touched
      this.form.get(fieldKey)?.markAsTouched();
      // Guardar etiqueta en alias para mostrar, pero no setear la señal raw
      this.searchValues[fieldKey] = option.label;
      // Cerrar la lista de opciones al seleccionar
      this.getOptionsSignal(fieldKey).set([]);
    }
  }

  // Añadir selección para autocomplete-multiselect
  addAutocompleteSelection(fieldKey: string, option: { value: any; label: string }): void {
    const control = this.form.get(fieldKey);
    if (!control) return;
    const current = Array.isArray(control.value) ? [...control.value] : [];
    const exists = current.some((v: any) => String(v) === String(option.value));
    if (!exists) {
      current.push(option.value);
      this.form.patchValue({ [fieldKey]: current });
      control.markAsTouched();
    }
    // limpiar texto de búsqueda pero mantener opciones cargadas; cerrar lista
    this.getSearchSignal(fieldKey).set('');
    this.searchValues[fieldKey] = '';
    this.getFocusSignal(fieldKey).set(false);
  }

  removeAutocompleteSelection(fieldKey: string, val: any): void {
    const control = this.form.get(fieldKey);
    if (!control) return;
    const current = Array.isArray(control.value) ? [...control.value] : [];
    const next = current.filter((v: any) => String(v) !== String(val));
    this.form.patchValue({ [fieldKey]: next });
    control.markAsTouched();
  }

  isAutocompleteSelected(fieldKey: string, val: any): boolean {
    const control = this.form.get(fieldKey);
    const current = control ? control.value : [];
    if (!Array.isArray(current)) return false;
    return current.some((v: any) => String(v) === String(val));
  }

  clearAutocomplete(fieldKey: string): void {
    if (this.form) {
      this.form.patchValue({ [fieldKey]: null });
      this.form.get(fieldKey)?.markAsTouched();
    }
    this.getSearchSignal(fieldKey).set('');
    this.searchValues[fieldKey] = '';
    this.getOptionsSignal(fieldKey).set([]);
    // Emitir una búsqueda vacía para el caso que la función dependa de ella
    const subj = this.searchSubjects[fieldKey];
    if (subj) subj.next('');
  }

  getAutocompleteLabel(field: ModalField): string | null {
    const val = this.form?.get(field.key)?.value ?? field.value;
    if (!val) return null;
    const opts = this.getAutocompleteOptions(field.key).length > 0 ? this.getAutocompleteOptions(field.key) : (Array.isArray(field.options) ? (field.options as any) : []);
    const found = (opts || []).find((o: any) => String(o.value) === String(val));
    return found ? found.label : null;
  }

  getSearchValue(fieldKey: string, field?: ModalField): string {
    const v = this.getSearchSignal(fieldKey)();
    if (v && v.length > 0) return v;
    // Si no hay término raw, mostrar la etiqueta guardada en alias `searchValues` o resolver por opciones
    if (this.searchValues[fieldKey] && String(this.searchValues[fieldKey]).length > 0) return this.searchValues[fieldKey];
    if (field) return this.getAutocompleteLabel(field) || '';
    return '';
  }

  getRawSearchValue(fieldKey: string): string {
    try {
      const v = this.getSearchSignal(fieldKey)();
      return v || '';
    } catch (e) {
      return '';
    }
  }

  getSizeClass(): string {
    const sizes = {
      'sm': 'max-w-sm sm:max-w-md',
      'md': 'max-w-lg sm:max-w-2xl',
      'lg': 'max-w-2xl sm:max-w-4xl',
      'xl': 'max-w-3xl sm:max-w-6xl'
    };
    return sizes[this.config?.size || 'md'];
  }

  onClose(): void {
    this.isSubmitting.set(false);
    this.isOpen.set(false);
    this.close.emit();
  }

  onSave(): void {
    if (this.config.mode === 'view') {
      this.onClose();
      return;
    }

    if (this.form.valid) {
      this.isSubmitting.set(true);
      this.save.emit(this.form.value);
    } else {
      // Mark all fields as touched to show validation errors
      Object.keys(this.form.controls).forEach(key => {
        this.form.controls[key].markAsTouched();
      });
    }
  }

  getFieldValue(field: ModalField): any {
    if (this.config.mode === 'view') {
      const value = this.data?.[field.key];
      
      if (field.type === 'select') {
        const opts = this.getFieldOptions(field);
        const option = opts.find(opt => opt.value === value || String(opt.value) === String(value));
        return option?.label || value;
      }
      
      if (field.type === 'multiselect') {
        const opts = this.getFieldOptions(field);
        const values = Array.isArray(value) ? value : (value ? [value] : []);
        const labels = values.map(v => {
          const option = opts.find(opt => opt.value === v || String(opt.value) === String(v));
          return option?.label || v;
        });
        return labels.join(', ') || '-';
      }
      
      if (field.type === 'checkbox') {
        return value ? 'Sí' : 'No';
      }
      
      if (field.type === 'date' && value) {
        return new Date(value).toLocaleDateString('es-ES');
      }
      
      return value || '-';
    }
    
    return this.form?.get(field.key)?.value;
  }

  getFieldOptions(field: ModalField): { value: any; label: string }[] {
    if (!field || !field.options) return [];
    if (Array.isArray(field.options)) return field.options as { value: any; label: string }[];
    // Si no es array (p. ej. función), intentar leer desde la señal de opciones si existe
    try {
      const opts = this.getOptionsSignal(field.key)();
      return Array.isArray(opts) ? opts : [];
    } catch (e) {
      return [];
    }
  }

  getOptionLabel(field: ModalField, val: any): string {
    if (val === undefined || val === null) return '';
    const opts = this.getFieldOptions(field);
    const found = opts.find(o => String(o.value) === String(val));
    return found ? found.label : String(val);
  }

  onCheckboxChange(field: ModalField, optionValue: any, event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    const currentValue = this.getMultiselectValue(field);
    const valueStr = String(optionValue);
    
    let newValue: string[];
    
    if (checkbox.checked) {
      // Agregar el valor si no está ya seleccionado
      if (!currentValue.includes(valueStr)) {
        newValue = [...currentValue, valueStr];
        
        // Validar límite máximo
        if (field.maxSelections && newValue.length > field.maxSelections) {
          // No permitir seleccionar más del máximo
          checkbox.checked = false;
          return;
        }
      } else {
        newValue = currentValue;
      }
    } else {
      // Remover el valor
      newValue = currentValue.filter(v => String(v) !== valueStr);
      
      // Validar límite mínimo
      if (field.minSelections && newValue.length < field.minSelections) {
        // No permitir deseleccionar si ya está en el mínimo
        checkbox.checked = true;
        return;
      }
    }
    
    // Actualizar el formulario
    this.form.patchValue({ [field.key]: newValue });
    this.form.get(field.key)?.markAsTouched();
  }

  isOptionDisabled(field: ModalField, optionValue: any): boolean {
    const currentValue = this.getMultiselectValue(field);
    const valueStr = String(optionValue);
    const isSelected = currentValue.includes(valueStr);
    
    // Si está seleccionado y ya alcanzamos el mínimo, no permitir deseleccionar
    if (isSelected && field.minSelections && currentValue.length <= field.minSelections) {
      return true;
    }
    
    // Si no está seleccionado y ya alcanzamos el máximo, deshabilitar
    if (!isSelected && field.maxSelections && currentValue.length >= field.maxSelections) {
      return true;
    }
    
    return false;
  }

  isArray(value: any): boolean {
    return Array.isArray(value);
  }

  getMultiselectValue(field: ModalField): any[] {
    const value = this.form?.get(field.key)?.value;
    return Array.isArray(value) ? value : [];
  }

  getMultiselectSelectedValues(field: ModalField): string[] {
    const value = this.getMultiselectValue(field);
    return value.map(v => String(v));
  }

  isOptionSelected(field: ModalField, optionValue: any): boolean {
    const selectedValues = this.getMultiselectSelectedValues(field);
    return selectedValues.includes(String(optionValue));
  }

  isFieldInvalid(field: ModalField): boolean {
    const control = this.form?.get(field.key);
    return !!(control && control.invalid && control.touched);
  }

  stopPropagation(event: Event): void {
    event.stopPropagation();
  }

  onImageUploaded(imageData: string | File, fieldKey: string): void {
    if (this.form) {
      this.form.patchValue({ [fieldKey]: imageData });
    }
  }

  onFileSelected(event: Event, fieldKey: string): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (this.form) {
        this.form.patchValue({ [fieldKey]: file });
      }
    }
  }

  fieldLength(fieldKey: string): number {
    try {
      const val = this.form?.get(fieldKey)?.value || '';
      return typeof val === 'string' ? val.length : 0;
    } catch (e) {
      return 0;
    }
  }

  onTextareaInput(fieldKey: string): void {
    const field = this.config.fields.find(f => f.key === fieldKey);
    const ctrl = this.form?.get(fieldKey);
    if (!ctrl || !field) return;
    const val = ctrl.value || '';
    if (field.maxlength && typeof val === 'string' && val.length > field.maxlength) {
      ctrl.setValue(val.slice(0, field.maxlength));
    }
    // Mark touched/dirty so validations appear
    try { ctrl.markAsTouched(); ctrl.markAsDirty(); } catch (e) { /* ignore */ }
  }

  getProgramUrl(value: any): string {
    if (!value) return '';
    if (typeof value === 'string') {
      // Si ya es una URL completa (de Bunny CDN), usarla directamente
      if (value.startsWith('http://') || value.startsWith('https://')) {
        return value;
      }
      // Si es solo un filename (legacy), construir la URL completa
      return `https://cursala.b-cdn.net/course-programs/${encodeURIComponent(value)}`;
    }
    return '';
  }

  getFileName(value: any): string {
    if (!value) return '';
    if (value instanceof File) {
      return value.name;
    }
    if (typeof value === 'string') {
      // Extraer solo el nombre del archivo sin la ruta
      const urlParts = value.split('/');
      return decodeURIComponent(urlParts[urlParts.length - 1]);
    }
    return '';
  }

  isFile(value: any): boolean {
    return value instanceof File;
  }

  removeFile(fieldKey: string): void {
    if (this.form) {
      this.form.patchValue({ [fieldKey]: null });
      // Resetear el input file
      const fileInput = document.querySelector(`input[type="file"][data-field="${fieldKey}"]`) as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
    }
  }

  getFieldsBySection(): { section: string | null; fields: ModalField[]; sectionIndex?: number }[] {
    if (!this.config?.fields) return [];
    
    const sectionMap = new Map<string | null, ModalField[]>();
    
    // Agrupar campos por sección
    this.config.fields.forEach(field => {
      const section = field.section || null;
      if (!sectionMap.has(section)) {
        sectionMap.set(section, []);
      }
      sectionMap.get(section)!.push(field);
    });
    
    // Convertir a array manteniendo el orden (campos sin sección primero, luego los demás)
    const result: { section: string | null; fields: ModalField[]; sectionIndex?: number }[] = [];
    let sectionNumber = 1;
    
    // Primero los campos sin sección
    if (sectionMap.has(null)) {
      result.push({ section: null, fields: sectionMap.get(null)! });
    }
    
    // Luego los campos con sección
    sectionMap.forEach((fields, section) => {
      if (section !== null) {
        result.push({ section, fields, sectionIndex: sectionNumber++ });
      }
    });
    
    return result;
  }
}
