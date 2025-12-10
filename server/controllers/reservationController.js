const { Reservation, Guest, Room, Transaction, Product, StockMovement, sequelize } = require('../models');
const { Op } = require('sequelize');
const { sendCheckInNotification, sendCheckOutNotification } = require('../services/n8nService');

// Create Reservation (WITHOUT check-in)
const createReservation = async (req, res) => {
    const t = await sequelize.transaction();

    try {
        const {
            room_id,
            guest_name,
            guest_doc_number,
            guest_doc_type,
            start_date,
            end_date,
            prepaid_amount,
            notes,
            created_by,
            total_amount,
            reservation_type = 'night',
            start_time,
            end_time,
        } = req.body;

        // 1. Find or Create Guest (basic info only)
        let guest = await Guest.findOne({ where: { doc_number: guest_doc_number } });

        if (!guest) {
            guest = await Guest.create(
                {
                    name: guest_name,
                    doc_type: guest_doc_type || 'DNI',
                    doc_number: guest_doc_number,
                    visit_count: 0, // Will increment on check-in
                },
                { transaction: t }
            );
        }

        // 2. Get Room details
        const room = await Room.findByPk(room_id);
        if (!room) {
            await t.rollback();
            return res.status(404).json({ message: 'Habitación no encontrada' });
        }

        // 3. Check for conflicts
        const existingReservations = await Reservation.findAll({
            where: {
                room_id,
                status: { [Op.notIn]: ['cancelled', 'checked_out'] }, // Check active reservations
                [Op.or]: [
                    {
                        start_date: { [Op.between]: [start_date, end_date] },
                    },
                    {
                        end_date: { [Op.between]: [start_date, end_date] },
                    },
                    {
                        [Op.and]: [
                            { start_date: { [Op.lte]: start_date } },
                            { end_date: { [Op.gte]: end_date } },
                        ],
                    },
                ],
            },
        });

        // Conflict Logic (Simplified per User Request)
        // Rule 1: Night vs Night -> Strict Date Overlap
        // Rule 2: Hourly vs Hourly -> Time Overlap
        // Rule 3: Night vs Hourly -> ALLOWED (No conflict)

        for (const res of existingReservations) {
            // Case 1: Trying to create NIGHT
            if (reservation_type === 'night') {
                // Only conflict if existing is also NIGHT
                if (res.reservation_type === 'night') {
                    // Standard checkout/checkin overlap exception
                    if (res.end_date === start_date || res.start_date === end_date) continue;

                    await t.rollback();
                    return res.status(400).json({ message: 'Ya hay una reserva por noche para la misma fecha en esta habitacion' });
                }
                // Ignore HOURLY (per user rule)
            }

            // Case 2: Trying to create HOURLY
            if (reservation_type === 'hourly') {
                // No creation restrictions. Handled by Check-In Gate (Room Occupied check).
                // Multiple hourly reservations allowed per day.
            }
        }

        // 4. Calculate total amount if not provided
        let finalTotalAmount = total_amount;
        if (!finalTotalAmount) {
            if (reservation_type === 'night') {
                const start = new Date(start_date);
                const end = new Date(end_date);
                const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
                finalTotalAmount = nights * room.price_per_night;
            } else {
                // Hourly logic - for now default to 1 night price or maybe a fraction?
                // For now, default to room price (or 0 if not specified)
                finalTotalAmount = room.price_per_night;
            }
        }

        // Validate total_amount is not negative
        if (finalTotalAmount < 0) {
            await t.rollback();
            return res.status(400).json({ message: 'El monto total no puede ser negativo' });
        }

        // Generate sequential reservation code
        const lastReservation = await Reservation.findOne({
            order: [['createdAt', 'DESC']],
            transaction: t,
            paranoid: false // Include soft-deleted records to calculate next ID correctly
        });
        const nextId = lastReservation ? parseInt(lastReservation.reservation_code) + 1 : 1;
        const reservation_code = nextId.toString();

        // Create Reservation
        const newReservation = await Reservation.create(
            {
                reservation_code,
                room_id,
                guest_id: guest.id,
                start_date,
                end_date,
                reservation_type,
                start_time,
                end_time,
                total_amount: finalTotalAmount,
                prepaid_amount: prepaid_amount || 0,
                paid_amount: prepaid_amount || 0, // Initialize paid_amount with prepaid_amount
                status: 'reserved',
                notes,
                created_by,
            },
            { transaction: t }
        );

        // 5. Create Transaction if prepaid_amount > 0
        if (prepaid_amount && prepaid_amount > 0) {
            await Transaction.create({
                type: 'income',
                transaction_type: 'reservation_payment',
                category: 'Habitación',
                amount: prepaid_amount,
                method: 'cash', // Default to cash for initial reservation, or add param
                room_id: room_id,
                reservation_id: newReservation.id,
                description: `Adelanto Reserva #${reservation_code} - ${guest_name}`,
                date: new Date(),
                created_by: created_by
            }, { transaction: t });
        }

        await t.commit();

        res.status(201).json({
            message: 'Reserva creada exitosamente',
            reservation: newReservation,
            guest,
        });
    } catch (error) {
        if (!t.finished) await t.rollback();
        console.error('Error creating reservation:', error);
        res.status(500).json({ message: 'Error al crear reserva', error: error.message });
    }
};

