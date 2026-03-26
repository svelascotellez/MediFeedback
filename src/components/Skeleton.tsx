import React from 'react';

interface SkeletonProps {
  className?: string;
  key?: React.Key;
}

export const Skeleton = ({ className }: SkeletonProps) => (
  <div className={`animate-pulse bg-slate-200 rounded ${className}`} />
);

export const DashboardSkeleton = () => (
  <div className="p-8 bg-slate-50 min-h-screen">
    <div className="max-w-7xl mx-auto">
      <header className="mb-10 flex justify-between items-end">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-12" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 h-[400px]">
            <Skeleton className="h-6 w-48 mb-6" />
            <Skeleton className="h-full w-full rounded-2xl" />
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 h-[300px]">
            <Skeleton className="h-6 w-48 mb-6" />
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 h-[600px]">
          <Skeleton className="h-6 w-32 mb-6" />
          <div className="space-y-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="p-4 bg-slate-50 rounded-2xl space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);
