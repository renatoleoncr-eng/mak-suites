const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, transactionController.getTransactions);
router.post('/venta-makala', authenticateToken, transactionController.createVentaMakala);
router.post('/venta-mak', authenticateToken, transactionController.createVentaMak);
router.post('/egreso', authenticateToken, transactionController.createEgreso);

module.exports = router;
