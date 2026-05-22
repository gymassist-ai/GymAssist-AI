import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  Calendar,
  Check,
  CreditCard,
  Download,
  Dumbbell,
  FileText,
  Hash,
  IndianRupee,
  Mail,
  MessageCircle,
  ShieldCheck,
  User,
  X,
  type LucideIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { calculatePaymentPreview, calculatePendingDues, formatInr, getDisplayMemberId, isValidTransactionId, toMoney } from '@/lib/billing';
import { calculateRenewalWindow, getStandardFeeForPlan, MEMBERSHIP_PLAN_OPTIONS, type StandardMembershipFees } from '@/lib/membership';
import { Member } from './MemberModal';
import jsPDF from 'jspdf';
import Image from 'next/image';

type BillPaymentType = 'payment' | 'renewal';

type BillData = {
  paymentType: BillPaymentType;
  transactionId: string;
  amountReceived: number;
  paymentDate: string;
  memberUpiId: string;
  owner_upi_id: string;
  notes: string;
  gymLogo?: string;
  renewalPlan?: string;
  renewalMonths?: number;
  renewalFee?: number;
  previousMembershipEnd?: string;
  renewalStartDate?: string;
  newMembershipEnd?: string;
  totalFee: number;
  previousTotalFee?: number;
  previousPaid: number;
  previousDue: number;
  payableNow?: number;
  remainingDue: number;
  paymentStatus: string;
  receiptStatus: string;
};

type BillModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (bill: BillData) => void | Promise<void>;
  member: Member | null;
  owner_upi_id: string;
  mode?: BillPaymentType;
  gymName?: string;
  gstNumber?: string;
  standardFees?: StandardMembershipFees;
};

const today = () => new Date().toISOString().split('T')[0];

