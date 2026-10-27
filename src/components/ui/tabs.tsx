"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type TabsContextValue = {
  value: string;
  setValue: (value: string) => void;
  baseId: string;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabs(component: string) {
  const context = React.useContext(TabsContext);
  if (!context) throw new Error(`${component} must be used inside <Tabs>`);
  return context;
}

function Tabs({
  value,
  onValueChange,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  value: string;
  onValueChange: (value: string) => void;
}) {
  const baseId = React.useId();
  return (
    <TabsContext.Provider value={{ value, setValue: onValueChange, baseId }}>
      <div className={cn("w-full", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

function TabsList({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex w-full items-center gap-1 overflow-x-auto rounded-2xl bg-paper p-1 ring-1 ring-line/70",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function TabsTrigger({
  value,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { value: string }) {
  const { value: active, setValue, baseId } = useTabs("TabsTrigger");
  const selected = active === value;

  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${value}`}
      aria-selected={selected}
      aria-controls={`${baseId}-panel-${value}`}
      data-state={selected ? "active" : "inactive"}
      onClick={() => setValue(value)}
      className={cn(
        "inline-flex h-9 flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 text-[12px] font-medium text-muted transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-brand/40 data-[state=active]:bg-white data-[state=active]:text-ink data-[state=active]:shadow-soft",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function TabsContent({
  value,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { value: string }) {
  const { value: active, baseId } = useTabs("TabsContent");
  if (active !== value) return null;

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      className={cn("mt-4 outline-none", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
