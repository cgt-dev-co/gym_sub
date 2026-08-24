const express = require('express');
const router = express.Router();
const { authenticate, isAdmin } = require('../middleware/auth.middleware');
const {
  getClasses, bookClass, cancelBooking, getMyBookings, createClass, updateClass, deleteClass,
  joinWaitlist, leaveWaitlist, rateClass, getClassRatings, searchClasses
} = require('../controllers/class.controller');

router.get('/', authenticate, getClasses);
router.get('/search', authenticate, searchClasses);
router.get('/my-bookings', authenticate, getMyBookings);
router.post('/book', authenticate, bookClass);
router.delete('/cancel/:classId', authenticate, cancelBooking);
router.post('/waitlist', authenticate, joinWaitlist);
router.delete('/waitlist/:classId', authenticate, leaveWaitlist);
router.get('/:classId/ratings', authenticate, getClassRatings);
router.post('/:classId/rate', authenticate, rateClass);

router.post('/', authenticate, isAdmin, createClass);
router.put('/:id', authenticate, isAdmin, updateClass);
router.delete('/:id', authenticate, isAdmin, deleteClass);

module.exports = router;
