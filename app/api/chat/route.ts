import { NextResponse } from 'next/server';
import { FunctionDeclaration, GoogleGenAI, Type } from '@google/genai';

type AiProvider = 'groq' | 'openai' | 'gemini';
type ToolName = 'prepareWhatsApp' | 'prepareSMS' | 'generateDietPlan' | 'generateWorkoutPlan';
type ChatMessage = {
  role: 'user' | 'model';
  content: string;
};

type ChatRequestBody = {
  gstNumber?: string | null;
  gymName?: string | null;
  members?: unknown[];
  messages?: ChatMessage[];
  upiId?: string | null;
};

const SYSTEM_INSTRUCTION = `You are GymAssist AI, an intelligent assistant built specifically for Indian gym owners to manage memberships, payments, renewals, and reminders.

Your responsibilities:
- Generate membership invoice summaries
- Track payment status (Paid / Unpaid / Partial / Overdue)
- Detect upcoming renewals (within 5 days)
- Generate polite but firm payment reminders
- Generate renewal reminder messages
- Provide short monthly revenue summaries
- Generate personalized diet plans based on member details
- Generate personalized workout plans based on member details

Behavior Rules:
1. Always use INR currency format.
2. Keep language simple and professional.
3. Do not use complicated accounting or legal terms.
4. If payment due date has passed, clearly mark as "Overdue".
5. If renewal is within 5 days, mark as "Renewal Due Soon".
6. Reminders must be polite, respectful, and firm.
7. Never threaten or shame members.
8. If required data is missing, ask one clear clarification question.
9. Always structure responses clearly in labeled sections.
10. Use prepareWhatsApp or prepareSMS only when the owner clearly asks to send, draft, prepare, or notify someone through WhatsApp/SMS.
11. Use generateDietPlan only when the owner clearly asks to generate/create a diet or meal plan.
12. Use generateWorkoutPlan only when the owner clearly asks to generate/create a workout or training plan.
13. For financial overview, revenue, payments, dues, analytics, member status, or ordinary questions, answer directly in text and do not call tools.

Tone:
Professional, practical, gym-owner focused.`;

const dietPlanProperties = {
  memberName: { type: 'string' },
  age: { type: 'number' },
  gender: { type: 'string' },
  height: { type: 'string' },
  weight: { type: 'string' },
  goal: { type: 'string' },
  activityLevel: { type: 'string' },
  dietaryPreference: { type: 'string' },
  budgetPreference: { type: 'string' },
  mealPreferences: { type: 'string' },
  mealsPerDay: { type: 'number' },
  allergies: { type: 'string' },
  medicalConditions: { type: 'string' },
  targetWeight: { type: 'string' },
  dailyCalories: { type: 'number' },
  macros: {
    type: 'object',
    properties: {
      protein: { type: 'string' },
      carbs: { type: 'string' },
      fats: { type: 'string' },
    },
  },
  schedule: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        meal: { type: 'string' },
        items: { type: 'string' },
        portion: { type: 'string' },
      },
    },
  },
  guidelines: {
    type: 'object',
    properties: {
      water: { type: 'string' },
      supplements: { type: 'string' },
      avoid: { type: 'string' },
      advice: { type: 'string' },
    },
  },
};

const workoutPlanProperties = {
  memberName: { type: 'string' },
  goal: { type: 'string' },
  experienceLevel: { type: 'string' },
  daysPerWeek: { type: 'number' },
  duration: { type: 'string' },
  targetMuscleGroups: { type: 'string' },
  injuries: { type: 'string' },
  schedule: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        day: { type: 'string' },
        focus: { type: 'string' },
        exercises: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              sets: { type: 'string' },
              reps: { type: 'string' },
              rest: { type: 'string' },
            },
          },
        },
      },
    },
  },
  guidelines: {
    type: 'object',
    properties: {
      warmup: { type: 'string' },
      cooldown: { type: 'string' },
      recovery: { type: 'string' },
      progressiveOverload: { type: 'string' },
    },
  },
};

