import { Hono } from "hono";
import { createScopedDb } from "@momentum/db";
import {
  computeDailyRating,
  eachPktDayInRange,
  parsePktDateString,
  pktDateString,
  nowPktDateString
} from "@momentum/rating-engine";
import type {
  DailyRatingTimeSeriesDTO,
  DailyRatingTimeSeriesPointDTO,
  ProjectCompletionStatsResponseDTO,
  ProjectCompletionStatsDTO,
  ApiResponse
} from "@momentum/shared-types";
import type { AppContext } from "../types.js";
import { ok, notFound, validationError } from "../lib/http.js";

export const analytics = new Hono<AppContext>();

analytics.get("/daily-rating-time-series", async (c) => {
  const scoped = await createScopedDb(c.env.DB, c.get("userId"));
  const seasonId = c.req.query("seasonId");

  let season: Awaited<ReturnType<typeof scoped.seasonById>> | undefined;
  if (seasonId) {
    if (!/^[a-zA-Z0-9-]{1,100}$/.test(seasonId)) {
      return validationError(c, "Invalid seasonId.", { seasonId });
    }
    season = await scoped.seasonById(seasonId);
  } else {
    const todayPkt = nowPktDateString();
    season = await scoped.currentSeason(todayPkt);
  }

  if (!season) {
    return notFound(c, "No season found for analytics.");
  }

  const activeDays = eachPktDayInRange(
    parsePktDateString(season.startDate),
    parsePktDateString(season.endDate),
    season.weekdaysOnly
  );

  const points: DailyRatingTimeSeriesPointDTO[] = [];
  let ratingSum = 0;

  for (const dayInstant of activeDays) {
    const dateKey = pktDateString(dayInstant);
    const tasksWithLogs = await scoped.tasksWithLogsForDate(dateKey);
    const result = computeDailyRating(
      tasksWithLogs.map(({ task, log }) => ({
        actualValue: log?.actualValue ?? null,
        targetValue: task.targetValue,
        importanceWeight: task.importanceWeight
      })),
      dateKey
    );
    points.push({
      pktDate: dateKey,
      rating: result.rating,
      taskCount: result.taskCount
    });
    ratingSum += result.rating;
  }

  const dto: DailyRatingTimeSeriesDTO = {
    seasonId: season.id,
    startDate: season.startDate,
    endDate: season.endDate,
    points,
    averageRating: points.length > 0 ? ratingSum / points.length : 0
  };

  return ok(c, dto);
});

analytics.get("/project-completion-stats", async (c) => {
  const scoped = await createScopedDb(c.env.DB, c.get("userId"));
  const seasonId = c.req.query("seasonId");

  let season: Awaited<ReturnType<typeof scoped.seasonById>> | undefined;
  if (seasonId) {
    if (!/^[a-zA-Z0-9-]{1,100}$/.test(seasonId)) {
      return validationError(c, "Invalid seasonId.", { seasonId });
    }
    season = await scoped.seasonById(seasonId);
  } else {
    const todayPkt = nowPktDateString();
    season = await scoped.currentSeason(todayPkt);
  }

  if (!season) {
    return notFound(c, "No season found for analytics.");
  }

  const projects = await scoped.projects();
  const tasks = await scoped.tasks();
  const logs = await scoped.taskLogsForDateRange(
    season.startDate,
    season.endDate
  );

  const tasksByProject = new Map<string, typeof tasks>();
  for (const task of tasks) {
    const arr = tasksByProject.get(task.projectId) ?? [];
    arr.push(task);
    tasksByProject.set(task.projectId, arr);
  }

  const logsByTaskId = new Map<string, typeof logs>();
  for (const log of logs) {
    const arr = logsByTaskId.get(log.taskId) ?? [];
    arr.push(log);
    logsByTaskId.set(log.taskId, arr);
  }

  const projectStats: ProjectCompletionStatsDTO[] = projects.map((project) => {
    const projectTasks = tasksByProject.get(project.id) ?? [];
    if (projectTasks.length === 0) {
      return {
        projectId: project.id,
        projectName: project.name,
        projectColor: project.color,
        taskCount: 0,
        loggedTaskCount: 0,
        averageScore: 0,
        completionRate: 0
      };
    }

    let loggedCount = 0;
    let scoreSum = 0;
    let maxPossibleScore = 0;

    for (const task of projectTasks) {
      maxPossibleScore += task.importanceWeight;
      const taskLogs = logsByTaskId.get(task.id) ?? [];
      if (taskLogs.length === 0) continue;

      const bestLog = taskLogs.reduce((best, log) => {
        if (!best || (log.taskScore ?? 0) > (best.taskScore ?? 0)) {
          return log;
        }
        return best;
      }, taskLogs[0] ?? null);

      if (bestLog && bestLog.actualValue !== null && bestLog.actualValue > 0) {
        loggedCount += 1;
        scoreSum += bestLog.taskScore ?? 0;
      }
    }

    return {
      projectId: project.id,
      projectName: project.name,
      projectColor: project.color,
      taskCount: projectTasks.length,
      loggedTaskCount: loggedCount,
      averageScore: maxPossibleScore > 0 ? scoreSum / maxPossibleScore : 0,
      completionRate: projectTasks.length > 0 ? loggedCount / projectTasks.length : 0
    };
  });

  const dto: ProjectCompletionStatsResponseDTO = {
    seasonId: season.id,
    projects: projectStats
  };

  return ok(c, dto);
});

export type AnalyticsRoute = typeof analytics;
export type {
  ApiResponse,
  DailyRatingTimeSeriesDTO,
  ProjectCompletionStatsResponseDTO
};
