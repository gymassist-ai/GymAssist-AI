'use client';

import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, User, Bot, Dumbbell, Calendar, CreditCard, MessageSquare, Menu, X, Plus, MessageCircle, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import MemberModal, { Member } from './MemberModal';

const SYSTEM_INSTRUCTION = `You are GymAssist AI – an intelligent assistant built specifically for Indian gym owners to manage memberships, payments, renewals, and reminders.

Your responsibilities:
- Generate membership invoice summaries
- Track payment status (Paid / Unpaid / Partial / Overdue)
- Detect upcoming renewals (within 5 days)
- Generate polite but firm payment reminders
- Generate renewal reminder messages
- Provide short monthly revenue summaries

Behavior Rules:

1. Always use INR currency format (₹).
2. Keep language simple and professional.
3. Do not use complicated accounting or legal terms.
4. If payment due date has passed, clearly mark as "Overdue".
5. If renewal is within 5 days, mark as "Renewal Due Soon".
6. Reminders must be polite, respectful, and firm.
7. Never threaten or shame members.
8. If required data is missing, ask one clear clarification question.
9. Always structure responses clearly in labeled sections.

Output Format:

**MEMBERSHIP SUMMARY:**
- Member Name:
- Plan Type:
- Start Date:
- End Date:
- Fee:
- Status:

**PAYMENT STATUS:**
- Amount Paid:
- Amount Pending:
- Due Date:

**WHATSAPP REMINDER:**
(Short, conversational, friendly tone)

**FORMAL SMS REMINDER:**
(Short, professional)

**RENEWAL MESSAGE:**
(If applicable)

**MONTHLY GYM SUMMARY:**
(If multiple records provided)

Tone:
Professional, practical, gym-owner focused.`;

type Message = {
  id: string;
  role: 'user' | 'model';
  content: string;
  action?: {
    type: 'whatsapp' | 'sms';
    phone: string;
    message: string;
  };
};