// Check-in (for existing reservation)
const checkIn = async (req, res) => {
    const t = await sequelize.transaction();

    try {
        const { id } = req.params; // Reservation ID
        const { guest_phone, guest_email } = req.body;
        const idPhoto = req.file ? req.file.filename : null;

        // 1. Find Reservation
        const reservation = await Reservation.findByPk(id, {
            include: [Guest, Room],
        });

        if (!reservation) {
            await t.rollback();
            return res.status(404).json({ message: 'Reserva no encontrada' });
        }

        if (reservation.status !== 'reserved') {
            await t.rollback();
            return res.status(400).json({ message: 'La reserva ya fue procesada' });
        }

        // 2. Validate required fields
        if (!guest_phone || !guest_email || !idPhoto) {
            await t.rollback();
            return res.status(400).json({
                message: 'Foto de DNI, celular y correo electrónico son obligatorios para el check-in',
            });
        }

        // CHECK-IN GATE: Check if Room is already occupied OR dirty
        if (reservation.Room.status === 'occupied') {
            await t.rollback();
            return res.status(400).json({
                message: 'La habitación está OCUPADA. Debe realizar el Check-out de la reserva actual antes de ingresar una nueva.'
            });
        }

        if (reservation.Room.status === 'cleaning' || reservation.Room.status === 'checked_out') {
            await t.rollback();
            return res.status(400).json({
                message: 'La habitación está en LIMPIEZA. Debe marcarla como "Limpia" en el panel antes de realizar el Check-in.'
            });
        }

        // 3. Update Guest with complete info
        await Guest.update(
            {
                phone: guest_phone,
                email: guest_email,
                id_photo: idPhoto,
                visit_count: reservation.Guest.visit_count + 1,
                last_visit: new Date(),
            },
            { where: { id: reservation.guest_id }, transaction: t }
        );

        // 4. Update Reservation status to 'checked_in'
        await Reservation.update(
            { status: 'checked_in' },
            { where: { id }, transaction: t }
        );

        // 5. Update Room Status to 'occupied'
        await Room.update(
            { status: 'occupied' },
            { where: { id: reservation.room_id }, transaction: t }
        );

        await t.commit();

        // 6. Reload reservation with updated data
        const updatedReservation = await Reservation.findByPk(id, {
            include: [Guest, Room],
        });

        // 7. Trigger N8N Webhook (After commit, non-blocking)
        sendCheckInNotification(
            {
                name: updatedReservation.Guest.name,
                phone: guest_phone,
                email: guest_email,
                visit_count: updatedReservation.Guest.visit_count,
                doc_number: updatedReservation.Guest.doc_number,
            },
            {
                room_number: updatedReservation.Room.number,
                start_date: updatedReservation.start_date,
                end_date: updatedReservation.end_date,
            }
        ).catch(err => console.error('[N8N] Failed to send check-in notification:', err));

        res.status(200).json({
            message: 'Check-in exitoso',
            reservation: updatedReservation,
        });
    } catch (error) {
        await t.rollback();
        console.error('Error during check-in:', error);
        res.status(500).json({ message: 'Error al hacer check-in', error: error.message });
    }
};

