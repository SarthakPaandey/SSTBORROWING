import { Navbar } from '@/components/Navbar';

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>
    </div>
  );
}
