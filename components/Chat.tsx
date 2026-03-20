'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, User, Bot, Dumbbell, Calendar, CreditCard, MessageSquare, Menu, X, Plus, MessageCircle, Smartphone, Users, LogOut, Settings, AlertCircle, LayoutDashboard, TrendingUp, Clock, UserPlus, Edit2, Copy, Check, FileText, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'motion/react';
import MemberModal, { Member } from './MemberModal';
import BillModal from './BillModal';
import DietPlanModal, { DietPlanData } from './DietPlanModal';
import WorkoutPlanModal, { WorkoutPlanData } from './WorkoutPlanModal';
import { ThemeToggle } from './ThemeToggle';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  upiId: string;
  onSave: (upiId: string) => void;
}

function SettingsModal({ isOpen, onClose, upiId, onSave }: SettingsModalProps) {
  const [newUpiId, setNewUpiId] = useState(upiId);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full max-w-sm bg-white dark:bg-neutral-900 rounded-2xl shadow-xl p-6 transition-colors"
          >
            <h2 className="text-xl font-bold mb-4">Profile Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">UPI ID for Payments</label>
                <input
                  type="text"
                  value={newUpiId}
                  onChange={(e) => setNewUpiId(e.target.value)}
                  placeholder="e.g. gym@okaxis"
                  className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                />
                <p className="text-[10px] text-neutral-400 mt-1">This ID will be included in all payment reminders.</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">Cancel</button>
                <button 
                  onClick={() => onSave(newUpiId)}
                  className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-xl hover:bg-emerald-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

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

const SUGGESTIONS = [
  "Generate a reminder for Rohit. His membership expires on 20 March.",
  "What should I do if memberships are expiring this week?",
  "What does 'Send Reminder' do?",
  "Add member: Amit, 9876543210, 3 months, paid ₹1500 of ₹3000.",
];

export default function Chat({ userId, upiId: initialUpiId, onLogout }: { userId: string; upiId: string | null; onLogout: () => void }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [activeView, setActiveView] = useState<'chat' | 'members' | 'dashboard'>('dashboard');
  const [upiId, setUpiId] = useState(initialUpiId || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Expired' | 'Expiring Soon'>('All');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      content: `Namaste! I am GymAssist AI. You are logged in as **${userId}**. How can I help you manage your gym today?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [isDietPlanModalOpen, setIsDietPlanModalOpen] = useState(false);
  const [isWorkoutPlanModalOpen, setIsWorkoutPlanModalOpen] = useState(false);
  const [selectedDietPlan, setSelectedDietPlan] = useState<DietPlanData | null>(null);
  const [selectedWorkoutPlan, setSelectedWorkoutPlan] = useState<WorkoutPlanData | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedMemberForBill, setSelectedMemberForBill] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`/api/auth/profile?username=${userId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.upiId) {
            setUpiId(data.upiId);
            localStorage.setItem('gym_assist_upi_id', data.upiId);
          }
        }
      } catch (e) {
        console.error('Failed to fetch profile', e);
      }
    };
    fetchProfile();
  }, [userId]);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const res = await fetch('/api/members', {
          headers: { 'x-user-id': userId }
        });
        if (res.ok) {
          const data = await res.json();
          setMembers(data);
        }
      } catch (e) {
        console.error('Failed to fetch members', e);
      }
    };
    fetchMembers();
  }, [userId]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleSaveProfile = async (newUpi: string) => {
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: userId, upiId: newUpi }),
      });
      if (res.ok) {
        setUpiId(newUpi);
        localStorage.setItem('gym_assist_upi_id', newUpi);
        setIsSettingsOpen(false);
        setToast({ message: 'Profile updated successfully', type: 'success' });
      } else {
        setToast({ message: 'Failed to update profile', type: 'error' });
      }
    } catch (e) {
      setToast({ message: 'Failed to update profile', type: 'error' });
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const res = await fetch('/api/members', {
          headers: { 'x-user-id': userId }
        });
        if (res.ok) {
          const data = await res.json();
          setMembers(data);
        }
      } catch (e) {
        console.error('Failed to fetch members', e);
      }
    };
    fetchMembers();
  }, [userId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSaveMember = async (member: Member) => {
    setIsLoading(true);
    try {
      const method = selectedMember ? 'PUT' : 'POST';
      const res = await fetch('/api/members', {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify(member),
      });

      if (res.ok) {
        const savedMember = await res.json();
        if (selectedMember) {
          setMembers(prev => prev.map(m => m.id === savedMember.id ? savedMember : m));
          setToast({ message: 'Member updated successfully', type: 'success' });
        } else {
          setMembers(prev => [savedMember, ...prev]);
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
    if (!selectedMemberForBill) return;
    setIsLoading(true);
    try {
      // 1. Save payment and update history via API
      const paymentRes = await fetch('/api/payments', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify({
          member_id: selectedMemberForBill.id,
          transaction_id: bill.transactionId,
          amount: bill.amountReceived,
          payment_date: bill.paymentDate,
          member_upi_id: bill.memberUpiId,
          owner_upi_id: bill.owner_upi_id,
          bill_url: bill.bill_url || null
        }),
      });

      if (!paymentRes.ok) {
        const err = await paymentRes.json();
        throw new Error(err.error || 'Failed to save payment history');
      }

      // 2. Refresh members to get updated status
      const membersRes = await fetch('/api/members', {
        headers: { 'x-user-id': userId }
      });
      if (membersRes.ok) {
        const updatedMembers = await membersRes.json();
        setMembers(updatedMembers);
      }

      setToast({ message: 'Payment recorded successfully and bill generated.', type: 'success' });
      
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'model',
          content: `Payment recorded successfully and bill generated for **${selectedMemberForBill.member_name}**. Status updated to **ACTIVE**.`,
        }
      ]);

    } catch (e: any) {
      setToast({ message: `Failed to record payment: ${e.message}`, type: 'error' });
    } finally {
      setIsLoading(false);
      setIsBillModalOpen(false);
      setSelectedMemberForBill(null);
    }
  };

  const currentMonth = new Date().toLocaleString('default', { month: 'long' });
  const financeReport = `
${currentMonth} Summary

Total Members: ${members.length}
Active Members: ${members.filter(m => m.status === 'Active').length}
Expired Members: ${members.filter(m => m.status === 'Expired').length}
  `.trim();

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
          messages: [...messages.filter(m => m.id !== 'welcome'), userMessage],
          upiId,
          members
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to fetch response from server');
      }

      const data = await res.json();

      if (data.type === 'functionCall') {
        if (data.name === 'generateDietPlan') {
          const modelMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            content: data.content,
            dietPlan: data.args as DietPlanData
          };
          setMessages((prev) => [...prev, modelMessage]);
        } else if (data.name === 'generateWorkoutPlan') {
          const modelMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            content: data.content,
            workoutPlan: data.args as WorkoutPlanData
          };
          setMessages((prev) => [...prev, modelMessage]);
        } else {
          const modelMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            content: data.content,
            action: {
              type: data.name === 'prepareWhatsApp' ? 'whatsapp' : 'sms',
              phone: data.args.phone,
              message: data.args.message
            }
          };
          setMessages((prev) => [...prev, modelMessage]);
        }
      } else {
        const modelMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          content: data.content || 'Sorry, I could not process that request.',
        };
        setMessages((prev) => [...prev, modelMessage]);
      }
    } catch (error: any) {
      console.error('Error generating response:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'model',
          content: `Error: ${error.message || 'Sorry, I encountered an error. Please try again.'}`,
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

  const stats = {
    totalActive: members.filter(m => m.status === 'Active').length,
    expiringSoon: members.filter(m => {
      if (!m.membership_end) return false;
      const expiry = new Date(m.membership_end);
      const diff = expiry.getTime() - new Date().getTime();
      const days = diff / (1000 * 60 * 60 * 24);
      return days >= 0 && days <= 7;
    }).length,
    pendingPayments: members.reduce((acc, m) => acc + (Number(m.fee || 0) - Number(m.amuont_paid || 0)), 0),
    newToday: members.filter(m => m.membership_start === new Date().toISOString().split('T')[0]).length,
  };

  const filteredMembers = members.filter(m => {
    const matchesSearch = m.member_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         m.phone.includes(searchQuery);
    
    if (statusFilter === 'All') return matchesSearch;
    if (statusFilter === 'Active') return matchesSearch && m.status === 'Active';
    if (statusFilter === 'Expired') return matchesSearch && m.status === 'Expired';
    if (statusFilter === 'Expiring Soon') {
      if (!m.membership_end) return false;
      const expiry = new Date(m.membership_end);
      const diff = expiry.getTime() - new Date().getTime();
      const days = diff / (1000 * 60 * 60 * 24);
      return matchesSearch && days >= 0 && days <= 7;
    }
    return matchesSearch;
  });

  return (
    <>
      <div className="flex h-screen bg-neutral-50 dark:bg-neutral-950 font-sans text-neutral-900 dark:text-neutral-50 overflow-hidden print:hidden transition-colors">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.div
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 flex flex-col transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between transition-colors">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xl">
            <Dumbbell className="w-6 h-6" />
            <span>GymAssist AI</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-1 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <button
            onClick={() => setIsMemberModalOpen(true)}
            className="w-full mb-3 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-4 rounded-xl font-medium transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            New Member
          </button>

          <div className="space-y-1 mb-6">
            <button
              onClick={() => { setActiveView('dashboard'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeView === 'dashboard'
                  ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
              Dashboard
            </button>
            <button
              onClick={() => { setActiveView('chat'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeView === 'chat'
                  ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
              AI Assistant
            </button>
            <button
              onClick={() => { setActiveView('members'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeView === 'members'
                  ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
              }`}
            >
              <Users className="w-5 h-5" />
              Members
            </button>
          </div>

          <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">Quick Actions</h3>
          <div className="space-y-2">
            {SUGGESTIONS.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full text-left p-3 text-sm bg-neutral-50 dark:bg-neutral-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-400 border border-neutral-100 dark:border-neutral-700 rounded-xl transition-colors flex items-start gap-3 group"
              >
                <MessageSquare className="w-4 h-4 mt-0.5 text-neutral-400 group-hover:text-emerald-500 shrink-0" />
                <span className="leading-snug">{suggestion}</span>
              </button>
            ))}
          </div>

          <div className="mt-8">
            <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">Features</h3>
            <ul className="space-y-3 text-sm text-neutral-600 dark:text-neutral-400">
              <li className="flex items-center gap-3"><User className="w-4 h-4 text-neutral-400" /> Membership Tracking</li>
              <li className="flex items-center gap-3"><CreditCard className="w-4 h-4 text-neutral-400" /> Payment Status</li>
              <li className="flex items-center gap-3"><Calendar className="w-4 h-4 text-neutral-400" /> Renewal Alerts</li>
              <li className="flex items-center gap-3"><MessageSquare className="w-4 h-4 text-neutral-400" /> Auto Reminders</li>
            </ul>
          </div>
        </div>
        
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 transition-colors">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center font-bold text-xs">
              {userId.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">{userId}</p>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">Gym Owner</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center justify-center gap-2 p-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-lg transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              Settings
            </button>
            <button
              onClick={onLogout}
              className="flex items-center justify-center gap-2 p-2 text-xs font-medium text-red-600 hover:bg-red-50 border border-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
          <p className="text-[10px] text-neutral-400 text-center mt-4">Powered by Gemini AI</p>
        </div>
      </motion.div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center px-4 shrink-0 z-10 transition-colors">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="md:hidden p-2 -ml-2 mr-2 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <h1 className="font-bold text-neutral-900 dark:text-white tracking-tight">
              {activeView === 'dashboard' ? 'Dashboard' : activeView === 'chat' ? 'AI Assistant' : 'Members Management'}
            </h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 text-neutral-500 dark:text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                aria-label="Toggle Dark Mode"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            )}
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="md:hidden p-2 text-neutral-500 dark:text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col relative">
          <AnimatePresence mode="wait">
            {activeView === 'dashboard' ? (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex-1 overflow-y-auto p-4 md:p-6"
              >
                <div className="max-w-5xl mx-auto space-y-6">
                  <header className="mb-8">
                    <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Gym Dashboard</h2>
                    <p className="text-neutral-500 dark:text-neutral-400">Overview of your gym&apos;s performance today.</p>
                  </header>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-800 transition-colors">
                      <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center mb-4">
                        <Users className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Active Members</p>
                      <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.totalActive}</h3>
                    </div>
                    <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-800 transition-colors">
                      <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center mb-4">
                        <Clock className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Expiring Soon</p>
                      <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.expiringSoon}</h3>
                    </div>
                    <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-800 transition-colors">
                      <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center mb-4">
                        <TrendingUp className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Pending Amount</p>
                      <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">₹{stats.pendingPayments.toLocaleString()}</h3>
                    </div>
                    <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-800 transition-colors">
                      <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center mb-4">
                        <UserPlus className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">New Today</p>
                      <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.newToday}</h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-800 transition-colors">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          Monthly Finance Report
                        </h4>
                        <button 
                          onClick={() => handleCopyReport(financeReport)}
                          className="p-2 text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-all"
                          title="Copy Report"
                        >
                          {isCopied ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className="bg-neutral-900 rounded-xl p-6 text-emerald-50 font-mono text-sm relative overflow-hidden">
                        <div className="relative z-10 space-y-3">
                          <p className="text-emerald-500 font-bold border-b border-emerald-500/20 pb-2">{currentMonth} Summary</p>
                          <div className="space-y-1">
                            <p className="flex justify-between"><span>Total Members:</span> <span className="text-white">{members.length}</span></p>
                            <p className="flex justify-between"><span>Active Members:</span> <span className="text-white">{stats.totalActive}</span></p>
                            <p className="flex justify-between"><span>Pending Amount:</span> <span className="text-white">₹{stats.pendingPayments.toLocaleString()}</span></p>
                            <p className="flex justify-between"><span>Expiring Soon:</span> <span className="text-white">{stats.expiringSoon}</span></p>
                          </div>
                        </div>
                        <CreditCard className="absolute -right-4 -bottom-4 w-24 h-24 text-white/5 -rotate-12" />
                      </div>
                    </div>
                    <div className="bg-emerald-900 p-6 rounded-2xl shadow-lg text-white relative overflow-hidden">
                      <div className="relative z-10">
                        <h4 className="font-semibold mb-2">AI Insights</h4>
                        <p className="text-emerald-100 text-sm mb-4">
                          {stats.expiringSoon > 0 
                            ? `You have ${stats.expiringSoon} members expiring in the next 5 days. Use the AI Assistant to send reminders.`
                            : "All memberships are up to date! Great job managing your gym."}
                        </p>
                        <button 
                          onClick={() => setActiveView('chat')}
                          className="bg-white dark:bg-neutral-800 text-emerald-900 dark:text-emerald-100 px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-50 dark:hover:bg-neutral-700 transition-colors"
                        >
                          Ask AI Assistant
                        </button>
                      </div>
                      <Bot className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10 rotate-12" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : activeView === 'chat' ? (
              <motion.div
                key="chat"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col overflow-hidden"
              >
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-neutral-50/50 dark:bg-neutral-950/50">
                  {messages.map((msg) => (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`flex gap-3 max-w-[85%] md:max-w-[75%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${
                          msg.role === 'user' ? 'bg-neutral-800 dark:bg-neutral-700 text-white' : 'bg-emerald-600 text-white'
                        }`}>
                          {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                        </div>
                        <div
                          className={`p-4 rounded-2xl ${
                            msg.role === 'user'
                              ? 'bg-neutral-800 dark:bg-neutral-700 text-white rounded-tr-sm'
                              : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm rounded-tl-sm text-neutral-800 dark:text-neutral-200'
                          }`}
                        >
                          {msg.role === 'user' ? (
                            <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                          ) : (
                            <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-neutral-100 dark:prose-pre:bg-neutral-800 prose-pre:text-neutral-800 dark:prose-pre:text-neutral-200 prose-strong:text-neutral-900 dark:prose-strong:text-white prose-ul:my-2 prose-li:my-0">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                              {msg.action && (
                                <div className="mt-4 not-prose">
                                  <a
                                    href={
                                      msg.action.type === 'whatsapp'
                                        ? `https://wa.me/${(msg.action.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(msg.action.message || '')}`
                                        : `sms:${(msg.action.phone || '').replace(/\D/g, '')}?body=${encodeURIComponent(msg.action.message || '')}`
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors shadow-sm ${
                                      msg.action.type === 'whatsapp'
                                        ? 'bg-[#25D366] hover:bg-[#1ebe57]'
                                        : 'bg-blue-500 hover:bg-blue-600'
                                    }`}
                                  >
                                    {msg.action.type === 'whatsapp' ? (
                                      <MessageCircle className="w-4 h-4" />
                                    ) : (
                                      <Smartphone className="w-4 h-4" />
                                    )}
                                    Send via {msg.action.type === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                                  </a>
                                </div>
                              )}
                              {msg.dietPlan && (
                                <div className="mt-4 not-prose">
                                  <button
                                    onClick={() => {
                                      setSelectedDietPlan(msg.dietPlan!);
                                      setIsDietPlanModalOpen(true);
                                    }}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors shadow-sm bg-emerald-600 hover:bg-emerald-700"
                                  >
                                    <FileText className="w-4 h-4" />
                                    View Diet Plan
                                  </button>
                                </div>
                              )}
                              {msg.workoutPlan && (
                                <div className="mt-4 not-prose">
                                  <button
                                    onClick={() => {
                                      setSelectedWorkoutPlan(msg.workoutPlan!);
                                      setIsWorkoutPlanModalOpen(true);
                                    }}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors shadow-sm bg-blue-600 hover:bg-blue-700"
                                  >
                                    <Dumbbell className="w-4 h-4" />
                                    View Workout Plan
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
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-start"
                    >
                      <div className="flex gap-3 max-w-[85%] md:max-w-[75%]">
                        <div className="w-8 h-8 shrink-0 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                          <Bot className="w-5 h-5" />
                        </div>
                        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm rounded-tl-sm flex items-center gap-2 transition-colors">
                          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </motion.div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 transition-colors">
                  <div className="max-w-4xl mx-auto">
                    <form
                      onSubmit={handleSubmit}
                      className="relative flex items-end gap-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all"
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
                        placeholder="Type membership details, payment info, or ask for a summary..."
                        className="w-full max-h-32 min-h-[44px] bg-transparent border-none focus:ring-0 resize-none py-2.5 px-3 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
                        rows={1}
                        style={{
                          height: 'auto',
                        }}
                        onInput={(e) => {
                          const target = e.target as HTMLTextAreaElement;
                          target.style.height = 'auto';
                          target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
                        }}
                      />
                      <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="shrink-0 w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-200 dark:disabled:bg-neutral-700 disabled:text-neutral-400 dark:disabled:text-neutral-500 text-white flex items-center justify-center transition-colors"
                      >
                        <Send className="w-4 h-4 ml-0.5" />
                      </button>
                    </form>
                    <div className="text-center mt-2">
                      <p className="text-[10px] text-neutral-400">
                        GymAssist AI can make mistakes. Please verify important payment details.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="members"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 overflow-y-auto p-4 md:p-8 bg-white dark:bg-neutral-900 transition-colors"
              >
                <div className="max-w-6xl mx-auto">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Gym Members</h2>
                      <p className="text-neutral-500 dark:text-neutral-400 text-sm">Manage and track all your gym memberships</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search members..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9 pr-4 py-2 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 w-64 transition-colors"
                        />
                        <User className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      </div>
                      <button
                        onClick={() => setIsMemberModalOpen(true)}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-4 rounded-xl font-medium transition-colors shadow-sm"
                      >
                        <Plus className="w-5 h-5" />
                        Add Member
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
                    {(['All', 'Active', 'Expired', 'Expiring Soon'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setStatusFilter(f)}
                        className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                          statusFilter === f 
                            ? 'bg-emerald-600 text-white shadow-md' 
                            : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:border-emerald-200 dark:hover:border-emerald-800'
                        }`}
                      >
                        {f} {f === 'Expiring Soon' ? '(7 Days)' : ''}
                      </button>
                    ))}
                  </div>

                  <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm transition-colors">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                            <th className="px-6 py-4 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Member</th>
                            <th className="px-6 py-4 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Plan</th>
                            <th className="px-6 py-4 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Dates</th>
                            <th className="px-6 py-4 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Payment</th>
                            <th className="px-6 py-4 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                          {filteredMembers.length > 0 ? (
                            filteredMembers.map((member, idx) => (
                              <tr 
                                key={idx} 
                                className={`group hover:bg-emerald-50/30 dark:hover:bg-emerald-900/20 transition-colors ${idx % 2 === 0 ? 'bg-white dark:bg-neutral-900' : 'bg-neutral-50/30 dark:bg-neutral-800/50'}`}
                              >
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-400 font-bold text-sm group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/30 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                      {member.member_name.charAt(0)}
                                    </div>
                                    <div>
                                      <div className="text-sm font-semibold text-neutral-900 dark:text-white">
                                        {member.member_name}
                                        {member.member_id && <span className="ml-2 text-xs font-normal text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded-md">{member.member_id}</span>}
                                      </div>
                                      <div className="text-xs text-neutral-500 dark:text-neutral-400">{member.phone}</div>
                                      {member.email && <div className="text-[10px] text-neutral-400">{member.email}</div>}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
                                    {member.membership_plan}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-xs text-neutral-600 dark:text-neutral-400">
                                    <div>Start: {member.membership_start}</div>
                                    <div className="font-medium">End: {member.membership_end}</div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-xs">
                                    <div className="text-neutral-900 dark:text-white font-bold">₹{member.amuont_paid || 0} / ₹{member.fee || 0}</div>
                                    <div className="text-[10px] text-neutral-400">
                                      {Number(member.fee || 0) - Number(member.amuont_paid || 0) > 0 ? 
                                        `Pending: ₹${Number(member.fee || 0) - Number(member.amuont_paid || 0)}` : 
                                        'Fully Paid'}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    member.status === 'Active' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300' :
                                    member.status === 'Expired' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
                                    'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200'
                                  }`}>
                                    {member.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => { setSelectedMemberForBill(member); setIsBillModalOpen(true); }}
                                      className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-all group/bill relative"
                                      title="Generate Bill"
                                    >
                                      <FileText className="w-4 h-4" />
                                      <span className="absolute bottom-full right-0 mb-2 hidden group-hover/bill:block bg-neutral-800 dark:bg-neutral-700 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap">Generate Bill</span>
                                    </button>
                                    <button
                                      onClick={() => handleEditMember(member)}
                                      className="p-2 text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-all"
                                      title="Edit Member"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="px-6 py-12 text-center text-neutral-500 dark:text-neutral-400 italic">
                                No members found. Add your first member to get started!
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      </div>

      <MemberModal
        key={selectedMember ? `edit-${selectedMember.member_name}` : 'new'}
        isOpen={isMemberModalOpen}
        onClose={() => { setIsMemberModalOpen(false); setSelectedMember(null); }}
        onSave={handleSaveMember}
        initialData={selectedMember}
      />

      <SettingsModal
        key={isSettingsOpen ? `settings-${upiId}` : 'settings-closed'}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        upiId={upiId}
        onSave={handleSaveProfile}
      />

      <BillModal
        isOpen={isBillModalOpen}
        onClose={() => { setIsBillModalOpen(false); setSelectedMemberForBill(null); }}
        onSave={handleSaveBill}
        member={selectedMemberForBill}
        owner_upi_id={upiId}
      />

      <DietPlanModal
        isOpen={isDietPlanModalOpen}
        onClose={() => { setIsDietPlanModalOpen(false); setSelectedDietPlan(null); }}
        dietPlan={selectedDietPlan}
        gymName={userId}
        memberEmail={selectedDietPlan ? members.find(m => m.member_name.toLowerCase() === selectedDietPlan.memberName.toLowerCase())?.email : undefined}
        memberPhone={selectedDietPlan ? members.find(m => m.member_name.toLowerCase() === selectedDietPlan.memberName.toLowerCase())?.phone : undefined}
      />

      <WorkoutPlanModal
        isOpen={isWorkoutPlanModalOpen}
        onClose={() => { setIsWorkoutPlanModalOpen(false); setSelectedWorkoutPlan(null); }}
        workoutPlan={selectedWorkoutPlan}
        gymName={userId}
        memberEmail={selectedWorkoutPlan ? members.find(m => m.member_name.toLowerCase() === selectedWorkoutPlan.memberName.toLowerCase())?.email : undefined}
        memberPhone={selectedWorkoutPlan ? members.find(m => m.member_name.toLowerCase() === selectedWorkoutPlan.memberName.toLowerCase())?.phone : undefined}
      />

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-xl text-white font-medium flex items-center gap-3 ${
              toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
            }`}
          >
            {toast.type === 'success' ? <CreditCard className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