// Update Reservation
const updateReservation = async (req, res) => {
    const t = await sequelize.transaction();

    try {
        const { id } = req.params;
        const {
            room_id,
            guest_name,
            guest_doc_number,
            start_date,
            end_date,
            total_amount,
            notes,
        } = req.body;

        const reservation = await Reservation.findByPk(id, { include: [Guest, Room] });

        if (!reservation) {
            await t.rollback();
            return res.status(404).json({ message: 'Reserva no encontrada' });
        }

        // Validate total_amount is not negative
        if (total_amount !== undefined && total_amount < 0) {
            await t.rollback();
            return res.status(400).json({ message: 'El monto total no puede ser negativo' });
        }

        // Get user role from request (assuming it's attached by auth middleware)
        const userRole = req.user?.role || 'counter';
        const userName = req.user?.name || req.user?.username || 'Usuario';

        // Track changes for email notification
        const changedFields = [];

        // Role-based permission check
        if (userRole === 'counter') {
            // Counter can ONLY edit: end_date, total_amount, notes
            if (room_id && room_id !== reservation.room_id) {
                await t.rollback();
                return res.status(403).json({ message: 'Counter no puede cambiar la habitación' });
            }
            if (guest_name && guest_name !== reservation.Guest.name) {
                await t.rollback();
                return res.status(403).json({ message: 'Counter no puede cambiar el nombre del huésped' });
            }
            if (guest_doc_number && guest_doc_number !== reservation.Guest.doc_number) {
                await t.rollback();
                return res.status(403).json({ message: 'Counter no puede cambiar el DNI del huésped' });
            }
            if (start_date && start_date !== reservation.start_date) {
                await t.rollback();
                return res.status(403).json({ message: 'Counter no puede cambiar la fecha de entrada' });
            }
        }

        // Update Guest Info (Admin only)
        if (userRole === 'admin' && (guest_name || guest_doc_number)) {
            if (guest_name && guest_name !== reservation.Guest.name) {
                changedFields.push({
                    field: 'Nombre del Huésped',
                    old_value: reservation.Guest.name,
                    new_value: guest_name,
                });
            }
            if (guest_doc_number && guest_doc_number !== reservation.Guest.doc_number) {
                changedFields.push({
                    field: 'DNI del Huésped',
                    old_value: reservation.Guest.doc_number,
                    new_value: guest_doc_number,
                });
            }

            await Guest.update(
                {
                    name: guest_name || reservation.Guest.name,
                    doc_number: guest_doc_number || reservation.Guest.doc_number,
                },
                { where: { id: reservation.guest_id }, transaction: t }
            );
        }

        // Track reservation changes
        if (room_id && room_id !== reservation.room_id) {
            const newRoom = await Room.findByPk(room_id);
            changedFields.push({
                field: 'Habitación',
                old_value: `#${reservation.Room.number} (${reservation.Room.type})`,
                new_value: `#${newRoom.number} (${newRoom.type})`,
            });
        }
        if (start_date && start_date !== reservation.start_date) {
            changedFields.push({
                field: 'Fecha de Entrada',
                old_value: reservation.start_date,
                new_value: start_date,
            });
        }
        if (end_date && end_date !== reservation.end_date) {
            changedFields.push({
                field: 'Fecha de Salida',
                old_value: reservation.end_date,
                new_value: end_date,
            });
        }
        if (total_amount !== undefined && total_amount !== reservation.total_amount) {
            changedFields.push({
                field: 'Precio Total',
                old_value: `S/ ${reservation.total_amount}`,
                new_value: `S/ ${total_amount}`,
            });
        }
        if (notes && notes !== reservation.notes) {
            changedFields.push({
                field: 'Notas',
                old_value: reservation.notes || '(vacío)',
                new_value: notes,
            });
        }

        // Update Reservation Info
        await Reservation.update(
            {
                room_id: room_id || reservation.room_id,
                start_date: start_date || reservation.start_date,
                end_date: end_date || reservation.end_date,
                total_amount: total_amount !== undefined ? total_amount : reservation.total_amount,
                notes: notes !== undefined ? notes : reservation.notes,
            },
            { where: { id }, transaction: t }
        );

        await t.commit();

        const updatedReservation = await Reservation.findByPk(id, {
            include: [Guest, Room],
        });

        // Send email notification if there were changes
        if (changedFields.length > 0) {
            const { sendReservationUpdateNotification } = require('../services/n8nService');
            sendReservationUpdateNotification(
                updatedReservation.reservation_code,
                changedFields,
                userName
            ).catch(err => console.error('[N8N] Failed to send reservation update notification:', err));
        }

        res.json({
            message: 'Reserva actualizada exitosamente',
            reservation: updatedReservation,
        });
    } catch (error) {
        await t.rollback();
        console.error('Error updating reservation:', error);
        res.status(500).json({ message: 'Error al actualizar reserva' });
    }
};

