import React from 'react';

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm p-4 animate-pulse flex flex-col gap-3">
      <div className="w-full aspect-square bg-slate-200 rounded-xl"></div>
      <div className="h-4 bg-slate-200 rounded w-3/4"></div>
      <div className="h-4 bg-slate-200 rounded w-1/2"></div>
      <div className="h-6 bg-slate-200 rounded w-1/3 mt-2"></div>
    </div>
  );
}

export function SkeletonList({ count = 8 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonProfile() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-pulse space-y-6">
      <div className="flex items-center gap-4 bg-slate-200 p-6 rounded-2xl h-28"></div>
      <div className="h-10 bg-slate-200 rounded-xl w-1/3"></div>
      <div className="bg-white rounded-2xl border border-slate-200 p-8 space-y-4">
        <div className="h-6 bg-slate-200 rounded w-1/4"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-12 bg-slate-200 rounded-xl"></div>
          <div className="h-12 bg-slate-200 rounded-xl"></div>
          <div className="h-12 bg-slate-200 rounded-xl"></div>
          <div className="h-12 bg-slate-200 rounded-xl"></div>
        </div>
      </div>
    </div>
  );
}
