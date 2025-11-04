'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { formatDateTime } from '@/lib/utils';
import { Plus } from 'lucide-react';

export default function BlocksPage() {
  const [blocks, setBlocks] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    resourceId: '',
    start: '',
    end: '',
    reason: '',
    type: 'MAINTENANCE' as 'MAINTENANCE' | 'EVENT',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchBlocks();
    fetchResources();
  }, []);

  const fetchBlocks = async () => {
    const res = await fetch('/api/admin/blocks');
    const data = await res.json();
    setBlocks(data.blocks);
  };

  const fetchResources = async () => {
    const res = await fetch('/api/resources');
    const data = await res.json();
    setResources(data.resources);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Resource Blocks</h1>
          <p className="text-gray-600">Manage maintenance and event blocks</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Block
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Blocks</CardTitle>
        </CardHeader>
        <CardContent>
          {blocks.length === 0 ? (
            <p className="text-center text-gray-500">No blocks</p>
          ) : (
            <div className="space-y-4">
              {blocks.map((block) => (
                <div
                  key={block._id}
                  className="flex items-start justify-between rounded-lg border p-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">Resource: {block.resourceId}</p>
                      <Badge variant={block.type === 'MAINTENANCE' ? 'warning' : 'default'}>
                        {block.type}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{block.reason}</p>
                    <p className="text-sm text-gray-600">
                      {formatDateTime(block.start)} - {formatDateTime(block.end)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create Resource Block"
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">Resource</label>
            <select
              value={formData.resourceId}
              onChange={(e) => setFormData({ ...formData, resourceId: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              required
            >
              <option value="">Select resource</option>
              {resources.map((resource) => (
                <option key={resource._id} value={resource._id}>
                  {resource.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Type</label>
            <select
              value={formData.type}
              onChange={(e) =>
                setFormData({ ...formData, type: e.target.value as 'MAINTENANCE' | 'EVENT' })
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2"
            >
              <option value="MAINTENANCE">Maintenance</option>
              <option value="EVENT">Event</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Start Date & Time</label>
            <Input
              type="datetime-local"
              value={formData.start}
              onChange={(e) => setFormData({ ...formData, start: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">End Date & Time</label>
            <Input
              type="datetime-local"
              value={formData.end}
              onChange={(e) => setFormData({ ...formData, end: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Reason</label>
            <Input
              type="text"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="e.g., Annual maintenance"
              required
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Creating...' : 'Create Block'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
