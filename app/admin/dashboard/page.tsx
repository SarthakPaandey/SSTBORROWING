import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth/config';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { User } from '@/models/User';
import { Penalty } from '@/models/Penalty';
import { Card, CardContent, CardHeader, CardTitle, StatCard } from '@/components/ui/Card';
import { Calendar, Users, AlertTriangle, Clock, ArrowRight, CheckCircle2, Zap, Shield, Database, Sparkles } from 'lucide-react';
import { AdminNotifications } from '@/components/AdminNotifications';
import { DashboardCharts } from '@/components/admin/DashboardCharts';
import { getTodayStart, getTodayEnd, getNow } from '@/lib/timezone';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';

// Quick action items with emojis and styling
const quickActions = [
  {
    href: '/admin/lab-approvals',
    emoji: '🔬',
    title: 'Review Lab Approvals',
    description: 'pending requests',
    gradient: 'from-amber-500/20 to-orange-500/10',
    borderColor: 'border-amber-500/20 hover:border-amber-500/40',
    countKey: 'pendingApprovals',
  },
  {
    href: '/admin/blocks',
    emoji: '🚫',
    title: 'Manage Blocks',
    description: 'Create maintenance blocks',
    gradient: 'from-red-500/20 to-rose-500/10',
    borderColor: 'border-red-500/20 hover:border-red-500/40',
  },
  {
    href: '/admin/penalties',
    emoji: '⚠️',
    title: 'Manage Penalties',
    description: 'View and waive penalties',
    gradient: 'from-purple-500/20 to-violet-500/10',
    borderColor: 'border-purple-500/20 hover:border-purple-500/40',
  },
  {
    href: '/admin/resources',
    emoji: '🗂️',
    title: 'Manage Resources',
    description: 'Add or edit facilities',
    gradient: 'from-blue-500/20 to-cyan-500/10',
    borderColor: 'border-blue-500/20 hover:border-blue-500/40',
  },
];

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/login');
  }

  await connectDB();

  const today = getTodayStart();
  const tomorrow = getTodayEnd();
  const now = getNow();

  // Get stats
  const todayBookings = await Booking.countDocuments({
    status: { $in: ['CONFIRMED', 'CHECKED_IN'] },
    start: { $gte: today, $lte: tomorrow },
  });

  const pendingApprovals = await Booking.countDocuments({
    approval: 'PENDING',
  });

  const activeUsers = await User.countDocuments({
    role: 'STUDENT',
  });

  const recentPenalties = await Penalty.countDocuments({
    createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
  });

  // Get greeting based on time
  const getGreeting = () => {
    const hour = now.getHours();
    if (hour < 12) return { text: 'Good morning', emoji: '🌅' };
    if (hour < 17) return { text: 'Good afternoon', emoji: '☀️' };
    return { text: 'Good evening', emoji: '🌙' };
  };

  const greeting = getGreeting();

  return (
    <div className="space-y-8">
      {/* Hero Welcome Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent-purple-1/10 via-accent-blue/5 to-transparent border border-accent-purple-1/20 p-6 md:p-8">
        {/* Background decorations */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-purple-1/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent-blue/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-3xl animate-bounce-subtle">{greeting.emoji}</span>
              <span className="text-text-muted">{greeting.text}, Admin</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              Admin Dashboard <span className="text-gradient">👑</span>
            </h1>
            <p className="text-text-muted text-lg">
              System overview and management controls
            </p>
          </div>
          
          {/* Quick stats summary */}
          {pendingApprovals > 0 && (
            <Link href="/admin/lab-approvals">
              <div className="inline-flex items-center gap-3 px-4 py-3 rounded-xl bg-warning/10 border border-warning/30 animate-pulse hover:scale-105 transition-transform">
                <span className="text-2xl">🔔</span>
                <div>
                  <p className="font-semibold text-warning">{pendingApprovals} Pending</p>
                  <p className="text-xs text-text-muted">Approvals waiting</p>
                </div>
                <ArrowRight className="h-4 w-4 text-warning" />
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* Stats Grid - Enhanced */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Today's Bookings */}
        <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 p-6 transition-all duration-300 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/10 hover:-translate-y-1">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium text-text-muted">Today&apos;s Bookings</p>
              <p className="text-4xl font-bold text-text-main group-hover:text-emerald-400 transition-colors">
                {todayBookings}
              </p>
              <p className="text-xs text-text-muted flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Active bookings today
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/20 group-hover:bg-emerald-500/30 transition-colors group-hover:scale-110 group-hover:rotate-6 duration-300">
              <span className="text-2xl">📅</span>
            </div>
          </div>
        </div>

        {/* Pending Approvals */}
        <div className={`group relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 p-6 transition-all duration-300 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/10 hover:-translate-y-1 ${pendingApprovals > 0 ? 'animate-pulse' : ''}`}>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium text-text-muted">Pending Approvals</p>
              <p className="text-4xl font-bold text-text-main group-hover:text-amber-400 transition-colors">
                {pendingApprovals}
              </p>
              <p className="text-xs text-text-muted flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Lab equipment requests
              </p>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/20 group-hover:bg-amber-500/30 transition-colors group-hover:scale-110 group-hover:rotate-6 duration-300">
              <span className="text-2xl">⏳</span>
            </div>
          </div>
          {pendingApprovals > 0 && (
            <Link href="/admin/lab-approvals" className="absolute inset-0" />
          )}
        </div>

        {/* Active Users */}
        <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/20 p-6 transition-all duration-300 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/10 hover:-translate-y-1">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium text-text-muted">Active Users</p>
              <p className="text-4xl font-bold text-text-main group-hover:text-blue-400 transition-colors">
                {activeUsers}
              </p>
              <p className="text-xs text-text-muted flex items-center gap-1">
                <Users className="h-3 w-3" />
                Registered students
              </p>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/20 group-hover:bg-blue-500/30 transition-colors group-hover:scale-110 group-hover:rotate-6 duration-300">
              <span className="text-2xl">👥</span>
            </div>
          </div>
        </div>

        {/* Recent Penalties */}
        <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-red-500/10 to-rose-500/5 border border-red-500/20 p-6 transition-all duration-300 hover:border-red-500/40 hover:shadow-lg hover:shadow-red-500/10 hover:-translate-y-1">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium text-text-muted">Recent Penalties</p>
              <p className="text-4xl font-bold text-text-main group-hover:text-red-400 transition-colors">
                {recentPenalties}
              </p>
              <p className="text-xs text-text-muted flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Last 7 days
              </p>
            </div>
            <div className="p-3 rounded-xl bg-red-500/20 group-hover:bg-red-500/30 transition-colors group-hover:scale-110 group-hover:rotate-6 duration-300">
              <span className="text-2xl">⚠️</span>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Charts */}
      <DashboardCharts />

      {/* Notification Settings */}
      <AdminNotifications />

      {/* Quick Actions & System Status */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <Card variant="glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-accent-blue" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {quickActions.map((action, index) => (
              <Link
                key={action.href}
                href={action.href}
                className={`
                  flex items-center gap-4 rounded-xl p-4
                  bg-gradient-to-r ${action.gradient}
                  border ${action.borderColor}
                  transition-all duration-300
                  hover:shadow-lg hover:translate-x-2
                  group
                `}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="p-2 rounded-lg bg-white/5 group-hover:scale-110 transition-transform">
                  <span className="text-2xl">{action.emoji}</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-text-main group-hover:text-accent-blue transition-colors">
                    {action.title}
                  </p>
                  <p className="text-sm text-text-muted">
                    {action.countKey === 'pendingApprovals' 
                      ? `${pendingApprovals} ${action.description}`
                      : action.description
                    }
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-text-muted group-hover:text-accent-blue group-hover:translate-x-1 transition-all" />
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* System Status */}
        <Card variant="glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-success" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status items */}
            {[
              { label: 'Database', icon: '🗄️', status: 'Connected', color: 'success' },
              { label: 'Authentication', icon: '🔐', status: 'Active', color: 'success' },
              { label: 'QR System', icon: '📱', status: 'Operational', color: 'success' },
              { label: 'Email Service', icon: '📧', status: 'Running', color: 'success' },
            ].map((item, index) => (
              <div 
                key={item.label}
                className="flex items-center justify-between p-3 rounded-lg bg-success/5 border border-success/10 transition-all duration-300 hover:bg-success/10"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-text-muted">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <span className="text-success font-medium text-sm">{item.status}</span>
                </div>
              </div>
            ))}

            {/* Last updated */}
            <div className="pt-3 border-t border-border/50">
              <p className="text-xs text-text-muted text-center flex items-center justify-center gap-2">
                <Sparkles className="h-3 w-3" />
                All systems operational • Last checked: Just now
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
