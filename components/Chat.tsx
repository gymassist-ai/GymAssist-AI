'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  Bell,
  Bot,
  Calendar,
  Check,
  ChevronDown,
  CircleCheck,
  ClipboardList,
  Copy,
  CreditCard,
  Dumbbell,
  Edit2,
  FileText,
  Filter,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  MessageSquare,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
  TrendingUp,
  User,
  UserPlus,
  Users,
  Utensils,
  Wallet,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { AnimatePresence, motion } from 'motion/react';
import MemberModal, { Member } from './MemberModal';
import BillModal from './BillModal';
import DietPlanModal, { DietPlanData } from './DietPlanModal';
import WorkoutPlanModal, { WorkoutPlanData } from './WorkoutPlanModal';
import { cn } from '@/lib/utils';
import { daysUntilMembershipEnd, getMembershipStatus, isMembershipExpiringSoon, type StandardMembershipFees } from '@/lib/membership';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  upiId: string;
  gymName: string;
  gstNumber: string;
  standardFees: StandardMembershipFees;
  onSave: (settings: OwnerSettings) => void;
}

type OwnerSettings = {
  gymName: string;
  gstNumber: string;
  standardFees: Required<StandardMembershipFees>;
  upiId: string;
};

const EMPTY_STANDARD_FEES: Required<StandardMembershipFees> = {
  oneMonth: 0,
  threeMonths: 0,
  sixMonths: 0,
  oneYear: 0,
};

type Message = {
  id: string;
  role: 'user' | 'model';
  content: string;
  action?: {
    type: 'whatsapp' | 'sms';
    phone: string;
    message: string;
  };
  dietPlan?: DietPlanData;
  workoutPlan?: WorkoutPlanData;
};

type ActiveView = 'dashboard' | 'chat' | 'members' | 'payments' | 'reminders' | 'analytics' | 'plans';
type PlanKind = 'diet' | 'workout';

type DietPlanForm = {
  activityLevel: string;
  age: string;
  allergies: string;
  budgetPreference: string;
  dietaryPreference: string;
  gender: string;
  goal: string;
  height: string;
  mealPreferences: string;
  mealsPerDay: string;
  medicalConditions: string;
  targetWeight: string;
  weight: string;
};

type WorkoutPlanForm = {
  daysPerWeek: string;
  duration: string;
  experienceLevel: string;
  goal: string;
  injuries: string;
  targetMuscleGroups: string;
};

type PaymentHistoryItem = {
  id?: string;
  member_id?: string;
  member_name: string;
  transaction_id: string;
  amount: number;
  amount_paid?: string;
  previous_due?: string;
  remaining_due?: string;
  payment_status?: string;
  payment_type?: 'payment' | 'renewal' | string;
  renewal_plan?: string;
  renewal_fee?: number | string;
  previous_membership_end?: string;
  renewal_start_date?: string;
  new_membership_end?: string;
  notes?: string;
  payment_date?: string;
};

type NavItem = {
  id: ActiveView | 'settings';
  label: string;
  icon: LucideIcon;
};

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'reminders', label: 'Reminders', icon: Bell },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'chat', label: 'AI Tools', icon: Sparkles },
  { id: 'plans', label: 'Diet Plans', icon: Utensils },
  { id: 'plans', label: 'Workout Plans', icon: Dumbbell },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const COMMANDS = [
  { label: 'Add paid member', text: 'Add member Priya, paid \u20b91800', icon: UserPlus },
  { label: 'Send renewal reminder', text: 'Send reminder to Rahul', icon: MessageCircle },
  { label: 'Show renewal queue', text: 'Show pending renewals', icon: Calendar },
  { label: 'Generate plan', text: 'Create a 7-day diet and workout plan for Priya', icon: Dumbbell },
];

const MINI_BARS = [46, 68, 52, 78, 63, 88, 74, 94];
const GROWTH_BARS = [32, 45, 38, 62, 70, 66, 82, 91, 86, 98];
type AnalyticsRange = '3m' | '6m' | '12m';
type AnalyticsFocus = 'revenue' | 'members' | 'renewals';

const DEFAULT_DIET_FORM: DietPlanForm = {
  activityLevel: 'Moderate',
  age: '',
  allergies: 'None',
  budgetPreference: 'Budget friendly',
  dietaryPreference: 'Vegetarian',
  gender: 'Male',
  goal: 'Fat loss',
  height: '',
  mealPreferences: '',
  mealsPerDay: '4',
  medicalConditions: 'None',
  targetWeight: '',
  weight: '',
};

const DEFAULT_WORKOUT_FORM: WorkoutPlanForm = {
  daysPerWeek: '4',
  duration: '60 minutes',
  experienceLevel: 'Beginner',
  goal: 'Fat loss and strength',
  injuries: 'None',
  targetMuscleGroups: 'Full body',
};

function SettingsModal({ isOpen, onClose, upiId, gymName, gstNumber, standardFees, onSave }: SettingsModalProps) {
  const [formData, setFormData] = useState<OwnerSettings>({
    gymName,
    gstNumber,
    standardFees: { ...EMPTY_STANDARD_FEES, ...standardFees },
    upiId,
  });

  const updateFee = (key: keyof StandardMembershipFees, value: string) => {
    setFormData((current) => ({
      ...current,
      standardFees: {
        ...current.standardFees,
        [key]: Number(value),
      },
    }));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-white/10 bg-[#101711]/95 p-6 text-white shadow-2xl shadow-black/40"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300/80">Workspace</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">Business Settings</h2>
              </div>
              <button
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-white/60 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                aria-label="Close settings"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-white/70">Gym name</label>
                  <input
                    type="text"
                    value={formData.gymName}
                    onChange={(e) => setFormData({ ...formData, gymName: e.target.value })}
                    placeholder="Iron Temple Fitness"
                    className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-emerald-300/60 focus:ring-4 focus:ring-emerald-400/10"
                  />
                  <p className="mt-2 text-xs text-white/40">Highlighted on receipts, PDFs, WhatsApp messages, and emails.</p>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-white/70">GST number</label>
                  <input
                    type="text"
                    value={formData.gstNumber}
                    onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })}
                    placeholder="22AAAAA0000A1Z5"
                    className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-4 py-3 text-sm uppercase text-white outline-none transition placeholder:text-white/30 focus:border-emerald-300/60 focus:ring-4 focus:ring-emerald-400/10"
                  />
                  <p className="mt-2 text-xs text-white/40">Shown on membership receipts and plan PDFs when available.</p>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/70">UPI ID for payment reminders</label>
                <input
                  type="text"
                  value={formData.upiId}
                  onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
                  placeholder="gym@okaxis"
                  className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-emerald-300/60 focus:ring-4 focus:ring-emerald-400/10"
                />
                <p className="mt-2 text-xs text-white/40">Included in AI-generated payment reminders and receipts.</p>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Standard membership fees</p>
                    <p className="mt-1 text-xs text-white/40">Used as defaults when adding members or renewing plans.</p>
                  </div>
                  <Wallet className="h-4 w-4 text-emerald-200" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['oneMonth', '1 month'],
                    ['threeMonths', '3 months'],
                    ['sixMonths', '6 months'],
                    ['oneYear', '1 year'],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-white/45">{label}</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.standardFees[key as keyof StandardMembershipFees] || ''}
                        onChange={(e) => updateFee(key as keyof StandardMembershipFees, e.target.value)}
                        placeholder="0"
                        className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-emerald-300/60 focus:ring-4 focus:ring-emerald-400/10"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-white/60 transition hover:bg-white/10 hover:text-white">
                  Cancel
                </button>
                <button
                  onClick={() => onSave(formData)}
                  className="rounded-lg bg-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-200"
                >
                  Save changes
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function MiniBars({ values = MINI_BARS }: { values?: number[] }) {
  return (
    <div className="flex h-10 items-end gap-1.5">
      {values.map((value, index) => (
        <span
          key={`${value}-${index}`}
          className="w-1.5 rounded-full bg-gradient-to-t from-emerald-500/25 to-emerald-200/90"
          style={{ height: `${Math.max(18, value)}%` }}
        />
      ))}
    </div>
  );
}

function GlassCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-lg border border-white/10 bg-white/[0.055] shadow-[0_18px_60px_rgba(0,0,0,0.24)] backdrop-blur-xl transition duration-300 hover:border-emerald-300/25 hover:bg-white/[0.075]',
        className,
      )}
    >
      {children}
    </div>
  );
}

function SectionHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300/80">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function StatusPill({ tone, children }: { tone: 'green' | 'amber' | 'red' | 'neutral'; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        tone === 'green' && 'border border-emerald-300/20 bg-emerald-300/10 text-emerald-200',
        tone === 'amber' && 'border border-amber-300/20 bg-amber-300/10 text-amber-200',
        tone === 'red' && 'border border-red-300/20 bg-red-400/10 text-red-200',
        tone === 'neutral' && 'border border-white/10 bg-white/[0.06] text-white/65',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          tone === 'green' && 'bg-emerald-300',
          tone === 'amber' && 'bg-amber-300',
          tone === 'red' && 'bg-red-300',
          tone === 'neutral' && 'bg-white/50',
        )}
      />
      {children}
    </span>
  );
}