// Get all reservations (Active only by default, or filtered)
const getReservations = async (req, res) => {
    try {
        const { status, start_date, end_date, guest_doc_number } = req.query;
        const userRole = req.user?.role || 'counter';
        console.log('getReservations - User:', req.user?.username, 'Role:', userRole);

        // Build where clause
        let where = {};

        // Status filter
        if (status) {
            where.status = status;
        } else {
            // Admin sees all reservations, Counter only sees active ones
            if (userRole !== 'admin') {
                where.status = {
                    [Op.in]: ['reserved', 'checked_in']
                };
            }
        }

        // Date range filter
        if (start_date && end_date) {
            where[Op.or] = [
                {
                    // Reservation starts within the range
                    start_date: {
                        [Op.between]: [start_date, end_date],
                    },
                },
                {
                    // Reservation ends within the range
                    end_date: {
                        [Op.between]: [start_date, end_date],
                    },
                },
                {
                    // Reservation spans the entire range
                    [Op.and]: [
                        { start_date: { [Op.lte]: start_date } },
                        { end_date: { [Op.gte]: end_date } },
                    ],
                },
            ];
        }

        // Guest include for DNI filter
        const guestInclude = {
            model: Guest,
            as: 'Guest',
        };

        if (guest_doc_number) {
            guestInclude.where = {
                doc_number: {
                    [Op.like]: `%${guest_doc_number}%`
                }
            };
        }

        const reservations = await Reservation.findAll({
            where,
            include: [
                guestInclude,
                {
                    model: Room,
                    as: 'Room',
                },
            ],
            order: [['createdAt', 'DESC']],
        });

        // Calculate consumption_total for each reservation
        const reservationsWithConsumptions = await Promise.all(
            reservations.map(async (reservation) => {
                // Get room_charge transactions for this reservation
                const consumptions = await Transaction.findAll({
                    where: {
                        reservation_id: reservation.id,
                        method: 'room_charge'
                    }
                });

                const consumption_total = consumptions.reduce(
                    (sum, t) => sum + parseFloat(t.amount),
                    0
                );

                console.log(`[getReservations] Reservation ${reservation.id}, consumption_total: ${consumption_total}`);

                // Add consumption_total to the reservation object
                const reservationData = reservation.toJSON();
                reservationData.consumption_total = consumption_total;

                return reservationData;
            })
        );

        console.log(`[getReservations] Returning ${reservationsWithConsumptions.length} reservations`);
        console.log(`[getReservations] First reservation consumption_total:`, reservationsWithConsumptions[0]?.consumption_total);

        res.json(reservationsWithConsumptions);
    } catch (error) {
        console.error('Error fetching reservations:', error);
        res.status(500).json({ message: 'Error al obtener reservas' });
    }
};

