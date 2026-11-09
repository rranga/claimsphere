import clsx, { type ClassValue } from 'clsx';

/** Compose Tailwind class names conditionally. */
export const cn = (...inputs: ClassValue[]) => clsx(inputs);
