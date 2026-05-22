'use client';

import { useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { calculateMembershipEndDate, getStandardFeeForPlan, MEMBERSHIP_PLAN_OPTIONS, type StandardMembershipFees } from '@/lib/membership';

export type Member = {
  id?: string;
  gym_owner_id: string;
  member_id?: string;
  member_name: string;
  phone: string;
  email?: string;
  membership_plan: string;
  membership_start: string;
  membership_end: string;
  member_upi_id?: string;
  fee: number;
  total_fee?: number;
  amount_paid?: number;
  pending_dues?: number;
  payment_status?: 'Fully Paid' | 'Partially Paid' | 'Pending';
  amuont_paid: number;
  status: string;
  last_renewal_date?: string;
  last_renewal_plan?: string;
  renewal_count?: number;
  recurring_fee?: number;
  current_period_start?: string;
  created_at?: string;
};

export default function MemberModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  standardFees,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (member: Member) => void;
  initialData?: Member | null;
  standardFees?: StandardMembershipFees;
}) {
  const [formData, setFormData] = useState({
    member_id: initialData?.member_id || '',
    member_name: initialData?.member_name || '',
    phone: initialData?.phone || '',
    email: initialData?.email || '',
    member_upi_id: initialData?.member_upi_id || '',
    membership_plan: initialData?.membership_plan || '1 Month',
    membership_start: initialData?.membership_start || new Date().toISOString().split('T')[0],
    fee: initialData?.fee || getStandardFeeForPlan(initialData?.membership_plan || '1 Month', standardFees) || 0,
    amuont_paid: initialData?.amuont_paid || 0,
  });

  const inputClass =
    'w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-emerald-300/60 focus:ring-4 focus:ring-emerald-300/10';
  const labelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-white/48';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    onSave({
      ...initialData,
      member_id: formData.member_id || undefined,
      member_name: formData.member_name,
      phone: formData.phone,
      email: formData.email || undefined,
      member_upi_id: formData.member_upi_id || undefined,
      membership_plan: formData.membership_plan,
      membership_start: formData.membership_start,
      membership_end: calculateMembershipEndDate(formData.membership_start, formData.membership_plan),
      fee: Number(formData.fee),
      total_fee: Number(formData.fee),
      amount_paid: Number(formData.amuont_paid),
      amuont_paid: Number(formData.amuont_paid),
      status: initialData?.status || 'Active',
      gym_owner_id: initialData?.gym_owner_id || '',
    });

    setFormData({
      member_id: '',
      member_name: '',
      phone: '',
      email: '',
      member_upi_id: '',
      membership_plan: '1 Month',
      membership_start: new Date().toISOString().split('T')[0],
      fee: getStandardFeeForPlan('1 Month', standardFees) || 0,
      amuont_paid: 0,
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/72 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 18 }}
            className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0c120e]/95 text-white shadow-2xl shadow-black/50"
          >
            <div className="flex items-center justify-between border-b border-white/10 p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-300 text-emerald-950 shadow-lg shadow-emerald-500/20">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/80">Member</p>
                  <h2 className="text-lg font-semibold tracking-tight text-white">
                    {initialData ? 'Edit member details' : 'New member onboarding'}
                  </h2>
                </div>
              </div>
              <button
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-white/55 transition hover:bg-white/10 hover:text-white"
                aria-label="Close member modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Member ID</label>
                  <input
                    type="text"
                    value={formData.member_id}
                    onChange={(e) => setFormData({ ...formData, member_id: e.target.value })}
                    className={inputClass}
                    placeholder="#GA-1024"
                  />
                </div>
                <div>
                  <label className={labelClass}>Full name</label>
                  <input
                    type="text"
                    required
                    value={formData.member_name}
                    onChange={(e) => setFormData({ ...formData, member_name: e.target.value })}
                    className={inputClass}
                    placeholder="Amit Kumar"
                  />
                </div>
                <div>
                  <label className={labelClass}>Phone number</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className={inputClass}
                    placeholder="9876543210"
                  />
                </div>
                <div>
                  <label className={labelClass}>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={inputClass}
                    placeholder="amit@example.com"
                  />
                </div>
                <div>
                  <label className={labelClass}>UPI ID</label>
                  <input
                    type="text"
                    value={formData.member_upi_id}
                    onChange={(e) => setFormData({ ...formData, member_upi_id: e.target.value })}
                    className={inputClass}
                    placeholder="amit@okaxis"
                  />
                </div>
                <div>
                  <label className={labelClass}>Plan</label>
                  <select
                    value={formData.membership_plan}
                    onChange={(e) => {
                      const membershipPlan = e.target.value;
                      const standardFee = getStandardFeeForPlan(membershipPlan, standardFees);
                      setFormData({
                        ...formData,
                        membership_plan: membershipPlan,
                        fee: standardFee > 0 ? standardFee : formData.fee,
                      });
                    }}
                    className={inputClass}
                  >
                    {MEMBERSHIP_PLAN_OPTIONS.map((plan) => (
                      <option key={plan.value} className="bg-[#0c120e]" value={plan.value}>
                        {plan.value}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Start date</label>
                  <input
                    type="date"
                    required
                    value={formData.membership_start}
                    onChange={(e) => setFormData({ ...formData, membership_start: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Total fee (INR)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.fee}
                    onChange={(e) => setFormData({ ...formData, fee: Number(e.target.value) })}
                    className={inputClass}
                    placeholder="3000"
                  />
                  <p className="mt-1.5 text-xs text-white/38">Prefills from settings when you choose a plan, but you can edit it for offers.</p>
                </div>
                <div>
                  <label className={labelClass}>Amount paid (INR)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.amuont_paid}
                    onChange={(e) => setFormData({ ...formData, amuont_paid: Number(e.target.value) })}
                    className={inputClass}
                    placeholder="1500"
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-2 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/62 transition hover:bg-white/10 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-200"
                >
                  {initialData ? 'Update member' : 'Save member'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
