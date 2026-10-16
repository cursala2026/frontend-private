export interface IAttachment {
  title: string;
  fileUrl: string;
  fileType: string;
}

export interface ILesson {
  _id: string;
  title: string;
  order: number;
  description?: string;
  videoUrl?: string;
  durationSeconds?: number;
  attachments: IAttachment[];
  isFreePreview: boolean;
}

export interface IModule {
  _id: string;
  title: string;
  order: number;
  lessons: ILesson[];
}

export type ReorderType = 'MODULES' | 'LESSONS';

export interface LessonUpdatePayload {
  title?: string;
  description?: string;
  isFreePreview?: boolean;
  videoUrl?: string;
  attachments?: IAttachment[];
}
