import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ШУМ — лаборатория прогнозов',
  description:
    'Анализ потока задач, эвристики перегрузки и прогнозы. CSV, прозрачная модель и 600 симуляций в браузере.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark">
      <body>{children}</body>
    </html>
  );
}
