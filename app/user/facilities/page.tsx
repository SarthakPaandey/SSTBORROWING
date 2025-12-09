import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth/config';
import { connectDB } from '@/lib/db';
import { Resource } from '@/models/Resource';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import Link from 'next/link';
import { MapPin, Users, Clock, ArrowRight, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

// Facility icons and colors mapping
const facilityConfig: Record<string, { emoji: string; gradient: string; borderColor: string }> = {
  'Table Tennis': { emoji: '🏓', gradient: 'from-indigo-500/20 to-purple-500/10', borderColor: 'border-indigo-500/20 hover:border-indigo-500/50' },
  'Tennis': { emoji: '🎾', gradient: 'from-lime-500/20 to-green-500/10', borderColor: 'border-lime-500/20 hover:border-lime-500/50' },
  'Volleyball': { emoji: '🏐', gradient: 'from-amber-500/20 to-orange-500/10', borderColor: 'border-amber-500/20 hover:border-amber-500/50' },
  'Turf': { emoji: '⚽', gradient: 'from-emerald-500/20 to-green-500/10', borderColor: 'border-emerald-500/20 hover:border-emerald-500/50' },
  'Court': { emoji: '🏀', gradient: 'from-orange-500/20 to-amber-500/10', borderColor: 'border-orange-500/20 hover:border-orange-500/50' },
  'Badminton': { emoji: '🏸', gradient: 'from-blue-500/20 to-cyan-500/10', borderColor: 'border-blue-500/20 hover:border-blue-500/50' },
  'Cricket': { emoji: '🏏', gradient: 'from-yellow-500/20 to-amber-500/10', borderColor: 'border-yellow-500/20 hover:border-yellow-500/50' },
  'Swimming': { emoji: '🏊', gradient: 'from-cyan-500/20 to-blue-500/10', borderColor: 'border-cyan-500/20 hover:border-cyan-500/50' },
  'Gym': { emoji: '🏋️', gradient: 'from-red-500/20 to-rose-500/10', borderColor: 'border-red-500/20 hover:border-red-500/50' },
  'default': { emoji: '🏟️', gradient: 'from-accent-blue/20 to-accent-purple-1/10', borderColor: 'border-accent-blue/20 hover:border-accent-blue/50' },
};

const getFacilityConfig = (name: string) => {
  const lowerName = name.toLowerCase();

  // Prefer more specific matches (longer keys) first to avoid partial hits like "Tennis" before "Table Tennis".
  const match = Object.entries(facilityConfig)
    .filter(([key]) => key !== 'default')
    .sort((a, b) => b[0].length - a[0].length)
    .find(([key]) => lowerName.includes(key.toLowerCase()));

  return match ? match[1] : facilityConfig['default'];
};

export default async function FacilitiesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  await connectDB();

  const facilities = await Resource.find({
    type: 'FACILITY',
    status: 'ACTIVE',
  })
    .sort({ name: 1 })
    .lean();

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/20 via-green-500/10 to-transparent p-6 border border-emerald-500/20">
        {/* Background decorations */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-green-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        {/* Floating facility icons */}
        <div className="absolute top-4 right-8 text-4xl opacity-20 animate-float">⚽</div>
        <div className="absolute bottom-4 right-24 text-3xl opacity-20 animate-float" style={{ animationDelay: '1s' }}>🏀</div>
        <div className="absolute top-12 right-32 text-2xl opacity-20 animate-float" style={{ animationDelay: '2s' }}>🏸</div>

        <div className="relative flex items-center gap-4">
          <div className="relative">
            {/* Animated glow ring */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-500 blur-xl opacity-40 animate-pulse" />
            <div className="relative p-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-green-500/10 border border-emerald-500/30 backdrop-blur-sm flex items-center justify-center animate-float">
              <span className="text-4xl drop-shadow-lg">🏟️</span>
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-text-main">
              Book a Facility
            </h1>
            <p className="text-text-muted">
              Select a sports facility to reserve your slot
            </p>
          </div>
        </div>
      </div>

      {/* Quick info */}
      <div className="flex flex-wrap gap-4 animate-fade-in-up">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-success/10 border border-success/20">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-sm text-success font-medium">{facilities.length} Facilities Available</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-accent-blue/10 border border-accent-blue/20">
          <Clock className="h-4 w-4 text-accent-blue" />
          <span className="text-sm text-accent-blue font-medium">8:00 AM – 8:00 PM</span>
        </div>
      </div>

      {/* Facilities Grid */}
      {facilities.length === 0 ? (
        <div className="empty-state py-16">
          <div className="empty-state-icon text-6xl">🏟️</div>
          <h3 className="text-xl font-semibold text-text-main mb-2">No Facilities Available</h3>
          <p className="text-text-muted">Check back later for available facilities.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {facilities.map((facility, index) => {
            const config = getFacilityConfig(facility.name);

            return (
              <Link
                key={facility._id.toString()}
                href={`/user/facilities/${facility._id}`}
                className="block animate-fade-in-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <Card
                  className={`
                    cursor-pointer h-full overflow-hidden
                    bg-gradient-to-br ${config.gradient}
                    border ${config.borderColor}
                    transition-all duration-400
                    hover:shadow-[0_0_40px_rgba(47,176,255,0.25)]
                    hover:-translate-y-2 hover:scale-[1.02]
                    group
                  `}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="p-3 rounded-xl bg-white/5 group-hover:bg-white/10 transition-colors group-hover:scale-110 group-hover:rotate-3 duration-300">
                        <span className="text-3xl">{config.emoji}</span>
                      </div>
                      <Badge variant="success" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        Available
                      </Badge>
                    </div>

                    <div className="mt-4">
                      <CardTitle className="text-xl group-hover:text-accent-blue transition-colors flex items-center gap-2">
                        {facility.name}
                        <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                      </CardTitle>
                      {facility.location && (
                        <CardDescription className="flex items-center gap-1.5 text-text-muted mt-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {facility.location}
                        </CardDescription>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5">
                        <Clock className="h-3.5 w-3.5 text-accent-blue" />
                        <span className="text-text-muted">8AM – 8PM</span>
                      </div>
                      {facility.capacity && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5">
                          <Users className="h-3.5 w-3.5 text-accent-blue" />
                          <span className="text-text-muted">{facility.capacity} people</span>
                        </div>
                      )}
                    </div>

                    {/* Hover hint */}
                    <div className="mt-4 pt-3 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-xs text-accent-blue flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        Click to view available slots
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Tips section */}
      <div className="grid gap-4 md:grid-cols-2 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
        <div className="p-4 rounded-xl bg-gradient-to-br from-accent-blue/10 to-accent-blue/5 border border-accent-blue/20">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">💡</span>
            <h3 className="font-semibold text-accent-blue">Booking Tips</h3>
          </div>
          <ul className="text-sm text-text-muted space-y-1">
            <li>• Book up to 7 days in advance</li>
            <li>• Generate QR code 15 min before slot</li>
            <li>• Cancel at least 24 hours before start</li>
          </ul>
        </div>

        <div className="p-4 rounded-xl bg-gradient-to-br from-accent-purple-1/10 to-accent-purple-1/5 border border-accent-purple-1/20">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">👥</span>
            <h3 className="font-semibold text-accent-purple-1">Group Bookings</h3>
          </div>
          <ul className="text-sm text-text-muted space-y-1">
            <li>• Invite up to 10 friends</li>
            <li>• Cancel early if group can't attend</li>
            <li>• Organizer generates QR code</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
