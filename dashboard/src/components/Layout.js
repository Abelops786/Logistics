'use client';
import { useRouter, usePathname } from 'next/navigation';

const nav = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/agents', label: 'Agents' },
  { href: '/dashboard/trips', label: 'Trips' },
  { href: '/dashboard/pricing', label: 'Pricing' },
  { href: '/dashboard/drivers', label: 'Drivers' },
  { href: '/dashboard/vehicles', label: 'Vehicles' },
];

export default function Layout({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  function logout() {
    localStorage.clear();
    router.push('/');
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 bg-gray-900 text-white flex flex-col">
        <div className="px-6 py-5 border-b border-gray-700">
          <span className="font-bold text-lg">Abel Dispatch</span>
          <p className="text-xs text-gray-400 mt-1">Admin Panel</p>
        </div>
        <nav className="flex-1 py-4">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`block px-6 py-3 text-sm font-medium transition-colors ${
                pathname === item.href ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <button
          onClick={logout}
          className="px-6 py-4 text-sm text-gray-400 hover:text-white border-t border-gray-700 text-left"
        >
          Sign Out
        </button>
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
