import { eq, and, gte, lte, sql, asc, inArray } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema.js";
import type {
  SeasonRow,
  SeasonInsert,
  SeasonWeeklyRewardRow,
  SeasonWeeklyRewardInsert,
  SeasonFinalGoalRow,
  SeasonFinalGoalInsert,
  ProjectRow,
  ProjectInsert,
  TaskRow,
  TaskInsert,
  TaskLogRow,
  TaskLogInsert,
  UserRow
} from "./schema.js";

type Database = DrizzleD1Database<typeof schema>;

type SeasonCreateInput = Omit<
  SeasonInsert,
  "id" | "userId" | "createdAt" | "updatedAt"
>;
type SeasonUpdateInput = Partial<
  Omit<SeasonInsert, "id" | "userId" | "createdAt" | "updatedAt">
>;

type ProjectCreateInput = Omit<
  ProjectInsert,
  "id" | "userId" | "createdAt" | "updatedAt"
>;
type ProjectUpdateInput = Partial<
  Omit<ProjectInsert, "id" | "userId" | "createdAt" | "updatedAt">
>;

type TaskCreateInput = Omit<
  TaskInsert,
  "id" | "userId" | "createdAt" | "updatedAt"
>;
type TaskUpdateInput = Partial<
  Omit<
    TaskInsert,
    | "id"
    | "userId"
    | "projectId"
    | "createdAt"
    | "updatedAt"
    | "targetValue"
    | "unit"
    | "importanceWeight"
  >
>;

type TaskLogUpsertInput = Pick<TaskLogInsert, "actualValue" | "taskScore">;

function now(): Date {
  return new Date();
}

function newId(): string {
  return crypto.randomUUID();
}

export class ScopedDb {
  private readonly db: Database;
  private readonly userId: string;

  constructor(db: Database, userId: string) {
    this.db = db;
    this.userId = userId;
  }

  get rawUserId(): string {
    return this.userId;
  }

