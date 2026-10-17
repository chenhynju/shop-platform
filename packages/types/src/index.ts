export interface User {
  id: number;
  email: string;
  name: string | null;
  createdAt: string;
  role: 'USER' | 'ADMIN';
}
export type ProjectStatus = 'PLANNED' | 'ACTIVE' | 'DONE';
export interface Project {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}
export interface ApiResponse<T> {
  data: T;
}
export interface ApiError {
  error: { code: string; message: string; requestId: string };
}
export interface Health {
  status: 'ok';
  uptime: number;
  timestamp: string;
}
export * from './shop';
