const prisma = require('../config/prisma');

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

module.exports = { getLogs, createLog, updateLog, deleteLog, getProgressStats };
