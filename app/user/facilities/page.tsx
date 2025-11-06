import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth/config';
import { connectDB } from '@/lib/db';
import { Resource } from '@/models/Resource';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import Link from 'next/link';
import { MapPin } from 'lucide-react';

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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-accent-blue">Book a Facility</h1>
        <p className="text-text-muted">Select a sports facility to book</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {facilities.map((facility) => (
          <Link
            key={facility._id.toString()}
            href={`/user/facilities/${facility._id.toString()}`}
          >
            <Card className="cursor-pointer transition-all duration-300 hover:shadow-[0_0_30px_rgba(47,176,255,0.3)] hover:border-accent-blue/40 hover:-translate-y-1">
              <CardHeader>
                <CardTitle>{facility.name}</CardTitle>
                {facility.location && (
                  <CardDescription className="flex items-center text-text-muted">
                    <MapPin className="mr-1 h-4 w-4" />
                    {facility.location}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="text-sm text-text-muted">
                  <p>Slot Duration: {facility.rules.slotMinutes || 60} minutes</p>
                  {facility.capacity && <p>Capacity: {facility.capacity} people</p>}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
