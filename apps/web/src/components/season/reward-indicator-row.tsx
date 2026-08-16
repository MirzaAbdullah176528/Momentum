"use client";

import { Check, CircleDot, Circle } from "lucide-react";
import type {
  WeeklyRewardIndicatorDTO,
  MonthlyRewardIndicatorDTO,
  RewardIndicatorStatus
} from "@momentum/shared-types";
import { cn } from "@/lib/utils";

const STATUS_META: Record<
  RewardIndicatorStatus,
  { label: string; tone: string; Icon: typeof Check }
> = {
  achieved: { label: "Achieved", tone: "text-liquid-success", Icon: Check },
  in_progress: { label: "In progress", tone: "text-liquid-warning", Icon: CircleDot },
  not_achieved: { label: "Not achieved", tone: "text-liquid-text-subtle", Icon: Circle }
};

/** Single reward indicator cell: green when achieved, dim when concluded but
 * not achieved, an in-progress dot while the window is still open. */
function RewardIndicatorCell({
  status,
  title,
  subtitle,
  averageRating,
  targetRating
}: {
  status: RewardIndicatorStatus;
  title: string;
  subtitle?: string;
  averageRating?: number;
  targetRating?: number;
}) {
  const meta = STATUS_META[status];
  const Icon = meta.Icon;
  const achieved = status === "achieved";

  return (
    <div
      className={cn(
        "liquid-glass-subtle p-3 rounded-xl flex flex-col items-center gap-1.5 text-center transition-all",
        achieved && "ring-1 ring-liquid-success/40"
      )}
    >
      <Icon
        className={cn("w-5 h-5", meta.tone)}
        aria-hidden="true"
      />
      <div className="text-xs font-medium text-liquid-text leading-tight">
        {title}
      </div>
      {subtitle && (
        <div className="text-[10px] text-liquid-text-subtle leading-tight">
          {subtitle}
        </div>
      )}
      {typeof averageRating === "number" && typeof targetRating === "number" && (
        <div className="text-[10px] text-liquid-text-subtle tabular-nums leading-tight">
          {averageRating.toFixed(1)} / {targetRating.toFixed(1)}
        </div>
      )}
    </div>
  );
}

interface RewardIndicatorRowProps {
  weeklyIndicators: WeeklyRewardIndicatorDTO[];
  monthlyIndicator: MonthlyRewardIndicatorDTO;
}

/** 5-indicator reward row: Week 1–4 + Overall, each independently
 * achieved / in-progress / dim. */
export function RewardIndicatorRow({
  weeklyIndicators,
  monthlyIndicator
}: RewardIndicatorRowProps) {
  const cells = [
    ...weeklyIndicators.map((w) => ({
      key: `week-${w.weekNumber}`,
      title: `Week ${w.weekNumber}`,
      subtitle: w.rewardText || undefined,
      status: w.status,
      averageRating: w.averageRating,
      targetRating: w.targetRating
    })),
    {
      key: "overall",
      title: "Overall",
      subtitle: monthlyIndicator.rewardText || undefined,
      status: monthlyIndicator.status,
      averageRating: monthlyIndicator.averageRating,
      targetRating: monthlyIndicator.targetRating
    }
  ];

  return (
    <div
      className="grid grid-cols-5 gap-2"
      role="list"
      aria-label="Weekly and overall reward status"
    >
      {cells.map((cell) => (
        <RewardIndicatorCell
          key={cell.key}
          title={cell.title}
          subtitle={cell.subtitle}
          status={cell.status}
          averageRating={cell.averageRating}
          targetRating={cell.targetRating}
        />
      ))}
    </div>
  );
}
