import type {Metadata} from 'next';
import { Analytics } from '@vercel/analytics/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'GymAssist AI | AI Gym Management Software for Indian Gyms',
  description: 'GymAssist AI helps Indian gym owners track members, payments, renewals, WhatsApp reminders, and revenue analytics.',
  icons: {
    icon: [
      { url: '/gymassistai-mark.png', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
