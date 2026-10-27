export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-line" />
        <div className="h-7 w-48 rounded bg-line" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-[20px] bg-white ring-1 ring-line/80 p-5 space-y-3">
            <div className="h-3 w-20 rounded bg-line" />
            <div className="h-6 w-32 rounded bg-line" />
          </div>
        ))}
      </div>

      <div className="h-80 rounded-[20px] bg-white ring-1 ring-line/80 p-6 space-y-4">
        <div className="h-4 w-32 rounded bg-line" />
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 rounded-lg bg-paper/70" />
          ))}
        </div>
      </div>
    </div>
  );
}
