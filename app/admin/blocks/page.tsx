'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { DatePicker } from '@/components/ui/DatePicker';
import { TimePicker } from '@/components/ui/TimePicker';
import { formatDateTime } from '@/lib/utils';
import { Plus, Wrench, Calendar as CalendarIcon, Clock, Trash2, AlertTriangle, Check, X, Repeat } from 'lucide-react';
import { getISTTodayStart } from '@/lib/timezone-client';
import { Block, Resource } from '@/types/frontend';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function BlocksPage() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<'ALL' | 'MAINTENANCE' | 'EVENT'>('ALL');
  const [selectedResources, setSelectedResources] = useState<string[]>([]);

  // Split state for better timezone handling
  const [startDate, setStartDate] = useState<Date>(getISTTodayStart());
  const [startTime, setStartTime] = useState<string>('08:00');
  const [endDate, setEndDate] = useState<Date>(getISTTodayStart());
  const [endTime, setEndTime] = useState<string>('20:00');

  const [reason, setReason] = useState('');
  const [blockType, setBlockType] = useState<'MAINTENANCE' | 'EVENT'>('MAINTENANCE');

  // Recurring block state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date>(() => {
    const d = getISTTodayStart();
    d.setMonth(d.getMonth() + 1);
    return d;
  });

  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteSeriesModal, setDeleteSeriesModal] = useState<Block | null>(null);

  useEffect(() => {
    fetchResources();
  }, []);

  useEffect(() => {
    if (resources.length > 0) {
      fetchBlocks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resources]);

  const fetchBlocks = async () => {
    const res = await fetch('/api/admin/blocks');
    const data = await res.json();
    // Enrich blocks with resource names
    const enrichedBlocks = (data.blocks || []).map((block: Block) => {
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

    if (isRecurring && recurrenceDays.length === 0) {
      alert('Please select at least one day for recurring blocks');
      return;
    }

    setLoading(true);

    try {
      // Construct ISO strings with IST offset
      // Note: We manually construct the string to ensure +05:30 offset is preserved
      // regardless of the browser's local timezone
      const formatDateISO = (date: Date, time: string) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}T${time}:00+05:30`;
      };

      const startISO = formatDateISO(startDate, startTime);
      const endISO = formatDateISO(endDate, endTime);

      // Create blocks for all selected resources
      const promises = selectedResources.map(resourceId =>
        fetch('/api/admin/blocks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resourceId,
            start: startISO,
            end: endISO,
            reason: reason,
            type: blockType,
            // Recurring params
            isRecurring,
            recurrenceType: 'weekly',
            recurrenceDays: isRecurring ? recurrenceDays : undefined,
            recurrenceEndDate: isRecurring ? recurrenceEndDate.toISOString() : undefined,
            startTime: isRecurring ? startTime : undefined,
            endTime: isRecurring ? endTime : undefined,
          }),
        })
      );

      const results = await Promise.all(promises);
      const failed = results.filter(r => !r.ok);

      if (failed.length === 0) {
        setModalOpen(false);
        fetchBlocks();
        // Reset form
        resetForm();

        if (isRecurring) {
          const data = await results[0].json();
          alert(`Successfully created ${data.count} recurring blocks with pattern: ${data.pattern}`);
        } else {
          alert(`Successfully created ${selectedResources.length} block(s)`);
        }
      } else {
        alert(`Created ${results.length - failed.length} blocks, but ${failed.length} failed`);
      }
    } catch {
      alert('Failed to create blocks');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setReason('');
    setBlockType('MAINTENANCE');
    setSelectedResources([]);
    setIsRecurring(false);
    setRecurrenceDays([]);
    const d = getISTTodayStart();
    d.setMonth(d.getMonth() + 1);
    setRecurrenceEndDate(d);
  };

  const handleDelete = async (blockId: string, deleteSeries: boolean = false) => {
    if (!deleteSeries && !confirm('Are you sure you want to delete this block?')) return;

    setDeleting(blockId);
    setDeleteSeriesModal(null);

    try {
      const url = deleteSeries
        ? `/api/admin/blocks/${blockId}?deleteSeries=true`
        : `/api/admin/blocks/${blockId}`;

      const res = await fetch(url, {
        method: 'DELETE',
      });

      if (res.ok) {
        const data = await res.json();
        fetchBlocks();
        if (deleteSeries && data.deletedCount) {
          alert(`Deleted ${data.deletedCount} blocks in the series`);
        }
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete block');
      }
    } catch {
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

  const toggleDay = (day: number) => {
    setRecurrenceDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day].sort((a, b) => a - b)
    );
  };

  const setQuickRecurrence = (type: 'weekend' | 'weekdays' | 'sunday') => {
    if (type === 'weekend') {
      setRecurrenceDays([0, 6]); // Sunday, Saturday
    } else if (type === 'weekdays') {
      setRecurrenceDays([1, 2, 3, 4, 5]); // Mon-Fri
    } else if (type === 'sunday') {
      setRecurrenceDays([0]); // Sunday only
    }
  };

  const setQuickDate = (type: 'today' | 'tomorrow' | 'weekend') => {
    const today = getISTTodayStart();

    // Business hours constants
    const BUSINESS_START_TIME = '08:00';
    const BUSINESS_END_TIME = '20:00';

    const newStartDate = new Date(today);
    const newEndDate = new Date(today);

    if (type === 'today') {
      // Today 8 AM - 8 PM
      setStartDate(newStartDate);
      setStartTime(BUSINESS_START_TIME);
      setEndDate(newEndDate);
      setEndTime(BUSINESS_END_TIME);
    } else if (type === 'tomorrow') {
      // Tomorrow 8 AM - 8 PM
      newStartDate.setDate(newStartDate.getDate() + 1);
      newEndDate.setDate(newEndDate.getDate() + 1);

      setStartDate(newStartDate);
      setStartTime(BUSINESS_START_TIME);
      setEndDate(newEndDate);
      setEndTime(BUSINESS_END_TIME);
    } else if (type === 'weekend') {
      // FIX EC-28: Next Saturday 8 AM - Sunday 8 PM
      const daysUntilSaturday = (6 - newStartDate.getDay() + 7) % 7 || 7;
      newStartDate.setDate(newStartDate.getDate() + daysUntilSaturday);
      // FIX: Use newEndDate directly, not newStartDate after mutation
      newEndDate.setDate(newEndDate.getDate() + daysUntilSaturday + 1); // Sunday

      setStartDate(newStartDate);
      setStartTime(BUSINESS_START_TIME);
      setEndDate(newEndDate);
      setEndTime(BUSINESS_END_TIME);
    }
  };

  const getPreviewCount = () => {
    if (!isRecurring || recurrenceDays.length === 0) return 0;

    let count = 0;
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    const end = new Date(recurrenceEndDate);
    end.setHours(23, 59, 59, 999);

    while (current <= end) {
      if (recurrenceDays.includes(current.getDay())) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count * selectedResources.length;
  };

  const filteredBlocks = blocks.filter(block => {
    if (filterType === 'ALL') return true;
    return block.type === filterType;
  });

  const maintenanceBlocks = blocks.filter(b => b.type === 'MAINTENANCE');
  const eventBlocks = blocks.filter(b => b.type === 'EVENT');
  const recurringBlocks = blocks.filter(b => b.recurringGroupId);

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
      <div className="grid gap-4 sm:grid-cols-4">
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

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="icon-circle w-12 h-12">
                <Repeat className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-text-muted">Recurring</p>
                <p className="text-2xl font-bold text-purple-500">{recurringBlocks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Tabs value={filterType} onValueChange={(v) => setFilterType(v as 'ALL' | 'MAINTENANCE' | 'EVENT')}>
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
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="font-semibold text-text-main">{block.resourceName}</h3>
                              <Badge variant={block.type === 'MAINTENANCE' ? 'warning' : 'default'}>
                                {block.type}
                              </Badge>
                              {block.recurringPattern && (
                                <Badge variant="secondary" className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                                  <Repeat className="h-3 w-3 mr-1" />
                                  {block.recurringPattern}
                                </Badge>
                              )}
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

                      <div className="flex gap-2">
                        {block.recurringGroupId ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteSeriesModal(block)}
                            disabled={deleting === block._id}
                            className="hover:bg-danger/10 hover:text-danger hover:border-danger"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(block._id)}
                            disabled={deleting === block._id}
                            className="hover:bg-danger/10 hover:text-danger hover:border-danger"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Series Confirmation Modal */}
      <Modal
        isOpen={!!deleteSeriesModal}
        onClose={() => setDeleteSeriesModal(null)}
        title="Delete Recurring Block"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-text-muted">
            This block is part of a recurring series ({deleteSeriesModal?.recurringPattern}).
            Would you like to delete just this block or the entire series?
          </p>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={() => deleteSeriesModal && handleDelete(deleteSeriesModal._id, false)}
              className="w-full"
            >
              Delete This Block Only
            </Button>
            <Button
              variant="gradient"
              onClick={() => deleteSeriesModal && handleDelete(deleteSeriesModal._id, true)}
              className="w-full bg-danger hover:bg-danger/80"
            >
              Delete Entire Series
            </Button>
            <Button
              variant="outline"
              onClick={() => setDeleteSeriesModal(null)}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title="Create Resource Block"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Resource Multi-Select */}
          <div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
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
                onClick={() => setBlockType('MAINTENANCE')}
                className={`p-3 rounded-lg border-2 transition-all ${blockType === 'MAINTENANCE'
                  ? 'border-accent-blue bg-accent-blue/10 shadow-lg shadow-accent-blue/20'
                  : 'border-card-border hover:border-accent-blue/50'
                  }`}
              >
                <Wrench className="h-5 w-5 text-yellow-500 mx-auto mb-1" />
                <span className="text-xs font-medium text-text-main">Maintenance</span>
              </button>
              <button
                type="button"
                onClick={() => setBlockType('EVENT')}
                className={`p-3 rounded-lg border-2 transition-all ${blockType === 'EVENT'
                  ? 'border-accent-blue bg-accent-blue/10 shadow-lg shadow-accent-blue/20'
                  : 'border-card-border hover:border-accent-blue/50'
                  }`}
              >
                <CalendarIcon className="h-5 w-5 text-badge-blue mx-auto mb-1" />
                <span className="text-xs font-medium text-text-main">Event</span>
              </button>
            </div>
          </div>

          {/* Recurring Toggle */}
          <div className="p-4 border border-card-border rounded-lg">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="w-5 h-5 rounded border-card-border text-purple-500 focus:ring-purple-500"
              />
              <div className="flex items-center gap-2">
                <Repeat className="h-5 w-5 text-purple-500" />
                <span className="font-medium text-text-main">Make Recurring</span>
              </div>
              <span className="text-xs text-text-muted ml-auto">Block specific days weekly</span>
            </label>

            {isRecurring && (
              <div className="mt-4 space-y-4 pt-4 border-t border-card-border">
                {/* Quick Presets */}
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-2">Quick Presets</label>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickRecurrence('sunday')}
                      className={`text-xs ${recurrenceDays.length === 1 && recurrenceDays[0] === 0 ? 'border-purple-500 bg-purple-500/10' : ''}`}
                    >
                      Every Sunday
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickRecurrence('weekend')}
                      className={`text-xs ${recurrenceDays.length === 2 && recurrenceDays.includes(0) && recurrenceDays.includes(6) ? 'border-purple-500 bg-purple-500/10' : ''}`}
                    >
                      Every Weekend
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickRecurrence('weekdays')}
                      className={`text-xs ${recurrenceDays.length === 5 && !recurrenceDays.includes(0) && !recurrenceDays.includes(6) ? 'border-purple-500 bg-purple-500/10' : ''}`}
                    >
                      Every Weekday
                    </Button>
                  </div>
                </div>

                {/* Day Picker */}
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-2">Select Days</label>
                  <div className="flex gap-2 flex-wrap">
                    {DAY_NAMES.map((day, index) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(index)}
                        className={`w-10 h-10 rounded-full text-xs font-medium transition-all ${recurrenceDays.includes(index)
                            ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                            : 'bg-bg-dark border border-card-border text-text-muted hover:border-purple-500/50'
                          }`}
                        title={DAY_NAMES_FULL[index]}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                  {recurrenceDays.length > 0 && (
                    <p className="text-xs text-purple-400 mt-2">
                      Every {recurrenceDays.map(d => DAY_NAMES_FULL[d]).join(', ')}
                    </p>
                  )}
                </div>

                {/* Recurrence End Date */}
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-2">Until</label>
                  <DatePicker
                    value={recurrenceEndDate}
                    onChange={(d) => { if (d instanceof Date) setRecurrenceEndDate(d); }}
                    minDate={startDate}
                    placeholder="End of recurrence"
                  />
                </div>

                {/* Preview */}
                {recurrenceDays.length > 0 && selectedResources.length > 0 && (
                  <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                    <p className="text-sm text-purple-400 font-medium">
                      📅 This will create {getPreviewCount()} blocks
                    </p>
                    <p className="text-xs text-text-muted mt-1">
                      {selectedResources.length} resource{selectedResources.length > 1 ? 's' : ''} × {
                        Math.ceil(getPreviewCount() / selectedResources.length)
                      } dates
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Date Selection (for single blocks) */}
          {!isRecurring && (
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
          )}

          {/* Date/Time Inputs - Compact Modern UI */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Start Date & Time */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-text-main">
                {isRecurring ? 'Start Date & Time (for each block)' : 'Start Date & Time'} <span className="text-danger">*</span>
              </label>
              <DatePicker
                value={startDate}
                onChange={(d) => { if (d instanceof Date) setStartDate(d); }}
                minDate={getISTTodayStart()}
                placeholder="Select start date"
              />
              <TimePicker
                date={startDate.toISOString().split('T')[0]}
                value={startTime}
                onChange={setStartTime}
                minTime="00:00"
                maxTime="23:45"
                stepMinutes={15}
              />
            </div>

            {/* End Date & Time */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-text-main">
                {isRecurring ? 'End Time (same day)' : 'End Date & Time'} <span className="text-danger">*</span>
              </label>
              {!isRecurring && (
                <DatePicker
                  value={endDate}
                  onChange={(d) => { if (d instanceof Date) setEndDate(d); }}
                  minDate={startDate}
                  placeholder="Select end date"
                />
              )}
              <TimePicker
                date={isRecurring ? startDate.toISOString().split('T')[0] : endDate.toISOString().split('T')[0]}
                value={endTime}
                onChange={setEndTime}
                minTime="00:00"
                maxTime="23:45"
                stepMinutes={15}
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-text-main mb-2">
              Reason / Description <span className="text-danger">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
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
                  {isRecurring
                    ? `This will create ${getPreviewCount()} blocks`
                    : selectedResources.length > 1
                      ? `This will block ${selectedResources.length} resources`
                      : 'This will prevent new bookings'}
                </p>
                <p className="text-xs text-text-muted">
                  during the specified time period. Existing bookings will be cancelled.
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
                resetForm();
              }}
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || selectedResources.length === 0 || (isRecurring && recurrenceDays.length === 0)}
              variant="gradient"
              className="flex-1 btn-ripple"
            >
              {loading ? 'Creating...' : isRecurring
                ? `Create ${getPreviewCount()} Blocks`
                : `Create ${selectedResources.length > 1 ? `${selectedResources.length} Blocks` : 'Block'}`}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
