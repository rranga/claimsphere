import type { User } from '@/shared/api/contracts';

/** Demo identities. The first four can sign in; all adjusters can be assigned claims. */
export const USERS: User[] = [
  {
    id: 'u-evano',
    name: 'Evano Morales',
    title: 'Claims Adjuster',
    role: 'adjuster',
    region: 'EMEA',
    avatarColor: '#5932EA',
  },
  {
    id: 'u-priya',
    name: 'Priya Raman',
    title: 'Claims Supervisor',
    role: 'supervisor',
    region: 'EMEA',
    avatarColor: '#0E9F6E',
  },
  {
    id: 'u-marcus',
    name: 'Marcus Lee',
    title: 'Claims Auditor',
    role: 'viewer',
    region: 'AMER',
    avatarColor: '#D97706',
  },
  {
    id: 'u-sofia',
    name: 'Sofia Alvarez',
    title: 'Platform Admin',
    role: 'admin',
    region: 'AMER',
    avatarColor: '#DC2626',
  },
  {
    id: 'u-jonas',
    name: 'Jonas Becker',
    title: 'Claims Adjuster',
    role: 'adjuster',
    region: 'EMEA',
    avatarColor: '#2563EB',
  },
  {
    id: 'u-hannah',
    name: 'Hannah Schmidt',
    title: 'Claims Adjuster',
    role: 'adjuster',
    region: 'EMEA',
    avatarColor: '#7C3AED',
  },
  {
    id: 'u-daniel',
    name: 'Daniel Okafor',
    title: 'Claims Adjuster',
    role: 'adjuster',
    region: 'AMER',
    avatarColor: '#0891B2',
  },
  {
    id: 'u-aiko',
    name: 'Aiko Tanaka',
    title: 'Claims Adjuster',
    role: 'adjuster',
    region: 'APAC',
    avatarColor: '#DB2777',
  },
];

export const SIGN_IN_USER_IDS = ['u-evano', 'u-priya', 'u-marcus', 'u-sofia'];

export const findUser = (id: string | null | undefined) => USERS.find((u) => u.id === id);