  async currentUser(): Promise<UserRow | undefined> {
    return this.db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, this.userId))
      .get();
  }

  async updateUser(
    patch: Partial<Pick<UserRow, "name" | "image" | "username" | "timezone">>
  ): Promise<UserRow | undefined> {
    await this.db
      .update(schema.user)
      .set({ ...patch, updatedAt: now() })
      .where(eq(schema.user.id, this.userId))
      .run();
    return this.currentUser();
  }

  async seasons(): Promise<SeasonRow[]> {
    return this.db
      .select()
      .from(schema.season)
      .where(eq(schema.season.userId, this.userId))
      .all();
  }

  async seasonById(id: string): Promise<SeasonRow | undefined> {
    return this.db
      .select()
      .from(schema.season)
      .where(
        and(eq(schema.season.id, id), eq(schema.season.userId, this.userId))
      )
      .get();
  }

  async insertSeason(input: SeasonCreateInput): Promise<SeasonRow> {
    const id = newId();
    const ts = now();
    await this.db
      .insert(schema.season)
      .values({
        id,
        userId: this.userId,
        startDate: input.startDate,
        endDate: input.endDate,
        targetRating: input.targetRating,
        rewardText: input.rewardText,
        includedDays: input.includedDays,
        createdAt: ts,
        updatedAt: ts
      })
      .run();
    const created = await this.seasonById(id);
    if (!created) {
      throw new Error(`Season ${id} was not persisted after insert.`);
    }
    return created;
  }

  async updateSeason(
    id: string,
    patch: SeasonUpdateInput
  ): Promise<SeasonRow | undefined> {
    await this.db
      .update(schema.season)
      .set({ ...patch, updatedAt: now() })
      .where(
        and(eq(schema.season.id, id), eq(schema.season.userId, this.userId))
      )
      .run();
    return this.seasonById(id);
  }

  async deleteSeason(id: string): Promise<void> {
    await this.db
      .delete(schema.season)
      .where(
        and(eq(schema.season.id, id), eq(schema.season.userId, this.userId))
      )
      .run();
  }

  /**
   * Returns the user's active or upcoming season relative to `todayPkt`, i.e.
   * any season whose date range includes today OR starts on/after today. Used
   * to decide whether the user may start a new challenge. When none exists,
   * the user is eligible to start one.
   */
  async findActiveOrUpcomingSeason(
    todayPkt: string
  ): Promise<SeasonRow | undefined> {
    return this.db
      .select()
      .from(schema.season)
      .where(
        and(
          eq(schema.season.userId, this.userId),
          gte(schema.season.endDate, todayPkt)
        )
      )
      .orderBy(asc(schema.season.startDate))
      .limit(1)
      .get();
  }

  /**
   * Returns the `scheduled_start` ("HH:mm", PKT wall clock) of every task the
   * user has. Tasks in this schema are recurring daily habits (they carry a
   * time-of-day, not a date), so "scheduled for today" means all of the user's
   * tasks. The Start Challenge flow takes the earliest of these to resolve the
   * season start date.
   */
  async scheduledStartsForPktDate(
    _todayPkt: string
  ): Promise<{ scheduledStart: string | null }[]> {
    return this.db
      .select({ scheduledStart: schema.task.scheduledStart })
      .from(schema.task)
      .where(eq(schema.task.userId, this.userId))
      .all();
  }

  // --- Weekly rewards (4 per season, decided upfront) ---

  async weeklyRewardsForSeason(
    seasonId: string
  ): Promise<SeasonWeeklyRewardRow[]> {
    return this.db
      .select()
      .from(schema.seasonWeeklyReward)
      .where(eq(schema.seasonWeeklyReward.seasonId, seasonId))
      .orderBy(asc(schema.seasonWeeklyReward.weekNumber))
      .all();
  }

  async insertWeeklyRewards(
    seasonId: string,
    rows: SeasonWeeklyRewardInsert[]
  ): Promise<SeasonWeeklyRewardRow[]> {
    if (rows.length === 0) return [];
    const ts = now();
    const payload = rows.map((row) => ({
      id: newId(),
      seasonId,
      weekNumber: row.weekNumber,
      targetRating: row.targetRating,
      rewardText: row.rewardText,
      createdAt: ts,
      updatedAt: ts
    }));
    await this.db
      .insert(schema.seasonWeeklyReward)
      .values(payload)
      .run();
    return this.db
      .select()
      .from(schema.seasonWeeklyReward)
      .where(eq(schema.seasonWeeklyReward.seasonId, seasonId))
      .orderBy(asc(schema.seasonWeeklyReward.weekNumber))
      .all();
  }

  // --- Final goals checklist (standalone, not scored) ---

  async finalGoalsForSeason(
    seasonId: string
  ): Promise<SeasonFinalGoalRow[]> {
    return this.db
      .select()
      .from(schema.seasonFinalGoal)
      .where(eq(schema.seasonFinalGoal.seasonId, seasonId))
      .orderBy(asc(schema.seasonFinalGoal.createdAt))
      .all();
  }

  async insertFinalGoals(
    seasonId: string,
    rows: SeasonFinalGoalInsert[]
  ): Promise<SeasonFinalGoalRow[]> {
    if (rows.length === 0) return [];
    const ts = now();
    const payload = rows.map((row) => ({
      id: newId(),
      seasonId,
      text: row.text,
      completed: row.completed ?? false,
      createdAt: ts,
      updatedAt: ts
    }));
    await this.db
      .insert(schema.seasonFinalGoal)
      .values(payload)
      .run();
    return this.db
      .select()
      .from(schema.seasonFinalGoal)
      .where(eq(schema.seasonFinalGoal.seasonId, seasonId))
      .orderBy(asc(schema.seasonFinalGoal.createdAt))
      .all();
  }

  async updateFinalGoalCompleted(
    goalId: string,
    completed: boolean
  ): Promise<SeasonFinalGoalRow | undefined> {
    await this.db
      .update(schema.seasonFinalGoal)
      .set({ completed, updatedAt: now() })
      .where(
        and(
          eq(schema.seasonFinalGoal.id, goalId),
          // scoping: ensure the goal belongs to this user via the season FK
          inArray(
            schema.seasonFinalGoal.seasonId,
            this.db
              .select({ id: schema.season.id })
              .from(schema.season)
              .where(eq(schema.season.userId, this.userId))
          )
        )
      )
      .run();
    return this.db
      .select()
      .from(schema.seasonFinalGoal)
      .where(eq(schema.seasonFinalGoal.id, goalId))
      .get();
  }

  async deleteFinalGoal(goalId: string): Promise<void> {
    await this.db
      .delete(schema.seasonFinalGoal)
      .where(
        and(
          eq(schema.seasonFinalGoal.id, goalId),
          inArray(
            schema.seasonFinalGoal.seasonId,
            this.db
              .select({ id: schema.season.id })
              .from(schema.season)
              .where(eq(schema.season.userId, this.userId))
          )
        )
      )
      .run();
  }

  async projects(): Promise<ProjectRow[]> {
    return this.db
      .select()
      .from(schema.project)
      .where(eq(schema.project.userId, this.userId))
      .all();
  }

  async projectById(id: string): Promise<ProjectRow | undefined> {
    return this.db
      .select()
      .from(schema.project)
      .where(
        and(eq(schema.project.id, id), eq(schema.project.userId, this.userId))
      )
      .get();
  }

  async insertProject(input: ProjectCreateInput): Promise<ProjectRow> {
    const id = newId();
    const ts = now();
    await this.db
      .insert(schema.project)
      .values({
        id,
        userId: this.userId,
        name: input.name,
        color: input.color ?? schema.DEFAULT_PROJECT_COLOR,
        createdAt: ts,
        updatedAt: ts
      })
      .run();
    const created = await this.projectById(id);
    if (!created) {
      throw new Error(`Project ${id} was not persisted after insert.`);
    }
    return created;
  }

  async updateProject(
    id: string,
    patch: ProjectUpdateInput
  ): Promise<ProjectRow | undefined> {
    await this.db
      .update(schema.project)
      .set({ ...patch, updatedAt: now() })
      .where(
        and(eq(schema.project.id, id), eq(schema.project.userId, this.userId))
      )
      .run();
    return this.projectById(id);
  }

  async deleteProject(id: string): Promise<void> {
    await this.db
      .delete(schema.project)
      .where(
        and(eq(schema.project.id, id), eq(schema.project.userId, this.userId))
      )
      .run();
  }

  async tasks(): Promise<TaskRow[]> {
    return this.db
      .select()
      .from(schema.task)
      .where(eq(schema.task.userId, this.userId))
      .all();
  }

  async tasksByProject(projectId: string): Promise<TaskRow[]> {
    return this.db
      .select()
      .from(schema.task)
      .where(
        and(
          eq(schema.task.userId, this.userId),
          eq(schema.task.projectId, projectId)
        )
      )
      .all();
  }

  async taskById(id: string): Promise<TaskRow | undefined> {
    return this.db
      .select()
      .from(schema.task)
      .where(and(eq(schema.task.id, id), eq(schema.task.userId, this.userId)))
      .get();
  }

  async insertTask(input: TaskCreateInput): Promise<TaskRow> {
    const id = newId();
    const ts = now();
    await this.db
      .insert(schema.task)
      .values({
        id,
        userId: this.userId,
        projectId: input.projectId,
        title: input.title,
        targetValue: input.targetValue,
        unit: input.unit,
        importanceWeight: input.importanceWeight,
        sortOrder: input.sortOrder ?? 0,
        scheduledStart: input.scheduledStart,
        scheduledEnd: input.scheduledEnd,
        createdAt: ts,
        updatedAt: ts
      })
      .run();
    const created = await this.taskById(id);
    if (!created) {
      throw new Error(`Task ${id} was not persisted after insert.`);
    }
    return created;
  }

  async updateTask(
    id: string,
    patch: TaskUpdateInput
  ): Promise<TaskRow | undefined> {
    await this.db
      .update(schema.task)
      .set({ ...patch, updatedAt: now() })
      .where(and(eq(schema.task.id, id), eq(schema.task.userId, this.userId)))
      .run();
    return this.taskById(id);
  }

  async deleteTask(id: string): Promise<void> {
    await this.db
      .delete(schema.task)
      .where(and(eq(schema.task.id, id), eq(schema.task.userId, this.userId)))
      .run();
  }

  async taskLogsByDate(date: string): Promise<TaskLogRow[]> {
    return this.db
      .select()
      .from(schema.taskLog)
      .where(
        and(eq(schema.taskLog.userId, this.userId), eq(schema.taskLog.date, date))
      )
      .all();
  }

  async taskLogsByTask(taskId: string): Promise<TaskLogRow[]> {
    return this.db
      .select()
      .from(schema.taskLog)
      .where(
        and(
          eq(schema.taskLog.userId, this.userId),
          eq(schema.taskLog.taskId, taskId)
        )
      )
      .all();
  }

  async taskLogById(id: string): Promise<TaskLogRow | undefined> {
    return this.db
      .select()
      .from(schema.taskLog)
      .where(
        and(eq(schema.taskLog.id, id), eq(schema.taskLog.userId, this.userId))
      )
      .get();
  }

  async upsertTaskLog(
    taskId: string,
    date: string,
    input: TaskLogUpsertInput
  ): Promise<TaskLogRow | undefined> {
    const ts = now();
    await this.db
      .insert(schema.taskLog)
      .values({
        id: newId(),
        taskId,
        userId: this.userId,
        date,
        actualValue: input.actualValue,
        taskScore: input.taskScore,
        createdAt: ts,
        updatedAt: ts
      })
      .onConflictDoUpdate({
        target: [schema.taskLog.taskId, schema.taskLog.date],
        set: {
          actualValue: input.actualValue,
          taskScore: input.taskScore,
          updatedAt: ts
        }
      })
      .run();

    return this.db
      .select()
      .from(schema.taskLog)
      .where(
        and(
          eq(schema.taskLog.taskId, taskId),
          eq(schema.taskLog.date, date),
          eq(schema.taskLog.userId, this.userId)
        )
      )
      .get();
  }

  async deleteTaskLog(id: string): Promise<void> {
    await this.db
      .delete(schema.taskLog)
      .where(
        and(eq(schema.taskLog.id, id), eq(schema.taskLog.userId, this.userId))
      )
      .run();
  }

  async tasksWithLogsForDate(
    date: string
  ): Promise<{ task: TaskRow; log: TaskLogRow | null }[]> {
    const tasks = await this.db
      .select()
      .from(schema.task)
      .where(eq(schema.task.userId, this.userId))
      .all();

    const logs = await this.db
      .select()
      .from(schema.taskLog)
      .where(
        and(eq(schema.taskLog.userId, this.userId), eq(schema.taskLog.date, date))
      )
      .all();

    const logByTaskId = new Map<string, TaskLogRow>();
    for (const log of logs) {
      logByTaskId.set(log.taskId, log);
    }

    return tasks.map((task) => ({
      task,
      log: logByTaskId.get(task.id) ?? null
    }));
  }

  async currentSeason(todayPkt: string): Promise<SeasonRow | undefined> {
  
    if(todayPkt === undefined || todayPkt === null || todayPkt === ""){
      throw new Error("todayPkt is undefined or null");
    } else{
    return this.db
      .select()
      .from(schema.season)
      .where(
        and(
          eq(schema.season.userId, this.userId),
          lte(schema.season.startDate, todayPkt),
          gte(schema.season.endDate, todayPkt)
        )
      )
      .limit(1)
      .get();
  }
}

  async taskLogsForDateRange(
    startDate: string,
    endDate: string
  ): Promise<TaskLogRow[]> {
    return this.db
      .select()
      .from(schema.taskLog)
      .where(
        and(
          eq(schema.taskLog.userId, this.userId),
          gte(schema.taskLog.date, startDate),
          lte(schema.taskLog.date, endDate)
        )
      )
      .all();
  }

  async tasksOrderedBySort(): Promise<TaskRow[]> {
    return this.db
      .select()
      .from(schema.task)
      .where(eq(schema.task.userId, this.userId))
      .orderBy(asc(schema.task.sortOrder))
      .all();
  }

  async tasksByProjectOrdered(projectId: string): Promise<TaskRow[]> {
    return this.db
      .select()
      .from(schema.task)
      .where(
        and(
          eq(schema.task.userId, this.userId),
          eq(schema.task.projectId, projectId)
        )
      )
      .orderBy(asc(schema.task.sortOrder))
      .all();
  }

  async updateTaskSortOrders(
    updates: { id: string; sortOrder: number }[]
  ): Promise<void> {
    const ts = now();
    for (const update of updates) {
      await this.db
        .update(schema.task)
        .set({ sortOrder: update.sortOrder, updatedAt: ts })
        .where(
          and(
            eq(schema.task.id, update.id),
            eq(schema.task.userId, this.userId)
          )
        )
        .run();
    }
  }
}

