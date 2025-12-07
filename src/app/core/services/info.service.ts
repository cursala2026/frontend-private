import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type InfoType = 'success' | 'error' | 'info';

export interface InfoMessage {
  id: number;
  type: InfoType;
  text: string;
  timeout?: number;
}

@Injectable({ providedIn: 'root' })
export class InfoService {
  private counter = 1;
  private messages$ = new BehaviorSubject<InfoMessage | null>(null);

  get messages(): Observable<InfoMessage | null> {
    return this.messages$.asObservable();
  }

  show(text: string, type: InfoType = 'info', timeout = 4000) {
    const msg: InfoMessage = { id: this.counter++, type, text, timeout };
    this.messages$.next(msg);
    return msg;
  }

  showSuccess(text: string, timeout = 4000) {
    return this.show(text, 'success', timeout);
  }

  showError(text: string, timeout = 6000) {
    return this.show(text, 'error', timeout);
  }

  showInfo(text: string, timeout = 4000) {
    return this.show(text, 'info', timeout);
  }
}
