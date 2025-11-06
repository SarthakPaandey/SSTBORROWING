import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth/config';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { Booking } from '@/models/Booking';
import { Resource } from '@/models/Resource';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { AlertCircle, Calendar, Clock } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { formatDateTime } from '@/lib/utils';

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

  // Get upcoming bookings
  const upcomingBookings = await Booking.find({
    userId: user._id.toString(),
    status: { $in: ['CONFIRMED', 'PENDING', 'CHECKED_IN'] },
    start: { $gte: new Date() },
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-accent-blue">Welcome, {user.name}!</h1>
        <p className="text-text-muted">Manage your facility, room, and equipment bookings</p>
      </div>

      {/* Penalty Warning */}
      {user.penaltyPoints > 0 && (
        <Card className="border-danger/30 bg-danger/5">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-danger" />
              <CardTitle className="text-lg text-danger">
                Penalty Points: {user.penaltyPoints}
              </CardTitle>
            </div>
            <CardDescription className="text-text-muted">
              {user.suspendedUntil && new Date() < user.suspendedUntil
                ? `You are suspended until ${new Date(user.suspendedUntil).toLocaleDateString()}`
                : user.penaltyPoints >= 5
                ? 'You have reached the maximum penalty points. Please contact admin.'
                : 'Avoid no-shows and late returns to prevent suspension.'}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-4">
        <Link href="/user/facilities">
          <Card className="cursor-pointer transition-all duration-300 hover:shadow-[0_0_30px_rgba(47,176,255,0.3)] hover:border-accent-blue/40 hover:-translate-y-1">
            <CardHeader>
              <CardTitle className="text-base">Book Facility</CardTitle>
              <CardDescription>Turf & Courts</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/user/rooms">
          <Card className="cursor-pointer transition-all duration-300 hover:shadow-[0_0_30px_rgba(47,176,255,0.3)] hover:border-accent-blue/40 hover:-translate-y-1">
            <CardHeader>
              <CardTitle className="text-base">Book Room</CardTitle>
              <CardDescription>Meeting & Study Rooms</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/user/equipment">
          <Card className="cursor-pointer transition-all duration-300 hover:shadow-[0_0_30px_rgba(47,176,255,0.3)] hover:border-accent-blue/40 hover:-translate-y-1">
            <CardHeader>
              <CardTitle className="text-base">Borrow Equipment</CardTitle>
              <CardDescription>Sports & Lab Items</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/user/bookings">
          <Card className="cursor-pointer transition-all duration-300 hover:shadow-[0_0_30px_rgba(47,176,255,0.3)] hover:border-accent-blue/40 hover:-translate-y-1">
            <CardHeader>
              <CardTitle className="text-base">My Bookings</CardTitle>
              <CardDescription>View & manage</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* Upcoming Bookings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Upcoming Bookings</CardTitle>
            <Link href="/user/bookings">
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {enrichedBookings.length === 0 ? (
            <p className="text-center text-text-muted">No upcoming bookings</p>
          ) : (
            <div className="space-y-4">
              {enrichedBookings.map((booking: any) => (
                <div
                  key={booking._id.toString()}
                  className="flex items-center justify-between rounded-lg border border-card-border bg-bg-dark/50 p-4 transition-all hover:border-accent-blue/30"
                >
                  <div>
                    <p className="font-medium text-text-main">{booking.resourceName}</p>
                    <div className="mt-1 flex items-center space-x-4 text-sm text-text-muted">
                      <span className="flex items-center">
                        <Calendar className="mr-1 h-4 w-4" />
                        {formatDateTime(booking.start)}
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant={
                      booking.status === 'CONFIRMED'
                        ? 'success'
                        : booking.status === 'PENDING'
                        ? 'warning'
                        : 'default'
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
    </div>
  );
}