export interface LeaderboardEntry {
  username: string;
  seasonRating: number;
}

export async function fetchLeaderboard(
  db: DrizzleD1Database<typeof schema>,
  opts: {
    seasonStartDate: string;
    seasonEndDate: string;
    /**
     * 7-bit included-days bitmask (bit N = `Date#getDay()`, 0 = Sunday .. 6 =
     * Saturday). Excluded days never count toward the average. This is a
     * cross-user approximation that uses UTC day-of-week (matching the legacy
     * leaderboard behavior); the rating-engine remains the source of truth for
     * precise PKT-aware averages.
     */
    includedDays: number;
    limit: number;
    offset: number;
  }
): Promise<{ entries: LeaderboardEntry[]; total: number }> {
  const entries = await db
    .select({
      username: schema.user.username,
      seasonId: schema.season.id,
      userId: schema.season.userId,
      includedDays: schema.season.includedDays
    })
    .from(schema.season)
    .innerJoin(schema.user, eq(schema.season.userId, schema.user.id))
    .where(
      and(
        eq(schema.season.startDate, opts.seasonStartDate),
        eq(schema.season.endDate, opts.seasonEndDate)
      )
    )
    .limit(opts.limit)
    .offset(opts.offset)
    .all();

  const totalRow = await db
    .select({ count: sql<number>`count(*)`.as("count") })
    .from(schema.season)
    .innerJoin(schema.user, eq(schema.season.userId, schema.user.id))
    .where(
      and(
        eq(schema.season.startDate, opts.seasonStartDate),
        eq(schema.season.endDate, opts.seasonEndDate)
      )
    )
    .get();
  const total = Number(totalRow?.count ?? 0);

  if (entries.length === 0) {
    return { entries: [], total };
  }

  const enriched = await Promise.all(
    entries.map(async (entry) => {
      const rating = await computeUserSeasonRatingInDb(
        db,
        entry.userId,
        opts.seasonStartDate,
        opts.seasonEndDate,
        Number(entry.includedDays ?? 0b1111111)
      );
      return {
        username: entry.username,
        seasonRating: rating
      };
    })
  );

  enriched.sort((a, b) => b.seasonRating - a.seasonRating);
  return { entries: enriched, total };
}

