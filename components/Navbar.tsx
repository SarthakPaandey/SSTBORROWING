'use client';

import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, User, Menu, X } from 'lucide-react';
import { Button } from './ui/Button';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!session) return null;

  const role = session.user.role;

  const getNavLinks = () => {
    if (role === 'GUARD') {
      return [
        { href: '/guard/scanner', label: 'Scanner' },
        { href: '/guard/history', label: 'History' },
      ];
    }

    if (role === 'ADMIN') {
      return [
        { href: '/admin/dashboard', label: 'Dashboard' },
        { href: '/admin/resources', label: 'Resources' },
        { href: '/admin/lab-approvals', label: 'Lab Approvals' },
        { href: '/admin/bookings', label: 'Bookings' },
        { href: '/admin/blocks', label: 'Blocks' },
        { href: '/admin/penalties', label: 'Penalties' },
      ];
    }

    // STUDENT
    return [
      { href: '/user/dashboard', label: 'Dashboard' },
      { href: '/user/facilities', label: 'Facilities' },
      { href: '/user/rooms', label: 'Rooms' },
      { href: '/user/equipment', label: 'Equipment' },
      { href: '/user/bookings', label: 'My Bookings' },
    ];
  };

  const navLinks = getNavLinks();

  return (
    <nav className="border-b border-border/50 bg-card/30 backdrop-blur-lg sticky top-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2 sm:space-x-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                <span className="text-lg sm:text-xl font-bold text-primary">S</span>
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-sm font-bold text-foreground">Scaler School of Technology</span>
                <span className="text-xs text-muted-foreground">Booking System</span>
              </div>
              <div className="sm:hidden flex flex-col">
                <span className="text-xs font-bold text-foreground">SST Booking</span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'inline-flex items-center rounded-lg px-3 lg:px-4 py-2 text-sm font-medium transition-all',
                  pathname === link.href
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop User Info & Logout */}
          <div className="hidden md:flex items-center space-x-2 lg:space-x-4">
            <div className="hidden lg:flex items-center space-x-2 rounded-lg bg-secondary/50 px-3 py-1.5 text-sm border border-border/50">
              <User className="h-4 w-4 text-primary" />
              <span className="font-medium text-foreground truncate max-w-[120px]">{session.user.name}</span>
              <span className="text-muted-foreground">({role})</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4 lg:mr-2" />
              <span className="hidden lg:inline">Sign Out</span>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden rounded-lg p-2 text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border/50 bg-card/95 backdrop-blur-lg">
          <div className="space-y-1 px-4 pb-3 pt-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'block rounded-lg px-3 py-3 text-base font-medium transition-all',
                  pathname === link.href
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                )}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-3 border-t border-border/50 mt-2">
              <div className="flex items-center space-x-2 rounded-lg bg-secondary/50 px-3 py-2.5 text-sm border border-border/50 mb-2">
                <User className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="font-medium text-foreground truncate">{session.user.name}</span>
                <span className="text-muted-foreground flex-shrink-0">({role})</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="w-full justify-start hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
