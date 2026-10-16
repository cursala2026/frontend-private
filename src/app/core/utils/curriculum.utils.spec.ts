import { describe, it, expect } from 'vitest';
import {
  ATTACHMENT_MAX_BYTES,
  isBunnyEmbedUrl,
  isValidVideoUrl,
  moveItem,
  validateAttachment,
} from './curriculum.utils';

describe('validateAttachment', () => {
  it('acepta un PDF dentro del límite', () => {
    expect(validateAttachment({ name: 'guia.pdf', size: 1024, type: 'application/pdf' })).toBeNull();
  });

  it('acepta un ZIP sin tipo MIME informado', () => {
    expect(validateAttachment({ name: 'Material.ZIP', size: 2048, type: '' })).toBeNull();
  });

  it('rechaza extensiones no permitidas', () => {
    expect(validateAttachment({ name: 'virus.exe', size: 10, type: 'application/x-msdownload' })).toBe(
      'Formato no permitido. Solo se aceptan archivos PDF o ZIP.'
    );
  });

  it('rechaza un archivo sin extensión', () => {
    expect(validateAttachment({ name: 'pdf', size: 10 })).not.toBeNull();
  });

  it('rechaza cuando el tipo MIME no coincide con la extensión', () => {
    expect(validateAttachment({ name: 'guia.pdf', size: 10, type: 'image/png' })).toBe(
      'El tipo de archivo no coincide con PDF o ZIP.'
    );
  });

  it('rechaza archivos mayores a 50 MB', () => {
    expect(
      validateAttachment({ name: 'grande.zip', size: ATTACHMENT_MAX_BYTES + 1, type: 'application/zip' })
    ).toBe('El archivo supera el máximo permitido de 50 MB.');
  });

  it('acepta exactamente 50 MB', () => {
    expect(
      validateAttachment({ name: 'limite.pdf', size: ATTACHMENT_MAX_BYTES, type: 'application/pdf' })
    ).toBeNull();
  });

  it('rechaza archivos vacíos', () => {
    expect(validateAttachment({ name: 'vacio.pdf', size: 0, type: 'application/pdf' })).toBe(
      'El archivo está vacío.'
    );
  });
});

describe('moveItem', () => {
  it('mueve un elemento hacia adelante', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
  });

  it('mueve un elemento hacia atrás', () => {
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });

  it('no altera la lista original', () => {
    const original = ['a', 'b', 'c'];
    moveItem(original, 0, 1);
    expect(original).toEqual(['a', 'b', 'c']);
  });

  it('devuelve una copia igual cuando el índice no cambia', () => {
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });

  it('ignora índices fuera de rango', () => {
    expect(moveItem(['a', 'b'], 0, 5)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], -1, 0)).toEqual(['a', 'b']);
  });
});

describe('isBunnyEmbedUrl', () => {
  it('reconoce embeds de Bunny Stream', () => {
    expect(isBunnyEmbedUrl('https://iframe.mediadelivery.net/embed/12345/abcd-efgh')).toBe(true);
    expect(isBunnyEmbedUrl('https://vz-1234-abc.b-cdn.net/abcd-efgh')).toBe(true);
  });

  it('rechaza URLs que no son de Bunny Stream', () => {
    expect(isBunnyEmbedUrl('https://www.youtube.com/watch?v=abc')).toBe(false);
    expect(isBunnyEmbedUrl('http://iframe.mediadelivery.net/embed/1/2')).toBe(false);
    expect(isBunnyEmbedUrl('')).toBe(false);
    expect(isBunnyEmbedUrl(null)).toBe(false);
  });
});

describe('isValidVideoUrl', () => {
  it('acepta vacío y https', () => {
    expect(isValidVideoUrl('')).toBe(true);
    expect(isValidVideoUrl('https://cursala.b-cdn.net/courses/1/videos/x.mp4')).toBe(true);
  });

  it('rechaza http y texto que no es URL', () => {
    expect(isValidVideoUrl('http://cursala.b-cdn.net/x.mp4')).toBe(false);
    expect(isValidVideoUrl('no es una url')).toBe(false);
  });
});
