import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class FormSavepointService {
  save(key: string, data: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('Savepoint mock save failed', e);
    }
  }

  load<T = any>(key: string): T | any {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : {};
    } catch (e) {
      return {};
    }
  }

  clear(key: string): void {
    localStorage.removeItem(key);
  }
}