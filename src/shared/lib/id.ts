/** RFC 4122 v4 id — used for client-generated entity ids and idempotency keys. */
export const createId = (prefix = ''): string => `${prefix}${crypto.randomUUID()}`;
