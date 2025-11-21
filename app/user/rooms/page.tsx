import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth/config';
import { connectDB } from '@/lib/db';
import { Resource } from '@/models/Resource';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import Link from 'next/link';
import { MapPin, Users, Clock } from 'lucide-react';

export default async function RoomsPage() {
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
      <div>
        <h1 className="text-3xl font-bold text-accent-blue">Book a Room</h1>
        <p className="text-text-muted">Select a meeting or study room</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rooms.map((room) => (
          <Link key={room._id.toString()} href={`/user/rooms/${room._id}`}>
            <Card className="cursor-pointer transition-all duration-300 hover:shadow-[0_0_30px_rgba(47,176,255,0.3)] hover:border-accent-blue/40 hover:-translate-y-1 card-scale-hover group">
              <CardHeader>
                <CardTitle className="group-hover:text-accent-blue transition-colors">{room.name}</CardTitle>
                {room.location && (
                  <CardDescription className="flex items-center text-text-muted">
                    <MapPin className="mr-1 h-4 w-4" />
                    {room.location}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="text-sm text-text-muted space-y-2">
                  <div className="flex items-center">
                    <Clock className="mr-2 h-4 w-4 text-accent-blue" />
                    <span>{((room.rules.slotMinutes || 60) / 60)} hour slots</span>
                  </div>
                  {room.capacity && (
                    <div className="flex items-center">
                      <Users className="mr-2 h-4 w-4 text-accent-blue" />
                      <span>Capacity: {room.capacity} people</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
