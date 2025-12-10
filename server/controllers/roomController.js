const { Room, Reservation, Floor, sequelize } = require('../models');
const { Op } = require('sequelize');

// --- Floor Management ---
const getFloors = async (req, res) => {
    try {
        const floors = await Floor.findAll({
            order: [['number', 'ASC']],
        });
        res.json(floors);
    } catch (error) {
        console.error('Error fetching floors:', error);
        res.status(500).json({ message: 'Error fetching floors' });
    }
};

const createFloor = async (req, res) => {
    try {
        const { number } = req.body;
        if (!number) return res.status(400).json({ message: 'Floor number is required' });

        const floor = await Floor.create({ number });
        res.status(201).json(floor);
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ message: 'Floor already exists' });
        }
        res.status(500).json({ message: 'Error creating floor' });
    }
};

// --- Room Management ---
const createRoom = async (req, res) => {
    try {
        const { number, floor_id, type, price_per_night } = req.body;

        if (!number || !floor_id || !type || !price_per_night) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Validate floor exists
        const floor = await Floor.findByPk(floor_id);
        if (!floor) return res.status(404).json({ message: 'Floor not found' });

        const room = await Room.create({
            number,
            floor: floor.number, // Keep redundant for now or refactor Room model to use relation
            type,
            price_per_night
        });

        res.status(201).json(room);
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ message: 'Room number already exists' });
        }
        res.status(500).json({ message: 'Error creating room' });
    }
};

const getRooms = async (req, res) => {
    try {
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }); // YYYY-MM-DD

        const rooms = await Room.findAll({
            order: [['floor', 'ASC'], ['number', 'ASC']],
            include: [{
                model: Reservation,
                required: false,
                where: {
                    status: { [Op.in]: ['checked_in', 'reserved'] },
                }
            }]
        });

        // Add has_active_reservation flag
        const roomsWithStatus = rooms.map(room => {
            const r = room.toJSON();
            // Check if any attached reservation is valid (active or reserved)
            const hasActive = r.Reservations && r.Reservations.some(res => {
                return ['checked_in', 'reserved'].includes(res.status);
            });

            // Specific flag for Checked In (for Caja)
            const hasCheckedIn = r.Reservations && r.Reservations.some(res => {
                return res.status === 'checked_in';
            });

            r.has_active_reservation = hasActive || r.status === 'occupied';
            r.has_checked_in_reservation = hasCheckedIn || r.status === 'occupied'; // Fallback to room status just in case
            delete r.Reservations; // Clean up
            return r;
        });

        res.json(roomsWithStatus);
    } catch (error) {
        console.error('Error fetching rooms:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get room availability for a date range
const getAvailability = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;

        if (!start_date || !end_date) {
            return res.status(400).json({ message: 'start_date y end_date son requeridos' });
        }

        const rooms = await Room.findAll({
            order: [['floor', 'ASC'], ['number', 'ASC']],
        });

        const reservations = await Reservation.findAll({
            where: {
                status: {
                    [Op.in]: ['reserved', 'checked_in', 'checked_out', 'cleaning', 'completed'],
                },
                [Op.or]: [
                    { start_date: { [Op.between]: [start_date, end_date] } },
                    { end_date: { [Op.between]: [start_date, end_date] } },
                    {
                        [Op.and]: [
                            { start_date: { [Op.lte]: start_date } },
                            { end_date: { [Op.gte]: end_date } },
                        ],
                    },
                ],
            },
            include: [
                { model: require('../models').Guest },
                { model: require('../models').Room }
            ],
            attributes: [
                'id', 'room_id', 'guest_id', 'start_date', 'end_date', 'status',
                'reservation_type', 'start_time', 'end_time', 'reservation_code',
                'total_amount', 'paid_amount', 'notes'
            ],
        });

        const availability = {};
        const dates = [];
        const currentDate = new Date(start_date);
        const endDateObj = new Date(end_date);

        while (currentDate <= endDateObj) {
            dates.push(currentDate.toISOString().split('T')[0]);
            currentDate.setDate(currentDate.getDate() + 1);
        }

        rooms.forEach((room) => {
            availability[room.id] = {};
            dates.forEach((date) => {
                availability[room.id][date] = {
                    available: true,
                    status: 'available',
                    reservations: []
                };
            });
        });

        reservations.forEach((reservation) => {
            const resStartDate = reservation.start_date;
            const resEndDate = reservation.end_date;

            dates.forEach((date) => {
                const isHourly = reservation.reservation_type === 'hourly';
                const blocksDate = isHourly
                    ? date === resStartDate
                    : (date >= resStartDate && date < resEndDate);

                if (blocksDate) {
                    if (availability[reservation.room_id] && availability[reservation.room_id][date]) {
                        const cell = availability[reservation.room_id][date];
                        if (!cell.reservations) cell.reservations = [];

                        cell.reservations.push(reservation);

                        let newStatus = 'reserved';
                        if (reservation.status === 'checked_in') newStatus = 'occupied';
                        else if (reservation.status === 'cleaning') newStatus = 'cleaning';
                        else if (reservation.status === 'checked_out') newStatus = 'cleaning';
                        else if (reservation.status === 'completed') newStatus = 'completed';

                        const statusPriority = {
                            'available': 0,
                            'completed': 1,
                            'reserved': 2,
                            'cleaning': 3,
                            'checked_out': 3,
                            'occupied': 4
                        };

                        const currentPriority = statusPriority[cell.status] || 0;
                        const newPriority = statusPriority[newStatus] || 0;

                        if (newPriority > currentPriority) {
                            cell.status = newStatus;
                        }

                        if (reservation.status !== 'completed') {
                            cell.available = false;
                        }

                        if (newPriority >= currentPriority || !cell.reservation) {
                            cell.reservation = reservation;
                        }
                    }
                }
            });
        });

        const floors = await Floor.findAll({
            order: [['number', 'ASC']],
        });

        res.json({
            rooms,
            dates,
            availability,
            floors
        });
    } catch (error) {
        console.error('Error fetching availability:', error);
        res.status(500).json({ message: 'Error al obtener disponibilidad' });
    }
};

