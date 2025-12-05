import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth/config';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { Booking } from '@/models/Booking';
import { Resource } from '@/models/Resource';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { AlertCircle, Calendar, Clock, MapPin, Package, DoorOpen, Users, CalendarDays, BookOpen, Sparkles, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { formatDateTime } from '@/lib/utils';
import { getNow } from '@/lib/timezone';
import { EnrichedBooking } from '@/types/booking';
import { POLICIES } from '@/lib/policies';

// Quick action cards with emojis and colors
const quickActions = [
  {
    href: '/user/facilities',
    emoji: '🏟️',
    title: 'Book Facility',
    description: 'Turf & Courts',
    gradient: 'from-emerald-500/20 to-teal-500/10',
    borderColor: 'hover:border-emerald-500/40',
    iconBg: 'bg-emerald-500/20',
  },
  {
    href: '/user/rooms',
    emoji: '🚪',
    title: 'Book Room',
    description: 'Meeting & Study Rooms',
    gradient: 'from-blue-500/20 to-cyan-500/10',
    borderColor: 'hover:border-blue-500/40',
    iconBg: 'bg-blue-500/20',
  },
  {
    href: '/user/equipment',
    emoji: '🎾',
    title: 'Borrow Items',
    description: 'Equipment & Books',
    gradient: 'from-purple-500/20 to-pink-500/10',
    borderColor: 'hover:border-purple-500/40',
    iconBg: 'bg-purple-500/20',
  },
  {
    href: '/user/bookings',
    emoji: '📅',
    title: 'My Bookings',
    description: 'View & manage',
    gradient: 'from-amber-500/20 to-orange-500/10',
    borderColor: 'hover:border-amber-500/40',
    iconBg: 'bg-amber-500/20',
  },
];

export default async function UserDashboard() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  await connectDB();

  const user = await User.findById(session.user.id);
  if (!user) {
    redirect('/login');
  }

  const now = getNow();
  const suspensionLevel = user.suspensionLevel || 0;
  const thresholdByLevel = [
    POLICIES.PENALTY_THRESHOLD_LEVEL_0,
    POLICIES.PENALTY_THRESHOLD_LEVEL_1,
    POLICIES.PENALTY_THRESHOLD_LEVEL_2,
  ];
  const threshold = thresholdByLevel[suspensionLevel] ?? POLICIES.PENALTY_THRESHOLD_LEVEL_0;
  const levelLabel = ['Level 0 • Fresh', 'Level 1 • Probation', 'Level 2 • Final warning'][suspensionLevel] || 'Current level';
  const nextAction = suspensionLevel >= 2 ? 'Permanent block' : 'Suspension';
  const penaltyProgress = Math.min((user.penaltyPoints / threshold) * 100, 100);

  // Get upcoming bookings
  const upcomingBookings = await Booking.find({
    userId: user.id,
    status: { $in: ['CONFIRMED', 'PENDING', 'CHECKED_IN'] },
    start: { $gte: now },
  })
    .sort({ start: 1 })
    .limit(5)
    .lean();

  // Enrich with resource names
  const resourceIds = upcomingBookings.map((b) => b.resourceId);
  const resources = await Resource.find({ _id: { $in: resourceIds } }).lean();
  const resourceMap = new Map(resources.map((r) => [r._id.toString(), r]));

  const enrichedBookings = upcomingBookings.map((b) => ({
    ...b,
    resourceName: resourceMap.get(b.resourceId)?.name || 'Unknown',
  }));

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
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent-blue/10 via-accent-purple-1/5 to-transparent border border-accent-blue/20 p-6 md:p-8">
        {/* Background decorations */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-blue/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent-purple-1/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-3xl animate-bounce-subtle">{greeting.emoji}</span>
            <span className="text-text-muted">{greeting.text}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            Welcome back, <span className="text-gradient">{user.name?.split(' ')[0]}</span>! ✨
          </h1>
          <p className="text-text-muted text-lg">
            Ready to book facilities, rooms, or equipment? Let&apos;s get started.
          </p>
        </div>
      </div>

      {/* Penalty Warning - Enhanced */}
      {user.penaltyPoints > 0 && (
        <Card className="border-danger/30 bg-gradient-to-r from-danger/10 to-danger/5 animate-fade-in">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-danger/20 animate-pulse">
                <AlertCircle className="h-5 w-5 text-danger" />
              </div>
              <div>
                <CardTitle className="text-lg text-danger flex items-center gap-2">
                  ⚠️ Penalty Points: {user.penaltyPoints}/{threshold}
                </CardTitle>
                <CardDescription className="text-text-muted">
                  {user.suspendedUntil && now < user.suspendedUntil
                    ? `🚫 You are suspended until ${new Date(user.suspendedUntil).toLocaleDateString()}`
                    : user.penaltyPoints >= threshold
                      ? `🛑 ${nextAction} threshold reached. Please contact admin.`
                      : `💡 Next ${nextAction.toLowerCase()} at ${threshold} points (${levelLabel}).`}
                </CardDescription>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-4 h-2 bg-danger/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-danger to-red-400 rounded-full transition-all duration-500"
                style={{ width: `${penaltyProgress}%` }}
              />
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Quick Actions - Enhanced Grid */}
      <div>
        <h2 className="text-xl font-semibold text-text-main mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent-blue" />
          Quick Actions
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action, index) => (
            <Link key={action.href} href={action.href}>
              <Card 
                className={`
                  cursor-pointer h-full
                  bg-gradient-to-br ${action.gradient}
                  border-card-border ${action.borderColor}
                  transition-all duration-300
                  hover:shadow-[0_0_30px_rgba(47,176,255,0.2)]
                  hover:-translate-y-2 hover:scale-[1.02]
                  group
                  animate-fade-in-up
                `}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardHeader className="space-y-4">
                  <div className={`w-14 h-14 rounded-2xl ${action.iconBg} flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                    <span className="text-3xl">{action.emoji}</span>
                  </div>
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2 group-hover:text-accent-blue transition-colors">
                      {action.title}
                      <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    </CardTitle>
                    <CardDescription className="text-text-muted">
                      {action.description}
                    </CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Upcoming Bookings - Enhanced */}
      <Card variant="glow">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">📋</span>
              Upcoming Bookings
            </CardTitle>
            <Link href="/user/bookings">
              <Button variant="ghost" size="sm" className="group">
                View All
                <ArrowRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {enrichedBookings.length === 0 ? (
            <div className="empty-state py-12">
              <div className="empty-state-icon text-6xl">📅</div>
              <h3 className="text-xl font-semibold text-text-main mb-2">No Upcoming Bookings</h3>
              <p className="text-text-muted mb-6 max-w-md">
                Your schedule is clear! Start by booking a facility, room, or equipment.
              </p>
              <Link href="/user/facilities">
                <Button variant="gradient" size="lg" className="btn-ripple group">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Book a Facility
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {enrichedBookings.map((booking: any, index: number) => (
                <div
                  key={booking._id.toString()}
                  className="flex items-center justify-between rounded-xl border border-card-border bg-gradient-to-r from-bg-dark/80 to-bg-dark/40 p-4 transition-all duration-300 hover:border-accent-blue/30 hover:shadow-lg hover:shadow-accent-blue/5 hover:translate-x-1 group animate-fade-in-up"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-center gap-4">
                    {/* Status indicator */}
                    <div className={`w-2 h-12 rounded-full ${
                      booking.status === 'CONFIRMED' ? 'bg-success' :
                      booking.status === 'PENDING' ? 'bg-warning' :
                      'bg-accent-blue'
                    }`} />
                    
                    <div>
                      <p className="font-medium text-text-main group-hover:text-accent-blue transition-colors">
                        {booking.resourceName}
                      </p>
                      <div className="mt-1 flex items-center gap-3 text-sm text-text-muted">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDateTime(booking.start)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <Badge
                    variant={
                      booking.status === 'CONFIRMED' ? 'success' :
                      booking.status === 'PENDING' ? 'warning' :
                      'default'
                    }
                    icon={
                      booking.status === 'CONFIRMED' ? '✅' :
                      booking.status === 'PENDING' ? '⏳' :
                      '📍'
                    }
                  >
                    {booking.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Tips Section */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="p-4 rounded-xl bg-gradient-to-br from-success/10 to-success/5 border border-success/20">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">💡</span>
            <h3 className="font-semibold text-success">Pro Tip</h3>
          </div>
          <p className="text-sm text-text-muted">
            Generate your QR code 15 minutes before your booking time for quick check-in!
          </p>
        </div>
        
        <div className="p-4 rounded-xl bg-gradient-to-br from-accent-blue/10 to-accent-blue/5 border border-accent-blue/20">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">📱</span>
            <h3 className="font-semibold text-accent-blue">Quick Access</h3>
          </div>
          <p className="text-sm text-text-muted">
            Add this page to your home screen for instant access to your bookings!
          </p>
        </div>
        
        <div className="p-4 rounded-xl bg-gradient-to-br from-accent-purple-1/10 to-accent-purple-1/5 border border-accent-purple-1/20">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">👥</span>
            <h3 className="font-semibold text-accent-purple-1">Group Bookings</h3>
          </div>
          <p className="text-sm text-text-muted">
            Invite friends to join your facility bookings for team activities!
          </p>
        </div>
      </div>
    </div>
  );
}
