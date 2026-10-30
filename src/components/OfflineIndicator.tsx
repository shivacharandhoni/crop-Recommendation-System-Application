import { WifiOff, CloudOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface OfflineIndicatorProps {
  isOnline: boolean;
  isSyncing: boolean;
}

export function OfflineIndicator({ isOnline, isSyncing }: OfflineIndicatorProps) {
  if (isOnline && !isSyncing) return null;

  return (
    <div
      className={cn(
        "fixed bottom-20 left-1/2 -translate-x-1/2 z-50",
        "px-4 py-2 rounded-full shadow-lg",
        "flex items-center gap-2 text-sm font-medium",
        "animate-fade-in transition-all",
        isOnline
          ? "bg-secondary text-secondary-foreground"
          : "bg-warning text-warning-foreground"
      )}
    >
      {isSyncing ? (
        <>
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Syncing...</span>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4" />
          <span>Offline Mode - Data saved locally</span>
        </>
      )}
    </div>
  );
}

export function OfflineBadge({ isOnline }: { isOnline: boolean }) {
  if (isOnline) return null;

  return (
    <div className="flex items-center gap-1 px-2 py-0.5 bg-warning/20 text-warning-foreground rounded-full text-xs font-medium">
      <CloudOff className="w-3 h-3" />
      <span>Offline</span>
    </div>
  );
}
