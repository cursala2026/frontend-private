import { Component, OnDestroy, signal, WritableSignal } from '@angular/core';

import { InfoService, InfoMessage } from '../../../core/services/info.service';
import { Subscription, timer } from 'rxjs';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [],
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.css']
})
export class ToastComponent implements OnDestroy {
  message: WritableSignal<InfoMessage | null> = signal(null);
  private sub?: Subscription;
  private timeoutSub?: Subscription;

  constructor(private info: InfoService) {
    this.sub = this.info.messages.subscribe(msg => {
      if (!msg) return;
      this.message.set(msg);
      // reset any previous timeout
      this.timeoutSub?.unsubscribe();
      if (msg.timeout && msg.timeout > 0) {
        this.timeoutSub = timer(msg.timeout).subscribe(() => this.message.set(null));
      }
    });
  }

  dismiss() {
    this.timeoutSub?.unsubscribe();
    this.message.set(null);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.timeoutSub?.unsubscribe();
  }
}