async function computeUserSeasonRatingInDb(
  db: DrizzleD1Database<typeof schema>,
  userId: string,
  startDate: string,
  endDate: string,
  includedDays: number
): Promise<number> {
  const tasks = await db
    .select({
      id: schema.task.id,
      targetValue: schema.task.targetValue,
      importanceWeight: schema.task.importanceWeight
    })
    .from(schema.task)
    .where(eq(schema.task.userId, userId))
    .all();

  const logs = await db
    .select({
      taskId: schema.taskLog.taskId,
      date: schema.taskLog.date,
      actualValue: schema.taskLog.actualValue
    })
    .from(schema.taskLog)
    .where(
      and(
        eq(schema.taskLog.userId, userId),
        gte(schema.taskLog.date, startDate),
        lte(schema.taskLog.date, endDate)
      )
    )
    .all();

  const logsByDate = new Map<string, Map<string, number | null>>();
  for (const log of logs) {
    const dayMap = logsByDate.get(log.date) ?? new Map<string, number | null>();
    dayMap.set(log.taskId, log.actualValue);
    logsByDate.set(log.date, dayMap);
  }

  const activeDates = computeActiveDates(startDate, endDate, includedDays);
  if (activeDates.length === 0) return 0;

  let ratingSum = 0;
  for (const date of activeDates) {
    const dayLogs = logsByDate.get(date) ?? new Map<string, number | null>();
    let totalScore = 0;
    let totalWeight = 0;
    for (const task of tasks) {
      const actual = dayLogs.get(task.id) ?? null;
      const score =
        actual === null || actual <= 0
          ? 0
          : Math.min(
            (actual / task.targetValue) * task.importanceWeight,
            task.importanceWeight
          );
      totalScore += score;
      totalWeight += task.importanceWeight;
    }
    const dayRating = totalWeight > 0 ? (totalScore / totalWeight) * 10 : 0;
    ratingSum += dayRating;
  }

  return ratingSum / activeDates.length;
}

function computeActiveDates(
  startDate: string,
  endDate: string,
  includedDays: number
): string[] {
  const mask = Number.isFinite(includedDays)
    ? Math.max(0, Math.min(0b1111111, Math.trunc(includedDays)))
    : 0b1111111;
  const dates: string[] = [];
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const dayMs = 24 * 60 * 60 * 1000;
  for (let t = start.getTime(); t <= end.getTime(); t += dayMs) {
    const d = new Date(t);
    const dayOfWeek = d.getUTCDay();
    // bit N (0=Sunday..6=Saturday) set => included. Excluded days are omitted
    // entirely (never counted, not even as 0).
    if ((mask >> dayOfWeek) & 1) {
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      dates.push(`${yyyy}-${mm}-${dd}`);
    }
  }
  return dates;
}
