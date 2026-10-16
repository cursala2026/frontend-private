export const ATTACHMENT_MAX_BYTES = 50 * 1024 * 1024;

export const ALLOWED_ATTACHMENT_EXTENSIONS = ['pdf', 'zip'] as const;

const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
];

export interface AttachmentCandidate {
  name: string;
  size: number;
  type?: string;
}

export function validateAttachment(file: AttachmentCandidate): string | null {
  const dotIndex = file.name.lastIndexOf('.');
  const extension = dotIndex >= 0 ? file.name.slice(dotIndex + 1).toLowerCase() : '';

  if (!(ALLOWED_ATTACHMENT_EXTENSIONS as readonly string[]).includes(extension)) {
    return 'Formato no permitido. Solo se aceptan archivos PDF o ZIP.';
  }

  if (file.type && !ALLOWED_ATTACHMENT_MIME_TYPES.includes(file.type)) {
    return 'El tipo de archivo no coincide con PDF o ZIP.';
  }

  if (file.size <= 0) {
    return 'El archivo está vacío.';
  }

  if (file.size > ATTACHMENT_MAX_BYTES) {
    return 'El archivo supera el máximo permitido de 50 MB.';
  }

  return null;
}

export function moveItem<T>(list: readonly T[], previousIndex: number, currentIndex: number): T[] {
  const result = [...list];
  if (
    previousIndex === currentIndex ||
    previousIndex < 0 ||
    previousIndex >= result.length ||
    currentIndex < 0 ||
    currentIndex >= result.length
  ) {
    return result;
  }
  const [moved] = result.splice(previousIndex, 1);
  result.splice(currentIndex, 0, moved);
  return result;
}

const BUNNY_EMBED_PATTERN = /^https:\/\/(iframe\.mediadelivery\.net\/(embed|play)\/[\w-]+\/[\w-]+|vz-[\w-]+\.b-cdn\.net\/[\w-]+)(\/[\w./?=&-]*)?$/i;

export function isBunnyEmbedUrl(url: string | null | undefined): boolean {
  return !!url && BUNNY_EMBED_PATTERN.test(url.trim());
}

export function isValidVideoUrl(url: string | null | undefined): boolean {
  if (!url || !url.trim()) return true;
  try {
    return new URL(url.trim()).protocol === 'https:';
  } catch {
    return false;
  }
}
