import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth/config';
import { requireAuth } from '@/lib/auth/guards';
import { connectDB } from '@/lib/db';
import { Resource } from '@/models/Resource';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import Link from 'next/link';
import { MapPin, Users, Clock, ArrowRight } from 'lucide-react';

// Room type icons and colors
const roomTypeConfig: Record<string, { emoji: string; gradient: string; accent: string }> = {
  'Meeting Room': { emoji: '🤝', gradient: 'from-blue-500/20 to-cyan-500/10', accent: 'border-blue-500/30' },
  'Study Room': { emoji: '📚', gradient: 'from-amber-500/20 to-yellow-500/10', accent: 'border-amber-500/30' },
  'Conference Room': { emoji: '🎯', gradient: 'from-purple-500/20 to-pink-500/10', accent: 'border-purple-500/30' },
  'Seminar Hall': { emoji: '🎤', gradient: 'from-emerald-500/20 to-green-500/10', accent: 'border-emerald-500/30' },
  'Lab': { emoji: '🔬', gradient: 'from-rose-500/20 to-red-500/10', accent: 'border-rose-500/30' },
  'default': { emoji: '🚪', gradient: 'from-slate-500/20 to-gray-500/10', accent: 'border-slate-500/30' },
};

function getRoomConfig(name: string) {
  for (const [key, config] of Object.entries(roomTypeConfig)) {
    if (name.toLowerCase().includes(key.toLowerCase())) {
      return config;
    }
  }
  return roomTypeConfig.default;
}

function getCapacityBadge(capacity: number) {
  if (capacity <= 6) return { label: 'Small', color: 'bg-blue-500/20 text-blue-400' };
  if (capacity <= 12) return { label: 'Medium', color: 'bg-amber-500/20 text-amber-400' };
  if (capacity <= 24) return { label: 'Large', color: 'bg-emerald-500/20 text-emerald-400' };
  return { label: 'Hall', color: 'bg-purple-500/20 text-purple-400' };
}

export default async function RoomsPage() {
  await requireAuth(); // Trigger error boundary if blocked/suspended

  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  await connectDB();

  const rooms = await Resource.find({
    type: 'ROOM',
    status: 'ACTIVE',
  })
    .sort({ name: 1 })
    .lean();

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent-purple-1/20 via-pink-500/10 to-transparent p-6 border border-accent-purple-1/20">
        {/* Background decorations */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-purple-1/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-pink-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        {/* Floating room icons */}
        <div className="absolute top-4 right-8 text-4xl opacity-20 animate-float">🚪</div>
        <div className="absolute bottom-4 right-24 text-3xl opacity-20 animate-float" style={{ animationDelay: '1s' }}>🏢</div>
        <div className="absolute top-12 right-32 text-2xl opacity-20 animate-float" style={{ animationDelay: '2s' }}>📋</div>

        <div className="relative flex items-center gap-4">
          <div className="relative">
            {/* Animated glow ring */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 blur-xl opacity-40 animate-pulse" />
            <div className="relative p-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/30 backdrop-blur-sm flex items-center justify-center animate-float">
              <span className="text-4xl drop-shadow-lg">🚪</span>
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-text-main">
              Book a Room
            </h1>
            <p className="text-text-muted">
              Select a meeting or study room • {rooms.length} room{rooms.length !== 1 ? 's' : ''} available
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Rooms', value: rooms.length, emoji: '🚪' },
          { label: 'Meeting Rooms', value: rooms.filter(r => r.name.toLowerCase().includes('meeting')).length, emoji: '🤝' },
          { label: 'Study Rooms', value: rooms.filter(r => r.name.toLowerCase().includes('study')).length, emoji: '📚' },
          { label: 'Hours', value: '8AM-8PM', emoji: '🕐' },
        ].map((stat, index) => (
          <div
            key={stat.label}
            className="p-3 rounded-xl bg-card border border-card-border hover:border-accent-purple-1/30 transition-all group"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-text-muted">{stat.label}</span>
              <span className="text-lg group-hover:scale-125 transition-transform">{stat.emoji}</span>
            </div>
            <p className="text-xl font-bold text-text-main mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Rooms Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rooms.map((room, index) => {
          const config = getRoomConfig(room.name);

          return (
            <Link
              key={room._id.toString()}
              href={`/user/rooms/${room._id}`}
              className="group"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <Card className={`cursor-pointer transition-all duration-300 hover:shadow-[0_0_30px_rgba(139,92,246,0.3)] hover:-translate-y-2 overflow-hidden bg-gradient-to-br ${config.gradient} border ${config.accent} animate-fade-in-up`}>
                {/* Top accent line */}
                <div className="h-1 bg-gradient-to-r from-accent-purple-1 via-pink-500 to-accent-purple-1 opacity-0 group-hover:opacity-100 transition-opacity" />

                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl group-hover:scale-125 group-hover:rotate-12 transition-all duration-300">
                      {config.emoji}
                    </span>
                    <div>
                      <CardTitle className="group-hover:text-accent-purple-1 transition-colors">
                        {room.name}
                      </CardTitle>
                      {room.location && (
                        <CardDescription className="flex items-center text-text-muted mt-1">
                          <MapPin className="mr-1 h-3 w-3" />
                          {room.location}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-2">
                  <div className="space-y-3">
                    {/* Info pills */}
                    <div className="flex flex-wrap gap-2">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-bg-dark/50 text-xs text-text-muted">
                        <Clock className="h-3 w-3 text-accent-purple-1" />
                        <span>8 AM – 8 PM</span>
                      </div>
                    </div>

                    {/* Book now hint */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-2 border-t border-card-border/50">
                      <span className="text-xs text-text-muted group-hover:text-accent-purple-1 transition-colors">
                        Click to book
                      </span>
                      <div className="flex items-center gap-1 text-accent-purple-1 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all">
                        <span className="text-xs font-medium">Book Now</span>
                        <ArrowRight className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Empty State */}
      {rooms.length === 0 && (
        <div className="text-center py-16 animate-fade-in">
          <span className="text-6xl mb-4 block">🚪</span>
          <h3 className="text-xl font-semibold text-text-main mb-2">No Rooms Available</h3>
          <p className="text-text-muted">Check back later for available rooms</p>
        </div>
      )}

      {/* Pro tip */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-accent-purple-1/10 to-pink-500/10 border border-accent-purple-1/20">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <p className="font-medium text-text-main">Pro Tip</p>
            <p className="text-sm text-text-muted">
              Book rooms in advance during peak hours (10 AM - 4 PM) for the best availability!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