export default function Chat({ userId, upiId: initialUpiId, onLogout }: { userId: string; upiId: string | null; onLogout: () => void }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [upiId, setUpiId] = useState(initialUpiId || '');
  const [gymName, setGymName] = useState(userId);
  const [gstNumber, setGstNumber] = useState('');
  const [standardFees, setStandardFees] = useState<Required<StandardMembershipFees>>(EMPTY_STANDARD_FEES);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Expired' | 'Expiring Soon'>('All');
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRange>('6m');
  const [analyticsFocus, setAnalyticsFocus] = useState<AnalyticsFocus>('revenue');
  const [activePlanKind, setActivePlanKind] = useState<PlanKind>('diet');
  const [dietMemberId, setDietMemberId] = useState('');
  const [workoutMemberId, setWorkoutMemberId] = useState('');
  const [dietForm, setDietForm] = useState<DietPlanForm>(DEFAULT_DIET_FORM);
  const [workoutForm, setWorkoutForm] = useState<WorkoutPlanForm>(DEFAULT_WORKOUT_FORM);
  const [planGenerating, setPlanGenerating] = useState<PlanKind | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      content: `Namaste! I am GymAssist AI. You are logged in as **${userId}**. What should we handle first?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [isDietPlanModalOpen, setIsDietPlanModalOpen] = useState(false);
  const [isWorkoutPlanModalOpen, setIsWorkoutPlanModalOpen] = useState(false);
  const [billMode, setBillMode] = useState<'payment' | 'renewal'>('payment');
  const [selectedDietPlan, setSelectedDietPlan] = useState<DietPlanData | null>(null);
  const [selectedWorkoutPlan, setSelectedWorkoutPlan] = useState<WorkoutPlanData | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedMemberForBill, setSelectedMemberForBill] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryItem[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getAuthHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'x-user-id': userId,
    };

    const accessToken = localStorage.getItem('gym_assist_access_token');
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    return headers;
  }, [userId]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/auth/profile', {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.upiId) {
            setUpiId(data.upiId);
            localStorage.setItem('gym_assist_upi_id', data.upiId);
          }
          setGymName(data.gymName || userId);
          setGstNumber(data.gstNumber || '');
          setStandardFees({ ...EMPTY_STANDARD_FEES, ...(data.standardFees || {}) });
        } else if (res.status === 402) {
          const data = await res.json().catch(() => ({}));
          setToast({
            message: data.error || 'Your free trial has ended. Please choose a paid plan to continue.',
            type: 'error',
          });
        }
      } catch (e) {
        console.error('Failed to fetch profile', e);
      }
    };

    const fetchMembers = async () => {
      try {
        const res = await fetch('/api/members', {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setMembers(data);
        } else {
          const data = await res.json().catch(() => ({}));
          setToast({
            message: data.error || 'Member workspace could not be loaded. Please login again.',
            type: 'error',
          });
        }
      } catch (e) {
        console.error('Failed to fetch members', e);
        setToast({ message: 'Member workspace could not be loaded. Please retry.', type: 'error' });
      }
    };

    const fetchPayments = async () => {
      try {
        const res = await fetch('/api/payments', {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setPaymentHistory(data);
        } else {
          console.error('Failed to fetch payment history', await res.json().catch(() => ({})));
        }
      } catch (e) {
        console.error('Failed to fetch payment history', e);
      }
    };

    fetchProfile();
    fetchMembers();
    fetchPayments();
  }, [getAuthHeaders, userId]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(Number.isFinite(value) ? value : 0);

  const daysUntil = useCallback((date?: string) => daysUntilMembershipEnd(date), []);
  const memberStatus = useCallback((member: Member) => getMembershipStatus(member.membership_end, member.status), []);
  const memberPendingDues = useCallback((member: Member) => Math.max(0, Number(member.pending_dues ?? Number(member.fee || 0) - Number(member.amuont_paid || 0))), []);
  const openBill = useCallback((member: Member, nextMode: 'payment' | 'renewal' = 'payment') => {
    setSelectedMemberForBill(member);
    setBillMode(nextMode);
    setIsBillModalOpen(true);
  }, []);

  const metrics = useMemo(() => {
    const totalMembers = members.length;
    const activeMembers = members.filter((member) => memberStatus(member) === 'Active' && !isMembershipExpiringSoon(member.membership_end)).length;
    const expiredMembers = members.filter((member) => memberStatus(member) === 'Expired').length;
    const monthlyRevenue = members.reduce((acc, member) => acc + Number(member.amuont_paid || 0), 0);
    const pendingPayments = members.reduce((acc, member) => acc + memberPendingDues(member), 0);
    const renewalsDue = members.filter((member) => isMembershipExpiringSoon(member.membership_end)).length;
    const activePlans = new Set(members.filter((member) => memberStatus(member) === 'Active').map((member) => member.membership_plan)).size;
    const thisMonth = new Date().toISOString().slice(0, 7);
    const newThisMonth = members.filter((member) => member.membership_start?.slice(0, 7) === thisMonth).length;
    const monthlyGrowth = totalMembers ? Math.round((newThisMonth / totalMembers) * 100) : 0;
    const collectionRate = monthlyRevenue + pendingPayments > 0 ? Math.round((monthlyRevenue / (monthlyRevenue + pendingPayments)) * 100) : 0;

    return {
      totalMembers,
      activeMembers,
      expiredMembers,
      monthlyRevenue,
      pendingPayments,
      renewalsDue,
      activePlans,
      monthlyGrowth,
      collectionRate,
      newThisMonth,
    };
  }, [memberPendingDues, memberStatus, members]);

  const pendingMembers = useMemo(
    () =>
      members
        .map((member) => ({
          ...member,
          pending: memberPendingDues(member),
          daysLeft: daysUntil(member.membership_end),
        }))
        .filter((member) => member.pending > 0)
        .sort((a, b) => b.pending - a.pending),
    [daysUntil, memberPendingDues, members],
  );

  const renewalMembers = useMemo(
    () =>
      members
        .map((member) => ({ ...member, daysLeft: daysUntil(member.membership_end) }))
        .filter((member) => member.daysLeft !== null && member.daysLeft >= -30 && member.daysLeft <= 7)
        .sort((a, b) => Number(a.daysLeft) - Number(b.daysLeft)),
    [daysUntil, members],
  );

  const analytics = useMemo(() => {
    const monthCount = analyticsRange === '3m' ? 3 : analyticsRange === '6m' ? 6 : 12;
    const now = new Date();
    const monthKeys = Array.from({ length: monthCount }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (monthCount - 1 - index), 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return {
        key,
        label: date.toLocaleString('default', { month: 'short' }),
        revenue: 0,
        dues: 0,
        joins: 0,
        renewals: 0,
      };
    });
    const monthMap = new Map(monthKeys.map((month) => [month.key, month]));

    members.forEach((member) => {
      const startKey = member.membership_start?.slice(0, 7);
      const endKey = member.membership_end?.slice(0, 7);
      const startMonth = startKey ? monthMap.get(startKey) : null;
      const endMonth = endKey ? monthMap.get(endKey) : null;
      const paid = Number(member.amuont_paid || 0);
      const due = memberPendingDues(member);

      if (startMonth) {
        startMonth.revenue += paid;
        startMonth.dues += due;
        startMonth.joins += 1;
      }
      if (endMonth) {
        endMonth.renewals += 1;
      }
    });

    const planCounts = members.reduce<Record<string, number>>((acc, member) => {
      const plan = member.membership_plan || 'No plan';
      acc[plan] = (acc[plan] || 0) + 1;
      return acc;
    }, {});
    const planMix = Object.entries(planCounts)
      .map(([name, count]) => ({
        count,
        name,
        percent: members.length ? Math.round((count / members.length) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const statusCounts = members.reduce(
      (acc, member) => {
        const status = memberStatus(member);
        if (status === 'Active' && isMembershipExpiringSoon(member.membership_end)) acc.other += 1;
        else if (status === 'Active') acc.active += 1;
        else if (status === 'Expired') acc.expired += 1;
        else acc.other += 1;
        return acc;
      },
      { active: 0, expired: 0, other: 0 },
    );

    const overdueMembers = pendingMembers.filter((member) => Number(member.daysLeft) < 0);
    const atRiskMembers = renewalMembers.filter((member) => Number(member.daysLeft) <= 3);
    const topDebtors = pendingMembers.slice(0, 5);
    const bestMembers = [...members]
      .filter((member) => Number(member.amuont_paid || 0) > 0)
      .sort((a, b) => Number(b.amuont_paid || 0) - Number(a.amuont_paid || 0))
      .slice(0, 5);
    const totalPotential = metrics.monthlyRevenue + metrics.pendingPayments;
    const averageFee = members.length ? Math.round(members.reduce((acc, member) => acc + Number(member.fee || 0), 0) / members.length) : 0;
    const averagePaid = members.length ? Math.round(metrics.monthlyRevenue / members.length) : 0;
    const revenueMax = Math.max(1, ...monthKeys.map((month) => month.revenue + month.dues));
    const joinsMax = Math.max(1, ...monthKeys.map((month) => month.joins));
    const renewalsMax = Math.max(1, ...monthKeys.map((month) => month.renewals));

    return {
      atRiskMembers,
      averageFee,
      averagePaid,
      bestMembers,
      joinsMax,
      monthKeys,
      overdueMembers,
      planMix,
      renewalsMax,
      revenueMax,
      statusCounts,
      topDebtors,
      totalPotential,
    };
  }, [analyticsRange, memberPendingDues, memberStatus, members, metrics.monthlyRevenue, metrics.pendingPayments, pendingMembers, renewalMembers]);

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        member.member_name.toLowerCase().includes(query) ||
        member.phone.includes(searchQuery) ||
        member.member_id?.toLowerCase().includes(query);

      if (statusFilter === 'All') return matchesSearch;
      if (statusFilter === 'Active') return matchesSearch && memberStatus(member) === 'Active' && !isMembershipExpiringSoon(member.membership_end);
      if (statusFilter === 'Expired') return matchesSearch && memberStatus(member) === 'Expired';
      if (statusFilter === 'Expiring Soon') {
        return matchesSearch && memberStatus(member) === 'Active' && isMembershipExpiringSoon(member.membership_end);
      }
      return matchesSearch;
    });
  }, [memberStatus, members, searchQuery, statusFilter]);

  const statusFilterCounts = useMemo(
    () => ({
      All: members.length,
      Active: members.filter((member) => memberStatus(member) === 'Active' && !isMembershipExpiringSoon(member.membership_end)).length,
      'Expiring Soon': members.filter((member) => memberStatus(member) === 'Active' && isMembershipExpiringSoon(member.membership_end)).length,
      Expired: members.filter((member) => memberStatus(member) === 'Expired').length,
    }),
    [memberStatus, members],
  );

  useEffect(() => {
    if (!members.length) return;
    setDietMemberId((current) => current || members[0].id || members[0].member_name);
    setWorkoutMemberId((current) => current || members[0].id || members[0].member_name);
  }, [members]);

  const currentMonth = new Date().toLocaleString('default', { month: 'long' });
  const financeReport = `
${currentMonth} GymAssist AI Summary

Total Members: ${metrics.totalMembers}
Active Members: ${metrics.activeMembers}
Monthly Revenue: ${formatCurrency(metrics.monthlyRevenue)}
Pending Payments: ${formatCurrency(metrics.pendingPayments)}
Renewals Due: ${metrics.renewalsDue}
Collection Rate: ${metrics.collectionRate}%
  `.trim();

  const handleSaveProfile = async (settings: OwnerSettings) => {
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setUpiId(settings.upiId);
        setGymName(settings.gymName || userId);
        setGstNumber(settings.gstNumber);
        setStandardFees({ ...EMPTY_STANDARD_FEES, ...settings.standardFees });
        if (settings.upiId) {
          localStorage.setItem('gym_assist_upi_id', settings.upiId);
        } else {
          localStorage.removeItem('gym_assist_upi_id');
        }
        setIsSettingsOpen(false);
        setToast({ message: 'Business settings updated successfully', type: 'success' });
      } else {
        const data = await res.json().catch(() => ({}));
        setToast({ message: data.error || 'Failed to update profile', type: 'error' });
      }
    } catch (e) {
      setToast({ message: 'Failed to update profile', type: 'error' });
    }
  };

  const handleSaveMember = async (member: Member) => {
    setIsLoading(true);
    try {
      const method = selectedMember ? 'PUT' : 'POST';
      const res = await fetch('/api/members', {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(member),
      });

      if (res.ok) {
        const savedMember = await res.json();
        if (selectedMember) {
          setMembers((prev) => prev.map((m) => (m.id === savedMember.id ? savedMember : m)));
          setToast({ message: 'Member updated successfully', type: 'success' });
        } else {
          setMembers((prev) => [savedMember, ...prev]);
          setToast({ message: 'Member added successfully', type: 'success' });
        }
        setIsMemberModalOpen(false);
        setSelectedMember(null);
      } else {
        const errorData = await res.json();
        setToast({ message: `Failed to save member: ${errorData.error}`, type: 'error' });
      }
    } catch (e) {
      setToast({ message: 'Failed to save member', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditMember = (member: Member) => {
    setSelectedMember(member);
    setIsMemberModalOpen(true);
  };

  const handleCopyReport = (report: string) => {
    navigator.clipboard.writeText(report);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSaveBill = async (bill: any) => {
    if (!selectedMemberForBill) throw new Error('No member selected for billing.');
    setIsLoading(true);
    try {
      const paymentRes = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          payment_type: bill.paymentType || billMode,
          member_record_id: selectedMemberForBill.id,
          member_id: selectedMemberForBill.member_id || null,
          transaction_id: bill.transactionId,
          amount: bill.amountReceived,
          payment_date: bill.paymentDate,
          member_upi_id: bill.memberUpiId,
          owner_upi_id: bill.owner_upi_id,
          bill_url: bill.bill_url || null,
          notes: bill.notes || null,
          renewal_plan: bill.renewalPlan || null,
          renewal_months: bill.renewalMonths || null,
          renewal_fee: bill.renewalFee || null,
          previous_membership_end: bill.previousMembershipEnd || null,
          renewal_start_date: bill.renewalStartDate || null,
          new_membership_end: bill.newMembershipEnd || null,
        }),
      });

      if (!paymentRes.ok) {
        const err = await paymentRes.json();
        throw new Error(err.error || 'Failed to save payment history');
      }

      const paymentResult = await paymentRes.json();
      const membersRes = await fetch('/api/members', {
        headers: getAuthHeaders(),
      });
      if (membersRes.ok) {
        const updatedMembers = await membersRes.json();
        setMembers(updatedMembers);
      }

      const paymentsRes = await fetch('/api/payments', {
        headers: getAuthHeaders(),
      });
      if (paymentsRes.ok) {
        setPaymentHistory(await paymentsRes.json());
      }

      setToast({ message: bill.paymentType === 'renewal' ? 'Membership renewed and receipt generated.' : 'Payment recorded and bill generated.', type: 'success' });
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'model',
          content:
            bill.paymentType === 'renewal'
              ? `Membership renewed for **${selectedMemberForBill.member_name}** through **${paymentResult.membership?.new_end || bill.newMembershipEnd}**. Remaining dues: **${formatCurrency(paymentResult.financials?.pending_dues ?? bill.remainingDue)}**.`
              : `Payment recorded successfully for **${selectedMemberForBill.member_name}**. Remaining dues: **${formatCurrency(paymentResult.financials?.pending_dues ?? bill.remainingDue)}**. Payment status: **${paymentResult.financials?.payment_status || bill.paymentStatus}**.`,
        },
      ]);
    } catch (e: any) {
      setToast({ message: `Failed to record payment: ${e.message}`, type: 'error' });
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent, textOverride?: string) => {
    e?.preventDefault();
    const textToSubmit = textOverride || input;
    if (!textToSubmit.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSubmit.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages.filter((m) => m.id !== 'welcome'), userMessage],
          upiId,
          gymName,
          gstNumber,
          members,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const message = errorData.error || 'AI response is temporarily unavailable. Please try again.';
        setToast({ message, type: 'error' });
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'model',
            content: message,
          },
        ]);
        return;
      }

      const data = await res.json();

      if (data.type === 'functionCall') {
        if (data.name === 'generateDietPlan') {
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: 'model',
              content: data.content,
              dietPlan: data.args as DietPlanData,
            },
          ]);
        } else if (data.name === 'generateWorkoutPlan') {
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: 'model',
              content: data.content,
              workoutPlan: data.args as WorkoutPlanData,
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: 'model',
              content: data.content,
              action: {
                type: data.name === 'prepareWhatsApp' ? 'whatsapp' : 'sms',
                phone: data.args.phone,
                message: data.args.message,
              },
            },
          ]);
        }
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'model',
            content: data.content || 'Sorry, I could not process that request.',
          },
        ]);
      }
    } catch (error: any) {
      const message = error.message || 'Sorry, I encountered an error. Please try again.';
      setToast({ message, type: 'error' });
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'model',
          content: message,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setActiveView('chat');
    handleSubmit(undefined, suggestion);
    setIsSidebarOpen(false);
  };

  const getPlanMember = (memberKey: string) => {
    return members.find((member) => member.id === memberKey || member.member_name === memberKey) || null;
  };

  const updateDietField = (field: keyof DietPlanForm, value: string) => {
    setDietForm((current) => ({ ...current, [field]: value }));
  };

  const updateWorkoutField = (field: keyof WorkoutPlanForm, value: string) => {
    setWorkoutForm((current) => ({ ...current, [field]: value }));
  };

  const callPlanGenerator = async (prompt: string, expectedType: 'generateDietPlan' | 'generateWorkoutPlan') => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        members,
        gymName,
        gstNumber,
        messages: [{ role: 'user', content: prompt }],
        upiId,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'AI plan generation is temporarily unavailable.');
    }

    const data = await res.json();
    if (data.type !== 'functionCall' || data.name !== expectedType) {
      throw new Error('AI could not generate a structured plan. Please check the details and try again.');
    }

    return data.args;
  };

  const generateDietPlanFromStudio = async () => {
    const member = getPlanMember(dietMemberId);
    if (!member) {
      setToast({ message: 'Select a member before generating a diet plan.', type: 'error' });
      return;
    }

    if (!dietForm.age || !dietForm.height || !dietForm.weight) {
      setToast({ message: 'Add age, height, and weight for a better diet plan.', type: 'error' });
      return;
    }

    setPlanGenerating('diet');
    try {
      const prompt = `Use the generateDietPlan tool to create a complete printable diet plan. Do not ask follow-up questions; use the exact details below and make sensible Indian gym-friendly choices where needed.

Member:
- Name: ${member.member_name}
- Phone: ${member.phone || 'Not provided'}
- Email: ${member.email || 'Not provided'}
- Membership plan: ${member.membership_plan || 'Not provided'}

Diet details:
- Age: ${dietForm.age}
- Gender: ${dietForm.gender}
- Height: ${dietForm.height}
- Weight: ${dietForm.weight}
- Goal: ${dietForm.goal}
- Activity level: ${dietForm.activityLevel}
- Dietary preference: ${dietForm.dietaryPreference}
- Budget preference: ${dietForm.budgetPreference}
- Meal preferences: ${dietForm.mealPreferences || 'No special preferences'}
- Meals per day: ${dietForm.mealsPerDay}
- Allergies: ${dietForm.allergies || 'None'}
- Medical conditions: ${dietForm.medicalConditions || 'None'}
- Target weight: ${dietForm.targetWeight || 'Not specified'}

Return realistic calories, macros, a daily meal schedule, hydration advice, supplements, foods to avoid, and practical advice.`;

      const plan = await callPlanGenerator(prompt, 'generateDietPlan');
      setSelectedDietPlan(plan as DietPlanData);
      setIsDietPlanModalOpen(true);
      setToast({ message: `Diet plan generated for ${member.member_name}`, type: 'success' });
    } catch (error: any) {
      setToast({ message: error.message || 'Failed to generate diet plan.', type: 'error' });
    } finally {
      setPlanGenerating(null);
    }
  };

  const generateWorkoutPlanFromStudio = async () => {
    const member = getPlanMember(workoutMemberId);
    if (!member) {
      setToast({ message: 'Select a member before generating a workout plan.', type: 'error' });
      return;
    }

    if (!workoutForm.goal || !workoutForm.daysPerWeek || !workoutForm.duration) {
      setToast({ message: 'Add goal, days per week, and session duration first.', type: 'error' });
      return;
    }

    setPlanGenerating('workout');
    try {
      const prompt = `Use the generateWorkoutPlan tool to create a complete printable workout plan. Do not ask follow-up questions; use the exact details below and keep it safe for a gym trainer to review.

Member:
- Name: ${member.member_name}
- Phone: ${member.phone || 'Not provided'}
- Email: ${member.email || 'Not provided'}
- Membership plan: ${member.membership_plan || 'Not provided'}

Workout details:
- Goal: ${workoutForm.goal}
- Experience level: ${workoutForm.experienceLevel}
- Days per week: ${workoutForm.daysPerWeek}
- Session duration: ${workoutForm.duration}
- Target muscle groups: ${workoutForm.targetMuscleGroups}
- Injuries or limitations: ${workoutForm.injuries || 'None'}

Return a weekly schedule with days, focus areas, exercises, sets, reps, rest periods, warm-up, cool-down, recovery, and progressive overload guidance.`;

      const plan = await callPlanGenerator(prompt, 'generateWorkoutPlan');
      setSelectedWorkoutPlan(plan as WorkoutPlanData);
      setIsWorkoutPlanModalOpen(true);
      setToast({ message: `Workout plan generated for ${member.member_name}`, type: 'success' });
    } catch (error: any) {
      setToast({ message: error.message || 'Failed to generate workout plan.', type: 'error' });
    } finally {
      setPlanGenerating(null);
    }
  };

  const openView = (view: NavItem['id']) => {
    if (view === 'settings') {
      setIsSettingsOpen(true);
      return;
    }
    setActiveView(view);
    setIsSidebarOpen(false);
  };

  const metricCards = [
    {
      label: 'Total Members',
      value: metrics.totalMembers.toString(),
      trend: '+12.8%',
      helper: `${metrics.activeMembers} active right now`,
      icon: Users,
      bars: MINI_BARS,
    },
    {
      label: 'Monthly Revenue',
      value: formatCurrency(metrics.monthlyRevenue),
      trend: '+18.4%',
      helper: `${metrics.collectionRate}% collected`,
      icon: Wallet,
      bars: [28, 44, 52, 48, 72, 76, 86, 92],
    },
    {
      label: 'Renewals Due',
      value: metrics.renewalsDue.toString(),
      trend: renewalMembers.length ? 'needs action' : 'clear',
      helper: 'Next 7 days',
      icon: Calendar,
      bars: [62, 58, 44, 40, 32, 28, 24, 18],
    },
    {
      label: 'Pending Payments',
      value: formatCurrency(metrics.pendingPayments),
      trend: `${pendingMembers.length} members`,
      helper: 'Uncollected dues',
      icon: CreditCard,
      bars: [88, 76, 64, 55, 44, 36, 31, 24],
    },
    {
      label: 'Active Plans',
      value: metrics.activePlans.toString(),
      trend: '+6.2%',
      helper: 'Live plan types',
      icon: ClipboardList,
      bars: [38, 54, 51, 68, 62, 70, 76, 81],
    },
    {
      label: 'Monthly Growth',
      value: `${metrics.monthlyGrowth}%`,
      trend: `${metrics.newThisMonth} new`,
      helper: 'New members this month',
      icon: TrendingUp,
      bars: GROWTH_BARS.slice(2),
    },
  ];

  const renderDashboard = () => (
    <motion.div
      key="dashboard"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="space-y-6"
    >
      <section className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
        <GlassCard className="relative overflow-hidden p-5 sm:p-7">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/60 to-transparent" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_260px] lg:items-end">
            <div>
              <div className="mb-5 flex flex-wrap gap-2">
                <StatusPill tone="green">AI active</StatusPill>
                <StatusPill tone="neutral">Razorpay ready</StatusPill>
                <StatusPill tone={metrics.renewalsDue > 0 ? 'amber' : 'green'}>
                  {metrics.renewalsDue > 0 ? `${metrics.renewalsDue} renewals` : 'Renewals clear'}
                </StatusPill>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300/80">GymAssist AI</p>
              <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                AI-powered gym operations center
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/58 sm:text-base">
                Payments, renewals, members, reminders, diet plans, workouts, and daily decisions in one calm command surface.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => setActiveView('chat')}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-200"
                >
                  <Sparkles className="h-4 w-4" />
                  Ask AI
                </button>
                <button
                  onClick={() => setIsMemberModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.1]"
                >
                  <Plus className="h-4 w-4" />
                  New member
                </button>
              </div>
            </div>
            <div className="rounded-lg border border-emerald-300/15 bg-emerald-300/[0.07] p-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Collection</span>
                <span className="text-sm font-semibold text-emerald-200">{metrics.collectionRate}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-lime-200" style={{ width: `${metrics.collectionRate || 8}%` }} />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-white/45">Collected</p>
                  <p className="mt-1 font-semibold text-white">{formatCurrency(metrics.monthlyRevenue)}</p>
                </div>
                <div>
                  <p className="text-white/45">Pending</p>
                  <p className="mt-1 font-semibold text-white">{formatCurrency(metrics.pendingPayments)}</p>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300/80">Copilot</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Command preview</h3>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-300 text-emerald-950 shadow-lg shadow-emerald-400/20">
              <Bot className="h-5 w-5" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="ml-auto max-w-[88%] rounded-lg bg-emerald-300 px-4 py-3 text-sm font-medium text-emerald-950">
              Add member Priya, paid {formatCurrency(1800)}
            </div>
            <div className="max-w-[92%] rounded-lg border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white/75">
              Priya is added, payment is logged, and her renewal reminder is scheduled for next month.
            </div>
            <div className="max-w-[92%] rounded-lg border border-emerald-300/20 bg-emerald-300/[0.08] px-4 py-3 text-sm text-emerald-100">
              Reminder sent to Rahul - membership expires in 3 days.
            </div>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {COMMANDS.slice(0, 3).map((command) => (
              <button
                key={command.text}
                onClick={() => handleSuggestionClick(command.text)}
                className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-left text-xs font-medium text-white/60 transition hover:border-emerald-300/30 hover:bg-emerald-300/10 hover:text-emerald-100"
              >
                {command.text}
              </button>
            ))}
          </div>
        </GlassCard>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <GlassCard key={card.label} className="group p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="grid h-10 w-10 place-items-center rounded-lg border border-emerald-300/15 bg-emerald-300/10 text-emerald-200">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-white/55">{card.trend}</span>
              </div>
              <div className="mt-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm text-white/48">{card.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{card.value}</p>
                  <p className="mt-2 text-xs text-white/40">{card.helper}</p>
                </div>
                <MiniBars values={card.bars} />
              </div>
            </GlassCard>
          );
        })}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.85fr]">
        <GlassCard className="p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300/80">Revenue</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Payment velocity</h3>
            </div>
            <button
              onClick={() => handleCopyReport(financeReport)}
              className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-white/55 transition hover:border-emerald-300/30 hover:bg-emerald-300/10 hover:text-emerald-200"
              title="Copy report"
            >
              {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_220px]">
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="flex h-52 items-end gap-2">
                {GROWTH_BARS.map((value, index) => (
                  <div key={index} className="flex flex-1 flex-col items-center gap-2">
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-emerald-500/30 via-emerald-300/70 to-lime-200"
                      style={{ height: `${value}%` }}
                    />
                    <span className="text-[10px] text-white/30">{index + 1}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs text-white/45">Average ticket</p>
                <p className="mt-2 text-xl font-semibold text-white">
                  {formatCurrency(metrics.totalMembers ? Math.round(metrics.monthlyRevenue / metrics.totalMembers) : 0)}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs text-white/45">At-risk dues</p>
                <p className="mt-2 text-xl font-semibold text-white">{pendingMembers.length}</p>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300/80">Renewals</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Reminder radar</h3>
            </div>
            <Zap className="h-5 w-5 text-emerald-200" />
          </div>
          <div className="space-y-3">
            {(renewalMembers.length ? renewalMembers.slice(0, 4) : members.slice(0, 4)).map((member) => (
              <div key={member.id || member.phone} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{member.member_name}</p>
                  <p className="text-xs text-white/40">{member.membership_plan}</p>
                </div>
                <StatusPill tone={Number((member as any).daysLeft) < 0 ? 'red' : Number((member as any).daysLeft) <= 3 ? 'amber' : 'green'}>
                  {(member as any).daysLeft !== undefined && (member as any).daysLeft !== null ? `${(member as any).daysLeft}d` : memberStatus(member)}
                </StatusPill>
              </div>
            ))}
            {!members.length && (
              <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-white/45">
                Member activity will appear here after onboarding.
              </div>
            )}
          </div>
        </GlassCard>
      </section>
    </motion.div>
  );

  const renderChat = () => (
    <motion.div
      key="chat"
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      className="flex min-h-[calc(100vh-104px)] flex-col overflow-hidden rounded-lg border border-white/10 bg-white/[0.045] shadow-2xl shadow-black/30 backdrop-blur-xl"
    >
      <div className="border-b border-white/10 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-emerald-300 text-emerald-950 shadow-lg shadow-emerald-500/20">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300/80">AI command center</p>
              <h2 className="text-xl font-semibold text-white">GymAssist Copilot</h2>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {COMMANDS.map((command) => {
              const Icon = command.icon;
              return (
                <button
                  key={command.text}
                  onClick={() => handleSuggestionClick(command.text)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-white/60 transition hover:border-emerald-300/30 hover:bg-emerald-300/10 hover:text-emerald-100"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {command.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto bg-black/10 p-4 sm:p-6">
        {messages.map((msg) => (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={msg.id}
            className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div className={cn('flex max-w-[92%] gap-3 md:max-w-[78%]', msg.role === 'user' && 'flex-row-reverse')}>
              <div
                className={cn(
                  'grid h-9 w-9 shrink-0 place-items-center rounded-lg',
                  msg.role === 'user'
                    ? 'border border-white/10 bg-white/[0.08] text-white'
                    : 'bg-emerald-300 text-emerald-950 shadow-lg shadow-emerald-500/20',
                )}
              >
                {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div
                className={cn(
                  'rounded-lg px-4 py-3 text-sm leading-6 shadow-lg',
                  msg.role === 'user'
                    ? 'bg-emerald-300 text-emerald-950 shadow-emerald-500/10'
                    : 'border border-white/10 bg-white/[0.07] text-white/80 shadow-black/15',
                )}
              >
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap font-medium">{msg.content}</p>
                ) : (
                  <div className="prose prose-sm prose-invert max-w-none prose-p:leading-6 prose-strong:text-white prose-ul:my-2 prose-li:my-0">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    {msg.action && (
                      <div className="not-prose mt-4">
                        <a
                          href={
                            msg.action.type === 'whatsapp'
                              ? `https://wa.me/${(msg.action.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(msg.action.message || '')}`
                              : `sms:${(msg.action.phone || '').replace(/\D/g, '')}?body=${encodeURIComponent(msg.action.message || '')}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            'inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition',
                            msg.action.type === 'whatsapp'
                              ? 'bg-[#25D366] hover:bg-[#1ebe57]'
                              : 'bg-sky-500 hover:bg-sky-400',
                          )}
                        >
                          {msg.action.type === 'whatsapp' ? <MessageCircle className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                          Send via {msg.action.type === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                        </a>
                      </div>
                    )}
                    {msg.dietPlan && (
                      <div className="not-prose mt-4">
                        <button
                          onClick={() => {
                            setSelectedDietPlan(msg.dietPlan!);
                            setIsDietPlanModalOpen(true);
                          }}
                          className="inline-flex items-center gap-2 rounded-lg bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-200"
                        >
                          <FileText className="h-4 w-4" />
                          View diet plan
                        </button>
                      </div>
                    )}
                    {msg.workoutPlan && (
                      <div className="not-prose mt-4">
                        <button
                          onClick={() => {
                            setSelectedWorkoutPlan(msg.workoutPlan!);
                            setIsWorkoutPlanModalOpen(true);
                          }}
                          className="inline-flex items-center gap-2 rounded-lg bg-sky-300 px-4 py-2.5 text-sm font-semibold text-sky-950 transition hover:bg-sky-200"
                        >
                          <Dumbbell className="h-4 w-4" />
                          View workout plan
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
        {isLoading && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
            <div className="flex gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-300 text-emerald-950">
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.07] px-4 py-3">
                <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-300" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-300" style={{ animationDelay: '120ms' }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-300" style={{ animationDelay: '240ms' }} />
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-white/10 bg-[#0c120e]/95 p-4">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-5xl items-end gap-2 rounded-lg border border-white/10 bg-black/25 p-2 transition focus-within:border-emerald-300/50 focus-within:ring-4 focus-within:ring-emerald-300/10"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Type a payment, renewal, reminder, diet, or workout request..."
            className="max-h-36 min-h-[46px] w-full resize-none border-none bg-transparent px-3 py-3 text-sm text-white outline-none placeholder:text-white/30"
            rows={1}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 144)}px`;
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-emerald-300 text-emerald-950 transition hover:bg-emerald-200 disabled:bg-white/10 disabled:text-white/25"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
        <p className="mt-2 text-center text-[11px] text-white/32">Verify important payment and health details before sharing.</p>
      </div>
    </motion.div>
  );

  const renderMembers = () => (
    <motion.div
      key="members"
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      className="space-y-6"
    >
      <SectionHeader
        eyebrow="Members"
        title="Member Management"
        action={
          <button
            onClick={() => setIsMemberModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-200"
          >
            <Plus className="h-4 w-4" />
            Add member
          </button>
        }
      />

      <GlassCard className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              type="text"
              placeholder="Search members, phone, or ID"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/25 py-3 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-emerald-300/50 focus:ring-4 focus:ring-emerald-300/10"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(['All', 'Active', 'Expiring Soon', 'Expired'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition',
                  statusFilter === filter
                    ? 'border-emerald-300/40 bg-emerald-300/15 text-emerald-100'
                    : 'border-white/10 bg-white/[0.04] text-white/50 hover:border-white/20 hover:text-white',
                )}
              >
                <Filter className="h-3.5 w-3.5" />
                {filter}
                <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">{statusFilterCounts[filter]}</span>
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      <GlassCard className="overflow-hidden">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[880px] text-left">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.04] text-xs uppercase tracking-[0.16em] text-white/38">
                <th className="px-5 py-4 font-semibold">Member</th>
                <th className="px-5 py-4 font-semibold">Plan</th>
                <th className="px-5 py-4 font-semibold">Expiry</th>
                <th className="px-5 py-4 font-semibold">Payment</th>
                <th className="px-5 py-4 font-semibold">Status</th>
                <th className="px-5 py-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {filteredMembers.map((member) => {
                const pending = memberPendingDues(member);
                const daysLeft = daysUntil(member.membership_end);
                const status = memberStatus(member);
                return (
                  <tr key={member.id || member.phone} className="group transition hover:bg-emerald-300/[0.035]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-sm font-semibold text-emerald-100">
                          {member.member_name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{member.member_name}</p>
                          <p className="truncate text-xs text-white/40">{member.phone}{member.member_id ? ` - ${member.member_id}` : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-white/65">{member.membership_plan}</span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-white/70">{member.membership_end}</p>
                      <p className="text-xs text-white/35">{daysLeft === null ? 'No date' : daysLeft < 0 ? `${Math.abs(daysLeft)} days overdue` : `${daysLeft} days left`}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-white">{formatCurrency(Number(member.amuont_paid || 0))} / {formatCurrency(Number(member.fee || 0))}</p>
                      <p className={cn('text-xs', pending > 0 ? 'text-amber-200' : 'text-emerald-200')}>{pending > 0 ? `${formatCurrency(pending)} pending` : 'Fully paid'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill tone={status === 'Active' ? (isMembershipExpiringSoon(member.membership_end) ? 'amber' : 'green') : 'red'}>
                        {status === 'Active' && isMembershipExpiringSoon(member.membership_end) ? 'Expiring Soon' : status}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openBill(member, 'renewal')}
                          className="grid h-9 w-9 place-items-center rounded-lg border border-emerald-300/20 text-emerald-100 transition hover:border-emerald-300/40 hover:bg-emerald-300/10"
                          title="Renew membership"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openBill(member, 'payment')}
                          className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-white/50 transition hover:border-emerald-300/30 hover:bg-emerald-300/10 hover:text-emerald-200"
                          title="Generate bill"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEditMember(member)}
                          className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-white/50 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                          title="Edit member"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filteredMembers.length && (
            <div className="p-10 text-center text-sm text-white/45">No members match this view.</div>
          )}
        </div>

        <div className="grid gap-3 p-3 md:hidden">
          {filteredMembers.map((member) => {
            const pending = memberPendingDues(member);
            const status = memberStatus(member);
            return (
              <div key={member.id || member.phone} className="rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{member.member_name}</p>
                    <p className="text-xs text-white/40">{member.phone}</p>
                  </div>
                  <StatusPill tone={status === 'Active' ? (isMembershipExpiringSoon(member.membership_end) ? 'amber' : 'green') : 'red'}>
                    {status === 'Active' && isMembershipExpiringSoon(member.membership_end) ? 'Expiring Soon' : status}
                  </StatusPill>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-white/35">Plan</p>
                    <p className="mt-1 text-white/80">{member.membership_plan}</p>
                  </div>
                  <div>
                    <p className="text-white/35">Payment</p>
                    <p className="mt-1 text-white/80">{pending > 0 ? `${formatCurrency(pending)} due` : 'Paid'}</p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => openBill(member, 'renewal')}
                    className="flex-1 rounded-lg bg-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-950"
                  >
                    Renew
                  </button>
                  <button onClick={() => openBill(member, 'payment')} className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-white/70">
                    Bill
                  </button>
                  <button onClick={() => handleEditMember(member)} className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-white/70">
                    Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </motion.div>
  );

  const renderPayments = () => (
    <motion.div key="payments" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="space-y-6">
      <SectionHeader eyebrow="Payments" title="Revenue Command Center" />
      <div className="grid gap-4 md:grid-cols-3">
        <GlassCard className="p-5">
          <p className="text-sm text-white/45">Collected this month</p>
          <p className="mt-2 text-3xl font-semibold text-white">{formatCurrency(metrics.monthlyRevenue)}</p>
          <MiniBars values={GROWTH_BARS.slice(0, 8)} />
        </GlassCard>
        <GlassCard className="p-5">
          <p className="text-sm text-white/45">Pending dues</p>
          <p className="mt-2 text-3xl font-semibold text-white">{formatCurrency(metrics.pendingPayments)}</p>
          <div className="mt-5 h-2 rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-emerald-300" style={{ width: `${Math.max(8, 100 - metrics.collectionRate)}%` }} />
          </div>
        </GlassCard>
        <GlassCard className="p-5">
          <p className="text-sm text-white/45">Razorpay status</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-emerald-300/10 text-emerald-200">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-white">Payment links ready</p>
              <p className="text-xs text-white/38">{gymName || userId}</p>
              <p className="text-xs text-white/38">UPI: {upiId || 'add in settings'}{gstNumber ? ` - GST: ${gstNumber}` : ''}</p>
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.82fr]">
        <GlassCard className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Pending dues</h3>
            <StatusPill tone="amber">{pendingMembers.length} open</StatusPill>
          </div>
          <div className="space-y-3">
            {(pendingMembers.length ? pendingMembers.slice(0, 6) : members.slice(0, 4)).map((member) => (
              <div key={member.id || member.phone} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{member.member_name}</p>
                  <p className="text-xs text-white/38">{member.phone}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-white">{formatCurrency((member as any).pending || memberPendingDues(member))}</p>
                  <button
                    onClick={() => openBill(member, 'payment')}
                    className="rounded-lg bg-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-200"
                  >
                    Bill
                  </button>
                </div>
              </div>
            ))}
            {!members.length && <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-sm text-white/45">No payment data yet.</div>}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <h3 className="text-lg font-semibold text-white">Payment history</h3>
          <div className="mt-4 space-y-3">
            {paymentHistory.slice(0, 6).map((payment) => (
              <div key={payment.transaction_id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/18 p-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.05] text-emerald-200">
                    {payment.payment_type === 'renewal' ? <RefreshCw className="h-4 w-4" /> : <CircleCheck className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{payment.member_name}</p>
                    <p className="text-xs text-white/35">
                      {payment.payment_date || 'No date'} - {payment.transaction_id}
                      {payment.payment_type === 'renewal' && payment.new_membership_end ? ` - renewed to ${payment.new_membership_end}` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-emerald-100">{formatCurrency(Number(payment.amount || payment.amount_paid || 0))}</p>
                  <p className="text-xs text-white/35">{payment.payment_type === 'renewal' ? `Renewal${payment.renewal_plan ? ` - ${payment.renewal_plan}` : ''}` : payment.payment_status || 'Recorded'}</p>
                </div>
              </div>
            ))}
            {!paymentHistory.length && <p className="py-8 text-center text-sm text-white/45">Collected payments will appear here.</p>}
          </div>
        </GlassCard>
      </div>
    </motion.div>
  );

  const renderReminders = () => (
    <motion.div key="reminders" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="space-y-6">
      <SectionHeader eyebrow="Automation" title="Reminders & Notifications" />
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <GlassCard className="p-5">
          <h3 className="text-lg font-semibold text-white">WhatsApp confirmations</h3>
          <div className="mt-5 space-y-3">
            {(renewalMembers.length ? renewalMembers.slice(0, 5) : members.slice(0, 5)).map((member, index) => (
              <div key={member.id || member.phone} className="rounded-lg border border-emerald-300/15 bg-emerald-300/[0.07] p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#25D366]/15 text-[#8bf4af]">
                    <MessageCircle className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Reminder {index === 0 ? 'ready' : 'queued'} to {member.member_name}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-white/50">
                      Membership {Number((member as any).daysLeft) < 0 ? 'expired' : 'expires'} {Math.abs(Number((member as any).daysLeft || 3))} days {Number((member as any).daysLeft) < 0 ? 'ago' : 'from now'}.
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {!members.length && <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-sm text-white/45">Reminder activity starts after members are added.</div>}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <h3 className="text-lg font-semibold text-white">Automation timeline</h3>
          <div className="mt-6 space-y-5">
            {[
              ['7 days before expiry', 'Friendly renewal nudge with plan details'],
              ['3 days before expiry', 'WhatsApp follow-up with payment link'],
              ['1 day before expiry', 'Owner alert and member reminder'],
              ['After expiry', 'At-risk member recovery workflow'],
            ].map(([title, body], index) => (
              <div key={title} className="relative flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="grid h-8 w-8 place-items-center rounded-full border border-emerald-300/20 bg-emerald-300/10 text-xs font-bold text-emerald-200">{index + 1}</div>
                  {index < 3 && <div className="mt-2 h-10 w-px bg-white/10" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="mt-1 text-sm text-white/45">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </motion.div>
  );

  const renderAnalytics = () => {
    const focusLabel = analyticsFocus === 'revenue' ? 'Revenue' : analyticsFocus === 'members' ? 'Members' : 'Renewals';
    const healthScore = Math.round((metrics.collectionRate + (metrics.totalMembers ? (metrics.activeMembers / metrics.totalMembers) * 100 : 0)) / 2);
    const riskTone = analytics.atRiskMembers.length || analytics.overdueMembers.length ? 'amber' : 'green';

    return (
      <motion.div key="analytics" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="space-y-6">
        <SectionHeader
          eyebrow="Analytics"
          title="Performance Intelligence"
          action={
            <div className="flex flex-wrap gap-2">
              {(['3m', '6m', '12m'] as AnalyticsRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setAnalyticsRange(range)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-xs font-semibold transition',
                    analyticsRange === range ? 'border-emerald-300/40 bg-emerald-300/15 text-emerald-100' : 'border-white/10 bg-white/[0.045] text-white/48 hover:text-white',
                  )}
                >
                  {range.toUpperCase()}
                </button>
              ))}
            </div>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ['Business health', `${healthScore}%`, 'Collection + active members', ShieldCheck, healthScore >= 70 ? 'green' : 'amber'],
            ['Collected', formatCurrency(metrics.monthlyRevenue), `${metrics.collectionRate}% collection`, Wallet, 'green'],
            ['Pending dues', formatCurrency(metrics.pendingPayments), `${pendingMembers.length} members need follow-up`, AlertCircle, pendingMembers.length ? 'amber' : 'green'],
            ['Renewal risk', `${analytics.atRiskMembers.length} urgent`, `${metrics.renewalsDue} due this week`, Bell, riskTone],
          ].map(([label, value, sub, Icon, tone]) => (
            <GlassCard key={label as string} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-white/45">{label as string}</p>
                  <p className="mt-2 truncate text-2xl font-semibold text-white">{value as string}</p>
                  <p className="mt-1 text-xs text-white/35">{sub as string}</p>
                </div>
                <div className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-lg', tone === 'amber' ? 'bg-amber-300/10 text-amber-200' : 'bg-emerald-300/10 text-emerald-200')}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </GlassCard>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <GlassCard className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/80">{focusLabel} trend</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Month-by-month performance</h3>
              </div>
              <div className="grid grid-cols-3 rounded-lg border border-white/10 bg-black/20 p-1">
                {[
                  ['revenue', Wallet],
                  ['members', Users],
                  ['renewals', Calendar],
                ].map(([focus, Icon]) => (
                  <button
                    key={focus as string}
                    onClick={() => setAnalyticsFocus(focus as AnalyticsFocus)}
                    className={cn(
                      'grid h-9 w-11 place-items-center rounded-md transition',
                      analyticsFocus === focus ? 'bg-emerald-300 text-emerald-950' : 'text-white/45 hover:bg-white/10 hover:text-white',
                    )}
                    title={`${focus} view`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_10rem]">
              <div className="flex h-80 items-end gap-2 rounded-lg border border-white/10 bg-black/20 p-4">
                {analytics.monthKeys.map((month) => {
                  const revenueHeight = Math.max(8, ((month.revenue + month.dues) / analytics.revenueMax) * 100);
                  const paidHeight = Math.max(6, (month.revenue / analytics.revenueMax) * 100);
                  const memberHeight = Math.max(8, (month.joins / analytics.joinsMax) * 100);
                  const renewalHeight = Math.max(8, (month.renewals / analytics.renewalsMax) * 100);
                  const primaryHeight = analyticsFocus === 'revenue' ? revenueHeight : analyticsFocus === 'members' ? memberHeight : renewalHeight;
                  const primaryValue = analyticsFocus === 'revenue' ? formatCurrency(month.revenue) : analyticsFocus === 'members' ? `${month.joins} joined` : `${month.renewals} renewals`;

                  return (
                    <button
                      key={month.key}
                      type="button"
                      onClick={() => {
                        setToast({ message: `${month.label}: ${primaryValue}`, type: 'success' });
                      }}
                      className="group flex min-w-0 flex-1 flex-col items-center gap-3"
                      title={`${month.label}: ${primaryValue}`}
                    >
                      <div className="relative flex h-60 w-full items-end justify-center rounded-md border border-white/5 bg-white/[0.025] px-1.5 transition group-hover:border-emerald-300/25 group-hover:bg-emerald-300/[0.06]">
                        {analyticsFocus === 'revenue' && (
                          <>
                            <div className="absolute bottom-0 w-[62%] rounded-t bg-amber-300/25" style={{ height: `${revenueHeight}%` }} />
                            <div className="absolute bottom-0 w-[62%] rounded-t bg-gradient-to-t from-emerald-600/60 to-emerald-200" style={{ height: `${paidHeight}%` }} />
                          </>
                        )}
                        {analyticsFocus !== 'revenue' && (
                          <div
                            className={cn('w-[62%] rounded-t', analyticsFocus === 'members' ? 'bg-gradient-to-t from-cyan-600/50 to-cyan-200' : 'bg-gradient-to-t from-violet-600/50 to-violet-200')}
                            style={{ height: `${primaryHeight}%` }}
                          />
                        )}
                      </div>
                      <span className="text-[11px] font-medium text-white/40">{month.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-3">
                {[
                  ['Potential', formatCurrency(analytics.totalPotential)],
                  ['Avg fee', formatCurrency(analytics.averageFee)],
                  ['Avg paid', formatCurrency(analytics.averagePaid)],
                  ['New joins', `${analytics.monthKeys.reduce((acc, month) => acc + month.joins, 0)}`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-white/10 bg-white/[0.045] p-4">
                    <p className="text-xs text-white/38">{label}</p>
                    <p className="mt-1 text-lg font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Member status</h3>
              <StatusPill tone={metrics.expiredMembers ? 'amber' : 'green'}>{metrics.activeMembers} active</StatusPill>
            </div>
            <div className="mt-6 grid place-items-center">
              <div
                className="grid h-44 w-44 place-items-center rounded-full"
                style={{
                  background: `conic-gradient(#6ee7b7 0 ${metrics.totalMembers ? (analytics.statusCounts.active / metrics.totalMembers) * 100 : 0}%, #fbbf24 0 ${metrics.totalMembers ? ((analytics.statusCounts.active + analytics.statusCounts.other) / metrics.totalMembers) * 100 : 0}%, #f87171 0 100%)`,
                }}
              >
                <div className="grid h-32 w-32 place-items-center rounded-full border border-white/10 bg-[#101711] text-center">
                  <div>
                    <p className="text-3xl font-semibold text-white">{metrics.totalMembers}</p>
                    <p className="text-xs text-white/38">members</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {[
                ['Active', analytics.statusCounts.active, 'bg-emerald-300'],
                ['Expiring', analytics.statusCounts.other, 'bg-amber-300'],
                ['Expired', analytics.statusCounts.expired, 'bg-red-300'],
              ].map(([label, value, color]) => (
                <div key={label as string} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-white/60">
                    <span className={cn('h-2.5 w-2.5 rounded-full', color as string)} />
                    {label as string}
                  </div>
                  <span className="font-semibold text-white">{value as number}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <GlassCard className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Plan mix</h3>
              <StatusPill tone="neutral">{analytics.planMix.length || 0} plans</StatusPill>
            </div>
            <div className="mt-5 space-y-4">
              {(analytics.planMix.length ? analytics.planMix : [{ name: 'No plan data', count: 0, percent: 0 }]).slice(0, 5).map((plan) => (
                <button
                  key={plan.name}
                  type="button"
                  onClick={() => {
                    setStatusFilter('All');
                    setSearchQuery(plan.name === 'No plan data' ? '' : plan.name);
                    setActiveView('members');
                  }}
                  className="w-full text-left"
                >
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium text-white">{plan.name}</span>
                    <span className="text-white/45">{plan.count} members</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-cyan-200" style={{ width: `${Math.max(3, plan.percent)}%` }} />
                  </div>
                </button>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-semibold text-white">Action queue</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveView('payments')}
                  className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/55 transition hover:bg-white/10 hover:text-white"
                >
                  Payments
                </button>
                <button
                  onClick={() => setActiveView('reminders')}
                  className="rounded-lg bg-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-200"
                >
                  Reminders
                </button>
              </div>
            </div>
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-semibold text-white">Top dues</p>
                  <StatusPill tone={analytics.topDebtors.length ? 'amber' : 'green'}>{analytics.topDebtors.length}</StatusPill>
                </div>
                <div className="space-y-3">
                  {(analytics.topDebtors.length ? analytics.topDebtors : members.slice(0, 3)).map((member) => {
                    const pending = memberPendingDues(member);
                    return (
                      <div key={member.id || member.phone} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">{member.member_name}</p>
                          <p className="text-xs text-white/35">{member.phone}</p>
                        </div>
                        <button
                          onClick={() => openBill(member, 'payment')}
                          className="shrink-0 rounded-lg border border-amber-300/20 px-2.5 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-300/10"
                        >
                          {pending > 0 ? formatCurrency(pending) : 'Bill'}
                        </button>
                      </div>
                    );
                  })}
                  {!members.length && <p className="py-5 text-center text-sm text-white/40">No dues yet.</p>}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-semibold text-white">Renewal watch</p>
                  <StatusPill tone={analytics.atRiskMembers.length ? 'amber' : 'green'}>{analytics.atRiskMembers.length} urgent</StatusPill>
                </div>
                <div className="space-y-3">
                  {(analytics.atRiskMembers.length ? analytics.atRiskMembers : renewalMembers.slice(0, 3)).map((member) => (
                    <button
                      key={member.id || member.phone}
                      onClick={() => openBill(member, 'renewal')}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.05]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{member.member_name}</p>
                        <p className="text-xs text-white/35">{member.membership_end || 'No renewal date'}</p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-emerald-100">
                        {member.daysLeft === null ? 'Set date' : Number(member.daysLeft) < 0 ? `${Math.abs(Number(member.daysLeft))}d late` : `${member.daysLeft}d left`}
                      </span>
                    </button>
                  ))}
                  {!renewalMembers.length && <p className="py-5 text-center text-sm text-white/40">No renewals in the risk window.</p>}
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        <GlassCard className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Owner snapshot</h3>
              <p className="mt-1 text-sm text-white/42">Simple numbers to guide daily action.</p>
            </div>
            <button
              onClick={() => handleCopyReport(financeReport)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {isCopied ? 'Copied' : 'Copy report'}
            </button>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {[
              ['Best payer', analytics.bestMembers[0]?.member_name || 'No data', analytics.bestMembers[0] ? formatCurrency(Number(analytics.bestMembers[0].amuont_paid || 0)) : 'Add payments'],
              ['Highest plan', analytics.planMix[0]?.name || 'No plan', `${analytics.planMix[0]?.percent || 0}% share`],
              ['Recovery target', analytics.topDebtors[0]?.member_name || 'No pending dues', analytics.topDebtors[0] ? formatCurrency(memberPendingDues(analytics.topDebtors[0])) : 'Clear'],
              ['Renewal load', `${analytics.monthKeys.reduce((acc, month) => acc + month.renewals, 0)} renewals`, `${analyticsRange.toUpperCase()} window`],
            ].map(([label, value, sub]) => (
              <div key={label} className="rounded-lg border border-white/10 bg-white/[0.045] p-4">
                <p className="text-xs text-white/38">{label}</p>
                <p className="mt-2 truncate text-base font-semibold text-white">{value}</p>
                <p className="mt-1 text-xs text-white/35">{sub}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      </motion.div>
    );
  };

  const renderPlans = () => {
    const selectedDietMember = getPlanMember(dietMemberId);
    const selectedWorkoutMember = getPlanMember(workoutMemberId);
    const planInputClass =
      'w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-emerald-300/60 focus:ring-4 focus:ring-emerald-300/10';
    const planLabelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-white/48';
    const memberOptions = members.map((member) => ({
      label: `${member.member_name}${member.phone ? ` - ${member.phone}` : ''}`,
      value: member.id || member.member_name,
    }));
    const planTabs: Array<{ kind: PlanKind; icon: LucideIcon; label: string }> = [
      { kind: 'diet', icon: Utensils, label: 'Diet' },
      { kind: 'workout', icon: Dumbbell, label: 'Workout' },
    ];

    return (
      <motion.div key="plans" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="space-y-6">
        <SectionHeader
          eyebrow="AI Plans"
          title="Diet & Workout Studio"
          action={
            <div className="grid grid-cols-2 rounded-lg border border-white/10 bg-black/25 p-1">
              {planTabs.map(({ kind, icon: Icon, label }) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setActivePlanKind(kind)}
                  className={cn(
                    'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition',
                    activePlanKind === kind ? 'bg-emerald-300 text-emerald-950' : 'text-white/55 hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          }
        />

        {!members.length ? (
          <GlassCard className="p-8 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-emerald-300/10 text-emerald-200">
              <UserPlus className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-xl font-semibold text-white">Add a member first</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/45">Diet and workout PDFs are generated against a saved member profile so the plan can use their name, phone, email, and membership context.</p>
            <button
              onClick={() => setIsMemberModalOpen(true)}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-300 px-4 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-200"
            >
              <Plus className="h-4 w-4" />
              Add member
            </button>
          </GlassCard>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <GlassCard className="p-5 sm:p-6">
              <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300/80">
                    {activePlanKind === 'diet' ? 'Nutrition builder' : 'Training builder'}
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">
                    {activePlanKind === 'diet' ? 'Generate a diet PDF' : 'Generate a workout PDF'}
                  </h3>
                </div>
                <StatusPill tone="green">{activePlanKind === 'diet' ? 'Meal plan' : 'Weekly split'}</StatusPill>
              </div>

              {activePlanKind === 'diet' ? (
                <div className="mt-5 space-y-5">
                  <div>
                    <label className={planLabelClass}>Member</label>
                    <select value={dietMemberId} onChange={(e) => setDietMemberId(e.target.value)} className={planInputClass}>
                      {memberOptions.map((option) => (
                        <option key={option.value} value={option.value} className="bg-[#0c120e]">
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className={planLabelClass}>Age</label>
                      <input value={dietForm.age} onChange={(e) => updateDietField('age', e.target.value)} className={planInputClass} type="number" min="1" placeholder="24" />
                    </div>
                    <div>
                      <label className={planLabelClass}>Gender</label>
                      <select value={dietForm.gender} onChange={(e) => updateDietField('gender', e.target.value)} className={planInputClass}>
                        {['Male', 'Female', 'Other'].map((value) => <option key={value} className="bg-[#0c120e]">{value}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={planLabelClass}>Meals/day</label>
                      <select value={dietForm.mealsPerDay} onChange={(e) => updateDietField('mealsPerDay', e.target.value)} className={planInputClass}>
                        {['3', '4', '5', '6'].map((value) => <option key={value} className="bg-[#0c120e]">{value}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className={planLabelClass}>Height</label>
                      <input value={dietForm.height} onChange={(e) => updateDietField('height', e.target.value)} className={planInputClass} placeholder="5ft 8in" />
                    </div>
                    <div>
                      <label className={planLabelClass}>Weight</label>
                      <input value={dietForm.weight} onChange={(e) => updateDietField('weight', e.target.value)} className={planInputClass} placeholder="78 kg" />
                    </div>
                    <div>
                      <label className={planLabelClass}>Target weight</label>
                      <input value={dietForm.targetWeight} onChange={(e) => updateDietField('targetWeight', e.target.value)} className={planInputClass} placeholder="70 kg" />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={planLabelClass}>Goal</label>
                      <select value={dietForm.goal} onChange={(e) => updateDietField('goal', e.target.value)} className={planInputClass}>
                        {['Fat loss', 'Muscle gain', 'Maintenance', 'Body recomposition', 'Strength support'].map((value) => <option key={value} className="bg-[#0c120e]">{value}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={planLabelClass}>Activity level</label>
                      <select value={dietForm.activityLevel} onChange={(e) => updateDietField('activityLevel', e.target.value)} className={planInputClass}>
                        {['Low', 'Moderate', 'High', 'Athlete'].map((value) => <option key={value} className="bg-[#0c120e]">{value}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={planLabelClass}>Food preference</label>
                      <select value={dietForm.dietaryPreference} onChange={(e) => updateDietField('dietaryPreference', e.target.value)} className={planInputClass}>
                        {['Vegetarian', 'Non-vegetarian', 'Eggetarian', 'Vegan', 'Jain'].map((value) => <option key={value} className="bg-[#0c120e]">{value}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={planLabelClass}>Budget</label>
                      <select value={dietForm.budgetPreference} onChange={(e) => updateDietField('budgetPreference', e.target.value)} className={planInputClass}>
                        {['Budget friendly', 'Standard', 'Premium'].map((value) => <option key={value} className="bg-[#0c120e]">{value}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className={planLabelClass}>Meal likes / dislikes</label>
                    <textarea value={dietForm.mealPreferences} onChange={(e) => updateDietField('mealPreferences', e.target.value)} className={`${planInputClass} min-h-20 resize-none`} placeholder="Rice is okay, avoid paneer at night, prefers Indian meals..." />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={planLabelClass}>Allergies</label>
                      <input value={dietForm.allergies} onChange={(e) => updateDietField('allergies', e.target.value)} className={planInputClass} placeholder="None" />
                    </div>
                    <div>
                      <label className={planLabelClass}>Medical notes</label>
                      <input value={dietForm.medicalConditions} onChange={(e) => updateDietField('medicalConditions', e.target.value)} className={planInputClass} placeholder="None" />
                    </div>
                  </div>

                  <button
                    onClick={generateDietPlanFromStudio}
                    disabled={planGenerating !== null}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-300 px-4 py-3 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-200 disabled:bg-white/10 disabled:text-white/30 disabled:shadow-none"
                  >
                    <Sparkles className="h-4 w-4" />
                    {planGenerating === 'diet' ? 'Generating diet PDF...' : 'Generate diet PDF'}
                  </button>
                </div>
              ) : (
                <div className="mt-5 space-y-5">
                  <div>
                    <label className={planLabelClass}>Member</label>
                    <select value={workoutMemberId} onChange={(e) => setWorkoutMemberId(e.target.value)} className={planInputClass}>
                      {memberOptions.map((option) => (
                        <option key={option.value} value={option.value} className="bg-[#0c120e]">
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={planLabelClass}>Goal</label>
                      <select value={workoutForm.goal} onChange={(e) => updateWorkoutField('goal', e.target.value)} className={planInputClass}>
                        {['Fat loss and strength', 'Muscle gain', 'General fitness', 'Strength', 'Mobility and conditioning'].map((value) => <option key={value} className="bg-[#0c120e]">{value}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={planLabelClass}>Experience</label>
                      <select value={workoutForm.experienceLevel} onChange={(e) => updateWorkoutField('experienceLevel', e.target.value)} className={planInputClass}>
                        {['Beginner', 'Intermediate', 'Advanced'].map((value) => <option key={value} className="bg-[#0c120e]">{value}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className={planLabelClass}>Days/week</label>
                      <select value={workoutForm.daysPerWeek} onChange={(e) => updateWorkoutField('daysPerWeek', e.target.value)} className={planInputClass}>
                        {['3', '4', '5', '6'].map((value) => <option key={value} className="bg-[#0c120e]">{value}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={planLabelClass}>Duration</label>
                      <select value={workoutForm.duration} onChange={(e) => updateWorkoutField('duration', e.target.value)} className={planInputClass}>
                        {['45 minutes', '60 minutes', '75 minutes', '90 minutes'].map((value) => <option key={value} className="bg-[#0c120e]">{value}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={planLabelClass}>Focus</label>
                      <select value={workoutForm.targetMuscleGroups} onChange={(e) => updateWorkoutField('targetMuscleGroups', e.target.value)} className={planInputClass}>
                        {['Full body', 'Upper/lower split', 'Push pull legs', 'Core and fat loss', 'Glutes and legs'].map((value) => <option key={value} className="bg-[#0c120e]">{value}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className={planLabelClass}>Injuries / limitations</label>
                    <textarea value={workoutForm.injuries} onChange={(e) => updateWorkoutField('injuries', e.target.value)} className={`${planInputClass} min-h-24 resize-none`} placeholder="Knee pain, shoulder restriction, lower back issue, or None" />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      ['Warm-up', 'Mobility and activation first'],
                      ['Progression', 'Weekly load guidance included'],
                      ['Recovery', 'Rest and cooldown advice'],
                    ].map(([title, body]) => (
                      <div key={title} className="rounded-lg border border-white/10 bg-white/[0.045] p-4">
                        <p className="text-sm font-semibold text-white">{title}</p>
                        <p className="mt-1 text-xs leading-5 text-white/40">{body}</p>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={generateWorkoutPlanFromStudio}
                    disabled={planGenerating !== null}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-300 px-4 py-3 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-200 disabled:bg-white/10 disabled:text-white/30 disabled:shadow-none"
                  >
                    <Sparkles className="h-4 w-4" />
                    {planGenerating === 'workout' ? 'Generating workout PDF...' : 'Generate workout PDF'}
                  </button>
                </div>
              )}
            </GlassCard>

            <div className="space-y-6">
              <GlassCard className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-white/45">Selected member</p>
                    <p className="mt-2 text-xl font-semibold text-white">
                      {(activePlanKind === 'diet' ? selectedDietMember : selectedWorkoutMember)?.member_name || 'Select member'}
                    </p>
                  </div>
                  <div className="grid h-12 w-12 place-items-center rounded-lg bg-emerald-300/10 text-emerald-200">
                    <User className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-5 grid gap-3 text-sm">
                  {[
                    ['Plan', (activePlanKind === 'diet' ? selectedDietMember : selectedWorkoutMember)?.membership_plan || '-'],
                    ['Phone', (activePlanKind === 'diet' ? selectedDietMember : selectedWorkoutMember)?.phone || '-'],
                    ['Email', (activePlanKind === 'diet' ? selectedDietMember : selectedWorkoutMember)?.email || 'Not added'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                      <span className="text-white/38">{label}</span>
                      <span className="min-w-0 truncate text-right font-medium text-white/75">{value}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>

              <GlassCard className="p-5">
                <h3 className="text-lg font-semibold text-white">Recent plan targets</h3>
                <div className="mt-4 space-y-3">
                  {(members.length ? members.slice(0, 4) : []).map((member) => (
                    <div key={member.id || member.phone} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{member.member_name}</p>
                        <p className="text-xs text-white/35">{memberStatus(member)} - {member.membership_plan || 'No plan'}</p>
                      </div>
                      <button
                        onClick={() => {
                          if (activePlanKind === 'diet') setDietMemberId(member.id || member.member_name);
                          else setWorkoutMemberId(member.id || member.member_name);
                        }}
                        className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/55 transition hover:border-emerald-300/30 hover:bg-emerald-300/10 hover:text-emerald-100"
                      >
                        Use
                      </button>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  const renderContent = () => {
    if (activeView === 'chat') return renderChat();
    if (activeView === 'members') return renderMembers();
    if (activeView === 'payments') return renderPayments();
    if (activeView === 'reminders') return renderReminders();
    if (activeView === 'analytics') return renderAnalytics();
    if (activeView === 'plans') return renderPlans();
    return renderDashboard();
  };

  const activeTitle = {
    dashboard: 'Dashboard',
    chat: 'AI Tools',
    members: 'Members',
    payments: 'Payments',
    reminders: 'Reminders',
    analytics: 'Analytics',
    plans: 'Plans',
  }[activeView];

  if (!mounted) {
    return <div className="min-h-screen bg-[#050806]" />;
  }

  return (
    <>
      <div className="min-h-screen overflow-hidden bg-[#050806] font-sans text-white print:hidden">
        <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(135deg,#050806_0%,#0e1711_46%,#050806_100%)]" />
        <div className="pointer-events-none fixed inset-x-0 top-0 h-64 bg-gradient-to-b from-emerald-300/10 to-transparent" />

        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
            />
          )}
        </AnimatePresence>

        <div className="relative flex h-screen">
          <aside
            className={cn(
              'fixed inset-y-0 left-0 z-50 flex w-[min(84vw,20rem)] flex-col border-r border-white/10 bg-[#070b08]/95 shadow-2xl shadow-black/40 backdrop-blur-xl transition-transform duration-300 lg:static lg:w-72 lg:translate-x-0',
              isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
            )}
          >
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-300 text-emerald-950 shadow-lg shadow-emerald-400/20">
                  <Dumbbell className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold tracking-tight text-white">GymAssist AI</p>
                  <p className="text-xs text-white/38">Ops center</p>
                </div>
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-white/50 lg:hidden"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              <button
                onClick={() => setIsMemberModalOpen(true)}
                className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-300 px-4 py-3 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-200"
              >
                <Plus className="h-4 w-4" />
                Quick add member
              </button>

              <nav className="space-y-1">
                {NAV_ITEMS.map((item, index) => {
                  const Icon = item.icon;
                  const isActive = item.id !== 'settings' && (activeView === item.id || (activeView === 'plans' && (item.label === 'Diet Plans' || item.label === 'Workout Plans')));
                  return (
                    <button
                      key={`${item.label}-${index}`}
                      onClick={() => openView(item.id)}
                      className={cn(
                        'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                        isActive
                          ? 'bg-emerald-300/12 text-emerald-100 shadow-[inset_0_0_0_1px_rgba(110,231,183,0.18),0_0_24px_rgba(16,185,129,0.12)]'
                          : 'text-white/48 hover:bg-white/[0.06] hover:text-white',
                      )}
                    >
                      <Icon className={cn('h-4 w-4', isActive ? 'text-emerald-200' : 'text-white/35 group-hover:text-white/70')} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.045] p-3">
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/35">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-200" />
                  Commands
                </div>
                <div className="space-y-2">
                  {COMMANDS.slice(0, 3).map((command) => (
                    <button
                      key={command.text}
                      onClick={() => handleSuggestionClick(command.text)}
                      className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-left text-xs leading-5 text-white/55 transition hover:border-emerald-300/30 hover:text-emerald-100"
                    >
                      {command.text}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg border border-emerald-300/20 bg-emerald-300/10 text-sm font-bold text-emerald-100">
                  {userId.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{userId}</p>
                  <p className="truncate text-xs text-white/38">Gym owner workspace</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/55 transition hover:bg-white/10 hover:text-white"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Settings
                </button>
                <button
                  onClick={onLogout}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300/15 px-3 py-2 text-xs font-semibold text-red-200/80 transition hover:bg-red-400/10 hover:text-red-100"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Logout
                </button>
              </div>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070b08]/72 px-4 py-3 backdrop-blur-xl sm:px-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 text-white/62 transition hover:bg-white/10 lg:hidden"
                  aria-label="Open navigation"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div className="hidden min-w-0 sm:block">
                  <p className="text-xs text-white/38">Workspace</p>
                  <div className="flex items-center gap-2">
                    <h1 className="truncate text-base font-semibold text-white">{userId}</h1>
                    <ChevronDown className="h-4 w-4 text-white/35" />
                  </div>
                </div>
                <div className="sm:hidden">
                  <h1 className="text-base font-semibold text-white">{activeTitle}</h1>
                </div>

                <div className="mx-auto hidden w-full max-w-md items-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 py-2 text-sm text-white/35 md:flex">
                  <Search className="h-4 w-4" />
                  <span>Search members, payments, renewals...</span>
                </div>

                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => setIsMemberModalOpen(true)}
                    className="hidden items-center gap-2 rounded-lg bg-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-200 sm:inline-flex"
                  >
                    <Plus className="h-4 w-4" />
                    Quick action
                  </button>
                  <button className="relative grid h-10 w-10 place-items-center rounded-lg border border-white/10 text-white/55 transition hover:bg-white/10 hover:text-white" aria-label="Notifications">
                    <Bell className="h-4 w-4" />
                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald-300" />
                  </button>
                  <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 text-white/55 transition hover:bg-white/10 hover:text-white"
                    aria-label="Settings"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                  {mounted && (
                    <button
                      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                      className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 text-white/55 transition hover:bg-white/10 hover:text-white"
                      aria-label="Toggle theme"
                    >
                      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    </button>
                  )}
                  <div className="hidden h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-2 pr-3 sm:flex">
                    <div className="grid h-7 w-7 place-items-center rounded-md bg-emerald-300 text-xs font-bold text-emerald-950">{userId.charAt(0).toUpperCase()}</div>
                    <span className="max-w-24 truncate text-xs font-semibold text-white/70">Profile</span>
                  </div>
                </div>
              </div>
            </header>

            <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-7xl">
                <AnimatePresence mode="wait">{renderContent()}</AnimatePresence>
              </div>
            </main>
          </div>
        </div>
      </div>

      <MemberModal
        key={selectedMember ? `edit-${selectedMember.member_name}` : `new-${standardFees.oneMonth}-${standardFees.threeMonths}-${standardFees.sixMonths}-${standardFees.oneYear}`}
        isOpen={isMemberModalOpen}
        onClose={() => {
          setIsMemberModalOpen(false);
          setSelectedMember(null);
        }}
        onSave={handleSaveMember}
        initialData={selectedMember}
        standardFees={standardFees}
      />

      <SettingsModal
        key={isSettingsOpen ? `settings-${upiId}-${gymName}-${gstNumber}` : 'settings-closed'}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        upiId={upiId}
        gymName={gymName}
        gstNumber={gstNumber}
        standardFees={standardFees}
        onSave={handleSaveProfile}
      />

      <BillModal
        isOpen={isBillModalOpen}
        onClose={() => {
          setIsBillModalOpen(false);
          setSelectedMemberForBill(null);
          setBillMode('payment');
        }}
        onSave={handleSaveBill}
        member={selectedMemberForBill}
        owner_upi_id={upiId}
        mode={billMode}
        gymName={gymName}
        gstNumber={gstNumber}
        standardFees={standardFees}
      />

      <DietPlanModal
        isOpen={isDietPlanModalOpen}
        onClose={() => {
          setIsDietPlanModalOpen(false);
          setSelectedDietPlan(null);
        }}
        dietPlan={selectedDietPlan}
        gymName={gymName}
        gstNumber={gstNumber}
        memberEmail={selectedDietPlan ? members.find((m) => m.member_name.toLowerCase() === selectedDietPlan.memberName.toLowerCase())?.email : undefined}
        memberPhone={selectedDietPlan ? members.find((m) => m.member_name.toLowerCase() === selectedDietPlan.memberName.toLowerCase())?.phone : undefined}
      />

      <WorkoutPlanModal
        isOpen={isWorkoutPlanModalOpen}
        onClose={() => {
          setIsWorkoutPlanModalOpen(false);
          setSelectedWorkoutPlan(null);
        }}
        workoutPlan={selectedWorkoutPlan}
        gymName={gymName}
        gstNumber={gstNumber}
        memberEmail={selectedWorkoutPlan ? members.find((m) => m.member_name.toLowerCase() === selectedWorkoutPlan.memberName.toLowerCase())?.email : undefined}
        memberPhone={selectedWorkoutPlan ? members.find((m) => m.member_name.toLowerCase() === selectedWorkoutPlan.memberName.toLowerCase())?.phone : undefined}
      />

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className={cn(
              'fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-3 rounded-lg px-5 py-3 text-sm font-semibold text-white shadow-2xl backdrop-blur-xl',
              toast.type === 'success' ? 'border border-emerald-300/20 bg-emerald-700/90' : 'border border-red-300/20 bg-red-700/90',
            )}
          >
            {toast.type === 'success' ? <CreditCard className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