const SUGGESTIONS = [
  "Rahul joined today for 3 months, paid ₹1500 out of ₹3000. Due next week.",
  "Generate a reminder for Amit. His monthly plan expired 2 days ago.",
  "Priya paid ₹5000 for a yearly plan starting 1st Jan. Fully paid.",
  "Show me a monthly summary: Rahul ₹1500, Priya ₹5000, Amit unpaid.",
];

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      content: 'Namaste! I am GymAssist AI. How can I help you manage your gym today? You can tell me about a new membership, ask for payment reminders, or get a monthly summary.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const stored = localStorage.getItem('gym_members');
    if (stored) {
      try {
        setMembers(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse members', e);
      }
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSaveMember = (member: Member) => {
    const updated = [...members, member];
    setMembers(updated);
    localStorage.setItem('gym_members', JSON.stringify(updated));
    setIsMemberModalOpen(false);

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: 'user',
        content: `I have added a new member: ${member.name} (${member.phone}). Plan: ${member.plan}, Fee: ₹${member.fee}, Paid: ₹${member.amountPaid}.`,
      },
    ]);
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
      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
      
      const chatHistory = messages.filter(m => m.id !== 'welcome').map(m => ({
        role: m.role,
        parts: [{ text: m.content }],
      }));

      const prepareWhatsAppDecl: FunctionDeclaration = {
        name: 'prepareWhatsApp',
        description: 'Prepares a WhatsApp message link for the user to click and send.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            phone: { type: Type.STRING, description: 'Phone number with country code, e.g., 919876543210' },
            message: { type: Type.STRING, description: 'The text message to send' }
          },
          required: ['phone', 'message']
        }
      };

      const prepareSMSDecl: FunctionDeclaration = {
        name: 'prepareSMS',
        description: 'Prepares an SMS message link for the user to click and send.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            phone: { type: Type.STRING, description: 'Phone number' },
            message: { type: Type.STRING, description: 'The text message to send' }
          },
          required: ['phone', 'message']
        }
      };

      const dynamicSystemInstruction = `${SYSTEM_INSTRUCTION}\n\nCURRENT MEMBERS DATABASE:\n${JSON.stringify(members, null, 2)}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          ...chatHistory,
          { role: 'user', parts: [{ text: userMessage.content }] }
        ],
        config: {
          systemInstruction: dynamicSystemInstruction,
          temperature: 0.2, // Keep it professional and consistent
          tools: [{ functionDeclarations: [prepareWhatsAppDecl, prepareSMSDecl] }]
        },
      });

      if (response.functionCalls && response.functionCalls.length > 0) {
        const call = response.functionCalls[0];
        const args = call.args as any;

        const modelMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          content: `I have prepared the ${call.name === 'prepareWhatsApp' ? 'WhatsApp' : 'SMS'} message for you. Click the button below to open the app and send it.`,
          action: {
            type: call.name === 'prepareWhatsApp' ? 'whatsapp' : 'sms',
            phone: args.phone,
            message: args.message
          }
        };
        setMessages((prev) => [...prev, modelMessage]);
      } else {
        const modelMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          content: response.text || 'Sorry, I could not process that request.',
        };
        setMessages((prev) => [...prev, modelMessage]);
      }
    } catch (error) {
      console.error('Error generating response:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'model',
          content: 'Sorry, I encountered an error. Please try again.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSubmit(undefined, suggestion);
    setIsSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-neutral-50 font-sans text-neutral-900 overflow-hidden">
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
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-white border-r border-neutral-200 flex flex-col transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-600 font-bold text-xl">
            <Dumbbell className="w-6 h-6" />
            <span>GymAssist AI</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-1 text-neutral-500 hover:bg-neutral-100 rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <button
            onClick={() => setIsMemberModalOpen(true)}
            className="w-full mb-6 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-4 rounded-xl font-medium transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            New Member
          </button>

          <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Quick Actions</h3>
          <div className="space-y-2">
            {SUGGESTIONS.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full text-left p-3 text-sm bg-neutral-50 hover:bg-emerald-50 hover:text-emerald-700 border border-neutral-100 rounded-xl transition-colors flex items-start gap-3 group"
              >
                <MessageSquare className="w-4 h-4 mt-0.5 text-neutral-400 group-hover:text-emerald-500 shrink-0" />
                <span className="leading-snug">{suggestion}</span>
              </button>
            ))}
          </div>

          <div className="mt-8">
            <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Features</h3>
            <ul className="space-y-3 text-sm text-neutral-600">
              <li className="flex items-center gap-3"><User className="w-4 h-4 text-neutral-400" /> Membership Tracking</li>
              <li className="flex items-center gap-3"><CreditCard className="w-4 h-4 text-neutral-400" /> Payment Status</li>
              <li className="flex items-center gap-3"><Calendar className="w-4 h-4 text-neutral-400" /> Renewal Alerts</li>
              <li className="flex items-center gap-3"><MessageSquare className="w-4 h-4 text-neutral-400" /> Auto Reminders</li>
            </ul>
          </div>
        </div>
        
        <div className="p-4 border-t border-neutral-200 text-xs text-neutral-400 text-center">
          Powered by Gemini AI
        </div>
      </motion.div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-neutral-200 bg-white flex items-center px-4 shrink-0 shadow-sm z-10">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="md:hidden p-2 -ml-2 mr-2 text-neutral-600 hover:bg-neutral-100 rounded-md"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-semibold text-neutral-900 leading-tight">GymAssist AI</h1>
              <p className="text-xs text-emerald-600 font-medium">Online</p>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-neutral-50/50">
          {messages.map((msg) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-3 max-w-[85%] md:max-w-[75%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${
                  msg.role === 'user' ? 'bg-neutral-800 text-white' : 'bg-emerald-600 text-white'
                }`}>
                  {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                </div>
                <div
                  className={`p-4 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-neutral-800 text-white rounded-tr-sm'
                      : 'bg-white border border-neutral-200 shadow-sm rounded-tl-sm text-neutral-800'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                  ) : (
                    <div className="prose prose-sm prose-neutral max-w-none prose-p:leading-relaxed prose-pre:bg-neutral-100 prose-pre:text-neutral-800 prose-strong:text-neutral-900 prose-ul:my-2 prose-li:my-0">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      {msg.action && (
                        <div className="mt-4 not-prose">
                          <a
                            href={
                              msg.action.type === 'whatsapp'
                                ? `https://wa.me/${msg.action.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg.action.message)}`
                                : `sms:${msg.action.phone.replace(/\D/g, '')}?body=${encodeURIComponent(msg.action.message)}`
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
                <div className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-sm rounded-tl-sm flex items-center gap-2">
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
        <div className="p-4 bg-white border-t border-neutral-200">
          <div className="max-w-4xl mx-auto">
            <form
              onSubmit={handleSubmit}
              className="relative flex items-end gap-2 bg-neutral-50 border border-neutral-200 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all"
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
                className="w-full max-h-32 min-h-[44px] bg-transparent border-none focus:ring-0 resize-none py-2.5 px-3 text-sm text-neutral-900 placeholder:text-neutral-400"
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
                className="shrink-0 w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-200 disabled:text-neutral-400 text-white flex items-center justify-center transition-colors"
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
      </div>

      <MemberModal
        isOpen={isMemberModalOpen}
        onClose={() => setIsMemberModalOpen(false)}
        onSave={handleSaveMember}
      />
    </div>
  );
}
