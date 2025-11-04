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
        <h1 className="text-3xl font-bold">Welcome, {user.name}!</h1>
        <p className="text-gray-600">Manage your facility, room, and equipment bookings</p>
      </div>

      {/* Penalty Warning */}
      {user.penaltyPoints > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <CardTitle className="text-lg text-yellow-900">
                Penalty Points: {user.penaltyPoints}
              </CardTitle>
            </div>
            <CardDescription className="text-yellow-800">
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
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="text-base">Book Facility</CardTitle>
              <CardDescription>Turf, Courts, Gym</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/user/rooms">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="text-base">Book Room</CardTitle>
              <CardDescription>Meeting & Study Rooms</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/user/equipment">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="text-base">Borrow Equipment</CardTitle>
              <CardDescription>Sports & Lab Items</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/user/bookings">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
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
            <p className="text-center text-gray-500">No upcoming bookings</p>
          ) : (
            <div className="space-y-4">
              {enrichedBookings.map((booking: any) => (
                <div
                  key={booking._id.toString()}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div>
                    <p className="font-medium">{booking.resourceName}</p>
                    <div className="mt-1 flex items-center space-x-4 text-sm text-gray-600">
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
