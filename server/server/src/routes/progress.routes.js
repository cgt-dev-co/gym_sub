const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const {
  getLogs, createLog, updateLog, deleteLog, getProgressStats,
  getGoals, createGoal, updateGoal, deleteGoal,
  getStreak, getPersonalRecords
} = require('../controllers/progress.controller');

router.use(authenticate);

router.get('/', getLogs);
router.get('/stats', getProgressStats);
router.get('/streak', getStreak);
router.get('/personal-records', getPersonalRecords);
router.post('/', createLog);
router.put('/:id', updateLog);
router.delete('/:id', deleteLog);

router.get('/goals', getGoals);
router.post('/goals', createGoal);
router.put('/goals/:id', updateGoal);
router.delete('/goals/:id', deleteGoal);

module.exports = router;
