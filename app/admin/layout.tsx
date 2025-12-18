import { Navbar } from '@/components/Navbar';
import { SimpleGradientBackground } from '@/components/ui/AnimatedBackground';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen relative">
      {/* Lightweight gradient background for better performance */}
      <SimpleGradientBackground />

      {/* Content */}
      <div className="relative z-10">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
