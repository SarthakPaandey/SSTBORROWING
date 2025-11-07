'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { formatDateTime } from '@/lib/utils';
import { Plus, Wrench, Calendar as CalendarIcon, Clock, Trash2, AlertTriangle } from 'lucide-react';

export default function BlocksPage() {
  const [blocks, setBlocks] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<'ALL' | 'MAINTENANCE' | 'EVENT'>('ALL');
  const [formData, setFormData] = useState({
    resourceId: '',
    start: '',
    end: '',
    reason: '',
    type: 'MAINTENANCE' as 'MAINTENANCE' | 'EVENT',
  });
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchResources();
  }, []);

  useEffect(() => {
    if (resources.length > 0) {
      fetchBlocks();
    }
  }, [resources]);

  const fetchBlocks = async () => {
    const res = await fetch('/api/admin/blocks');
    const data = await res.json();
    // Enrich blocks with resource names
    const enrichedBlocks = (data.blocks || []).map((block: any) => {
      const resource = resources.find(r => r._id === block.resourceId);
      return {
        ...block,
        resourceName: resource?.name || 'Unknown Resource',
      };
    });
    setBlocks(enrichedBlocks);
  };

  const fetchResources = async () => {
    const res = await fetch('/api/resources');
    const data = await res.json();
    setResources(data.resources || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/admin/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setModalOpen(false);
        fetchBlocks();
        setFormData({
          resourceId: '',
          start: '',
          end: '',
          reason: '',
          type: 'MAINTENANCE',
        });
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create block');
      }
    } catch (error) {
      alert('Failed to create block');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (blockId: string) => {
    if (!confirm('Are you sure you want to delete this block?')) return;

    setDeleting(blockId);
    try {
      const res = await fetch(`/api/admin/blocks/${blockId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchBlocks();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete block');
      }
    } catch (error) {
      alert('Failed to delete block');
    } finally {
      setDeleting(null);
    }
  };

  const filteredBlocks = blocks.filter(block => {
    if (filterType === 'ALL') return true;
    return block.type === filterType;
  });

  const maintenanceBlocks = blocks.filter(b => b.type === 'MAINTENANCE');
  const eventBlocks = blocks.filter(b => b.type === 'EVENT');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-accent-blue">Resource Blocks</h1>
          <p className="text-text-muted">Schedule maintenance and event blocks</p>
        </div>
        <Button onClick={() => setModalOpen(true)} variant="gradient" className="btn-ripple">
          <Plus className="mr-2 h-4 w-4" />
          Create Block
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="icon-circle w-12 h-12">
                <CalendarIcon className="h-6 w-6 text-accent-blue" />
              </div>
              <div>
                <p className="text-sm text-text-muted">Total Blocks</p>
                <p className="text-2xl font-bold text-text-main">{blocks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="icon-circle w-12 h-12">
                <Wrench className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-text-muted">Maintenance</p>
                <p className="text-2xl font-bold text-yellow-500">{maintenanceBlocks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="icon-circle w-12 h-12">
                <CalendarIcon className="h-6 w-6 text-badge-blue" />
              </div>
              <div>
                <p className="text-sm text-text-muted">Events</p>
                <p className="text-2xl font-bold text-badge-blue">{eventBlocks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Tabs value={filterType} onValueChange={(v) => setFilterType(v as any)}>
        <TabsList>
          <TabsTrigger value="ALL">All Blocks</TabsTrigger>
          <TabsTrigger value="MAINTENANCE">Maintenance</TabsTrigger>
          <TabsTrigger value="EVENT">Events</TabsTrigger>
        </TabsList>

        <TabsContent value={filterType} className="mt-6">
          {filteredBlocks.length === 0 ? (
            <Card>
              <CardContent>
                <div className="empty-state">
                  <div className="empty-state-icon">
                    {filterType === 'MAINTENANCE' ? '🔧' : filterType === 'EVENT' ? '📅' : '📋'}
                  </div>
                  <h3 className="text-xl font-semibold text-text-main mb-2">
                    No {filterType === 'ALL' ? '' : filterType.toLowerCase()} blocks
                  </h3>
                  <p className="text-text-muted mb-6">
                    {filterType === 'MAINTENANCE'
                      ? 'Schedule maintenance windows for facilities and equipment'
                      : filterType === 'EVENT'
                      ? 'Block resources for special events'
                      : 'Create blocks to manage resource availability'}
                  </p>
                  <Button onClick={() => setModalOpen(true)} variant="gradient" className="btn-ripple">
                    <Plus className="mr-2 h-5 w-5" />
                    Create {filterType === 'ALL' ? '' : filterType === 'MAINTENANCE' ? 'Maintenance' : 'Event'} Block
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredBlocks.map((block) => (
                <Card
                  key={block._id}
                  className="transition-all hover:shadow-[0_0_20px_rgba(47,176,255,0.2)] card-scale-hover"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="icon-circle w-10 h-10">
                            {block.type === 'MAINTENANCE' ? (
                              <Wrench className="h-5 w-5 text-yellow-500" />
                            ) : (
                              <CalendarIcon className="h-5 w-5 text-badge-blue" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-text-main">{block.resourceName}</h3>
                              <Badge variant={block.type === 'MAINTENANCE' ? 'warning' : 'default'}>
                                {block.type}
                              </Badge>
                            </div>
                            <p className="text-sm text-text-muted">{block.reason}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-text-muted">
                          <Clock className="h-4 w-4" />
                          <span>
                            {formatDateTime(block.start)} → {formatDateTime(block.end)}
                          </span>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(block._id)}
                        disabled={deleting === block._id}
                        className="hover:bg-danger/10 hover:text-danger hover:border-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create Resource Block"
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-text-main mb-2">
              Resource <span className="text-danger">*</span>
            </label>
            <select
              value={formData.resourceId}
              onChange={(e) => setFormData({ ...formData, resourceId: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-bg-dark border border-card-border text-text-main focus:border-accent-blue focus:outline-none"
              required
            >
              <option value="">Select resource</option>
              {resources.map((resource) => (
                <option key={resource._id} value={resource._id}>
                  {resource.name} ({resource.type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-main mb-2">
              Block Type <span className="text-danger">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'MAINTENANCE' })}
                className={`p-4 rounded-lg border-2 transition-all ${
                  formData.type === 'MAINTENANCE'
                    ? 'border-accent-blue bg-accent-blue/10'
                    : 'border-card-border hover:border-accent-blue/50'
                }`}
              >
                <Wrench className="h-6 w-6 text-yellow-500 mx-auto mb-2" />
                <span className="text-sm font-medium text-text-main">Maintenance</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'EVENT' })}
                className={`p-4 rounded-lg border-2 transition-all ${
                  formData.type === 'EVENT'
                    ? 'border-accent-blue bg-accent-blue/10'
                    : 'border-card-border hover:border-accent-blue/50'
                }`}
              >
                <CalendarIcon className="h-6 w-6 text-badge-blue mx-auto mb-2" />
                <span className="text-sm font-medium text-text-main">Event</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-main mb-2">
              Start Date & Time <span className="text-danger">*</span>
            </label>
            <Input
              type="datetime-local"
              value={formData.start}
              onChange={(e) => setFormData({ ...formData, start: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-main mb-2">
              End Date & Time <span className="text-danger">*</span>
            </label>
            <Input
              type="datetime-local"
              value={formData.end}
              onChange={(e) => setFormData({ ...formData, end: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-main mb-2">
              Reason / Description <span className="text-danger">*</span>
            </label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="e.g., Annual maintenance, Sports day event"
              className="w-full px-4 py-3 rounded-lg bg-bg-dark border border-card-border text-text-main placeholder:text-text-muted focus:border-accent-blue focus:outline-none resize-none"
              rows={3}
              required
            />
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-text-main">
                This will prevent new bookings during the specified time period. Existing bookings will not be affected.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              variant="gradient"
              className="flex-1 btn-ripple"
            >
              {loading ? 'Creating...' : 'Create Block'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
