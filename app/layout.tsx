import './globals.css';
import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/theme-provider';
import { RefreshProvider } from '@/components/refresh-provider';
import { ModalProvider } from '@/components/modal-provider';
import { AuthProvider } from '@/components/auth-provider';
import { AuthGuard } from '@/components/auth-guard';
import { LanguageProvider } from '@/components/language-provider';
import { AgencyProvider } from '@/components/agency-provider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'MEHANS — Real Estate OS',
  description: 'The operating system for modern real estate teams.',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
    shortcut: '/logo.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${playfair.variable} font-sans`}>
        <ThemeProvider>
          <AuthProvider>
            <LanguageProvider>
              <AuthGuard>
                <AgencyProvider>
                <RefreshProvider>
                  <ModalProvider>
                    {children}
                  </ModalProvider>
                </RefreshProvider>
                </AgencyProvider>
              </AuthGuard>
            </LanguageProvider>
          </AuthProvider>
          <Toaster
            position="bottom-right"
            theme="dark"
            toastOptions={{
              style: {
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)',
                borderRadius: '12px',
                fontSize: '13px',
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