const dietRequired = [
  'memberName',
  'age',
  'gender',
  'height',
  'weight',
  'goal',
  'activityLevel',
  'dietaryPreference',
  'budgetPreference',
  'mealsPerDay',
  'allergies',
  'dailyCalories',
  'macros',
  'schedule',
  'guidelines',
];

const workoutRequired = [
  'memberName',
  'goal',
  'experienceLevel',
  'daysPerWeek',
  'duration',
  'targetMuscleGroups',
  'schedule',
  'guidelines',
];

function buildSystemInstruction(upiId?: string | null, members?: unknown[], gymName?: string | null, gstNumber?: string | null) {
  return `${SYSTEM_INSTRUCTION}

GYM NAME: ${gymName || 'Not Configured'}
GST NUMBER: ${gstNumber || 'Not Configured'}
GYM OWNER UPI ID: ${upiId || 'Not Configured'}

INSTRUCTIONS FOR BRANDING: Include the gym name prominently in WhatsApp/SMS drafts, payment reminders, invoice summaries, and member-facing plan messages. Include the GST number in payment or receipt-style messages when configured.
INSTRUCTIONS FOR UPI: If a UPI ID is provided above, include it in payment reminders and invoice summaries. If it is not configured, politely ask the owner to add it in settings.

CURRENT MEMBERS DATABASE:
${JSON.stringify(members || [], null, 2)}`;
}

function latestUserText(messages: ChatMessage[]) {
  return [...messages].reverse().find((message) => message.role === 'user')?.content || '';
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatInr(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));
}

function getMemberValue(member: any, keys: string[]) {
  for (const key of keys) {
    if (member?.[key] !== undefined && member?.[key] !== null && member?.[key] !== '') return member[key];
  }
  return undefined;
}

function wantsFinancialOverview(text: string) {
  const value = normalizeText(text);
  return (
    /\b(financial|finance|revenue|income|collection|collections|earning|earnings|sales|cashflow|cash flow|payment|payments|dues|fee|fees)\b/.test(value) &&
    /\b(overview|summary|report|status|health|revenue|financial|finance|gym|business)\b/.test(value)
  );
}

function wantsOutboundMessage(text: string) {
  const value = normalizeText(text);
  const explicitSend =
    /\b(send|prepare|draft|write|whatsapp|sms|notify|follow up|follow-up)\b/.test(value) ||
    (/\bmessage\b/.test(value) && !/\b(show|list|view|history|overview|summary|dashboard|analytics)\b/.test(value));
  const reminderAction =
    /\b(remind|reminder)\b/.test(value) &&
    /\b(member|him|her|them|client|customer|payment|renewal|due|overdue)\b/.test(value) &&
    !/\b(show|list|view|overview|summary|dashboard|queue|status|analytics)\b/.test(value);

  return explicitSend || reminderAction;
}

function wantsDietPlan(text: string) {
  const value = normalizeText(text);
  return /\b(diet|meal|nutrition|calorie|macro|vegetarian|non vegetarian|fat loss|weight gain)\b/.test(value) &&
    /\b(generate|create|make|plan|pdf|prepare)\b/.test(value);
}

function wantsWorkoutPlan(text: string) {
  const value = normalizeText(text);
  return /\b(workout|training|exercise|gym split|split|strength|cardio|conditioning)\b/.test(value) &&
    /\b(generate|create|make|plan|pdf|prepare)\b/.test(value);
}

function isToolAllowedForPrompt(toolName: string, userText: string) {
  if (toolName === 'prepareWhatsApp' || toolName === 'prepareSMS') return wantsOutboundMessage(userText);
  if (toolName === 'generateDietPlan') return wantsDietPlan(userText);
  if (toolName === 'generateWorkoutPlan') return wantsWorkoutPlan(userText);
  return false;
}

function allowedToolNamesForPrompt(userText: string): ToolName[] {
  const allowed = new Set<ToolName>();
  if (wantsOutboundMessage(userText)) {
    allowed.add('prepareWhatsApp');
    allowed.add('prepareSMS');
  }
  if (wantsDietPlan(userText)) allowed.add('generateDietPlan');
  if (wantsWorkoutPlan(userText)) allowed.add('generateWorkoutPlan');
  return Array.from(allowed);
}