// Mark room as clean (change from cleaning to available)
const markRoomAsClean = async (req, res) => {
    const t = await sequelize.transaction();

    try {
        const { id } = req.params;

        const room = await Room.findByPk(id, { transaction: t });
        if (!room) {
            await t.rollback();
            return res.status(404).json({ message: 'Habitación no encontrada' });
        }

        if (room.status !== 'cleaning') {
            await t.rollback();
            return res.status(400).json({ message: 'La habitación no está en estado de limpieza' });
        }

        // Find the most recent checked_out reservation for this room
        const reservation = await Reservation.findOne({
            where: {
                room_id: id,
                status: 'checked_out'
            },
            order: [['updatedAt', 'DESC']],
            transaction: t
        });

        // Mark reservation as completed
        if (reservation) {
            await reservation.update({ status: 'completed' }, { transaction: t });
        }

        // Mark room as available
        await room.update({ status: 'available' }, { transaction: t });

        await t.commit();

        res.json({ message: 'Habitación marcada como limpia y disponible. Reserva completada.' });
    } catch (error) {
        await t.rollback();
        console.error('Error marking room as clean:', error);
        res.status(500).json({ message: 'Error al marcar habitación como limpia' });
    }
};

// --- Floor Management ---
const deleteFloor = async (req, res) => {
    try {
        const { id } = req.params;
        const floor = await Floor.findByPk(id);

        if (!floor) {
            return res.status(404).json({ message: 'Piso no encontrado' });
        }

        // Check if there are rooms on this floor
        const roomsOnFloor = await Room.count({ where: { floor: floor.number } });
        if (roomsOnFloor > 0) {
            return res.status(400).json({ message: 'No se puede eliminar el piso porque tiene habitaciones asignadas.' });
        }

        await floor.destroy();
        res.json({ message: 'Piso eliminado exitosamente' });
    } catch (error) {
        console.error('Error deleting floor:', error);
        res.status(500).json({ message: 'Error deleting floor' });
    }
};

// --- Room Management ---
const updateRoom = async (req, res) => {
    try {
        const { id } = req.params;
        const { number, type, price_per_night, floor_id } = req.body;

        const room = await Room.findByPk(id);
        if (!room) {
            return res.status(404).json({ message: 'Habitación no encontrada' });
        }

        const updates = {};
        if (number) updates.number = number;
        if (type) updates.type = type;
        if (price_per_night) updates.price_per_night = price_per_night;

        // If floor_id is provided, look up the floor number to update the room's floor number
        if (floor_id) {
            const floor = await Floor.findByPk(floor_id);
            if (floor) {
                updates.floor = floor.number;
            }
        }

        await room.update(updates);
        res.json(room);
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ message: 'Numero de habitación ya existe' });
        }
        console.error('Error updating room:', error);
        res.status(500).json({ message: 'Error updating room' });
    }
};

const deleteRoom = async (req, res) => {
    try {
        const { id } = req.params;
        const room = await Room.findByPk(id);

        if (!room) {
            return res.status(404).json({ message: 'Habitación no encontrada' });
        }

        // Check for active reservations
        const activeReservations = await Reservation.count({
            where: {
                room_id: id,
                status: { [Op.in]: ['reserved', 'checked_in', 'checked_out', 'cleaning'] }
            }
        });

        if (activeReservations > 0) {
            return res.status(400).json({ message: 'No se puede eliminar la habitación porque tiene reservas activas o pendientes.' });
        }

        await room.destroy();
        res.json({ message: 'Habitación eliminada exitosamente' });
    } catch (error) {
        console.error('Error deleting room:', error);
        res.status(500).json({ message: 'Error deleting room' });
    }
};

module.exports = { getRooms, getAvailability, markRoomAsClean, getFloors, createFloor, deleteFloor, createRoom, updateRoom, deleteRoom };