export default function BillModal({
  isOpen,
  onClose,
  onSave,
  member,
  owner_upi_id: initialOwnerUpiId,
  mode = 'payment',
  gymName = 'GymAssist AI',
  gstNumber = '',
  standardFees,
}: BillModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    transactionId: '',
    amountReceived: 0,
    paymentDate: today(),
    memberUpiId: '',
    owner_upi_id: initialOwnerUpiId || '',
    notes: '',
    gymLogo: '',
    renewalPlan: '1 Month',
    renewalFee: 0,
  });
  const [isGenerated, setIsGenerated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [markDuesCleared, setMarkDuesCleared] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [error, setError] = useState('');

  const isRenewal = mode === 'renewal';

  const totals = useMemo(() => {
    if (!member) {
      return {
        ...calculatePaymentPreview({ totalFee: 0, previousPaid: 0, currentPayment: 0 }),
        previousTotalFee: 0,
        payableNow: 0,
        renewalFee: 0,
        renewalMonths: 1,
        renewalStartDate: today(),
        newMembershipEnd: today(),
      };
    }

    const totalFee = toMoney(member.total_fee ?? member.fee);
    const previousPaid = toMoney(member.amount_paid ?? member.amuont_paid);
    const previousDue = member.pending_dues ?? calculatePendingDues(totalFee, previousPaid);

    if (isRenewal) {
      const renewalFee = toMoney(formData.renewalFee);
      const renewalWindow = calculateRenewalWindow({
        currentEndDate: member.membership_end,
        paymentDate: formData.paymentDate || today(),
        renewalPlan: formData.renewalPlan,
      });
      const nextTotalFee = toMoney(totalFee + renewalFee);
      const payableNow = toMoney(toMoney(previousDue) + renewalFee);
      return {
        ...calculatePaymentPreview({
          totalFee: nextTotalFee,
          previousPaid,
          previousDue: payableNow,
          currentPayment: formData.amountReceived,
        }),
        previousTotalFee: totalFee,
        payableNow,
        renewalFee,
        renewalMonths: renewalWindow.months,
        renewalStartDate: renewalWindow.renewalStartDate,
        newMembershipEnd: renewalWindow.newEndDate,
      };
    }

    const preview = calculatePaymentPreview({
      totalFee,
      previousPaid,
      previousDue,
      currentPayment: formData.amountReceived,
    });
    return {
      ...preview,
      previousTotalFee: totalFee,
      payableNow: preview.previousDue,
      renewalFee: 0,
      renewalMonths: 0,
      renewalStartDate: '',
      newMembershipEnd: '',
    };
  }, [formData.amountReceived, formData.paymentDate, formData.renewalFee, formData.renewalPlan, isRenewal, member]);

  useEffect(() => {
    if (!isOpen || !member) return;

    const totalFee = toMoney(member.total_fee ?? member.fee);
    const previousPaid = toMoney(member.amount_paid ?? member.amuont_paid);
    const previousDue = toMoney(member.pending_dues ?? calculatePendingDues(totalFee, previousPaid));
    const defaultRenewalPlan = MEMBERSHIP_PLAN_OPTIONS.some((plan) => plan.value === member.membership_plan) ? member.membership_plan : '1 Month';
    const defaultRenewalFee = toMoney(member.recurring_fee || getStandardFeeForPlan(defaultRenewalPlan, standardFees) || totalFee || member.fee || 0);

    setFormData({
      transactionId: '',
      amountReceived: isRenewal ? toMoney(previousDue + defaultRenewalFee) : previousDue,
      paymentDate: today(),
      memberUpiId: member.member_upi_id || '',
      owner_upi_id: initialOwnerUpiId || '',
      notes: '',
      gymLogo: '',
      renewalPlan: defaultRenewalPlan,
      renewalFee: defaultRenewalFee,
    });
    setIsGenerated(false);
    setIsSaving(false);
    setMarkDuesCleared(isRenewal || previousDue > 0);
    setShowSaveConfirm(false);
    setLogoPreview(null);
    setError('');
  }, [initialOwnerUpiId, isOpen, isRenewal, member, standardFees]);

  if (!member) return null;

  const actualMemberId = getDisplayMemberId(member.member_id);
  const fieldClass =
    'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm font-medium text-neutral-950 shadow-sm outline-none transition placeholder:text-neutral-500 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-100 disabled:text-neutral-600';
  const labelClass = 'mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-neutral-600';
  const memberSummary: Array<{ label: string; value: string; icon: LucideIcon }> = [
    { label: 'Member ID', value: actualMemberId, icon: Hash },
    { label: 'Current plan', value: member.membership_plan || 'N/A', icon: FileText },
    { label: 'Pending dues', value: formatInr(totals.previousDue), icon: IndianRupee },
    { label: 'Validity', value: `${member.membership_start || 'N/A'} to ${member.membership_end || 'N/A'}`, icon: Calendar },
    ...(isRenewal
      ? [
          { label: 'Renews from', value: totals.renewalStartDate, icon: Calendar },
          { label: 'New expiry', value: totals.newMembershipEnd, icon: BadgeCheck },
        ]
      : []),
  ];
  const isReceiptOnly = !isRenewal && !markDuesCleared;

  const validate = () => {
    if (!isValidTransactionId(formData.transactionId)) {
      return 'Enter a valid transaction ID. Use 3-64 characters: letters, numbers, dot, slash, underscore, or hyphen.';
    }
    if (!formData.paymentDate) return 'Payment date is required.';
    if (!formData.memberUpiId.trim()) return 'Member UPI ID is required.';
    if (totals.currentPayment <= 0) return 'Current payment must be greater than zero.';
    if (isRenewal) {
      if (!formData.renewalPlan) return 'Choose a renewal period.';
      if (totals.renewalFee <= 0) return 'Renewal fee must be greater than zero.';
      if (totals.currentPayment > totals.payableNow) return 'Payment cannot be greater than previous dues plus this renewal fee.';
      return '';
    }
    if (isReceiptOnly) return '';
    if (totals.previousDue <= 0) return 'This member has no pending dues to clear.';
    if (totals.currentPayment > totals.previousDue) return 'Current payment cannot be greater than the remaining dues.';
    return '';
  };

  const handleLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setLogoPreview(result);
      setFormData((current) => ({ ...current, gymLogo: result }));
    };
    reader.readAsDataURL(file);
  };

  const handleMarkCleared = (checked: boolean) => {
    setMarkDuesCleared(checked);
    if (checked) {
      setFormData((current) => ({ ...current, amountReceived: totals.previousDue }));
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setIsGenerated(true);
  };

  const buildBillPayload = (): BillData => ({
    ...formData,
    paymentType: mode,
    amountReceived: totals.currentPayment,
    totalFee: totals.totalFee,
    previousTotalFee: totals.previousTotalFee,
    previousPaid: totals.previousPaid,
    previousDue: totals.previousDue,
    payableNow: totals.payableNow,
    remainingDue: totals.remainingDue,
    paymentStatus: totals.paymentStatus,
    receiptStatus: totals.receiptStatus,
    renewalPlan: isRenewal ? formData.renewalPlan : undefined,
    renewalMonths: isRenewal ? totals.renewalMonths : undefined,
    renewalFee: isRenewal ? totals.renewalFee : undefined,
    previousMembershipEnd: isRenewal ? member.membership_end : undefined,
    renewalStartDate: isRenewal ? totals.renewalStartDate : undefined,
    newMembershipEnd: isRenewal ? totals.newMembershipEnd : undefined,
  });

  const downloadPDF = async () => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 16;
    let y = 18;

    const ensureSpace = (height: number) => {
      if (y + height <= pageHeight - margin) return;
      pdf.addPage();
      y = margin;
    };

    const setText = (color: [number, number, number]) => pdf.setTextColor(color[0], color[1], color[2]);
    const writeLabelValue = (label: string, value: string, x: number, width: number) => {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      setText([115, 115, 115]);
      pdf.text(label.toUpperCase(), x, y);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      setText([24, 24, 27]);
      const lines = pdf.splitTextToSize(value || 'N/A', width);
      pdf.text(lines, x, y + 6);
      return 9 + lines.length * 4;
    };

    const sectionTitle = (title: string) => {
      ensureSpace(18);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      setText([5, 122, 85]);
      pdf.text(title.toUpperCase(), margin, y);
      y += 4;
      pdf.setDrawColor(218, 224, 220);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 8;
    };

    const summaryLine = (label: string, value: string, strong = false) => {
      ensureSpace(9);
      pdf.setFont('helvetica', strong ? 'bold' : 'normal');
      pdf.setFontSize(strong ? 11 : 10);
      setText(strong ? [24, 24, 27] : [82, 82, 91]);
      pdf.text(label, margin + 4, y);
      pdf.setFont('helvetica', 'bold');
      setText(strong ? [5, 122, 85] : [24, 24, 27]);
      pdf.text(value, pageWidth - margin - 4, y, { align: 'right' });
      y += 8;
    };

    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');

    if (logoPreview && /^data:image\/(png|jpeg|jpg|webp);/i.test(logoPreview)) {
      try {
        const format = logoPreview.includes('image/png') ? 'PNG' : logoPreview.includes('image/webp') ? 'WEBP' : 'JPEG';
        pdf.addImage(logoPreview, format, margin, y, 18, 18);
      } catch {
        pdf.setFillColor(12, 18, 14);
        pdf.rect(margin, y, 18, 18, 'F');
      }
    } else {
      pdf.setFillColor(12, 18, 14);
      pdf.rect(margin, y, 18, 18, 'F');
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    setText([5, 122, 85]);
    pdf.text(isRenewal ? 'RENEWAL RECEIPT' : 'OFFICIAL RECEIPT', margin + 24, y + 5);
    pdf.setFontSize(20);
    setText([24, 24, 27]);
    const gymNameLines = pdf.splitTextToSize(gymName || 'GymAssist AI', 102).slice(0, 2);
    pdf.text(gymNameLines, margin + 24, y + 13);
    const headerMetaY = y + 17 + gymNameLines.length * 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    setText([113, 113, 122]);
    pdf.text(isRenewal ? 'Membership Renewal' : 'Gym Membership Bill', margin + 24, headerMetaY);
    if (gstNumber) pdf.text(`GST: ${gstNumber}`, margin + 24, headerMetaY + 5);

    pdf.setFillColor(240, 253, 244);
    pdf.setDrawColor(187, 247, 208);
    pdf.rect(pageWidth - margin - 44, y, 44, 18, 'FD');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    setText([82, 82, 91]);
    pdf.text('STATUS', pageWidth - margin - 22, y + 6, { align: 'center' });
    pdf.setFontSize(10);
    setText([5, 122, 85]);
    pdf.text(isReceiptOnly ? 'Receipt Only' : totals.receiptStatus, pageWidth - margin - 22, y + 13, { align: 'center' });

    y += gstNumber || gymNameLines.length > 1 ? 38 : 30;
    sectionTitle('Member Details');
    const leftX = margin;
    const rightX = pageWidth / 2 + 4;
    const colWidth = pageWidth / 2 - margin - 10;
    const firstRowHeight = Math.max(
      writeLabelValue('Name', member.member_name, leftX, colWidth),
      writeLabelValue('Member ID', actualMemberId, rightX, colWidth),
    );
    y += firstRowHeight;
    const secondRowHeight = Math.max(
      writeLabelValue('Contact', member.phone || 'N/A', leftX, colWidth),
      writeLabelValue('Email', member.email || 'N/A', rightX, colWidth),
    );
    y += secondRowHeight;
    const thirdRowHeight = Math.max(
      writeLabelValue('Plan', member.membership_plan || 'N/A', leftX, colWidth),
      writeLabelValue('Validity', `${member.membership_start || 'N/A'} to ${member.membership_end || 'N/A'}`, rightX, colWidth),
    );
    y += thirdRowHeight + 2;
    if (isRenewal) {
      const renewalRowHeight = Math.max(
        writeLabelValue('Renewal Plan', formData.renewalPlan, leftX, colWidth),
        writeLabelValue('New Validity', `${totals.renewalStartDate} to ${totals.newMembershipEnd}`, rightX, colWidth),
      );
      y += renewalRowHeight + 2;
    }

    sectionTitle('Payment Details');
    const paymentFirstRow = Math.max(
      writeLabelValue('Transaction ID', formData.transactionId, leftX, colWidth),
      writeLabelValue('Payment Date', formData.paymentDate, rightX, colWidth),
    );
    y += paymentFirstRow;
    const paymentSecondRow = Math.max(
      writeLabelValue('Member UPI', formData.memberUpiId, leftX, colWidth),
      writeLabelValue('Gym UPI', formData.owner_upi_id || 'N/A', rightX, colWidth),
    );
    y += paymentSecondRow + 2;
    if (gstNumber) {
      const gstRowHeight = writeLabelValue('Gym GST', gstNumber, leftX, colWidth);
      y += gstRowHeight + 2;
    }

    const summaryBoxHeight = isRenewal ? 74 : 50;
    ensureSpace(summaryBoxHeight + 6);
    pdf.setFillColor(240, 253, 244);
    pdf.setDrawColor(187, 247, 208);
    pdf.rect(margin, y, pageWidth - margin * 2, summaryBoxHeight, 'FD');
    y += 10;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    setText([5, 122, 85]);
    pdf.text('PAYMENT SUMMARY', margin + 4, y);
    y += 10;
    summaryLine(isRenewal ? 'Total Fee After Renewal' : 'Total Membership Fee', formatInr(totals.totalFee));
    if (isRenewal) {
      summaryLine('Previous Total Fee', formatInr(totals.previousTotalFee));
      summaryLine('Renewal Fee', formatInr(totals.renewalFee));
      summaryLine('Payable Now', formatInr(totals.payableNow));
    }
    summaryLine('Previously Paid', formatInr(totals.previousPaid));
    summaryLine('Current Payment', formatInr(totals.currentPayment), true);
    if (totals.remainingDue > 0) summaryLine('Remaining Balance', formatInr(totals.remainingDue));
    y += 8;

    ensureSpace(38);
    pdf.setDrawColor(218, 224, 220);
    pdf.rect(margin, y, pageWidth - margin * 2, 30, 'S');
    y += 9;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    setText([113, 113, 122]);
    pdf.text('PAYMENT STATUS', margin + 4, y);
    y += 7;
    pdf.setFontSize(13);
    setText([24, 24, 27]);
    pdf.text(isReceiptOnly ? 'Receipt Only' : totals.receiptStatus, margin + 4, y);
    y += 8;
    if (isReceiptOnly) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      setText([82, 82, 91]);
      pdf.text('Receipt-only mode. Member dues, amount paid, and payment history were not changed.', margin + 4, y);
      y += 6;
    }

    if (formData.notes) {
      ensureSpace(24);
      sectionTitle('Notes');
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      setText([82, 82, 91]);
      pdf.text(pdf.splitTextToSize(formData.notes, pageWidth - margin * 2), margin, y);
      y += 14;
    }

    pdf.setDrawColor(218, 224, 220);
    pdf.line(margin, pageHeight - 24, pageWidth - margin, pageHeight - 24);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    setText([82, 82, 91]);
    pdf.text(`Payment successfully received by ${gymName || 'the gym'}. Thank you.`, pageWidth / 2, pageHeight - 16, { align: 'center' });

    const safeName = `${member.member_name}_${formData.transactionId}`.replace(/[^a-z0-9_-]+/gi, '_');
    pdf.save(`Receipt_${safeName}.pdf`);
  };

  const sendWhatsApp = () => {
    const gymSignature = `${gymName || 'Your gym'}${gstNumber ? `\nGST: ${gstNumber}` : ''}`;
    const message = isRenewal
      ? `Hi ${member.member_name},\n\n${gymSignature} has received your ${formData.renewalPlan} membership renewal payment of ${formatInr(totals.currentPayment)}.\n\nNew expiry: ${totals.newMembershipEnd}\nRemaining balance: ${formatInr(totals.remainingDue)}\nTransaction ID: ${formData.transactionId}`
      : `Hi ${member.member_name},\n\n${gymSignature} has received your gym payment of ${formatInr(totals.currentPayment)}.\n\nRemaining balance: ${formatInr(totals.remainingDue)}\nTransaction ID: ${formData.transactionId}`;
    window.open(`https://wa.me/${member.phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const sendEmail = () => {
    if (!member.email) return;
    const subject = `${gymName || 'Gym'} - ${isRenewal ? 'Membership Renewal' : 'Membership Receipt'} - ${member.member_name}`;
    const body = isRenewal
      ? `Hi ${member.member_name},\n\n${gymName || 'Your gym'} has received your ${formData.renewalPlan} membership renewal payment of ${formatInr(totals.currentPayment)}.\n\nTransaction ID: ${formData.transactionId}\nNew expiry: ${totals.newMembershipEnd}\nRemaining balance: ${formatInr(totals.remainingDue)}\nStatus: ${totals.receiptStatus}${gstNumber ? `\nGST: ${gstNumber}` : ''}\n\nBest regards,\n${gymName || 'Your gym'}`
      : `Hi ${member.member_name},\n\n${gymName || 'Your gym'} has received your gym payment of ${formatInr(totals.currentPayment)}.\n\nTransaction ID: ${formData.transactionId}\nRemaining balance: ${formatInr(totals.remainingDue)}\nStatus: ${totals.receiptStatus}${gstNumber ? `\nGST: ${gstNumber}` : ''}\n\nBest regards,\n${gymName || 'Your gym'}`;
    window.open(`mailto:${member.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
  };

  const handleFinalize = async () => {
    if (isReceiptOnly) {
      setIsGenerated(false);
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      await onSave(buildBillPayload());
      setShowSaveConfirm(false);
      setIsGenerated(false);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 18 }}
            className="relative flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-white/10 bg-neutral-50 text-neutral-950 shadow-2xl shadow-black/50"
          >
            <div className="flex items-start justify-between border-b border-neutral-200 bg-white px-5 py-4">
              <div className="flex gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-emerald-500 text-white shadow-lg shadow-emerald-500/25">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Billing</p>
                  <h2 className="text-xl font-bold tracking-tight text-neutral-950">
                    {isGenerated ? (isRenewal ? 'Review renewal receipt' : 'Review membership receipt') : isRenewal ? 'Renew membership' : 'Generate membership bill'}
                  </h2>
                  <p className="mt-1 text-sm text-neutral-600">
                    {isRenewal
                      ? 'Extend validity, collect the renewal payment, and keep dues plus history in sync.'
                      : 'Record dues, update member payment status, and generate a clean receipt.'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-lg border border-neutral-200 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950 focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
                aria-label="Close bill modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {!isGenerated ? (
                <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                  <section className="space-y-4">
                    <div className="rounded-lg border border-emerald-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                          <User className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Auto-fetched member</p>
                          <h3 className="mt-1 truncate text-lg font-bold text-neutral-950">{member.member_name}</h3>
                          <p className="mt-1 text-sm text-neutral-600">{member.phone || 'No phone added'}{member.email ? ` - ${member.email}` : ''}</p>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        {memberSummary.map(({ label, value, icon: Icon }) => (
                          <div key={label} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">
                              <Icon className="h-3.5 w-3.5 text-emerald-700" />
                              {label}
                            </div>
                            <p className="mt-1 text-sm font-bold text-neutral-950 break-words">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-500">{isRenewal ? 'Renewal preview' : 'Live dues preview'}</p>
                          <h3 className="mt-1 text-lg font-bold text-neutral-950">{isReceiptOnly ? 'Receipt only' : totals.receiptStatus}</h3>
                        </div>
                        <div className={isReceiptOnly ? 'rounded-lg bg-neutral-100 px-3 py-2 text-sm font-bold text-neutral-700' : 'rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800'}>
                          {formatInr(totals.remainingDue)} left
                        </div>
                      </div>
                      <div className="mt-4 space-y-3">
                        {[
                          [isRenewal ? 'Current total fee' : 'Total membership fee', isRenewal ? totals.previousTotalFee : totals.totalFee],
                          ...(isRenewal ? [['Renewal fee', totals.renewalFee], ['Payable now', totals.payableNow]] : []),
                          ['Previously paid', totals.previousPaid],
                          ['Current payment', totals.currentPayment],
                          ['Remaining balance', totals.remainingDue],
                        ].map(([label, value]) => (
                          <div key={label as string} className="flex items-center justify-between border-b border-neutral-100 pb-2 last:border-0 last:pb-0">
                            <span className="text-sm text-neutral-600">{label as string}</span>
                            <span className="text-sm font-bold text-neutral-950">{formatInr(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>

                  <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className={labelClass} htmlFor="bill-transaction">Transaction ID *</label>
                        <input
                          id="bill-transaction"
                          type="text"
                          required
                          value={formData.transactionId}
                          onChange={(e) => setFormData({ ...formData, transactionId: e.target.value })}
                          className={fieldClass}
                          placeholder="TXN123456"
                        />
                      </div>
                      <div>
                        <label className={labelClass} htmlFor="bill-date">Payment date *</label>
                        <input
                          id="bill-date"
                          type="date"
                          required
                          value={formData.paymentDate}
                          onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                          className={fieldClass}
                        />
                      </div>
                      {isRenewal && (
                        <>
                          <div>
                            <label className={labelClass} htmlFor="bill-renewal-plan">Renewal period *</label>
                            <select
                              id="bill-renewal-plan"
                              required
                              value={formData.renewalPlan}
                              onChange={(e) => {
                                const renewalPlan = e.target.value;
                                const standardFee = getStandardFeeForPlan(renewalPlan, standardFees);
                                const renewalFee = standardFee > 0 ? standardFee : formData.renewalFee;
                                setFormData({
                                  ...formData,
                                  renewalPlan,
                                  renewalFee,
                                  amountReceived: toMoney(totals.previousDue + renewalFee),
                                });
                              }}
                              className={fieldClass}
                            >
                              {MEMBERSHIP_PLAN_OPTIONS.map((plan) => (
                                <option key={plan.value} value={plan.value}>
                                  {plan.label} ({plan.value})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className={labelClass} htmlFor="bill-renewal-fee">Renewal fee *</label>
                            <input
                              id="bill-renewal-fee"
                              type="number"
                              required
                              min="1"
                              value={formData.renewalFee || ''}
                              onChange={(e) => {
                                const renewalFee = Number(e.target.value);
                                const previousDue = totals.previousDue;
                                setFormData((current) => ({
                                  ...current,
                                  renewalFee,
                                  amountReceived: toMoney(previousDue + renewalFee),
                                }));
                              }}
                              className={fieldClass}
                              placeholder="1500"
                            />
                            <p className="mt-1.5 text-xs font-medium text-neutral-500">Defaults from settings for the selected period. Edit it for special offers.</p>
                          </div>
                        </>
                      )}
                      <div>
                        <label className={labelClass} htmlFor="bill-amount">Current payment *</label>
                        <input
                          id="bill-amount"
                          type="number"
                          required
                          min="1"
                          max={(isRenewal ? totals.payableNow : totals.previousDue) || undefined}
                          value={formData.amountReceived || ''}
                          onChange={(e) => {
                            const nextAmount = Number(e.target.value);
                            if (!isRenewal && markDuesCleared && nextAmount !== totals.previousDue) {
                              setMarkDuesCleared(false);
                            }
                            setFormData({ ...formData, amountReceived: nextAmount });
                          }}
                          className={fieldClass}
                          placeholder="200"
                        />
                      </div>
                      <div>
                        <label className={labelClass} htmlFor="bill-member-upi">Member UPI ID *</label>
                        <input
                          id="bill-member-upi"
                          type="text"
                          required
                          value={formData.memberUpiId}
                          onChange={(e) => setFormData({ ...formData, memberUpiId: e.target.value })}
                          className={fieldClass}
                          placeholder="member@okaxis"
                        />
                      </div>
                      <div>
                        <label className={labelClass} htmlFor="bill-owner-upi">Gym owner UPI</label>
                        <input
                          id="bill-owner-upi"
                          type="text"
                          value={formData.owner_upi_id}
                          onChange={(e) => setFormData({ ...formData, owner_upi_id: e.target.value })}
                          className={fieldClass}
                          placeholder="owner@okaxis"
                        />
                      </div>
                      <div>
                        <label className={labelClass} htmlFor="bill-logo">Gym logo</label>
                        <input
                          id="bill-logo"
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-emerald-800 hover:file:bg-emerald-100 focus:outline-none focus:ring-4 focus:ring-emerald-500/15"
                        />
                      </div>
                    </div>

                    {isRenewal ? (
                      <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-neutral-900">
                        <span className="block text-sm font-bold">Membership extends to {totals.newMembershipEnd}</span>
                        <span className="mt-1 block text-sm text-neutral-600">
                          Renewal starts from {totals.renewalStartDate}. Existing pending dues are carried forward into this payment.
                        </span>
                      </div>
                    ) : (
                      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-neutral-900">
                        <input
                          type="checkbox"
                          checked={markDuesCleared}
                          onChange={(e) => handleMarkCleared(e.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>
                          <span className="block text-sm font-bold">Mark pending dues as cleared</span>
                          <span className="mt-1 block text-sm text-neutral-600">
                            {markDuesCleared
                              ? 'Sets current payment to the exact remaining due and updates the member after saving.'
                              : 'Unchecked mode generates a receipt only. No member dues or payment history will be changed.'}
                          </span>
                        </span>
                      </label>
                    )}

                    <div className="mt-5">
                      <label className={labelClass} htmlFor="bill-notes">Notes</label>
                      <textarea
                        id="bill-notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        className={`${fieldClass} min-h-24 resize-none`}
                        placeholder="Dues cleared for May membership"
                      />
                    </div>

                    {error && (
                      <div className="mt-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        {error}
                      </div>
                    )}

                    <div className="mt-6 flex flex-col-reverse gap-2 border-t border-neutral-200 pt-5 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-bold text-neutral-700 transition hover:bg-neutral-100 focus:outline-none focus:ring-4 focus:ring-emerald-500/15"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/25"
                      >
                        <FileText className="h-4 w-4" />
                        {isRenewal ? 'Preview renewal receipt' : 'Preview receipt'}
                      </button>
                    </div>
                  </section>
                </form>
              ) : (
                <div className="space-y-5">
                  <div
                    ref={receiptRef}
                    className="mx-auto w-full max-w-[760px] bg-white p-5 text-neutral-950 shadow-sm sm:p-8"
                    style={{ minHeight: '900px' }}
                  >
                    <div className="flex flex-col gap-5 border-b border-neutral-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4">
                        {logoPreview ? (
                          <Image src={logoPreview} alt="Gym logo" width={64} height={64} unoptimized className="h-16 w-16 rounded-lg border border-neutral-200 object-contain p-1" />
                        ) : (
                          <div className="grid h-16 w-16 place-items-center rounded-lg bg-[#0c120e] text-emerald-300">
                            <Dumbbell className="h-8 w-8" />
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">{isRenewal ? 'Renewal receipt' : 'Official receipt'}</p>
                          <h1 className="mt-1 text-2xl font-black tracking-tight text-neutral-950">{gymName || 'GymAssist AI'}</h1>
                          <p className="mt-1 text-sm font-bold text-neutral-700">{isRenewal ? 'Membership Renewal' : 'Gym Membership Bill'}</p>
                          {gstNumber && <p className="mt-0.5 text-xs font-semibold text-neutral-500">GST: {gstNumber}</p>}
                        </div>
                      </div>
                      <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-left sm:text-right">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-500">Status</p>
                        <p className="mt-1 text-lg font-black text-emerald-700">{isReceiptOnly ? 'Receipt Only' : totals.receiptStatus}</p>
                      </div>
                    </div>

                    <div className="mt-7 grid gap-5 sm:grid-cols-2">
                      <section>
                        <h2 className="text-xs font-black uppercase tracking-[0.18em] text-neutral-500">Member Details</h2>
                        <div className="mt-3 grid gap-3 rounded-lg border border-neutral-200 p-4">
                          {[
                            ['Name', member.member_name],
                            ['Member ID', actualMemberId],
                            ['Contact', member.phone || 'N/A'],
                            ['Email', member.email || 'N/A'],
                            ['Plan', member.membership_plan || 'N/A'],
                            ['Validity', `${member.membership_start || 'N/A'} to ${member.membership_end || 'N/A'}`],
                            ...(isRenewal
                              ? [
                                  ['Renewal plan', formData.renewalPlan],
                                  ['New validity', `${totals.renewalStartDate} to ${totals.newMembershipEnd}`],
                                ]
                              : []),
                          ].map(([label, value]) => (
                            <div key={label} className="grid grid-cols-[110px_1fr] gap-3">
                              <p className="text-xs font-bold uppercase tracking-[0.1em] text-neutral-400">{label}</p>
                              <p className="break-words text-sm font-bold text-neutral-900">{value}</p>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section>
                        <h2 className="text-xs font-black uppercase tracking-[0.18em] text-neutral-500">Payment Details</h2>
                        <div className="mt-3 grid gap-3 rounded-lg border border-neutral-200 p-4">
                          {[
                            ['Transaction ID', formData.transactionId],
                            ['Payment date', formData.paymentDate],
                            ['Member UPI', formData.memberUpiId],
                            ['Gym UPI', formData.owner_upi_id || 'N/A'],
                            ...(gstNumber ? [['Gym GST', gstNumber]] : []),
                          ].map(([label, value]) => (
                            <div key={label} className="grid grid-cols-[110px_1fr] gap-3">
                              <p className="text-xs font-bold uppercase tracking-[0.1em] text-neutral-400">{label}</p>
                              <p className="break-words text-sm font-bold text-neutral-900">{value}</p>
                            </div>
                          ))}
                        </div>
                      </section>
                    </div>

                    <section className="mt-7 rounded-lg border border-emerald-200 bg-emerald-50 p-5">
                      <h2 className="text-xs font-black uppercase tracking-[0.18em] text-emerald-800">Payment Summary</h2>
                      <div className="mt-4 space-y-3">
                        <ReceiptLine label={isRenewal ? 'Total Fee After Renewal' : 'Total Membership Fee'} value={formatInr(totals.totalFee)} />
                        {isRenewal && <ReceiptLine label="Renewal Fee" value={formatInr(totals.renewalFee)} />}
                        {isRenewal && <ReceiptLine label="Payable Now" value={formatInr(totals.payableNow)} />}
                        {totals.previousPaid >= 0 && <ReceiptLine label="Previously Paid" value={formatInr(totals.previousPaid)} />}
                        <ReceiptLine label="Current Payment" value={formatInr(totals.currentPayment)} strong />
                        {totals.remainingDue > 0 && <ReceiptLine label="Remaining Balance" value={formatInr(totals.remainingDue)} />}
                      </div>
                    </section>

                    <section className="mt-7 rounded-lg border border-neutral-200 p-5">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
                          <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-neutral-500">Payment Status</p>
                          <p className="mt-1 text-lg font-black text-neutral-950">{isReceiptOnly ? 'Receipt Only' : totals.receiptStatus}</p>
                        </div>
                      </div>
                      {isReceiptOnly && (
                        <p className="mt-4 rounded-lg bg-neutral-50 p-3 text-sm font-medium text-neutral-700">
                          Receipt-only mode. This bill will not update member dues, amount paid, or payment history.
                        </p>
                      )}
                      {formData.notes && <p className="mt-4 rounded-lg bg-neutral-50 p-3 text-sm font-medium text-neutral-700">{formData.notes}</p>}
                    </section>

                    <div className="mt-10 border-t border-neutral-200 pt-5 text-center text-xs font-semibold text-neutral-500">
                      Payment successfully received by {gymName || 'the gym'}. Thank you.
                    </div>
                  </div>

                  <div className="mx-auto grid w-full max-w-[760px] gap-3 sm:grid-cols-3">
                    <button onClick={downloadPDF} className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-black">
                      <Download className="h-4 w-4" />
                      Download PDF
                    </button>
                    <button onClick={sendWhatsApp} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700">
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </button>
                    <button onClick={sendEmail} disabled={!member.email} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-neutral-300">
                      <Mail className="h-4 w-4" />
                      Email
                    </button>
                  </div>

                  <div className="mx-auto flex w-full max-w-[760px] flex-col-reverse gap-2 border-t border-neutral-200 pt-5 sm:flex-row sm:justify-between">
                    <button onClick={() => setIsGenerated(false)} className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-bold text-neutral-700 transition hover:bg-neutral-100">
                      Back to edit
                    </button>
                    <button onClick={isReceiptOnly ? handleFinalize : () => setShowSaveConfirm(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700">
                      {isReceiptOnly ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                      {isReceiptOnly ? 'Done' : isRenewal ? 'Confirm & renew' : 'Confirm & save payment'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <AnimatePresence>
              {showSaveConfirm && (
                <div className="absolute inset-0 z-10 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 10 }}
                    className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl"
                    role="dialog"
                    aria-modal="true"
                  >
                    <div className="flex items-start gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                        <BadgeCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-neutral-950">{isRenewal ? 'Renew this membership?' : 'Record this payment?'}</h3>
                        <p className="mt-1 text-sm leading-6 text-neutral-600">
                          {isRenewal
                            ? `This will add transaction ${formData.transactionId}, extend ${member.member_name}'s membership to ${totals.newMembershipEnd}, and set remaining dues to ${formatInr(totals.remainingDue)}.`
                            : `This will add transaction ${formData.transactionId}, update ${member.member_name}'s paid amount, and set remaining dues to ${formatInr(totals.remainingDue)}.`}
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={() => setShowSaveConfirm(false)}
                        className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-bold text-neutral-700 transition hover:bg-neutral-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleFinalize}
                        disabled={isSaving}
                        className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:bg-emerald-400"
                      >
                        {isSaving ? 'Saving...' : 'Yes, record payment'}
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function ReceiptLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-emerald-200/70 pb-2 last:border-0 last:pb-0">
      <span className={strong ? 'text-sm font-black text-neutral-950' : 'text-sm font-semibold text-neutral-700'}>{label}</span>
      <span className={strong ? 'text-lg font-black text-emerald-700' : 'text-sm font-black text-neutral-950'}>{value}</span>
    </div>
  );
}