type FinancialTotals = {
  active: number;
  collected: number;
  fullyPaid: number;
  overdue: number;
  partial: number;
  pending: number;
  topDues: Array<{ name: string; pending: number }>;
  totalFee: number;
  unpaid: number;
};

function buildFinancialOverview(members: unknown[]) {
  const rows = Array.isArray(members) ? members : [];
  const totals = rows.reduce<FinancialTotals>(
    (acc, member: any) => {
      const totalFee = toNumber(getMemberValue(member, ['total_fee', 'fee']));
      const paid = toNumber(getMemberValue(member, ['amount_paid', 'amuont_paid', 'amount paid']));
      const pending = Math.max(
        0,
        getMemberValue(member, ['pending_dues']) !== undefined
          ? toNumber(getMemberValue(member, ['pending_dues']))
          : totalFee - paid,
      );
      const endDate = getMemberValue(member, ['membership_end', 'end date']);
      const isOverdue = pending > 0 && endDate && new Date(endDate) < new Date();

      acc.totalFee += totalFee;
      acc.collected += paid;
      acc.pending += pending;
      acc.active += member?.status === 'Active' ? 1 : 0;
      acc.fullyPaid += pending === 0 && totalFee > 0 ? 1 : 0;
      acc.partial += paid > 0 && pending > 0 ? 1 : 0;
      acc.unpaid += paid === 0 && pending > 0 ? 1 : 0;
      acc.overdue += isOverdue ? 1 : 0;

      if (pending > 0) {
        acc.topDues.push({
          name: getMemberValue(member, ['member_name', 'name']) || 'Unnamed member',
          pending,
        });
      }

      return acc;
    },
    {
      active: 0,
      collected: 0,
      fullyPaid: 0,
      overdue: 0,
      partial: 0,
      pending: 0,
      topDues: [] as Array<{ name: string; pending: number }>,
      totalFee: 0,
      unpaid: 0,
    },
  );

  const collectionRate = totals.totalFee > 0 ? Math.round((totals.collected / totals.totalFee) * 100) : 0;
  const topDues = totals.topDues.sort((a, b) => b.pending - a.pending).slice(0, 3);

  if (!rows.length) {
    return {
      type: 'text',
      content: '## Financial Overview\n\nNo member records are available yet. Add members with total fee and amount paid to see revenue, dues, and collection health here.',
    };
  }

  return {
    type: 'text',
    content: `## Financial Overview

**Collection Health**
- Total membership value: **${formatInr(totals.totalFee)}**
- Collected amount: **${formatInr(totals.collected)}**
- Pending dues: **${formatInr(totals.pending)}**
- Collection rate: **${collectionRate}%**

**Payment Status**
- Fully paid members: **${totals.fullyPaid}**
- Partially paid members: **${totals.partial}**
- Unpaid members: **${totals.unpaid}**
- Overdue dues: **${totals.overdue}**

**Priority Follow-up**
${topDues.length ? topDues.map((item) => `- ${item.name}: **${formatInr(item.pending)}** pending`).join('\n') : '- No pending dues right now.'}

**Recommendation**
${totals.pending > 0 ? 'Focus today on the top pending members and send polite payment follow-ups with your UPI ID included.' : 'Your collection status looks clean. Keep renewals updated so future revenue stays predictable.'}`,
  };
}

function functionCallResponse(name: string, args: any) {
  if (name === 'generateDietPlan') {
    return {
      type: 'functionCall',
      name,
      args,
      content: `I have generated the personalized diet plan for **${args.memberName || 'this member'}**. You can view, download, or share it below.`,
    };
  }

  if (name === 'generateWorkoutPlan') {
    return {
      type: 'functionCall',
      name,
      args,
      content: `I have generated the personalized workout plan for **${args.memberName || 'this member'}**. You can view, download, or share it below.`,
    };
  }

  return {
    type: 'functionCall',
    name,
    args,
    content: `I have prepared the ${name === 'prepareWhatsApp' ? 'WhatsApp' : 'SMS'} message for you. Click the button below to open the app and send it.`,
  };
}

