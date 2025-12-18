import { SkeletonDashboard } from "@/components/ui/Skeleton";

export default function UserLoading() {
  return (
    <div className="animate-fade-in">
      <SkeletonDashboard />
    </div>
  );
}

