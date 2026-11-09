import type { CLAIM_CHANNELS } from '@/shared/api/contracts';
import { LINES_OF_BUSINESS, type ClaimPriority, type ClaimStatus, type Region } from '@/shared/api/contracts';
import { createRandom } from './random';
import { USERS } from './users';

/** Server-side record (no per-user fields such as `allowedActions`). */
export interface ClaimRecord {
  id: string;
  index: number;
  claimNumber: string;
  policyNumber: string;
  claimant: string;
  lineOfBusiness: (typeof LINES_OF_BUSINESS)[number];
  channel: (typeof CLAIM_CHANNELS)[number];
  status: ClaimStatus;
  priority: ClaimPriority;
  riskScore: number;
  amount: number;
  region: Region;
  lossDate: string;
  receivedAt: string;
  assigneeId: string | null;
  version: number;
}

const FIRST = [
  'Jane',
  'Floyd',
  'Ronald',
  'Marvin',
  'Jerome',
  'Kathryn',
  'Jacob',
  'Kristin',
  'Amara',
  'Lukas',
  'Mei',
  'Omar',
  'Elena',
  'Ravi',
  'Sophie',
  'Noah',
  'Ines',
  'Kenji',
  'Zara',
  'Mateo',
];
const LAST = [
  'Cooper',
  'Miles',
  'Richards',
  'McKinney',
  'Bell',
  'Murphy',
  'Jones',
  'Watson',
  'Okoye',
  'Fischer',
  'Chen',
  'Haddad',
  'Rossi',
  'Iyer',
  'Laurent',
  'Kim',
  'Silva',
  'Sato',
  'Ahmed',
  'Garcia',
];
const COMPANIES = [
  'Northwind Logistics',
  'Contoso Marine',
  'Fabrikam Foods',
  'Tailspin Air',
  'Litware Health',
  'Adatum Energy',
  'Proseware Retail',
];
const REGIONS: Region[] = ['EMEA', 'AMER', 'APAC'];

const STATUS_WEIGHTS: (readonly [ClaimStatus, number])[] = [
  ['New', 18],
  ['In Review', 30],
  ['Pending Info', 17],
  ['Approved', 15],
  ['Rejected', 8],
  ['Closed', 12],
];
const PRIORITY_WEIGHTS: (readonly [ClaimPriority, number])[] = [
  ['Low', 30],
  ['Medium', 40],
  ['High', 22],
  ['Critical', 8],
];
const RISK_BASE: Record<ClaimPriority, number> = { Low: 5, Medium: 30, High: 55, Critical: 78 };

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 9);

export const CLAIM_COUNT = 25_000;

export function generateClaims(count = CLAIM_COUNT): ClaimRecord[] {
  const rnd = createRandom(20_261_109);
  const adjustersByRegion = new Map<Region, string[]>(
    REGIONS.map((r) => [r, USERS.filter((u) => u.role === 'adjuster' && u.region === r).map((u) => u.id)]),
  );

  return Array.from({ length: count }, (_, index) => {
    const region = rnd.weighted([
      ['EMEA', 45],
      ['AMER', 35],
      ['APAC', 20],
    ] as const);
    const priority = rnd.weighted(PRIORITY_WEIGHTS);
    const status = rnd.weighted(STATUS_WEIGHTS);
    const receivedAt = NOW - rnd.int(0, 365) * DAY - rnd.int(0, DAY);
    const isCompany = rnd.next() < 0.3;
    const adjusters = adjustersByRegion.get(region) ?? [];
    const assigneeId =
      status === 'New' && rnd.next() < 0.6 ? null : rnd.next() < 0.85 ? rnd.pick(adjusters) : null;

    return {
      id: `c-${(index + 1).toString().padStart(5, '0')}`,
      index,
      claimNumber: `CLM-${2025 + (receivedAt > NOW - 300 * DAY ? 1 : 0)}-${(100_000 + index).toString()}`,
      policyNumber: `POL-${rnd.int(1_000_000, 9_999_999)}`,
      claimant: isCompany ? rnd.pick(COMPANIES) : `${rnd.pick(FIRST)} ${rnd.pick(LAST)}`,
      lineOfBusiness: rnd.pick(LINES_OF_BUSINESS),
      channel: rnd.weighted([
        ['Email', 35],
        ['SFTP', 25],
        ['Portal', 28],
        ['API', 12],
      ] as const),
      status,
      priority,
      riskScore: Math.min(99, RISK_BASE[priority] + rnd.int(0, 21)),
      amount: Math.round(Math.exp(7 + rnd.next() * 6.5) / 10) * 10,
      region,
      lossDate: new Date(receivedAt - rnd.int(1, 60) * DAY).toISOString(),
      receivedAt: new Date(receivedAt).toISOString(),
      assigneeId,
      version: 1,
    };
  });
}
