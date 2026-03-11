import { useState } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
  amuont_paid: number;
  status: string;
  created_at?: string;
};

export default function MemberModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (member: Member) => void;
  initialData?: Member | null;
}) {
  const [formData, setFormData] = useState({
    member_id: initialData?.member_id || '',
    member_name: initialData?.member_name || '',
    phone: initialData?.phone || '',
    email: initialData?.email || '',
    member_upi_id: initialData?.member_upi_id || '',
    membership_plan: initialData?.membership_plan || '1 Month',
    membership_start: initialData?.membership_start || new Date().toISOString().split('T')[0],
    fee: initialData?.fee || 0,
    amuont_paid: initialData?.amuont_paid || 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Calculate end date
    const startDate = new Date(formData.membership_start);
    let endDate = new Date(startDate);
    if (formData.membership_plan === '1 Month') endDate.setMonth(endDate.getMonth() + 1);
    else if (formData.membership_plan === '3 Months') endDate.setMonth(endDate.getMonth() + 3);
    else if (formData.membership_plan === '6 Months') endDate.setMonth(endDate.getMonth() + 6);
    else if (formData.membership_plan === '1 Year') endDate.setFullYear(endDate.getFullYear() + 1);

    onSave({
      ...initialData,
      member_id: formData.member_id || undefined,
      member_name: formData.member_name,
      phone: formData.phone,
      email: formData.email || undefined,
      member_upi_id: formData.member_upi_id || undefined,
      membership_plan: formData.membership_plan,
      membership_start: formData.membership_start,
      membership_end: endDate.toISOString().split('T')[0],
      fee: Number(formData.fee),
      amuont_paid: Number(formData.amuont_paid),
      status: initialData?.status || 'Active',
      gym_owner_id: initialData?.gym_owner_id || '', // Will be set by API/Chat
    });
    
    setFormData({
      member_id: '',
      member_name: '',
      phone: '',
      email: '',
      member_upi_id: '',
      membership_plan: '1 Month',
      membership_start: new Date().toISOString().split('T')[0],
      fee: 0,
      amuont_paid: 0,
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-0">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-neutral-100">
              <h2 className="text-lg font-semibold text-neutral-900">
                {initialData ? 'Edit Member Details' : 'New Member Onboarding'}
              </h2>
              <button
                onClick={onClose}
                className="p-1 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Member ID (Optional)</label>
                  <input
                    type="text"
                    value={formData.member_id || ''}
                    onChange={(e) => setFormData({ ...formData, member_id: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                    placeholder="e.g. #ROH001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.member_name}
                    onChange={(e) => setFormData({ ...formData, member_name: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                    placeholder="e.g. Amit Kumar"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                  placeholder="e.g. 9876543210"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                    placeholder="e.g. amit@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">UPI ID (Optional)</label>
                  <input
                    type="text"
                    value={formData.member_upi_id}
                    onChange={(e) => setFormData({ ...formData, member_upi_id: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                    placeholder="e.g. amit@okaxis"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Plan</label>
                  <select
                    value={formData.membership_plan}
                    onChange={(e) => setFormData({ ...formData, membership_plan: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm bg-white"
                  >
                    <option value="1 Month">1 Month</option>
                    <option value="3 Months">3 Months</option>
                    <option value="6 Months">6 Months</option>
                    <option value="1 Year">1 Year</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={formData.membership_start}
                    onChange={(e) => setFormData({ ...formData, membership_start: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Total Fee (₹)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.fee}
                    onChange={(e) => setFormData({ ...formData, fee: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                    placeholder="e.g. 3000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Amount Paid (₹)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.amuont_paid}
                    onChange={(e) => setFormData({ ...formData, amuont_paid: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                    placeholder="e.g. 1500"
                  />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm"
                >
                  {initialData ? 'Update Member' : 'Save Member'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
