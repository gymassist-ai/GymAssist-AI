import { useState, useRef } from 'react';
import { X, Download, MessageCircle, Mail, Check, Printer, CreditCard, User, Calendar, Hash, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Member } from './MemberModal';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type BillData = {
  transactionId: string;
  amountReceived: number;
  paymentDate: string;
  memberUpiId: string;
  owner_upi_id: string;
  notes: string;
  gymLogo?: string;
};

export default function BillModal({
  isOpen,
  onClose,
  onSave,
  member,
  owner_upi_id: initialOwnerUpiId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (bill: BillData) => void;
  member: Member | null;
  owner_upi_id: string;
}) {
  const [formData, setFormData] = useState<BillData>({
    transactionId: '',
    amountReceived: 0,
    paymentDate: new Date().toISOString().split('T')[0],
    memberUpiId: member?.member_upi_id || '',
    owner_upi_id: initialOwnerUpiId || '',
    notes: '',
  });

  const [isGenerated, setIsGenerated] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  if (!member) return null;

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
        setFormData({ ...formData, gymLogo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerated(true);
  };

  const downloadPDF = async () => {
    if (!receiptRef.current) return;
    const canvas = await html2canvas(receiptRef.current, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Receipt_${member.member_name}_${formData.transactionId}.pdf`);
  };

  const sendWhatsApp = () => {
    const message = `Hi ${member.member_name}, your gym membership payment of ₹${formData.amountReceived} has been successfully received. Your receipt is attached. Thank you!`;
    const url = `https://wa.me/${member.phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const sendEmail = () => {
    if (!member.email) return;
    const subject = `Gym Membership Receipt - ${member.member_name}`;
    const body = `Hi ${member.member_name}, your gym membership payment of ₹${formData.amountReceived} has been successfully received. Transaction ID: ${formData.transactionId}. Thank you!`;
    const url = `mailto:${member.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank');
  };

  const handleFinalize = () => {
    onSave(formData);
    setIsGenerated(false);
    onClose();
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
            className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-neutral-100 shrink-0">
              <h2 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                {isGenerated ? 'Review Receipt' : 'Generate Membership Bill'}
              </h2>
              <button
                onClick={onClose}
                className="p-1 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {!isGenerated ? (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 mb-6">
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">Member Details (Auto-fetched)</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] text-emerald-600 uppercase">Name</p>
                        <p className="text-sm font-bold text-neutral-900">{member.member_name}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-emerald-600 uppercase">Plan</p>
                        <p className="text-sm font-bold text-neutral-900">{member.membership_plan}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Transaction ID *</label>
                      <input
                        type="text"
                        required
                        value={formData.transactionId}
                        onChange={(e) => setFormData({ ...formData, transactionId: e.target.value })}
                        className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                        placeholder="e.g. TXN123456789"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Amount Received (₹) *</label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={formData.amountReceived}
                        onChange={(e) => setFormData({ ...formData, amountReceived: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Date of Payment *</label>
                      <input
                        type="date"
                        required
                        value={formData.paymentDate}
                        onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                        className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Member UPI ID *</label>
                      <input
                        type="text"
                        required
                        value={formData.memberUpiId}
                        onChange={(e) => setFormData({ ...formData, memberUpiId: e.target.value })}
                        className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                        placeholder="e.g. member@okaxis"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Gym Logo (Optional)</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="w-full text-xs text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                      />
                      {logoPreview && (
                        <div className="mt-2 w-12 h-12 rounded-lg border border-neutral-200 overflow-hidden">
                          <img src={logoPreview} alt="Logo Preview" className="w-full h-full object-contain" />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Gym Owner UPI ID</label>
                      <input
                        type="text"
                        value={formData.owner_upi_id}
                        onChange={(e) => setFormData({ ...formData, owner_upi_id: e.target.value })}
                        className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                        placeholder="e.g. owner@okaxis"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Notes (Optional)</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm resize-none"
                      rows={2}
                      placeholder="e.g. Thank you for your payment!"
                    />
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
                      Generate Bill
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-8">
                  {/* Receipt Preview */}
                  <div 
                    ref={receiptRef}
                    className="bg-white border border-neutral-200 shadow-sm p-8 max-w-md mx-auto rounded-sm font-sans"
                    style={{ minHeight: '600px' }}
                  >
                    {/* Header */}
                    <div className="flex flex-col items-center text-center mb-8 border-b border-neutral-100 pb-6">
                      {logoPreview ? (
                        <img src={logoPreview} alt="Gym Logo" className="h-16 object-contain mb-4" />
                      ) : (
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                          <Dumbbell className="w-8 h-8 text-emerald-600" />
                        </div>
                      )}
                      <h1 className="text-xl font-bold text-neutral-900 uppercase tracking-tight">Gym Membership Receipt</h1>
                      <p className="text-xs text-neutral-500 mt-1 italic">Official Payment Confirmation</p>
                    </div>

                    {/* Member Details */}
                    <div className="mb-8">
                      <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-3 border-b border-neutral-50 pb-1">Member Details</h3>
                      <div className="grid grid-cols-2 gap-y-3">
                        <div>
                          <p className="text-[9px] text-neutral-500 uppercase">Name</p>
                          <p className="text-xs font-bold text-neutral-900">{member.member_name}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-neutral-500 uppercase">Member ID</p>
                          <p className="text-xs font-bold text-neutral-900">#{member.id?.slice(-6) || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-neutral-500 uppercase">Contact</p>
                          <p className="text-xs font-semibold text-neutral-900">{member.phone}</p>
                        </div>
                        {member.email && (
                          <div>
                            <p className="text-[9px] text-neutral-500 uppercase">Email</p>
                            <p className="text-xs font-semibold text-neutral-900 truncate">{member.email}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-[9px] text-neutral-500 uppercase">Plan</p>
                          <p className="text-xs font-semibold text-neutral-900">{member.membership_plan}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-neutral-500 uppercase">Validity</p>
                          <p className="text-[10px] font-semibold text-neutral-900">{member.membership_start} to {member.membership_end}</p>
                        </div>
                      </div>
                    </div>

                    {/* Payment Details */}
                    <div className="bg-neutral-50 p-4 rounded-lg mb-8 border border-neutral-100">
                      <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-3 border-b border-neutral-200 pb-1">Payment Details</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <p className="text-[10px] text-neutral-500">Transaction ID</p>
                          <p className="text-[10px] font-mono font-bold text-neutral-900">{formData.transactionId}</p>
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-[10px] text-neutral-500">Payment Date</p>
                          <p className="text-[10px] font-bold text-neutral-900">{formData.paymentDate}</p>
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-[10px] text-neutral-500">Member UPI</p>
                          <p className="text-[10px] font-bold text-neutral-900">{formData.memberUpiId}</p>
                        </div>
                        {formData.owner_upi_id && (
                          <div className="flex justify-between items-center">
                            <p className="text-[10px] text-neutral-500">Gym UPI</p>
                            <p className="text-[10px] font-bold text-neutral-900">{formData.owner_upi_id}</p>
                          </div>
                        )}
                        <div className="pt-2 mt-2 border-t border-neutral-200 flex justify-between items-center">
                          <p className="text-xs font-bold text-neutral-900">Total Amount</p>
                          <p className="text-lg font-black text-emerald-600">₹{formData.amountReceived.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="text-center mt-auto">
                      <p className="text-[10px] text-neutral-600 font-medium">Payment successfully received.</p>
                      <p className="text-[10px] text-neutral-600 font-medium">Thank you for choosing our gym.</p>
                      {formData.notes && (
                        <p className="text-[9px] text-neutral-400 mt-4 italic">&quot;{formData.notes}&quot;</p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      onClick={downloadPDF}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-neutral-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-all shadow-lg"
                    >
                      <Download className="w-4 h-4" />
                      Download PDF
                    </button>
                    <button
                      onClick={sendWhatsApp}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg"
                    >
                      <MessageCircle className="w-4 h-4" />
                      WhatsApp
                    </button>
                    <button
                      onClick={sendEmail}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg"
                    >
                      <Mail className="w-4 h-4" />
                      Email
                    </button>
                  </div>

                  <div className="pt-6 flex justify-between items-center border-t border-neutral-100">
                    <button
                      onClick={() => setIsGenerated(false)}
                      className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
                    >
                      Back to Edit
                    </button>
                    <button
                      onClick={handleFinalize}
                      className="flex items-center gap-2 px-6 py-2 bg-emerald-100 text-emerald-700 rounded-xl text-sm font-bold hover:bg-emerald-200 transition-all"
                    >
                      <Check className="w-4 h-4" />
                      Confirm & Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Dumbbell(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6.5 6.5 11 11" />
      <path d="m21 21-1-1" />
      <path d="m3 3 1 1" />
      <path d="m18 22 4-4" />
      <path d="m2 6 4-4" />
      <path d="m3 10 7-7" />
      <path d="m14 21 7-7" />
    </svg>
  );
}