function parseFunctionArgs(value: unknown) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return {};

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function providerOrder(): AiProvider[] {
  const requested = (process.env.AI_PROVIDER || 'auto').trim().toLowerCase();
  if (requested === 'groq') return ['groq', 'openai', 'gemini'];
  if (requested === 'gemini') return ['gemini', 'openai'];
  if (requested === 'openai') return ['openai', 'groq', 'gemini'];
  return ['groq', 'openai', 'gemini'];
}

function friendlyProviderError(provider: AiProvider, error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || '');
  const invalidKey =
    raw.includes('API key not valid') ||
    raw.includes('API_KEY_INVALID') ||
    raw.includes('Invalid API Key') ||
    raw.includes('Incorrect API key') ||
    raw.includes('invalid_api_key') ||
    raw.includes('invalid_api_key') ||
    raw.includes('401');

  if (invalidKey) {
    if (provider === 'groq') {
      return 'Groq API key is invalid. Update GROQ_API_KEY in .env.local and Vercel environment variables.';
    }
    if (provider === 'openai') {
      return 'OpenAI API key is invalid. Update OPENAI_API_KEY in .env.local and Vercel environment variables.';
    }
    return 'Gemini API key is invalid. Update GEMINI_API_KEY in .env.local and Vercel environment variables.';
  }

  return raw || `${provider} failed to generate a response.`;
}

function readOpenAIContent(message: any) {
  const content = message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => part?.text || part?.content || '').join('');
  }
  return '';
}

function compactToolsForPrompt(userText: string) {
  const allowedNames = allowedToolNamesForPrompt(userText);
  if (!allowedNames.length) return [];
  return openAITools(allowedNames);
}

async function callOpenAICompatibleProvider({
  apiKey,
  baseUrl,
  defaultModel,
  latestUserPrompt,
  messages,
  providerName,
  systemInstruction,
}: {
  apiKey: string | undefined;
  baseUrl: string;
  defaultModel: string;
  latestUserPrompt: string;
  messages: ChatMessage[];
  providerName: string;
  systemInstruction: string;
}) {
  if (!apiKey) throw new Error(`${providerName.toUpperCase()}_API_KEY is missing.`);

  const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const tools = compactToolsForPrompt(latestUserPrompt);
  const mappedMessages = [
    { role: 'system', content: systemInstruction },
    ...messages.map((message) => ({
      role: message.role === 'model' ? 'assistant' : 'user',
      content: message.content,
    })),
  ];

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: defaultModel,
      messages: mappedMessages,
      temperature: 0.2,
      ...(tools.length
        ? {
            tools,
            tool_choice: 'auto',
          }
        : {}),
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `${providerName} request failed with status ${response.status}.`);
  }

  const message = data?.choices?.[0]?.message;
  const toolCall = message?.tool_calls?.[0];
  if (toolCall?.function?.name) {
    if (!isToolAllowedForPrompt(toolCall.function.name, latestUserPrompt)) {
      const safeResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: defaultModel,
          messages: [
            {
              role: 'system',
              content: `${systemInstruction}\n\nThe previous model response selected an unrelated tool. Do not call tools. Answer the user's latest request directly in text.`,
            },
            ...mappedMessages.slice(1),
          ],
          temperature: 0.2,
        }),
      });
      const safeData = await safeResponse.json().catch(() => ({}));
      if (!safeResponse.ok) {
        throw new Error(safeData?.error?.message || `${providerName} text retry failed with status ${safeResponse.status}.`);
      }
      return {
        type: 'text',
        content: readOpenAIContent(safeData?.choices?.[0]?.message) || 'Sorry, I could not process that request.',
      };
    }
    return functionCallResponse(toolCall.function.name, parseFunctionArgs(toolCall.function.arguments));
  }

  return {
    type: 'text',
    content: readOpenAIContent(message) || 'Sorry, I could not process that request.',
  };
}

