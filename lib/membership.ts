export type MembershipStatus = 'Active' | 'Expired';

export type MembershipPlanOption = {
  value: string;
  label: string;
  months: number;
};

export type StandardMembershipFees = {
  oneMonth?: number;
  threeMonths?: number;
  sixMonths?: number;
  oneYear?: number;
};

export const MEMBERSHIP_PLAN_OPTIONS: MembershipPlanOption[] = [
  { value: '1 Month', label: 'Monthly', months: 1 },
  { value: '3 Months', label: 'Quarterly', months: 3 },
  { value: '6 Months', label: 'Half yearly', months: 6 },
  { value: '1 Year', label: 'Yearly', months: 12 },
];

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseDateOnly(value?: string | null) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
}

export function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addMonthsClamped(date: Date, months: number) {
  const originalDay = date.getDate();
  const targetMonthStart = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDayOfTargetMonth = new Date(targetMonthStart.getFullYear(), targetMonthStart.getMonth() + 1, 0).getDate();
  return new Date(targetMonthStart.getFullYear(), targetMonthStart.getMonth(), Math.min(originalDay, lastDayOfTargetMonth));
}

export function getMembershipPlanMonths(plan?: string | null) {
  const normalized = String(plan || '').trim().toLowerCase();
  const found = MEMBERSHIP_PLAN_OPTIONS.find((option) => option.value.toLowerCase() === normalized || option.label.toLowerCase() === normalized);
  if (found) return found.months;

  if (/annual|year/.test(normalized)) return 12;
  if (/half|six|6/.test(normalized)) return 6;
  if (/quarter|three|3/.test(normalized)) return 3;
  return 1;
}

export function getStandardFeeForPlan(plan: string | null | undefined, standardFees?: StandardMembershipFees | null) {
  if (!standardFees) return 0;
  const months = getMembershipPlanMonths(plan);

  if (months === 12) return Number(standardFees.oneYear || 0);
  if (months === 6) return Number(standardFees.sixMonths || 0);
  if (months === 3) return Number(standardFees.threeMonths || 0);
  return Number(standardFees.oneMonth || 0);
}

export function calculateMembershipEndDate(startDate: string, plan: string) {
  const start = parseDateOnly(startDate) || startOfDay();
  return formatDateOnly(addMonthsClamped(start, getMembershipPlanMonths(plan)));
}

export function daysUntilMembershipEnd(endDate?: string | null, fromDate = new Date()) {
  const expiry = parseDateOnly(endDate);
  if (!expiry) return null;
  return Math.ceil((expiry.getTime() - startOfDay(fromDate).getTime()) / DAY_MS);
}

export function getMembershipStatus(endDate?: string | null, fallback?: string | null): MembershipStatus {
  const days = daysUntilMembershipEnd(endDate);
  if (days === null) return fallback === 'Expired' ? 'Expired' : 'Active';
  return days < 0 ? 'Expired' : 'Active';
}

export function isMembershipExpiringSoon(endDate?: string | null, windowDays = 7) {
  const days = daysUntilMembershipEnd(endDate);
  return days !== null && days >= 0 && days <= windowDays;
}

export function calculateRenewalWindow({
  currentEndDate,
  paymentDate,
  renewalPlan,
}: {
  currentEndDate?: string | null;
  paymentDate: string;
  renewalPlan: string;
}) {
  const paidOn = parseDateOnly(paymentDate) || startOfDay();
  const currentEnd = parseDateOnly(currentEndDate);
  const baseDate = currentEnd && currentEnd.getTime() >= paidOn.getTime() ? currentEnd : paidOn;
  const months = getMembershipPlanMonths(renewalPlan);
  const newEndDate = addMonthsClamped(baseDate, months);

  return {
    months,
    renewalStartDate: formatDateOnly(baseDate),
    newEndDate: formatDateOnly(newEndDate),
  };
}
