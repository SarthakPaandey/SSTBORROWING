import { SkeletonDashboard } from "@/components/ui/Skeleton";

export default function AdminLoading() {
  return (
    <div className="animate-fade-in">
      <SkeletonDashboard />
    </div>
  );
}

