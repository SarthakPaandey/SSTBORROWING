'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';

export default function ResourcesPage() {
  const [resources, setResources] = useState<any[]>([]);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResources();
    fetchEquipment();
  }, []);

  const fetchResources = async () => {
    const res = await fetch('/api/resources');
    const data = await res.json();
    setResources(data.resources);
  };

  const fetchEquipment = async () => {
    const res = await fetch('/api/admin/equipment');
    const data = await res.json();
    setEquipment(data.items);
    setLoading(false);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  const facilities = resources.filter((r) => r.type === 'FACILITY');
  const rooms = resources.filter((r) => r.type === 'ROOM');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Resource Management</h1>
        <p className="text-gray-600">Manage facilities, rooms, and equipment</p>
      </div>

      <Tabs defaultValue="facilities">
        <TabsList>
          <TabsTrigger value="facilities">Facilities</TabsTrigger>
          <TabsTrigger value="rooms">Rooms</TabsTrigger>
          <TabsTrigger value="equipment">Equipment</TabsTrigger>
        </TabsList>

        <TabsContent value="facilities">
          <Card>
            <CardHeader>
              <CardTitle>Facilities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {facilities.map((resource) => (
                  <div
                    key={resource._id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div>
                      <p className="font-medium">{resource.name}</p>
                      <p className="text-sm text-gray-600">{resource.location}</p>
                    </div>
                    <Badge variant={resource.status === 'ACTIVE' ? 'success' : 'secondary'}>
                      {resource.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rooms">
          <Card>
            <CardHeader>
              <CardTitle>Rooms</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {rooms.map((resource) => (
                  <div
                    key={resource._id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div>
                      <p className="font-medium">{resource.name}</p>
                      <p className="text-sm text-gray-600">{resource.location}</p>
                    </div>
                    <Badge variant={resource.status === 'ACTIVE' ? 'success' : 'secondary'}>
                      {resource.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="equipment">
          <Card>
            <CardHeader>
              <CardTitle>Equipment Inventory</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {equipment.map((item) => (
                  <div
                    key={item._id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-600">
                        Available: {item.qtyAvailable} / {item.qtyTotal}
                      </p>
                    </div>
                    {item.restricted && <Badge variant="destructive">Restricted</Badge>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
