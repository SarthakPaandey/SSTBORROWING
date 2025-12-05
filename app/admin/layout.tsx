import { Navbar } from '@/components/Navbar';
import { AnimatedBackground } from '@/components/ui/AnimatedBackground';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen relative">
      {/* Animated gradient background - intense variant for admin */}
      <AnimatedBackground variant="default" />
      
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
