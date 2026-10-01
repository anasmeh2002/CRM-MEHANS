import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/theme-provider';
import { RefreshProvider } from '@/components/refresh-provider';
import { ModalProvider } from '@/components/modal-provider';
import { AuthProvider } from '@/components/auth-provider';
import { AuthGuard } from '@/components/auth-guard';
import { LanguageProvider } from '@/components/language-provider';
import { AgencyProvider } from '@/components/agency-provider';
import { ServiceWorkerRegister } from '@/components/sw-register';

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
  manifest: '/manifest.webmanifest',
  applicationName: 'MEHANS',
  appleWebApp: {
    capable: true,
    title: 'MEHANS',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/logo.png', sizes: 'any' },
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180' },
    ],
    shortcut: '/logo.png',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-title': 'MEHANS',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#0D0D0F',
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
            position="bottom-center"
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
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
