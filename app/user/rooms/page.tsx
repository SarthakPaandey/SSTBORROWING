import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth/config';
import { connectDB } from '@/lib/db';
import { Resource } from '@/models/Resource';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import Link from 'next/link';
import { MapPin } from 'lucide-react';

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
        <h1 className="text-3xl font-bold">Book a Room</h1>
        <p className="text-gray-600">Select a meeting or study room</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rooms.map((room) => (
          <Link key={room._id.toString()} href={`/user/rooms/${room._id.toString()}`}>
            <Card className="cursor-pointer transition-shadow hover:shadow-lg">
              <CardHeader>
                <CardTitle>{room.name}</CardTitle>
                {room.location && (
                  <CardDescription className="flex items-center">
                    <MapPin className="mr-1 h-4 w-4" />
                    {room.location}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-600">
                  <p>Slot Duration: {room.rules.slotMinutes || 120} minutes</p>
                  {room.capacity && <p>Capacity: {room.capacity} people</p>}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
