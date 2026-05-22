export type PaymentStatus = 'Fully Paid' | 'Partially Paid' | 'Pending';
export type ReceiptPaymentStatus = PaymentStatus | 'Due Cleared';

export type PaymentPreviewInput = {
  totalFee: number;
  previousPaid: number;
  currentPayment: number;
  previousDue?: number | null;
};

export function toMoney(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed * 100) / 100);
}

export function formatInr(value: unknown) {
  return `INR ${toMoney(value).toLocaleString('en-IN')}`;
}

export function calculatePendingDues(totalFee: unknown, amountPaid: unknown) {
  return toMoney(toMoney(totalFee) - toMoney(amountPaid));
}

export function getPaymentStatus(totalFee: unknown, amountPaid: unknown): PaymentStatus {
  const total = toMoney(totalFee);
  const paid = toMoney(amountPaid);

  if (total > 0 && paid >= total) return 'Fully Paid';
  if (paid > 0) return 'Partially Paid';
  return 'Pending';
}

export function calculatePaymentPreview(input: PaymentPreviewInput) {
  const totalFee = toMoney(input.totalFee);
  const previousPaid = toMoney(input.previousPaid);
  const currentPayment = toMoney(input.currentPayment);
  const previousDue =
    input.previousDue === null || input.previousDue === undefined
      ? calculatePendingDues(totalFee, previousPaid)
      : toMoney(input.previousDue);
  const remainingDue = toMoney(previousDue - currentPayment);
  const totalPaidAfterPayment = toMoney(previousPaid + currentPayment);
  const amountPaidAfterPayment = totalFee > 0 ? Math.min(totalFee, totalPaidAfterPayment) : totalPaidAfterPayment;
  const paymentStatus = getPaymentStatus(totalFee, amountPaidAfterPayment);
  const receiptStatus: ReceiptPaymentStatus =
    previousDue > 0 && currentPayment > 0 && remainingDue === 0 ? 'Due Cleared' : paymentStatus;

  return {
    totalFee,
    previousPaid,
    previousDue,
    currentPayment,
    remainingDue,
    amountPaidAfterPayment,
    paymentStatus,
    receiptStatus,
  };
}

export function isValidTransactionId(transactionId: string) {
  return /^[A-Za-z0-9][A-Za-z0-9._/-]{2,63}$/.test(transactionId.trim());
}

export function getDisplayMemberId(memberId?: string | null) {
  const trimmed = memberId?.trim();
  return trimmed ? trimmed : 'N/A';
}
