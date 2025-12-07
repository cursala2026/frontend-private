import { IUser } from './user.interface';

export interface LoginRequest {
  user: string; // username or email
  password: string;
}

export interface LoginResponse {
  token: string;
  userInfo: IUser;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: IUser | null;
  token: string | null;
}
