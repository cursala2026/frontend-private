export interface IRole {
  _id: string;
  name: string;
  description: string;
  code: string;
}

export interface IFeature {
  name: string;
}

export interface IUser {
  _id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  birthDate?: Date;
  dni?: string;
  status: string;
  // Puede ser un array de objetos IRole (antes) o un array de códigos de role (string) que ahora devuelve el backend
  roles: Array<IRole | string>;
  features: IFeature[];
  lastConnection?: Date;
  professionalDescription?: string;
  profilePhotoUrl?: string;
  professionalSignatureUrl?: string;
}
