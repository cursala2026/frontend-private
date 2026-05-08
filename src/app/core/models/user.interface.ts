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
  // Roles ahora son strings directamente (e.g., 'ADMIN', 'PROFESOR', 'ALUMNO')
  roles: string[];
  features?: IFeature[];
  lastConnection?: Date;
  professionalDescription?: string;
  profilePhotoUrl?: string;
  professionalSignatureUrl?: string;
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
  roles: string[];
  features?: IFeature[];
  lastConnection?: Date;
  professionalDescription?: string;
  profilePhotoUrl?: string;
  professionalSignatureUrl?: string;
  hasCompletedInterestsForm?: boolean;
  interests?: any[];           
  interestSuggestions?: string; 
}