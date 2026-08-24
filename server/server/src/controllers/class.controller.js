const prisma = require('../config/prisma');

const getClasses = async (req, res, next) => {
  try {
    const { upcoming } = req.query;
    const where = { isActive: true };

    if (upcoming === 'true') {
      where.schedule = { gte: new Date() };
    }

    const classes = await prisma.gymClass.findMany({
      where,
      orderBy: { schedule: 'asc' },
      include: {
        _count: { select: { bookings: { where: { status: 'CONFIRMED' } } } }
      }
    });

    const userId = req.user?.id;
    let userBookings = [];

    if (userId) {
      userBookings = await prisma.classBooking.findMany({
        where: { userId, status: 'CONFIRMED' },
        select: { classId: true }
      });
    }

    const bookedClassIds = new Set(userBookings.map(b => b.classId));

    const enriched = classes.map(c => ({
      ...c,
      spotsLeft: c.capacity - c._count.bookings,
      isBooked: bookedClassIds.has(c.id)
    }));

    res.json({ classes: enriched });
  } catch (error) {
    next(error);
  }
};

const bookClass = async (req, res, next) => {
  try {
    const { classId } = req.body;
    const userId = req.user.id;

    const gymClass = await prisma.gymClass.findUnique({ where: { id: classId } });

    if (!gymClass || !gymClass.isActive) {
      return res.status(404).json({ error: 'Class not found' });
    }

    if (new Date(gymClass.schedule) < new Date()) {
      return res.status(400).json({ error: 'Cannot book a past class' });
    }

    const confirmedCount = await prisma.classBooking.count({
      where: { classId, status: 'CONFIRMED' }
    });

    if (confirmedCount >= gymClass.capacity) {
      return res.status(400).json({ error: 'Class is fully booked' });
    }

    const booking = await prisma.classBooking.upsert({
      where: { userId_classId: { userId, classId } },
      update: { status: 'CONFIRMED' },
      create: { userId, classId, status: 'CONFIRMED' }
    });

    await prisma.notification.create({
      data: {
        userId,
        title: 'Class Booked',
        message: `You have successfully booked "${gymClass.name}" on ${new Date(gymClass.schedule).toLocaleString()}.`,
        type: 'SUCCESS'
      }
    });

    res.status(201).json({ message: 'Class booked successfully', booking });
  } catch (error) {
    next(error);
  }
};

const cancelBooking = async (req, res, next) => {
  try {
    const { classId } = req.params;
    const userId = req.user.id;

    const booking = await prisma.classBooking.findUnique({
      where: { userId_classId: { userId, classId } }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    await prisma.classBooking.update({
      where: { userId_classId: { userId, classId } },
      data: { status: 'CANCELLED' }
    });

    res.json({ message: 'Booking cancelled successfully' });
  } catch (error) {
    next(error);
  }
};

const getMyBookings = async (req, res, next) => {
  try {
    const bookings = await prisma.classBooking.findMany({
      where: { userId: req.user.id },
      include: { gymClass: true },
      orderBy: { gymClass: { schedule: 'asc' } }
    });

    res.json({ bookings });
  } catch (error) {
    next(error);
  }
};

const createClass = async (req, res, next) => {
  try {
    const { name, description, instructor, capacity, classType, schedule, duration } = req.body;

    const gymClass = await prisma.gymClass.create({
      data: { name, description, instructor, capacity, classType, schedule: new Date(schedule), duration }
    });

    res.status(201).json({ message: 'Class created', gymClass });
  } catch (error) {
    next(error);
  }
};

const updateClass = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, instructor, capacity, classType, schedule, duration, isActive } = req.body;

    const gymClass = await prisma.gymClass.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(instructor !== undefined && { instructor }),
        ...(capacity !== undefined && { capacity }),
        ...(classType !== undefined && { classType }),
        ...(schedule !== undefined && { schedule: new Date(schedule) }),
        ...(duration !== undefined && { duration }),
        ...(isActive !== undefined && { isActive })
      }
    });

    res.json({ message: 'Class updated', gymClass });
  } catch (error) {
    next(error);
  }
};

const deleteClass = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.gymClass.update({ where: { id }, data: { isActive: false } });
    res.json({ message: 'Class deactivated' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getClasses, bookClass, cancelBooking, getMyBookings, createClass, updateClass, deleteClass };
