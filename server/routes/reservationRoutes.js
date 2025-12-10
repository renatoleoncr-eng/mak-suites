const express = require('express');
const router = express.Router();
const {
    createReservation,
    checkIn,
    updateReservation,
    getReservations,
    getReservationById,
    checkoutReservation,
    addPayment,
    deleteReservation,
    validateDNI,
    addConsumption,
} = require('../controllers/reservationController');
const upload = require('../middleware/upload');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Create reservation (without check-in)
router.post('/', authenticateToken, createReservation);

// Check-in (requires ID photo upload)
router.post('/:id/checkin', authenticateToken, upload.single('id_photo'), checkIn);

// Validate DNI (N8N)
router.post('/validate-dni', authenticateToken, upload.single('image'), validateDNI);

// Update reservation
router.put('/:id', authenticateToken, updateReservation);

// Get all reservations
router.get('/', authenticateToken, getReservations);

// Get reservation by ID
router.get('/:id', authenticateToken, getReservationById);

// Checkout
router.post('/:id/checkout', authenticateToken, checkoutReservation);

// Add payment
router.post('/:id/payment', authenticateToken, addPayment);

// Add consumption
router.post('/:id/consumption', authenticateToken, addConsumption);

// Delete reservation (Admin only)
router.delete('/:id', authenticateToken, isAdmin, deleteReservation);

module.exports = router;
