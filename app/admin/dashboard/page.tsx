import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth/config';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { User } from '@/models/User';
import { Penalty } from '@/models/Penalty';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Calendar, Users, AlertTriangle, Clock } from 'lucide-react';
import { AdminNotifications } from '@/components/AdminNotifications';
import { DashboardCharts } from '@/components/admin/DashboardCharts';

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/login');
  }

  await connectDB();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get stats
  const todayBookings = await Booking.countDocuments({
    status: { $in: ['CONFIRMED', 'CHECKED_IN'] },
    start: { $gte: today, $lt: tomorrow },
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-gray-600">System overview and statistics</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayBookings}</div>
            <p className="text-xs text-muted-foreground">Active bookings today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingApprovals}</div>
            <p className="text-xs text-muted-foreground">Lab equipment requests</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeUsers}</div>
            <p className="text-xs text-muted-foreground">Registered students</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Penalties</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentPenalties}</div>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Charts */}
      <DashboardCharts />

      {/* Notification Settings */}
      <AdminNotifications />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <a
              href="/admin/lab-approvals"
              className="block rounded-lg border p-3 hover:bg-gray-50"
            >
              <p className="font-medium">Review Lab Approvals</p>
              <p className="text-sm text-gray-600">{pendingApprovals} pending requests</p>
            </a>
            <a
              href="/admin/blocks"
              className="block rounded-lg border p-3 hover:bg-gray-50"
            >
              <p className="font-medium">Manage Blocks</p>
              <p className="text-sm text-gray-600">Create maintenance blocks</p>
            </a>
            <a
              href="/admin/penalties"
              className="block rounded-lg border p-3 hover:bg-gray-50"
            >
              <p className="font-medium">Manage Penalties</p>
              <p className="text-sm text-gray-600">View and waive penalties</p>
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Database</span>
                <span className="text-green-600 font-medium">Connected</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Authentication</span>
                <span className="text-green-600 font-medium">Active</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">QR System</span>
                <span className="text-green-600 font-medium">Operational</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
