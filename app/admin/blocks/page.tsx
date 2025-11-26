'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { formatDateTime } from '@/lib/utils';
import { Plus, Wrench, Calendar as CalendarIcon, Clock, Trash2, AlertTriangle, Check, X } from 'lucide-react';
import { getISTToday, getISTNow } from '@/lib/timezone-client';

export default function BlocksPage() {
  const [blocks, setBlocks] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<'ALL' | 'MAINTENANCE' | 'EVENT'>('ALL');
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const [formData, setFormData] = useState({
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

    if (selectedResources.length === 0) {
      alert('Please select at least one resource');
      return;
    }

    setLoading(true);

    try {
      // Create blocks for all selected resources
      const promises = selectedResources.map(resourceId =>
        fetch('/api/admin/blocks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resourceId,
            start: formData.start,
            end: formData.end,
            reason: formData.reason,
            type: formData.type,
          }),
        })
      );

      const results = await Promise.all(promises);
      const failed = results.filter(r => !r.ok);

      if (failed.length === 0) {
        setModalOpen(false);
        fetchBlocks();
        setFormData({
          start: '',
          end: '',
          reason: '',
          type: 'MAINTENANCE',
        });
        setSelectedResources([]);
        alert(`Successfully created ${selectedResources.length} block(s)`);
      } else {
        alert(`Created ${results.length - failed.length} blocks, but ${failed.length} failed`);
      }
    } catch (error) {
      alert('Failed to create blocks');
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

  const toggleResourceSelection = (resourceId: string) => {
    setSelectedResources(prev =>
      prev.includes(resourceId)
        ? prev.filter(id => id !== resourceId)
        : [...prev, resourceId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedResources.length === resources.length) {
      setSelectedResources([]);
    } else {
      setSelectedResources(resources.map(r => r._id));
    }
  };

  const setQuickDate = (type: 'today' | 'tomorrow' | 'weekend') => {
    const today = getISTToday();

    // Business hours constants
    const BUSINESS_START_HOUR = 8;  // 8:00 AM
    const BUSINESS_END_HOUR = 20;   // 8:00 PM

    let startDate = new Date(today);
    let endDate = new Date(today);

    if (type === 'today') {
      // Today's business hours: 8 AM - 8 PM
      startDate.setHours(BUSINESS_START_HOUR, 0, 0);
      endDate.setHours(BUSINESS_END_HOUR, 0, 0);
    } else if (type === 'tomorrow') {
      // Tomorrow's business hours: 8 AM - 8 PM
      startDate.setDate(startDate.getDate() + 1);
      startDate.setHours(BUSINESS_START_HOUR, 0, 0);
      endDate.setDate(endDate.getDate() + 1);
      endDate.setHours(BUSINESS_END_HOUR, 0, 0);
    } else if (type === 'weekend') {
      // Next Saturday 8 AM to Sunday 8 PM
      const daysUntilSaturday = (6 - startDate.getDay() + 7) % 7 || 7;
      startDate.setDate(startDate.getDate() + daysUntilSaturday);
      startDate.setHours(BUSINESS_START_HOUR, 0, 0);
      // Sunday evening
      endDate.setDate(startDate.getDate() + 1);
      endDate.setHours(BUSINESS_END_HOUR, 0, 0);
    }

    setFormData({
      ...formData,
      start: startDate.toISOString().slice(0, 16),
      end: endDate.toISOString().slice(0, 16),
    });
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
        onClose={() => {
          setModalOpen(false);
          setSelectedResources([]);
        }}
        title="Create Resource Block"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Resource Multi-Select */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-text-main">
                Resources <span className="text-danger">*</span>
              </label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                  className="text-xs"
                >
                  {selectedResources.length === resources.length ? (
                    <>
                      <X className="h-3 w-3 mr-1" />
                      Deselect All
                    </>
                  ) : (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Select All ({resources.length})
                    </>
                  )}
                </Button>
              </div>
            </div>

            {selectedResources.length > 0 && (
              <div className="mb-3 p-3 bg-accent-blue/10 border border-accent-blue/30 rounded-lg">
                <p className="text-sm text-accent-blue font-medium">
                  {selectedResources.length} resource{selectedResources.length !== 1 ? 's' : ''} selected
                </p>
              </div>
            )}

            <div className="max-h-48 overflow-y-auto border border-card-border rounded-lg">
              {resources.map((resource) => (
                <label
                  key={resource._id}
                  className={`flex items-center gap-3 p-3 cursor-pointer transition-colors hover:bg-bg-dark ${selectedResources.includes(resource._id) ? 'bg-accent-blue/10' : ''
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedResources.includes(resource._id)}
                    onChange={() => toggleResourceSelection(resource._id)}
                    className="w-4 h-4 rounded border-card-border text-accent-blue focus:ring-accent-blue"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-text-main">{resource.name}</p>
                    <p className="text-xs text-text-muted">{resource.type}</p>
                  </div>
                  {selectedResources.includes(resource._id) && (
                    <Check className="h-4 w-4 text-accent-blue" />
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Block Type */}
          <div>
            <label className="block text-sm font-medium text-text-main mb-3">
              Block Type <span className="text-danger">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'MAINTENANCE' })}
                className={`p-3 rounded-lg border-2 transition-all ${formData.type === 'MAINTENANCE'
                  ? 'border-accent-blue bg-accent-blue/10 shadow-lg shadow-accent-blue/20'
                  : 'border-card-border hover:border-accent-blue/50'
                  }`}
              >
                <Wrench className="h-5 w-5 text-yellow-500 mx-auto mb-1" />
                <span className="text-xs font-medium text-text-main">Maintenance</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'EVENT' })}
                className={`p-3 rounded-lg border-2 transition-all ${formData.type === 'EVENT'
                  ? 'border-accent-blue bg-accent-blue/10 shadow-lg shadow-accent-blue/20'
                  : 'border-card-border hover:border-accent-blue/50'
                  }`}
              >
                <CalendarIcon className="h-5 w-5 text-badge-blue mx-auto mb-1" />
                <span className="text-xs font-medium text-text-main">Event</span>
              </button>
            </div>
          </div>

          {/* Quick Date Selection */}
          <div>
            <label className="block text-sm font-medium text-text-main mb-2">
              Quick Select
            </label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuickDate('today')}
                className="text-xs h-8"
              >
                Today
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuickDate('tomorrow')}
                className="text-xs h-8"
              >
                Tomorrow
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuickDate('weekend')}
                className="text-xs h-8"
              >
                This Weekend
              </Button>
            </div>
          </div>

          {/* Date/Time Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-main mb-2">
                Start Date & Time <span className="text-danger">*</span>
              </label>
              <Input
                type="datetime-local"
                value={formData.start}
                onChange={(e) => setFormData({ ...formData, start: e.target.value })}
                className="text-base"
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
                className="text-base"
                required
              />
            </div>
          </div>

          {/* Reason */}
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

          {/* Warning */}
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-text-main mb-1">
                  {selectedResources.length > 1
                    ? `This will block ${selectedResources.length} resources`
                    : 'This will prevent new bookings'}
                </p>
                <p className="text-xs text-text-muted">
                  during the specified time period. Existing bookings will not be affected.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setModalOpen(false);
                setSelectedResources([]);
              }}
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || selectedResources.length === 0}
              variant="gradient"
              className="flex-1 btn-ripple"
            >
              {loading ? 'Creating...' : `Create ${selectedResources.length > 1 ? `${selectedResources.length} Blocks` : 'Block'}`}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