function openAITools(allowedNames?: ToolName[]) {
  const tools = [
    {
      type: 'function',
      function: {
        name: 'prepareWhatsApp',
        description: 'Prepares a WhatsApp message link for the user to click and send.',
        parameters: {
          type: 'object',
          properties: {
            phone: { type: 'string', description: 'Phone number with country code, e.g. 919876543210' },
            message: { type: 'string', description: 'The text message to send' },
          },
          required: ['phone', 'message'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'prepareSMS',
        description: 'Prepares an SMS message link for the user to click and send.',
        parameters: {
          type: 'object',
          properties: {
            phone: { type: 'string', description: 'Phone number' },
            message: { type: 'string', description: 'The text message to send' },
          },
          required: ['phone', 'message'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'generateDietPlan',
        description: 'Generates a structured diet plan for a gym member after collecting all required details.',
        parameters: {
          type: 'object',
          properties: dietPlanProperties,
          required: dietRequired,
          additionalProperties: true,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'generateWorkoutPlan',
        description: 'Generates a structured workout plan for a gym member after collecting all required details.',
        parameters: {
          type: 'object',
          properties: workoutPlanProperties,
          required: workoutRequired,
          additionalProperties: true,
        },
      },
    },
  ];

  if (!allowedNames?.length) return tools;
  return tools.filter((tool) => allowedNames.includes(tool.function.name as ToolName));
}

function geminiDeclarations(allowedNames?: ToolName[]): FunctionDeclaration[] {
  const declarations: FunctionDeclaration[] = [
    {
      name: 'prepareWhatsApp',
      description: 'Prepares a WhatsApp message link for the user to click and send.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          phone: { type: Type.STRING, description: 'Phone number with country code, e.g. 919876543210' },
          message: { type: Type.STRING, description: 'The text message to send' },
        },
        required: ['phone', 'message'],
      },
    },
    {
      name: 'prepareSMS',
      description: 'Prepares an SMS message link for the user to click and send.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          phone: { type: Type.STRING, description: 'Phone number' },
          message: { type: Type.STRING, description: 'The text message to send' },
        },
        required: ['phone', 'message'],
      },
    },
    {
      name: 'generateDietPlan',
      description: 'Generates a structured diet plan for a gym member after collecting all required details.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          memberName: { type: Type.STRING },
          age: { type: Type.NUMBER },
          gender: { type: Type.STRING },
          height: { type: Type.STRING },
          weight: { type: Type.STRING },
          goal: { type: Type.STRING },
          activityLevel: { type: Type.STRING },
          dietaryPreference: { type: Type.STRING },
          budgetPreference: { type: Type.STRING },
          mealPreferences: { type: Type.STRING },
          mealsPerDay: { type: Type.NUMBER },
          allergies: { type: Type.STRING },
          medicalConditions: { type: Type.STRING },
          targetWeight: { type: Type.STRING },
          dailyCalories: { type: Type.NUMBER },
          macros: {
            type: Type.OBJECT,
            properties: {
              protein: { type: Type.STRING },
              carbs: { type: Type.STRING },
              fats: { type: Type.STRING },
            },
          },
          schedule: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                meal: { type: Type.STRING },
                items: { type: Type.STRING },
                portion: { type: Type.STRING },
              },
            },
          },
          guidelines: {
            type: Type.OBJECT,
            properties: {
              water: { type: Type.STRING },
              supplements: { type: Type.STRING },
              avoid: { type: Type.STRING },
              advice: { type: Type.STRING },
            },
          },
        },
        required: dietRequired,
      },
    },
    {
      name: 'generateWorkoutPlan',
      description: 'Generates a structured workout plan for a gym member after collecting all required details.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          memberName: { type: Type.STRING },
          goal: { type: Type.STRING },
          experienceLevel: { type: Type.STRING },
          daysPerWeek: { type: Type.NUMBER },
          duration: { type: Type.STRING },
          targetMuscleGroups: { type: Type.STRING },
          injuries: { type: Type.STRING },
          schedule: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                day: { type: Type.STRING },
                focus: { type: Type.STRING },
                exercises: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      sets: { type: Type.STRING },
                      reps: { type: Type.STRING },
                      rest: { type: Type.STRING },
                    },
                  },
                },
              },
            },
          },
          guidelines: {
            type: Type.OBJECT,
            properties: {
              warmup: { type: Type.STRING },
              cooldown: { type: Type.STRING },
              recovery: { type: Type.STRING },
              progressiveOverload: { type: Type.STRING },
            },
          },
        },
        required: workoutRequired,
      },
    },
  ];

  if (!allowedNames?.length) return declarations;
  return declarations.filter((declaration) => allowedNames.includes(declaration.name as ToolName));
}

