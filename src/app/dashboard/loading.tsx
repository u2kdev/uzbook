export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="h-3 w-24 rounded bg-line" />
          <div className="h-7 w-48 rounded bg-line" />
        </div>
        <div className="h-10 w-36 rounded-xl bg-line" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-[20px] bg-white ring-1 ring-line/80 p-5 space-y-3">
            <div className="h-3 w-20 rounded bg-line" />
            <div className="h-6 w-32 rounded bg-line" />
          </div>
        ))}
      </div>

      <div className="h-96 rounded-[24px] bg-white ring-1 ring-line/80 p-6 space-y-4">
        <div className="h-5 w-40 rounded bg-line" />
        <div className="h-full rounded-xl bg-paper/60" />
      </div>
    </div>
  );
}
