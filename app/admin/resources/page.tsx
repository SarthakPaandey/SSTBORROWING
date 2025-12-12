'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/LoadingState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Plus, Edit, Trash2, Clock } from 'lucide-react';
import Link from 'next/link';

type ModalMode = 'add' | 'edit' | null;

export default function ResourcesPage() {
  const [resources, setResources] = useState<any[]>([]);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Resource modal state
  const [resourceModal, setResourceModal] = useState(false);
  const [resourceMode, setResourceMode] = useState<ModalMode>(null);
  const [selectedResource, setSelectedResource] = useState<any>(null);
  const [resourceForm, setResourceForm] = useState({
    type: 'FACILITY',
    name: '',
    location: '',
    capacity: '',
    requiresApproval: false,
    studentsOnly: false,
    status: 'ACTIVE',
  });

  // Equipment modal state
  const [equipmentModal, setEquipmentModal] = useState(false);
  const [equipmentMode, setEquipmentMode] = useState<ModalMode>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<any>(null);
  const [equipmentForm, setEquipmentForm] = useState({
    name: '',
    qtyTotal: '',
    qtyAvailable: '',
    safety: false,
    restricted: false,
    requiresApproval: false,
    resourceId: '',
  });

  // Delete confirmation
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteType, setDeleteType] = useState<'resource' | 'equipment'>('resource');

  useEffect(() => {
    fetchResources();
    fetchEquipment();
  }, []);

  const fetchResources = async () => {
    try {
      const res = await fetch('/api/resources?type=');
      const data = await res.json();
      setResources(data.resources || []);
    } catch (error) {
      console.error('Failed to fetch resources:', error);
    }
  };

  const fetchEquipment = async () => {
    try {
      const res = await fetch('/api/admin/equipment');
      const data = await res.json();
      setEquipment(data.items || []);
    } catch (error) {
      console.error('Failed to fetch equipment:', error);
    } finally {
      setLoading(false);
    }
  };

  // Resource handlers
  const openAddResource = (type: string) => {
    setResourceForm({
      type,
      name: '',
      location: '',
      capacity: '',
      requiresApproval: false,
      studentsOnly: false,
      status: 'ACTIVE',
    });
    setResourceMode('add');
    setResourceModal(true);
  };

  const openEditResource = (resource: any) => {
    setSelectedResource(resource);
    setResourceForm({
      type: resource.type,
      name: resource.name,
      location: resource.location || '',
      capacity: resource.capacity?.toString() || '',
      requiresApproval: resource.rules?.requiresApproval || false,
      studentsOnly: resource.rules?.studentsOnly || false,
      status: resource.status,
    });
    setResourceMode('edit');
    setResourceModal(true);
  };

  const handleSaveResource = async () => {
    try {
      const payload = {
        type: resourceForm.type,
        name: resourceForm.name,
        location: resourceForm.location || undefined,
        capacity: resourceForm.capacity ? parseInt(resourceForm.capacity) : undefined,
        rules: {
          requiresApproval: resourceForm.requiresApproval,
          studentsOnly: resourceForm.studentsOnly,
        },
        status: resourceForm.status,
      };

      if (resourceMode === 'add') {
        await fetch('/api/resources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else if (resourceMode === 'edit' && selectedResource) {
        await fetch(`/api/resources/${selectedResource._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      setResourceModal(false);
      fetchResources();
    } catch (error) {
      console.error('Failed to save resource:', error);
      alert('Failed to save resource');
    }
  };

  const handleDeleteResource = async () => {
    try {
      await fetch(`/api/resources/${deleteTarget._id}`, {
        method: 'DELETE',
      });
      setDeleteModal(false);
      fetchResources();
    } catch (error) {
      console.error('Failed to delete resource:', error);
      alert('Failed to delete resource');
    }
  };

  // Equipment handlers
  const openAddEquipment = (resourceId: string) => {
    setEquipmentForm({
      name: '',
      qtyTotal: '',
      qtyAvailable: '',
      safety: false,
      restricted: false,
      requiresApproval: false,
      resourceId,
    });
    setEquipmentMode('add');
    setEquipmentModal(true);
  };

  const openEditEquipment = (item: any) => {
    setSelectedEquipment(item);
    setEquipmentForm({
      name: item.name,
      qtyTotal: item.qtyTotal.toString(),
      qtyAvailable: item.qtyAvailable.toString(),
      safety: item.safety || false,
      restricted: item.restricted || false,
      requiresApproval: item.requiresApproval || false,
      resourceId: item.resourceId,
    });
    setEquipmentMode('edit');
    setEquipmentModal(true);
  };

  const handleSaveEquipment = async () => {
    try {
      const payload = {
        name: equipmentForm.name,
        qtyTotal: parseInt(equipmentForm.qtyTotal),
        qtyAvailable: parseInt(equipmentForm.qtyAvailable),
        safety: equipmentForm.safety,
        restricted: equipmentForm.restricted,
        requiresApproval: equipmentForm.requiresApproval,
        resourceId: equipmentForm.resourceId,
      };

      if (equipmentMode === 'add') {
        await fetch('/api/admin/equipment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else if (equipmentMode === 'edit' && selectedEquipment) {
        await fetch(`/api/admin/equipment/${selectedEquipment._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      setEquipmentModal(false);
      fetchEquipment();
    } catch (error) {
      console.error('Failed to save equipment:', error);
      alert('Failed to save equipment');
    }
  };

  const handleDeleteEquipment = async () => {
    try {
      await fetch(`/api/admin/equipment/${deleteTarget._id}`, {
        method: 'DELETE',
      });
      setDeleteModal(false);
      fetchEquipment();
    } catch (error) {
      console.error('Failed to delete equipment:', error);
      alert('Failed to delete equipment');
    }
  };

  const confirmDelete = (item: any, type: 'resource' | 'equipment') => {
    setDeleteTarget(item);
    setDeleteType(type);
    setDeleteModal(true);
  };

  if (loading) {
    return (
      <LoadingState
        title="Loading resources"
        subtitle="Fetching facilities, rooms, and equipment..."
        variant="galaxy"
      />
    );
  }

  const facilities = resources.filter((r) => r.type === 'FACILITY');
  const rooms = resources.filter((r) => r.type === 'ROOM');

  // Get equipment resources (excluding library)
  const sportsEquipmentResource = resources.find(r => r.type === 'SPORTS_EQUIPMENT');
  const labEquipmentResource = resources.find(r => r.type === 'LAB_EQUIPMENT');

  // Filter equipment by resource type (exclude library books)
  const sportsEquipment = equipment.filter(item =>
    sportsEquipmentResource && item.resourceId === sportsEquipmentResource._id
  );
  const labEquipment = equipment.filter(item =>
    labEquipmentResource && item.resourceId === labEquipmentResource._id
  );

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500/20 via-purple-600/10 to-transparent p-6 border border-purple-500/20">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-600/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        <div className="absolute top-4 right-8 text-4xl opacity-20 animate-float">🏟️</div>
        <div className="absolute bottom-4 right-24 text-3xl opacity-20 animate-float" style={{ animationDelay: '1s' }}>🔬</div>

        <div className="relative flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 blur-xl opacity-40 animate-pulse" />
            <div className="relative p-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 backdrop-blur-sm flex items-center justify-center animate-float">
              <span className="text-4xl drop-shadow-lg">⚙️</span>
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-text-main">Resource Management</h1>
            <p className="text-text-muted">Manage facilities, rooms, and equipment</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in-up">
        <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 hover:border-emerald-500/40 transition-colors cursor-pointer">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🏟️</span>
            <p className="text-2xl font-bold text-emerald-400">{facilities.length}</p>
          </div>
          <p className="text-sm text-text-muted">Facilities</p>
        </div>
        <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 hover:border-blue-500/40 transition-colors cursor-pointer">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🚪</span>
            <p className="text-2xl font-bold text-blue-400">{rooms.length}</p>
          </div>
          <p className="text-sm text-text-muted">Rooms</p>
        </div>
        <div className="p-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20 hover:border-orange-500/40 transition-colors cursor-pointer">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">⚽</span>
            <p className="text-2xl font-bold text-orange-400">{sportsEquipment.length}</p>
          </div>
          <p className="text-sm text-text-muted">Sports Equipment</p>
        </div>
        <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 hover:border-purple-500/40 transition-colors cursor-pointer">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🔬</span>
            <p className="text-2xl font-bold text-purple-400">{labEquipment.length}</p>
          </div>
          <p className="text-sm text-text-muted">Lab Equipment</p>
        </div>
      </div>

      <Tabs defaultValue="facilities">
        <TabsList>
          <TabsTrigger value="facilities">🏟️ Facilities</TabsTrigger>
          <TabsTrigger value="rooms">🚪 Rooms</TabsTrigger>
          <TabsTrigger value="equipment">🔧 Equipment</TabsTrigger>
        </TabsList>

        <TabsContent value="facilities">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-text-main">Facilities</CardTitle>
              <Button
                onClick={() => openAddResource('FACILITY')}
                variant="gradient"
                size="sm"
                className="btn-ripple"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Facility
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {facilities.length === 0 ? (
                  <p className="text-center text-text-muted py-8">No facilities yet. Add one to get started.</p>
                ) : (
                  facilities.map((resource) => (
                    <div
                      key={resource._id}
                      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-card-border bg-card p-4 hover:border-accent-blue/30 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-text-main">{resource.name}</p>
                        <p className="text-sm text-text-muted">{resource.location}</p>
                        {resource.rules?.requiresApproval && (
                          <p className="text-xs text-yellow-500 mt-1">Requires Approval</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={resource.status === 'ACTIVE' ? 'success' : 'secondary'}>
                          {resource.status}
                        </Badge>
                        <Link href={`/admin/resources/${resource._id}/hours`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-accent-blue hover:text-accent-blue"
                            title="Edit Operating Hours"
                          >
                            <Clock className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          onClick={() => openEditResource(resource)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => confirmDelete(resource, 'resource')}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rooms">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-text-main">Rooms</CardTitle>
              <Button
                onClick={() => openAddResource('ROOM')}
                variant="gradient"
                size="sm"
                className="btn-ripple"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Room
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {rooms.length === 0 ? (
                  <p className="text-center text-text-muted py-8">No rooms yet. Add one to get started.</p>
                ) : (
                  rooms.map((resource) => (
                    <div
                      key={resource._id}
                      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-card-border bg-card p-4 hover:border-accent-blue/30 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-text-main">{resource.name}</p>
                        <p className="text-sm text-text-muted">
                          {resource.location} {resource.capacity && `• Capacity: ${resource.capacity}`}
                        </p>
                        {resource.rules?.requiresApproval && (
                          <p className="text-xs text-yellow-500 mt-1">Requires Approval</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={resource.status === 'ACTIVE' ? 'success' : 'secondary'}>
                          {resource.status}
                        </Badge>
                        <Link href={`/admin/resources/${resource._id}/hours`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-accent-blue hover:text-accent-blue"
                            title="Edit Operating Hours"
                          >
                            <Clock className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          onClick={() => openEditResource(resource)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => confirmDelete(resource, 'resource')}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="equipment">
          <Tabs defaultValue="sports">
            <TabsList className="mb-4">
              <TabsTrigger value="sports">Sports Equipment</TabsTrigger>
              <TabsTrigger value="lab">Lab Equipment</TabsTrigger>
            </TabsList>

            <TabsContent value="sports">
              <Card>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-text-main">Sports Equipment</CardTitle>
                  {sportsEquipmentResource && (
                    <Button
                      onClick={() => openAddEquipment(sportsEquipmentResource._id)}
                      variant="gradient"
                      size="sm"
                      className="btn-ripple"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Sports Equipment
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {sportsEquipment.length === 0 ? (
                      <p className="text-center text-text-muted py-8">No sports equipment yet. Add one to get started.</p>
                    ) : (
                      sportsEquipment.map((item) => (
                        <div
                          key={item._id}
                          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-card-border bg-card p-4 hover:border-accent-blue/30 transition-colors"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-text-main">{item.name}</p>
                            <p className="text-sm text-text-muted">
                              On Shelf: {item.physicalStock ?? item.qtyAvailable} / {item.qtyTotal}
                              {(item.checkedOutCount ?? 0) > 0 && <span className="text-warning"> ({item.checkedOutCount} checked out)</span>}
                            </p>
                            <div className="flex gap-2 mt-1">
                              {item.safety && <Badge variant="warning">Safety Item</Badge>}
                              {item.restricted && <Badge variant="destructive">Restricted</Badge>}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Button
                              onClick={() => openEditEquipment(item)}
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => confirmDelete(item, 'equipment')}
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:text-danger"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="lab">
              <Card>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-text-main">Lab Equipment</CardTitle>
                  {labEquipmentResource && (
                    <Button
                      onClick={() => openAddEquipment(labEquipmentResource._id)}
                      variant="gradient"
                      size="sm"
                      className="btn-ripple"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Lab Equipment
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {labEquipment.length === 0 ? (
                      <p className="text-center text-text-muted py-8">No lab equipment yet. Add one to get started.</p>
                    ) : (
                      labEquipment.map((item) => (
                        <div
                          key={item._id}
                          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-card-border bg-card p-4 hover:border-accent-blue/30 transition-colors"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-text-main">{item.name}</p>
                            <p className="text-sm text-text-muted">
                              On Shelf: {item.physicalStock ?? item.qtyAvailable} / {item.qtyTotal}
                              {(item.checkedOutCount ?? 0) > 0 && <span className="text-warning"> ({item.checkedOutCount} checked out)</span>}
                            </p>
                            <div className="flex gap-2 mt-1">
                              {item.safety && <Badge variant="warning">Safety Item</Badge>}
                              {item.restricted && <Badge variant="destructive">Restricted</Badge>}
                              {item.requiresApproval && <Badge variant="info">Requires Approval</Badge>}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Button
                              onClick={() => openEditEquipment(item)}
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => confirmDelete(item, 'equipment')}
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:text-danger"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      {/* Resource Add/Edit Modal */}
      <Modal
        isOpen={resourceModal}
        onClose={() => setResourceModal(false)}
        title={resourceMode === 'add' ? 'Add Resource' : 'Edit Resource'}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Name *</label>
            <Input
              value={resourceForm.name}
              onChange={(e) => setResourceForm({ ...resourceForm, name: e.target.value })}
              placeholder="e.g., Basketball Court"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Location</label>
            <Input
              value={resourceForm.location}
              onChange={(e) => setResourceForm({ ...resourceForm, location: e.target.value })}
              placeholder="e.g., Ground Floor"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Capacity</label>
            <Input
              type="number"
              value={resourceForm.capacity}
              onChange={(e) => setResourceForm({ ...resourceForm, capacity: e.target.value })}
              placeholder="Maximum people"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="requiresApproval"
              checked={resourceForm.requiresApproval}
              onChange={(e) => setResourceForm({ ...resourceForm, requiresApproval: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="requiresApproval" className="text-sm text-text-main">Requires Admin Approval</label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="studentsOnly"
              checked={resourceForm.studentsOnly}
              onChange={(e) => setResourceForm({ ...resourceForm, studentsOnly: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="studentsOnly" className="text-sm text-text-main">Students Only</label>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleSaveResource} variant="gradient" className="flex-1 btn-ripple">
              {resourceMode === 'add' ? 'Add' : 'Save'}
            </Button>
            <Button onClick={() => setResourceModal(false)} variant="outline" className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Equipment Add/Edit Modal */}
      <Modal
        isOpen={equipmentModal}
        onClose={() => setEquipmentModal(false)}
        title={equipmentMode === 'add' ? 'Add Equipment' : 'Edit Equipment'}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Name *</label>
            <Input
              value={equipmentForm.name}
              onChange={(e) => setEquipmentForm({ ...equipmentForm, name: e.target.value })}
              placeholder="e.g., Basketball"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Total Quantity *</label>
            <Input
              type="number"
              value={equipmentForm.qtyTotal}
              onChange={(e) => setEquipmentForm({ ...equipmentForm, qtyTotal: e.target.value })}
              placeholder="Total items"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Available Quantity *</label>
            <Input
              type="number"
              value={equipmentForm.qtyAvailable}
              onChange={(e) => setEquipmentForm({ ...equipmentForm, qtyAvailable: e.target.value })}
              placeholder="Currently available"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="safety"
              checked={equipmentForm.safety}
              onChange={(e) => setEquipmentForm({ ...equipmentForm, safety: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="safety" className="text-sm text-text-main">Safety Item</label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="restricted"
              checked={equipmentForm.restricted}
              onChange={(e) => setEquipmentForm({ ...equipmentForm, restricted: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="restricted" className="text-sm text-text-main">Restricted (Requires Training)</label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="requiresApprovalEquip"
              checked={equipmentForm.requiresApproval}
              onChange={(e) => setEquipmentForm({ ...equipmentForm, requiresApproval: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="requiresApprovalEquip" className="text-sm text-text-main">Requires Admin Approval</label>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleSaveEquipment} variant="gradient" className="flex-1 btn-ripple">
              {equipmentMode === 'add' ? 'Add' : 'Save'}
            </Button>
            <Button onClick={() => setEquipmentModal(false)} variant="outline" className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal}
        onClose={() => setDeleteModal(false)}
        title="Confirm Delete"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-text-main">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button
              onClick={deleteType === 'resource' ? handleDeleteResource : handleDeleteEquipment}
              variant="outline"
              className="flex-1 border-danger text-danger hover:bg-danger/10"
            >
              Delete
            </Button>
            <Button onClick={() => setDeleteModal(false)} variant="gradient" className="flex-1 btn-ripple">
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