// Get reservation by ID
const getReservationById = async (req, res) => {
    try {
        const { id } = req.params;
        const reservation = await Reservation.findByPk(id, {
            include: [
                { model: Guest },
                { model: Room },
                { model: Transaction },
            ],
        });

        if (!reservation) {
            return res.status(404).json({ message: 'Reserva no encontrada' });
        }

        // Calculate consumption_total from room_charge transactions
        const consumptions = await Transaction.findAll({
            where: {
                reservation_id: id,
                method: 'room_charge'
            }
        });

        const consumption_total = consumptions.reduce(
            (sum, t) => sum + parseFloat(t.amount),
            0
        );

        console.log(`[getReservationById] ID: ${id}, consumption_total: ${consumption_total}`);

        // Add consumption_total to the reservation response
        const reservationData = reservation.toJSON();
        reservationData.consumption_total = consumption_total;

        res.json(reservationData);
    } catch (error) {
        console.error('Error fetching reservation:', error);
        res.status(500).json({ message: 'Error al obtener reserva' });
    }
};

// Checkout Reservation
const checkoutReservation = async (req, res) => {
    const t = await sequelize.transaction();

    try {
        const { id } = req.params;

        const reservation = await Reservation.findByPk(id, {
            include: [Guest, Room],
        });

        if (!reservation) {
            await t.rollback();
            return res.status(404).json({ message: 'Reserva no encontrada' });
        }

        // Calculate dynamic total: Base Reservation Cost + Room Charges
        const transactions = await Transaction.findAll({
            where: {
                reservation_id: id,
                method: 'room_charge'
            },
            transaction: t
        });

        const consumptionTotal = transactions.reduce((sum, tr) => sum + parseFloat(tr.amount), 0);
        const grandTotal = parseFloat(reservation.total_amount) + consumptionTotal;
        const paidAmount = parseFloat(reservation.paid_amount || 0);
        const debe = grandTotal - paidAmount;

        if (debe > 0.01) { // Allow small floating point differences
            await t.rollback();
            return res.status(400).json({
                message: `No se puede hacer check-out. El cliente debe S/ ${debe.toFixed(2)} (Reserva: ${reservation.total_amount}, Consumos: ${consumptionTotal.toFixed(2)}, Pagado: ${paidAmount.toFixed(2)})`,
                debe: debe.toFixed(2),
            });
        }

        // Update reservation status
        await Reservation.update(
            { status: 'checked_out' },
            { where: { id }, transaction: t }
        );

        // Update room status to cleaning
        await Room.update(
            { status: 'cleaning' },
            { where: { id: reservation.room_id }, transaction: t }
        );

        await t.commit();

        // Trigger N8N Webhook (After commit, non-blocking)
        sendCheckOutNotification(
            {
                name: reservation.Guest.name,
                phone: reservation.Guest.phone,
            },
            {
                room_number: reservation.Room.number,
            }
        ).catch(err => console.error('[N8N] Failed to send check-out notification:', err));

        res.json({ message: 'Check-out exitoso' });
    } catch (error) {
        await t.rollback();
        console.error('Error during checkout:', error);
        res.status(500).json({ message: 'Error al hacer check-out' });
    }
};