async function callOpenAI(messages: ChatMessage[], systemInstruction: string, latestUserPrompt: string) {
  return callOpenAICompatibleProvider({
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    defaultModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    latestUserPrompt,
    messages,
    providerName: 'OpenAI',
    systemInstruction,
  });
}

async function callGroq(messages: ChatMessage[], systemInstruction: string, latestUserPrompt: string) {
  return callOpenAICompatibleProvider({
    apiKey: process.env.GROQ_API_KEY,
    baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    defaultModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    latestUserPrompt,
    messages,
    providerName: 'Groq',
    systemInstruction,
  });
}

async function callGeminiTextOnly(messages: ChatMessage[], systemInstruction: string, apiKey: string) {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-3-flash-preview',
    contents: messages.map((message) => ({
      role: message.role,
      parts: [{ text: message.content }],
    })),
    config: {
      systemInstruction: `${systemInstruction}\n\nDo not call tools. Answer the user's latest request directly in text.`,
      temperature: 0.2,
    },
  });

  return {
    type: 'text',
    content: response.text || 'Sorry, I could not process that request.',
  };
}

async function callGemini(messages: ChatMessage[], systemInstruction: string, latestUserPrompt: string) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing.');

  const ai = new GoogleGenAI({ apiKey });
  const declarations = geminiDeclarations(allowedToolNamesForPrompt(latestUserPrompt));
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-3-flash-preview',
    contents: messages.map((message) => ({
      role: message.role,
      parts: [{ text: message.content }],
    })),
    config: {
      systemInstruction,
      temperature: 0.2,
      ...(declarations.length ? { tools: [{ functionDeclarations: declarations }] } : {}),
    },
  });

  const call = response.functionCalls?.[0];
  if (call?.name) {
    if (!isToolAllowedForPrompt(call.name, latestUserPrompt)) {
      return callGeminiTextOnly(messages, systemInstruction, apiKey);
    }
    return functionCallResponse(call.name, call.args || {});
  }

  return {
    type: 'text',
    content: response.text || 'Sorry, I could not process that request.',
  };
}

export async function POST(request: Request) {
  const body = (await request.json()) as ChatRequestBody;
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const latestPrompt = latestUserText(messages);

  if (wantsFinancialOverview(latestPrompt)) {
    return NextResponse.json({ ...buildFinancialOverview(body.members || []), provider: 'local' });
  }

  const systemInstruction = buildSystemInstruction(body.upiId, body.members, body.gymName, body.gstNumber);
  const errors: string[] = [];

  for (const provider of providerOrder()) {
    try {
      const result =
        provider === 'groq'
          ? await callGroq(messages, systemInstruction, latestPrompt)
          : provider === 'openai'
            ? await callOpenAI(messages, systemInstruction, latestPrompt)
            : await callGemini(messages, systemInstruction, latestPrompt);

      return NextResponse.json({ ...result, provider });
    } catch (error) {
      errors.push(friendlyProviderError(provider, error));
    }
  }

  return NextResponse.json(
    {
      error: errors.length
        ? errors.join(' ')
        : 'AI provider unavailable. Add GROQ_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY to your environment.',
    },
    { status: 500 },
  );
}
