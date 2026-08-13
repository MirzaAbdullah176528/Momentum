"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from "recharts";
import { useAsyncData } from "@/hooks/use-async-data";
import { api } from "@/lib/api";
import { ErrorState, EmptyState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, BarChart3 } from "lucide-react";

export default function AnalyticsPage() {
  const timeSeriesData = useAsyncData(() => api.analytics.dailyRatingTimeSeries(), []);
  const projectStatsData = useAsyncData(
    () => api.analytics.projectCompletionStats(),
    []
  );

  const chartData = useMemo(() => {
    if (!timeSeriesData.data) return [];
    return timeSeriesData.data.points.map((p) => ({
      date: p.pktDate.slice(5),
      rating: Number(p.rating.toFixed(2)),
      taskCount: p.taskCount
    }));
  }, [timeSeriesData.data]);

  const projectChartData = useMemo(() => {
    if (!projectStatsData.data) return [];
    return projectStatsData.data.projects.map((p) => ({
      name: p.projectName,
      completion: Number((p.completionRate * 100).toFixed(1)),
      color: p.projectColor
    }));
  }, [projectStatsData.data]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-liquid-text">Analytics</h1>
        <p className="text-sm text-liquid-text-muted">
          Track your trends and project completion over the current season.
        </p>
      </header>

      <section
        className="liquid-glass p-6 space-y-4"
        aria-labelledby="trend-heading"
      >
        <div className="flex items-center justify-between">
          <h2
            id="trend-heading"
            className="text-lg font-semibold text-liquid-text flex items-center gap-2"
          >
            <TrendingUp className="w-5 h-5 text-liquid-accent" aria-hidden="true" />
            Daily Rating Trend
          </h2>
          {timeSeriesData.data && (
            <Badge tone="neutral">
              Avg: {timeSeriesData.data.averageRating.toFixed(2)}
            </Badge>
          )}
        </div>

        {timeSeriesData.loading ? (
          <Skeleton className="h-64 w-full" />
        ) 
        : (
          <div
            role="img"
            aria-label={`Daily rating trend chart showing ${chartData.length} data points from ${chartData[0]?.date} to ${chartData[chartData.length - 1]?.date}. Average rating: ${timeSeriesData.data?.averageRating.toFixed(2)}`}
          >
            <ResponsiveContainer width="100%" height={280}>
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.06)"
                />
                <XAxis
                  dataKey="date"
                  stroke="rgba(255,255,255,0.5)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[0, 10]}
                  stroke="rgba(255,255,255,0.5)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(11, 14, 28, 0.95)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    color: "#fff"
                  }}
                  labelStyle={{ color: "rgba(255,255,255,0.7)" }}
                />
                <Line
                  type="monotone"
                  dataKey="rating"
                  stroke="#7c5cff"
                  strokeWidth={2}
                  dot={{ fill: "#7c5cff", r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section
        className="liquid-glass p-6 space-y-4"
        aria-labelledby="project-stats-heading"
      >
        <h2
          id="project-stats-heading"
          className="text-lg font-semibold text-liquid-text flex items-center gap-2"
        >
          <BarChart3 className="w-5 h-5 text-liquid-accent" aria-hidden="true" />
          Project Completion
        </h2>

        {projectStatsData.loading ? (
          <Skeleton className="h-64 w-full" />
        ) : projectStatsData.error ? (
          <ErrorState
            title="Couldn't load project stats"
            message={projectStatsData.error}
            onRetry={projectStatsData.refetch}
          />
        ) : projectChartData.length === 0 ? (
          <EmptyState
            title="No projects"
            message="Create projects with tasks to see completion stats."
          />
        ) : (
          <>
            <div
              role="img"
              aria-label={`Project completion bar chart showing ${projectChartData.length} projects`}
            >
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={projectChartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.06)"
                  />
                  <XAxis
                    dataKey="name"
                    stroke="rgba(255,255,255,0.5)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="rgba(255,255,255,0.5)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(11, 14, 28, 0.95)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                      color: "#fff"
                    }}
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  />
                  <Bar dataKey="completion" radius={[8, 8, 0, 0]}>
                    {projectChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <ul className="space-y-2" aria-label="Project completion details">
              {projectStatsData.data?.projects.map((p) => (
                <li
                  key={p.projectId}
                  className="liquid-glass-subtle p-3 flex items-center gap-3"
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: p.projectColor }}
                    aria-hidden="true"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-liquid-text truncate">
                      {p.projectName}
                    </div>
                    <div className="text-xs text-liquid-text-subtle">
                      {p.loggedTaskCount} / {p.taskCount} tasks logged · avg
                      score {(p.averageScore * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className="text-lg font-bold tabular-nums"
                      style={{ color: p.projectColor }}
                    >
                      {(p.completionRate * 100).toFixed(0)}%
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
