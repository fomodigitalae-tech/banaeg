import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ساعة الأهلي الذكية | تجربة مصرفية ذكية',
  description: 'ساعة الأهلي الذكية — ادفع بلمسة واحدة من معصمك.',
  themeColor: '#087a47',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
