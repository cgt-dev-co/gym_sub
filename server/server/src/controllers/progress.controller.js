const prisma = require('../config/prisma');

// ── Goal tracking ────────────────────────────────────────────────────────────

const getGoals = async (req, res, next) => {
  try {
    const goals = await prisma.workoutGoal.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ goals });
  } catch (error) {
    next(error);
  }
};

const createGoal = async (req, res, next) => {
  try {
    const { title, targetValue, unit, deadline } = req.body;
    const goal = await prisma.workoutGoal.create({
      data: {
        userId: req.user.id,
        title,
        targetValue: parseFloat(targetValue),
        currentValue: 0,
        unit,
        deadline: deadline ? new Date(deadline) : null,
        status: 'ACTIVE'
      }
    });
    res.status(201).json({ message: 'Goal created', goal });
  } catch (error) {
    next(error);
  }
};

const updateGoal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, targetValue, currentValue, unit, deadline, status } = req.body;

    const existing = await prisma.workoutGoal.findFirst({ where: { id, userId: req.user.id } });
    if (!existing) return res.status(404).json({ error: 'Goal not found' });

    const data = {};
    if (title !== undefined) data.title = title;
    if (targetValue !== undefined) data.targetValue = parseFloat(targetValue);
    if (currentValue !== undefined) {
      data.currentValue = parseFloat(currentValue);
      if (data.currentValue >= (targetValue !== undefined ? parseFloat(targetValue) : existing.targetValue)) {
        data.status = 'COMPLETED';
      }
    }
    if (unit !== undefined) data.unit = unit;
    if (deadline !== undefined) data.deadline = deadline ? new Date(deadline) : null;
    if (status !== undefined) data.status = status;

    const goal = await prisma.workoutGoal.update({ where: { id }, data });
    res.json({ message: 'Goal updated', goal });
  } catch (error) {
    next(error);
  }
};

const deleteGoal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await prisma.workoutGoal.findFirst({ where: { id, userId: req.user.id } });
    if (!existing) return res.status(404).json({ error: 'Goal not found' });
    await prisma.workoutGoal.delete({ where: { id } });
    res.json({ message: 'Goal deleted' });
  } catch (error) {
    next(error);
  }
};

// ── Streak calculation ────────────────────────────────────────────────────────

const getStreak = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const logs = await prisma.workoutLog.findMany({
      where: { userId },
      select: { logDate: true },
      orderBy: { logDate: 'desc' }
    });

    if (logs.length === 0) {
      return res.json({ currentStreak: 0, longestStreak: 0, lastWorkoutDate: null });
    }

    const uniqueDays = [...new Set(logs.map(l => new Date(l.logDate).toDateString()))].map(d => new Date(d));
    uniqueDays.sort((a, b) => b - a);

    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const lastDay = uniqueDays[0];
    lastDay.setHours(0, 0, 0, 0);
    const isActive = lastDay.getTime() === today.getTime() || lastDay.getTime() === yesterday.getTime();

    if (isActive) {
      currentStreak = 1;
      for (let i = 1; i < uniqueDays.length; i++) {
        const diff = (uniqueDays[i - 1] - uniqueDays[i]) / (1000 * 60 * 60 * 24);
        if (diff === 1) currentStreak++;
        else break;
      }
    }

    let longestStreak = 1, tempStreak = 1;
    for (let i = 1; i < uniqueDays.length; i++) {
      const diff = (uniqueDays[i - 1] - uniqueDays[i]) / (1000 * 60 * 60 * 24);
      if (diff === 1) { tempStreak++; longestStreak = Math.max(longestStreak, tempStreak); }
      else tempStreak = 1;
    }

    res.json({ currentStreak, longestStreak, lastWorkoutDate: uniqueDays[0] });
  } catch (error) {
    next(error);
  }
};

// ── Personal records ──────────────────────────────────────────────────────────

const getPersonalRecords = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const logs = await prisma.workoutLog.findMany({
      where: { userId },
      select: { exercises: true, logDate: true }
    });

    const records = {};
    for (const log of logs) {
      for (const ex of (log.exercises || [])) {
        if (!ex.name || !ex.weight) continue;
        const w = parseFloat(ex.weight);
        if (isNaN(w)) continue;
        if (!records[ex.name] || w > records[ex.name].weight) {
          records[ex.name] = { weight: w, unit: ex.weightUnit || 'kg', date: log.logDate, sets: ex.sets, reps: ex.reps };
        }
      }
    }

    res.json({ personalRecords: records });
  } catch (error) {
    next(error);
  }
};

// ── Workout logs ─────────────────────────────────────────────────────────────

const getLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, from, to } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { userId: req.user.id };

    if (from || to) {
      where.logDate = {};
      if (from) where.logDate.gte = new Date(from);
      if (to) where.logDate.lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      prisma.workoutLog.findMany({
        where,
        orderBy: { logDate: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.workoutLog.count({ where })
    ]);

    res.json({ logs, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    next(error);
  }
};

const createLog = async (req, res, next) => {
  try {
    const { title, exercises, notes, duration, logDate } = req.body;

    const log = await prisma.workoutLog.create({
      data: {
        userId: req.user.id,
        title,
        exercises,
        notes,
        duration: parseInt(duration),
        logDate: logDate ? new Date(logDate) : new Date()
      }
    });

    res.status(201).json({ message: 'Workout logged', log });
  } catch (error) {
    next(error);
  }
};

const updateLog = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, exercises, notes, duration, logDate } = req.body;

    const existing = await prisma.workoutLog.findFirst({ where: { id, userId: req.user.id } });

    if (!existing) {
      return res.status(404).json({ error: 'Log not found' });
    }

    const log = await prisma.workoutLog.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(exercises !== undefined && { exercises }),
        ...(notes !== undefined && { notes }),
        ...(duration !== undefined && { duration: parseInt(duration) }),
        ...(logDate !== undefined && { logDate: new Date(logDate) })
      }
    });

    res.json({ message: 'Log updated', log });
  } catch (error) {
    next(error);
  }
};

const deleteLog = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await prisma.workoutLog.findFirst({ where: { id, userId: req.user.id } });

    if (!existing) {
      return res.status(404).json({ error: 'Log not found' });
    }

    await prisma.workoutLog.delete({ where: { id } });
    res.json({ message: 'Log deleted' });
  } catch (error) {
    next(error);
  }
};

const getProgressStats = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalLogs, recentLogs, durationStats] = await Promise.all([
      prisma.workoutLog.count({ where: { userId } }),
      prisma.workoutLog.count({ where: { userId, logDate: { gte: thirtyDaysAgo } } }),
      prisma.workoutLog.aggregate({
        where: { userId, logDate: { gte: thirtyDaysAgo } },
        _sum: { duration: true },
        _avg: { duration: true }
      })
    ]);

    const logsPerWeek = await prisma.workoutLog.findMany({
      where: { userId, logDate: { gte: thirtyDaysAgo } },
      select: { logDate: true, duration: true }
    });

    res.json({
      stats: {
        totalLogs,
        recentLogs,
        totalDuration: durationStats._sum.duration || 0,
        avgDuration: Math.round(durationStats._avg.duration || 0),
        logsPerWeek
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLogs, createLog, updateLog, deleteLog, getProgressStats,
  getGoals, createGoal, updateGoal, deleteGoal,
  getStreak, getPersonalRecords
};
