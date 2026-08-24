const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { getLogs, createLog, updateLog, deleteLog, getProgressStats } = require('../controllers/progress.controller');

router.use(authenticate);

router.get('/', getLogs);
router.get('/stats', getProgressStats);
router.post('/', createLog);
router.put('/:id', updateLog);
router.delete('/:id', deleteLog);

module.exports = router;
