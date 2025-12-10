const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticateToken, isAdmin } = require('../middleware/auth');

router.get('/', authenticateToken, productController.getProducts);
router.post('/', authenticateToken, productController.createProduct);
router.put('/:id', authenticateToken, productController.updateProduct);
router.delete('/:id', authenticateToken, isAdmin, productController.deleteProduct);

// Stock routes
router.post('/:id/stock', authenticateToken, productController.updateStock);
router.get('/movements', authenticateToken, productController.getStockMovements); // Global
router.get('/:id/movements', authenticateToken, productController.getStockMovements); // Per product

module.exports = router;
