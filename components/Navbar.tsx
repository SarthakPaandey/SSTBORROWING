'use client';

import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { LogOut, User, Menu, X, Bell, Sparkles } from 'lucide-react';
import { Button } from './ui/Button';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

// Navigation icons for each section
const navIcons: Record<string, string> = {
  '/user/dashboard': '🏠',
  '/user/facilities': '🏟️',
  '/user/rooms': '🚪',
  '/user/equipment': '🎾',
  '/user/group-invitations': '👥',
  '/user/bookings': '📅',

  '/user/penalties': '⚖️',
  '/admin/dashboard': '📊',
  '/admin/resources': '🗂️',
  '/admin/lab-approvals': '🔬',
  '/admin/bookings': '📋',
  '/admin/group-bookings': '👨‍👩‍👧‍👦',
  '/admin/blocks': '🚫',
  '/admin/penalties': '⚠️',
  '/admin/settings': '⚙️',
  '/admin/email-routing': '📧',
  '/admin/audit-logs': '📋',
  '/admin/bulk-operations': '⚡',
  '/admin/analytics': '📊',
  '/guard/scanner': '📷',
  '/guard/returns': '↩️',
  '/guard/library-returns': '📚',
  '/guard/history': '📜',
};

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  // Track scroll for navbar effects
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch pending approvals count for admins
  useEffect(() => {
    if (session?.user?.role === 'ADMIN') {
      const fetchPendingCount = async () => {
        try {
          const res = await fetch('/api/admin/lab-approvals?status=PENDING');
          const data = await res.json();
          setPendingApprovalsCount(data.bookings?.length || 0);
        } catch (error) {
          console.error('Failed to fetch pending approvals:', error);
        }
      };

      fetchPendingCount();
      const interval = setInterval(fetchPendingCount, 30000);
      return () => clearInterval(interval);
    }
  }, [session?.user?.role]);

  if (!session) return null;

  const role = session.user.role;

  const getNavLinks = () => {
    if (role === 'GUARD') {
      return [
        { href: '/guard/scanner', label: 'Scanner' },
        { href: '/guard/returns', label: 'Equipment Returns' },
        { href: '/guard/library-returns', label: 'Library Returns' },
        { href: '/guard/history', label: 'History' },
      ];
    }

    if (role === 'ADMIN') {
      // Primary links always visible
      return [
        { href: '/admin/dashboard', label: 'Dashboard' },
        { href: '/admin/resources', label: 'Resources' },
        { href: '/admin/library', label: 'Library' },
        { href: '/admin/lab-approvals', label: 'Approvals' },
        { href: '/admin/bookings', label: 'Bookings' },
        { href: '/admin/group-bookings', label: 'Group Bookings' },
        { href: '/admin/blocks', label: 'Blocks' },
        { href: '/admin/penalties', label: 'Penalties' },
        { href: '/admin/settings', label: 'Settings' },
        { href: '/admin/email-routing', label: 'Email Routing' },
        { href: '/admin/audit-logs', label: 'Audit Logs' },
        { href: '/admin/bulk-operations', label: 'Bulk Ops' },
        { href: '/admin/analytics', label: 'Analytics' },
      ];
    }

    // STUDENT
    return [
      { href: '/user/dashboard', label: 'Dashboard' },
      { href: '/user/facilities', label: 'Facilities' },
      { href: '/user/rooms', label: 'Rooms' },
      { href: '/user/equipment', label: 'Equipment' },
      { href: '/user/library', label: 'Library' },
      { href: '/user/group-invitations', label: 'Group Invites' },
      { href: '/user/bookings', label: 'My Bookings' },

      { href: '/user/penalties', label: 'Rules & Penalties' },
    ];
  };

  const navLinks = getNavLinks();

  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 5) return '🌙 Good night';
    if (hour < 12) return '🌅 Good morning';
    if (hour < 17) return '☀️ Good afternoon';
    if (hour < 21) return '🌆 Good evening';
    return '🌙 Good night';
  };

  return (
    <nav
      className={cn(
        'border-b border-border/50 sticky top-0 z-50',
        'transition-all duration-300',
        scrolled
          ? 'bg-card/80 backdrop-blur-xl shadow-lg shadow-black/10'
          : 'bg-card/30 backdrop-blur-lg'
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          {/* Logo with hover effect */}
          <div className="flex items-center">
            <Link
              href="/"
              className="flex items-center group transition-transform duration-300 hover:scale-105"
            >
              <Image
                src="/sst-logo.png"
                alt="SST Logo"
                width={180}
                height={50}
                className="object-contain h-10 sm:h-12 transition-all duration-300 group-hover:brightness-110"
                priority
              />
            </Link>
          </div>

          {/* Desktop Navigation - Scrollable for many links */}
          <div className="hidden md:flex items-center overflow-x-auto scrollbar-hide max-w-[calc(100vw-400px)]">
            <div className="flex items-center space-x-1">
              {navLinks.map((link, index) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-lg px-2 lg:px-3 py-1.5 text-xs lg:text-sm font-medium whitespace-nowrap',
                    'transition-all duration-300 relative overflow-hidden group flex-shrink-0',
                    pathname === link.href
                      ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm shadow-primary/20'
                      : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground hover:scale-105'
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Animated background on hover */}
                  <span className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />

                  {/* Icon */}
                  <span className={cn(
                    'text-base leading-none opacity-90 transition-transform duration-300',
                    pathname === link.href ? 'animate-bounce-subtle' : 'group-hover:scale-110'
                  )}>
                    {navIcons[link.href] || '📌'}
                  </span>

                  {/* Label */}
                  <span className="relative">{link.label}</span>

                  {/* Active indicator dot */}
                  {pathname === link.href && (
                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary animate-pulse" />
                  )}
                </Link>
              ))}
            </div>
          </div>

          {/* Desktop User Info & Logout */}
          <div className="hidden md:flex items-center space-x-2 lg:space-x-4">
            {/* Notification Bell for Admins */}
            {role === 'ADMIN' && (
              <Link
                href="/admin/lab-approvals"
                className={cn(
                  'relative p-2 rounded-lg transition-all duration-300',
                  'hover:bg-secondary/50 hover:scale-110',
                  pendingApprovalsCount > 0 && 'animate-bounce-subtle'
                )}
                title="Approvals"
              >
                <Bell className={cn(
                  "h-5 w-5 transition-colors duration-300",
                  pendingApprovalsCount > 0 ? "text-accent-blue" : "text-muted-foreground"
                )} />
                {pendingApprovalsCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white animate-pulse shadow-lg shadow-danger/50">
                    {pendingApprovalsCount > 9 ? '9+' : pendingApprovalsCount}
                  </span>
                )}
              </Link>
            )}

            {/* User info pill */}
            <div className="hidden lg:flex items-center space-x-2 rounded-full bg-gradient-to-r from-secondary/50 to-secondary/30 px-4 py-2 text-sm border border-border/50 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10 group">
              <div className="p-1 rounded-full bg-primary/20 group-hover:bg-primary/30 transition-colors">
                <User className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="font-medium text-foreground truncate max-w-[120px]">{session.user.name}</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                <span className="text-sm leading-none opacity-90" aria-hidden>
                  {role === 'ADMIN' ? '🛠️' : role === 'GUARD' ? '🛡️' : '🎓'}
                </span>
                <span>
                  {role === 'ADMIN' ? 'Admin' : role === 'GUARD' ? 'Guard' : 'Student'}
                </span>
              </span>
            </div>

            {/* Logout button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="hover:bg-destructive/10 hover:text-destructive group transition-all duration-300"
            >
              <LogOut className="h-4 w-4 lg:mr-2 transition-transform duration-300 group-hover:rotate-12" />
              <span className="hidden lg:inline">Sign Out</span>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={cn(
              'md:hidden rounded-lg p-2 transition-all duration-300',
              'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
              mobileMenuOpen && 'bg-secondary/50 text-foreground rotate-90'
            )}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6 animate-scale-in" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu with animation */}
      <div
        className={cn(
          'md:hidden overflow-hidden transition-all duration-300 ease-out',
          mobileMenuOpen
            ? 'max-h-[80vh] opacity-100 border-t border-border/50'
            : 'max-h-0 opacity-0'
        )}
      >
        <div className="bg-card/95 backdrop-blur-xl">
          <div className="space-y-1 px-4 pb-4 pt-3">
            {/* Greeting */}
            <div className="px-3 py-2 mb-2">
              <p className="text-sm text-text-muted">{getGreeting()}, {session.user.name?.split(' ')[0]}! 👋</p>
            </div>

            {navLinks.map((link, index) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium',
                  'transition-all duration-300 animate-fade-in-left',
                  pathname === link.href
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground hover:translate-x-2'
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <span className="text-xl">{navIcons[link.href] || '📌'}</span>
                <span>{link.label}</span>
                {pathname === link.href && (
                  <Sparkles className="h-4 w-4 ml-auto text-primary animate-pulse" />
                )}
              </Link>
            ))}

            {/* Mobile Notification for Admins */}
            {role === 'ADMIN' && pendingApprovalsCount > 0 && (
              <Link
                href="/admin/lab-approvals"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between rounded-xl bg-gradient-to-r from-accent-blue/20 to-accent-blue/10 border border-accent-blue/30 px-4 py-3 text-sm font-medium text-accent-blue animate-pulse"
              >
                <span className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Pending Approvals
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-danger text-xs font-bold text-white shadow-lg shadow-danger/50">
                  {pendingApprovalsCount > 9 ? '9+' : pendingApprovalsCount}
                </span>
              </Link>
            )}

            {/* User section */}
            <div className="pt-4 border-t border-border/50 mt-3 space-y-3">
              <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-secondary/50 to-secondary/30 px-4 py-3 text-sm border border-border/50">
                <div className="p-2 rounded-full bg-primary/20">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{session.user.name}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <span className="text-sm leading-none opacity-90" aria-hidden>
                        {role === 'ADMIN' ? '🛠️' : role === 'GUARD' ? '🛡️' : '🎓'}
                      </span>
                      <span>{role === 'ADMIN' ? 'Administrator' : role === 'GUARD' ? 'Security Guard' : 'Student'}</span>
                    </span>
                  </p>
                </div>
              </div>

              <Button
                variant="destructive"
                size="sm"
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="w-full justify-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
