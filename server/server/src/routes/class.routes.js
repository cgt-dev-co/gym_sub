const express = require('express');
const router = express.Router();
const { authenticate, isAdmin } = require('../middleware/auth.middleware');
const { getClasses, bookClass, cancelBooking, getMyBookings, createClass, updateClass, deleteClass } = require('../controllers/class.controller');

router.get('/', authenticate, getClasses);
router.get('/my-bookings', authenticate, getMyBookings);
router.post('/book', authenticate, bookClass);
router.delete('/cancel/:classId', authenticate, cancelBooking);

router.post('/', authenticate, isAdmin, createClass);
router.put('/:id', authenticate, isAdmin, updateClass);
router.delete('/:id', authenticate, isAdmin, deleteClass);

module.exports = router;
