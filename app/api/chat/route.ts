import { NextResponse } from 'next/server';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';

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
1. Always use INR currency format (₹).
2. Keep language simple and professional.
3. Do not use complicated accounting or legal terms.
4. If payment due date has passed, clearly mark as "Overdue".
5. If renewal is within 5 days, mark as "Renewal Due Soon".
6. Reminders must be polite, respectful, and firm.
7. Never threaten or shame members.
8. If required data is missing, ask one clear clarification question.
9. Always structure responses clearly in labeled sections.
10. When asked to send a reminder or message, ALWAYS use the prepareWhatsApp or prepareSMS tool.
11. When asked to generate a diet plan, ALWAYS use the generateDietPlan tool.
12. When asked to generate a workout plan, ALWAYS use the generateWorkoutPlan tool.

Tone:
Professional, practical, gym-owner focused.`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messages, upiId, members } = body;

    if (!process.env.GEMINI_API_KEY && !process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'API Key Missing. Please add GEMINI_API_KEY to your environment variables.' },
        { status: 500 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    const ai = new GoogleGenAI({ apiKey: apiKey as string });

    const chatHistory = messages.map((m: any) => ({
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

    const generateDietPlanDecl: FunctionDeclaration = {
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
              fats: { type: Type.STRING }
            }
          },
          schedule: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                meal: { type: Type.STRING },
                items: { type: Type.STRING },
                portion: { type: Type.STRING }
              }
            }
          },
          guidelines: {
            type: Type.OBJECT,
            properties: {
              water: { type: Type.STRING },
              supplements: { type: Type.STRING },
              avoid: { type: Type.STRING },
              advice: { type: Type.STRING }
            }
          }
        },
        required: ['memberName', 'age', 'gender', 'height', 'weight', 'goal', 'activityLevel', 'dietaryPreference', 'budgetPreference', 'mealsPerDay', 'allergies', 'dailyCalories', 'macros', 'schedule', 'guidelines']
      }
    };

    const generateWorkoutPlanDecl: FunctionDeclaration = {
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
                      rest: { type: Type.STRING }
                    }
                  }
                }
              }
            }
          },
          guidelines: {
            type: Type.OBJECT,
            properties: {
              warmup: { type: Type.STRING },
              cooldown: { type: Type.STRING },
              recovery: { type: Type.STRING },
              progressiveOverload: { type: Type.STRING }
            }
          }
        },
        required: ['memberName', 'goal', 'experienceLevel', 'daysPerWeek', 'duration', 'targetMuscleGroups', 'schedule', 'guidelines']
      }
    };

    const dynamicSystemInstruction = `${SYSTEM_INSTRUCTION}\n\nGYM OWNER UPI ID: ${upiId || 'Not Configured'}\n\nINSTRUCTIONS FOR UPI: If a UPI ID is provided above, you MUST include it in all payment reminders (WhatsApp/SMS) and invoice summaries to facilitate payment. If it is 'Not Configured', politely ask the owner to add it to their profile.\n\nCURRENT MEMBERS DATABASE:\n${JSON.stringify(members, null, 2)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: chatHistory,
      config: {
        systemInstruction: dynamicSystemInstruction,
        temperature: 0.2,
        tools: [{ functionDeclarations: [prepareWhatsAppDecl, prepareSMSDecl, generateDietPlanDecl, generateWorkoutPlanDecl] }]
      },
    });

    if (response.functionCalls && response.functionCalls.length > 0) {
      const call = response.functionCalls[0];
      const args = call.args as any;

      if (call.name === 'generateDietPlan') {
        return NextResponse.json({
          type: 'functionCall',
          name: call.name,
          args: args,
          content: `I have generated the personalized diet plan for **${args.memberName}**. You can view, download, or share it below.`
        });
      } else if (call.name === 'generateWorkoutPlan') {
        return NextResponse.json({
          type: 'functionCall',
          name: call.name,
          args: args,
          content: `I have generated the personalized workout plan for **${args.memberName}**. You can view, download, or share it below.`
        });
      } else {
        return NextResponse.json({
          type: 'functionCall',
          name: call.name,
          args: args,
          content: `I have prepared the ${call.name === 'prepareWhatsApp' ? 'WhatsApp' : 'SMS'} message for you. Click the button below to open the app and send it.`
        });
      }
    } else {
      return NextResponse.json({
        type: 'text',
        content: response.text
      });
    }

  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred during chat generation.' },
      { status: 500 }
    );
  }
}
