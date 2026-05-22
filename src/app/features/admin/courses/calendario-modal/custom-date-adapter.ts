import { NativeDateAdapter } from '@angular/material/core';
import { Injectable } from '@angular/core';

/**
 * CustomDateAdapter
 *
 * Bug 3 fix: En el locale 'es', Angular abrevia Miércoles como 'X'
 * (tradición española). Se sobrescribe getDayOfWeekNames para usar
 * abreviaciones de 2 letras en español latinoamericano.
 *
 * Bug visual: getFirstDayOfWeek = 1 (Lunes) para que la semana
 * empiece en Lunes tal como muestra la imagen de referencia.
 */
@Injectable()
export class CustomDateAdapter extends NativeDateAdapter {

  /** Primer día de la semana: 1 = Lunes */
  override getFirstDayOfWeek(): number {
    return 1;
  }

  override getDayOfWeekNames(style: 'long' | 'short' | 'narrow'): string[] {
    // IMPORTANTE: retornar en orden natural Do=0, Lu=1, ... Sá=6
    // Angular Material aplica getFirstDayOfWeek() por separado para rotar la grilla.
    if (style === 'narrow') {
      // Bug 3 fix: 'Mi' para Miércoles en lugar de 'X'
      return ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];
    }
    if (style === 'short') {
      return ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    }
    return ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  }
}
