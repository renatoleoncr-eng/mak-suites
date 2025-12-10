const express = require('express');
const router = express.Router();
const { getAllUsers, updateUser, deleteUser } = require('../controllers/userController');

// All these routes should ideally be protected by auth middleware and admin check
// For now, assuming the frontend gate is the primary barrier as requested, 
// but in a production app we'd add middleware here.

router.get('/', getAllUsers);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

module.exports = router;