// Add payment to reservation
const addPayment = async (req, res) => {
    const t = await sequelize.transaction();

    try {
        const { id } = req.params;
        const { amount, payment_method, description, payment_evidence } = req.body;
        const paymentAmount = parseFloat(amount);

        const reservation = await Reservation.findByPk(id);

        if (!reservation) {
            await t.rollback();
            return res.status(404).json({ message: 'Reserva no encontrada' });
        }

        if (!Number.isInteger(paymentAmount) || paymentAmount <= 0) {
            await t.rollback();
            return res.status(400).json({ message: 'El monto debe ser un número entero positivo.' });
        }

        // --- STEP 1: FETCH DATA & IMMEDIATE PAYMENTS ---
        const roomCost = parseFloat(reservation.total_amount);

        const allTransactions = await Transaction.findAll({
            where: { reservation_id: id },
            transaction: t
        });

        // Calculate Totals (CHARGES)
        const makCharges = allTransactions.filter(t => t.method === 'room_charge' && t.transaction_type === 'venta_mak')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);

        const makalaCharges = allTransactions.filter(t => t.method === 'room_charge' && t.transaction_type !== 'venta_mak')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);

        const totalDebt = roomCost + makCharges + makalaCharges;
        const currentTotalPaid = parseFloat(reservation.paid_amount || 0);

        // Validation
        if ((currentTotalPaid + paymentAmount) > totalDebt + 0.1) {
            await t.rollback();
            return res.status(400).json({ message: `El pago excede la deuda total.` });
        }

        // --- STEP 2: CALCULATE "NET BUCKETS" (Debts NOT covered by immediate payments) ---
        // Immediate payments are those with specific types created during "Pay Now" flow.
        const immediateMakPayments = allTransactions.filter(t => t.category === 'Pago Inmediato (Venta Mak)')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);

        const immediateMakalaPayments = allTransactions.filter(t => t.category === 'Pago Inmediato (Venta Makala)')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);

        // The "Net" capacity of each bucket that must be filled by "Generic" payments
        // Room Bucket is always full size (unless we had immediate room payments, which we don't usually)
        const netRoomBucketSize = roomCost;
        const netMakBucketSize = Math.max(0, makCharges - immediateMakPayments);
        const netMakalaBucketSize = Math.max(0, makalaCharges - immediateMakalaPayments);

        // --- STEP 3: CALCULATE "GENERIC PAID" (Pool of money available for split) ---
        // Total Paid includes Immediate Payments. We must subtract them to find the "Generic" pool.
        const totalImmediatePaid = immediateMakPayments + immediateMakalaPayments;
        const currentGenericPaid = Math.max(0, currentTotalPaid - totalImmediatePaid);

        // This payment is purely Generic
        const newGenericPaidStart = currentGenericPaid;
        const newGenericPaidEnd = currentGenericPaid + paymentAmount;

        // --- STEP 4: DISTRIBUTE ACROSS NET BUCKETS ---
        // Timeline: [Room] -> [NetMak] -> [NetMakala]
        const roomEnd = netRoomBucketSize;
        const makEnd = roomEnd + netMakBucketSize;
        const makalaEnd = makEnd + netMakalaBucketSize;

        let roomPayment = 0;
        let makPayment = 0;
        let makalaPayment = 0;

        // Overlap with Room
        if (newGenericPaidStart < roomEnd) {
            roomPayment = Math.min(newGenericPaidEnd, roomEnd) - newGenericPaidStart;
        }

        // Overlap with Mak
        if (newGenericPaidStart < makEnd && newGenericPaidEnd > roomEnd) {
            const start = Math.max(newGenericPaidStart, roomEnd);
            const end = Math.min(newGenericPaidEnd, makEnd);
            makPayment = end - start;
        }

        // Overlap with Makala
        if (newGenericPaidEnd > makEnd) {
            const start = Math.max(newGenericPaidStart, makEnd);
            const end = Math.min(newGenericPaidEnd, makalaEnd);
            makalaPayment = end - start;
        }

        // --- STEP 5: CREATE TRANSACTIONS ---
        const commonData = {
            reservation_id: id,
            room_id: reservation.room_id,
            type: 'income',
            method: payment_method,
            payment_evidence: payment_evidence || null,
            date: new Date(),
            created_by: req.user?.id
        };

        if (roomPayment > 0.001) {
            await Transaction.create({ ...commonData, transaction_type: 'reservation_payment', category: 'Pago Reserva (Habitación)', amount: roomPayment, description: description || `Pago Habitación` }, { transaction: t });
        }
        if (makPayment > 0.001) {
            await Transaction.create({ ...commonData, transaction_type: 'reservation_payment', category: 'Pago Venta Mak', amount: makPayment, description: `Pago Consumo Mak (Diferido)` }, { transaction: t });
        }
        if (makalaPayment > 0.001) {
            await Transaction.create({ ...commonData, transaction_type: 'reservation_payment', category: 'Pago Venta Makala', amount: makalaPayment, description: `Pago Consumo Makala (Diferido)` }, { transaction: t });
        }

        // Update Total
        await Reservation.update(
            { paid_amount: currentTotalPaid + paymentAmount },
            { where: { id }, transaction: t }
        );

        await t.commit();
        res.json({ message: 'Pago registrado y clasificado exitosamente' });

    } catch (error) {
        await t.rollback();
        console.error('Error adding payment:', error);
        res.status(500).json({ message: 'Error al registrar pago' });
    }
};


