const express = require('express');
const router = express.Router();
const { getRooms, getAvailability, markRoomAsClean, getFloors, createFloor, deleteFloor, createRoom, updateRoom, deleteRoom } = require('../controllers/roomController');

router.get('/', getRooms);
router.post('/', createRoom);
router.put('/:id', updateRoom);
router.delete('/:id', deleteRoom);
router.get('/floors', getFloors);
router.post('/floors', createFloor);
router.delete('/floors/:id', deleteFloor);
router.get('/availability', getAvailability);
router.put('/:id/clean', markRoomAsClean);

module.exports = router;
