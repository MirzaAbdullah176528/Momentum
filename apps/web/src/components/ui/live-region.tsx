"use client";

import { useEffect, useRef, useState } from "react";

interface LiveRegionProps {
  message: string;
  politeness?: "polite" | "assertive";
  clearAfterMs?: number;
}

export function LiveRegion({
  message,
  politeness = "polite",
  clearAfterMs = 3000
}: LiveRegionProps) {
  const [announced, setAnnounced] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (message) {
      setAnnounced(message);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setAnnounced("");
      }, clearAfterMs);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [message, clearAfterMs]);

  return (
    <div
      className="live-region"
      role="status"
      aria-live={politeness}
      aria-atomic="true"
    >
      {announced}
    </div>
  );
}