// Delete Reservation (Admin only)
const deleteReservation = async (req, res) => {
    const t = await sequelize.transaction();

    try {
        const { id } = req.params;

        const reservation = await Reservation.findByPk(id);

        if (!reservation) {
            await t.rollback();
            return res.status(404).json({ message: 'Reserva no encontrada' });
        }

        // Prevent deletion of checked-in reservations
        if (reservation.status === 'checked_in') {
            await t.rollback();
            return res.status(400).json({
                message: 'No se puede eliminar una reserva con huésped hospedado. Realice el check-out primero.',
            });
        }

        // Delete reservation (Soft delete due to paranoid: true)
        // DO NOT delete transactions per user request
        await Reservation.destroy({
            where: { id },
            transaction: t
        });

        await t.commit();
        res.json({ message: 'Reserva eliminada exitosamente' });
    } catch (error) {
        if (!t.finished) await t.rollback();
        console.error('Error deleting reservation:', error);
        res.status(500).json({ message: 'Error al eliminar reserva' });
    }
};



// Validate DNI with N8N
const validateDNI = async (req, res) => {
    try {
        const { expected_dni } = req.body;
        const imageFile = req.file;

        if (!imageFile || !expected_dni) {
            return res.status(400).json({
                success: false,
                error: 'Imagen y número de DNI esperado son requeridos'
            });
        }

        const { validateDNI: validateDNIWithN8N } = require('../services/n8nService');
        const fs = require('fs');

        // Read file buffer
        const imageBuffer = fs.readFileSync(imageFile.path);

        // Call N8N service
        const result = await validateDNIWithN8N(imageBuffer, expected_dni);

        // Clean up temp file
        fs.unlinkSync(imageFile.path);

        if (result.success) {
            res.json(result);
        } else {
            res.json({
                success: false,
                error: result.error || 'Validación de DNI fallida',
                extractedDNI: result.extractedDNI
            });
        }
    } catch (error) {
        console.error('Error in validateDNI controller:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor al validar DNI'
        });
    }
};

// Add Consumption to Reservation
const addConsumption = async (req, res) => {
    const t = await sequelize.transaction();

    try {
        const { id } = req.params;
        const { products, description } = req.body;
        const userId = req.user?.id || null;

        const reservation = await Reservation.findByPk(id);

        if (!reservation) {
            await t.rollback();
            return res.status(404).json({ message: 'Reserva no encontrada' });
        }

        // Validate Status
        if (['cancelled', 'completed', 'checked_out'].includes(reservation.status)) {
            await t.rollback();
            return res.status(400).json({ message: 'Solo se pueden agregar consumos a reservas activas' });
        }

        let totalAmount = 0;

        // 1. Validate Stock first (all or nothing)
        for (const item of products) {
            const product = await Product.findByPk(item.id);
            if (!product) throw new Error(`Producto ${item.id} no encontrado`);
            if (product.stock < item.quantity) throw new Error(`Stock insuficiente para ${product.name}`);
            totalAmount += item.price * item.quantity;
        }

        // 2. Create Transaction
        const transaction = await Transaction.create({
            reservation_id: id,
            room_id: reservation.room_id,
            type: 'income',
            transaction_type: 'venta_makala', // Or similar
            category: 'Restobar',
            amount: totalAmount,
            method: 'room_charge',
            products: JSON.stringify(products),
            description: description || `Consumo - Reserva #${reservation.reservation_code}`,
            created_by: userId,
            date: new Date()
        }, { transaction: t });

        // 3. Update Stock & Create Movements
        for (const item of products) {
            await Product.decrement('stock', {
                by: item.quantity,
                where: { id: item.id },
                transaction: t
            });

            await StockMovement.create({
                product_id: item.id,
                type: 'out',
                quantity: item.quantity,
                reason: 'sale',
                reference_type: 'transaction',
                reference_id: transaction.id,
                created_by: userId,
                notes: `Venta Habitación ${reservation.reservation_code}`
            }, { transaction: t });
        }

        await t.commit();
        res.status(200).json({ message: 'Consumo agregado exitosamente', transaction });

    } catch (error) {
        await t.rollback();
        console.error('Add Consumption Error:', error);
        res.status(400).json({ message: error.message || 'Error al procesar consumo' });
    }
};

module.exports = {
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
};
