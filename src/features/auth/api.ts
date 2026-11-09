import type { Session, User } from '@/shared/api/contracts';
import { http } from '@/shared/api/http';

export const authApi = {
  listDemoUsers: (signal?: AbortSignal) => http<User[]>('/auth/users', { signal }),
  login: (userId: string) => http<Session>('/auth/login', { method: 'POST', body: { userId } }),
  me: (signal?: AbortSignal) => http<Session>('/auth/me', { signal }),
};
