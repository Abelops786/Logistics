import './globals.css';

export const metadata = {
  title: 'R Transport — Admin',
  icons: {
    icon: [{ url: '/favicon.png', type: 'image/png' }],
    shortcut: '/favicon.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-100 min-h-screen">{children}</body>
    </html>
  );
}
