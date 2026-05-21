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
  birthDate?: Date | string;
  dni?: string;
  status: string;
  // Roles ahora son strings directamente (e.g., 'ADMIN', 'PROFESOR', 'ALUMNO')
  roles: string[];
  features?: IFeature[];
  lastConnection?: Date | string;
  professionalDescription?: string;
  profilePhotoUrl?: string;
  professionalSignatureUrl?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  hasCompletedInterestsForm?: boolean;
  interests?: any[];           
  interestSuggestions?: string; 
}