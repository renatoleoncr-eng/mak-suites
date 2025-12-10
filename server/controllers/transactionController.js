const { Transaction, Room, Product, User, StockMovement, Reservation } = require('../models');
const { sequelize } = require('../models');
const { Op } = require('sequelize');

// Get Transactions with filters
const getTransactions = async (req, res) => {
    try {
        const { startDate, endDate, type, transaction_type } = req.query;
        const where = {};

        if (startDate && endDate) {
            // Parse dates in Lima timezone (UTC-5)
            const start = new Date(startDate + 'T00:00:00-05:00');
            const end = new Date(endDate + 'T23:59:59-05:00');
            where.date = { [Op.between]: [start, end] };
        }

        if (type) where.type = type;
        if (transaction_type) where.transaction_type = transaction_type;

        const transactions = await Transaction.findAll({
            where,
            order: [['date', 'DESC']],
            include: [
                { model: Room, attributes: ['number'] },
                { model: User, as: 'Creator', attributes: ['name', 'username', 'role'] }
            ]
        });
        res.json(transactions);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ message: 'Error al obtener transacciones', error: error.message });
    }
};

// Helper to find active reservation for a room
const findActiveReservation = async (roomId) => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

    // STRICT RULE: Consumption must be linked to a reservation active TODAY.
    // Update: If status is 'checked_in', TRUST THE STATUS. The guest is there.
    // Date checks are only needed if we were looking for 'reserved' to auto-check-in or similar.
    return await Reservation.findOne({
        where: {
            room_id: roomId,
            status: 'checked_in'
        },
        order: [['start_date', 'DESC']]
    });
};

// Create Venta Makala (Ingreso vinculado a habitación)
const createVentaMakala = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { room_id, amount, method, description, payment_evidence } = req.body;

        if (amount <= 0) {
            await t.rollback();
            return res.status(400).json({ message: 'El monto debe ser mayor a 0.' });
        }

        let reservationId = null;
        if (room_id) {
            const reservation = await findActiveReservation(room_id);
            if (reservation) {
                reservationId = reservation.id;
            } else if (method === 'room_charge') {
                await t.rollback();
                return res.status(400).json({ message: 'No hay reserva activa para cargar a la habitación.' });
            }
        }

        // Logic: If sold to a room but paid immediately (Cash/Card/Etc), split into Charge + Payment
        // 1. The Sale (Charge to Room)
        const saleMethod = room_id ? 'room_charge' : method;

        const transaction = await Transaction.create({
            type: saleMethod === 'room_charge' ? 'charge' : 'income',
            transaction_type: 'venta_makala',
            category: 'Venta Makala',
            room_id,
            reservation_id: reservationId,
            amount,
            method: saleMethod, // Forced to room_charge if room exists
            description,
            payment_evidence: method === 'room_charge' ? null : payment_evidence,
            created_by: req.user?.id,
            date: new Date(),
        }, { transaction: t });

        // 2. The Immediate Payment (If room exists and method wasn't already room_charge)
        if (room_id && method !== 'room_charge' && reservationId) {
            await Transaction.create({
                type: 'income',
                transaction_type: 'reservation_payment',
                category: 'Pago Inmediato (Venta Makala)',
                room_id,
                reservation_id: reservationId,
                amount,
                method: method, // The actual payment method (Cash, Card, etc.)
                description: `Pago por consumo: ${description || 'Venta Makala'}`,
                payment_evidence,
                created_by: req.user?.id,
                date: new Date(),
            }, { transaction: t });

            // Note: We don't update reservation.paid_amount here because we rely on summing transactions dynamically or a separate hook. 
            // If the system relies on the 'paid_amount' column in Reservation, we should update it. 
            // Assuming current system might calculate valid balance from transactions, but let's be safe.
            // Actually, ReservationManager calculates paidAmount from activeReservation.paid_amount usually derived from DB columns if they exist.
            // Let's update the reservation totals just in case.
            await Reservation.increment(
                { paid_amount: amount },
                { where: { id: reservationId }, transaction: t }
            );
        }

        await t.commit();
        res.status(201).json(transaction);
    } catch (error) {
        await t.rollback();
        console.error('Error creating Venta Makala:', error);
        res.status(500).json({ message: 'Error al registrar Venta Makala', error: error.message });
    }
};

// Create Venta Mak (Venta de productos con descuento de stock)
const createVentaMak = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { products, method, description, payment_evidence, room_id } = req.body; // products: [{id, quantity, price}]

        if (!products || products.length === 0) {
            await t.rollback();
            return res.status(400).json({ message: 'No hay productos seleccionados.' });
        }

        let totalAmount = 0;
        const productDetails = [];

        // Validate stock and calculate total
        for (const item of products) {
            if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
                throw new Error(`La cantidad para el producto ID ${item.id} debe ser un entero positivo.`);
            }
            const product = await Product.findByPk(item.id, { transaction: t });
            if (!product) {
                throw new Error(`Producto ID ${item.id} no encontrado`);
            }
            if (product.stock < item.quantity) {
                throw new Error(`Stock insuficiente para ${product.name}`);
            }

            totalAmount += item.price * item.quantity;
            productDetails.push({
                product_id: product.id,
                name: product.name,
                quantity: item.quantity,
                price: item.price
            });

            // Update stock
            await product.update({ stock: product.stock - item.quantity }, { transaction: t });

            // Create stock movement for this sale
            await StockMovement.create({
                product_id: product.id,
                type: 'out',
                quantity: item.quantity,
                reason: 'sale',
                notes: `Venta Mak - ${description || 'Sin descripción'}`,
                created_by: req.user?.id,
            }, { transaction: t });
        }

        let reservationId = null;
        if (room_id) {
            const reservation = await findActiveReservation(room_id);
            if (reservation) {
                reservationId = reservation.id;
            } else if (method === 'room_charge') {
                await t.rollback();
                return res.status(400).json({ message: 'No hay reserva activa para cargar a la habitación.' });
            }
        }

        // Logic: Split into Charge + Payment if to room but paid now
        const saleMethod = room_id ? 'room_charge' : method;

        // Create Transaction
        const transaction = await Transaction.create({
            type: saleMethod === 'room_charge' ? 'charge' : 'income',
            transaction_type: 'venta_mak',
            category: 'Venta Mak',
            room_id: room_id || null,
            reservation_id: reservationId,
            amount: totalAmount,
            method: saleMethod,
            description,
            payment_evidence: method === 'room_charge' ? null : payment_evidence,
            products: JSON.stringify(productDetails),
            created_by: req.user?.id,
            date: new Date(),
        }, { transaction: t });

        // Payment Transaction
        if (room_id && method !== 'room_charge' && reservationId) {
            await Transaction.create({
                type: 'income',
                transaction_type: 'reservation_payment',
                category: 'Pago Inmediato (Venta Mak)',
                room_id,
                reservation_id: reservationId,
                amount: totalAmount,
                method: method,
                description: `Pago por consumo: ${description || 'Venta Mak'}`,
                payment_evidence,
                created_by: req.user?.id,
                date: new Date(),
            }, { transaction: t });

            await Reservation.increment(
                { paid_amount: totalAmount },
                { where: { id: reservationId }, transaction: t }
            );
        }

        await t.commit();
        res.status(201).json(transaction);
    } catch (error) {
        await t.rollback();
        console.error('Error creating Venta Mak:', error);
        res.status(500).json({ message: error.message || 'Error al registrar Venta Mak' });
    }
};

// Create Egreso (Solo efectivo)
// Create Egreso (Solo efectivo)
const createEgreso = async (req, res) => {
    try {
        const { amount, category, description } = req.body;

        if (amount <= 0) {
            return res.status(400).json({ message: 'El monto debe ser mayor a 0.' });
        }

        const transaction = await Transaction.create({
            type: 'expense',
            transaction_type: 'egreso',
            category, // Salarios, Mantenimiento, etc.
            amount,
            method: 'cash', // Always cash for expenses as per requirement
            description,
            created_by: req.user?.id,
            date: new Date(),
        });

        res.status(201).json(transaction);
    } catch (error) {
        console.error('Error creating Egreso:', error);
        res.status(500).json({ message: 'Error al registrar egreso', error: error.message });
    }
};

// Update Transaction (Admin only)
const updateTransaction = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { amount, method, description, date, products } = req.body;

        const transaction = await Transaction.findByPk(id, { transaction: t });
        if (!transaction) {
            await t.rollback();
            return res.status(404).json({ message: 'Transacción no encontrada' });
        }

        // 1. Handle Stock Adjustments for Venta Mak
        if (transaction.transaction_type === 'venta_mak') {
            const oldProducts = typeof transaction.products === 'string' ? JSON.parse(transaction.products) : transaction.products;

            // If products are being updated (even if just same products but QTY changed, we treat as full reversal + new sale for safety and logging)
            if (products) {
                // A. Revert OLD stock (Credit/Return)
                for (const item of oldProducts) {
                    const product = await Product.findByPk(item.product_id, { transaction: t });
                    if (product) {
                        await product.increment({ stock: item.quantity }, { transaction: t });
                        await StockMovement.create({
                            product_id: product.id,
                            type: 'in',
                            quantity: item.quantity,
                            reason: 'correction',
                            notes: `Devolución/Corrección por edición de Venta #${transaction.id}`,
                            created_by: req.user?.id,
                        }, { transaction: t });
                    }
                }

                // B. Deduct NEW stock (Debit/Sale)
                const newProductDetails = [];
                let newTotalAmount = 0;

                for (const item of products) {
                    // item: { id, quantity, price, name } - Input might be slightly different from stored structure
                    // We expect input products to have { id, quantity } at minimum.

                    if (item.quantity > 0) {
                        const product = await Product.findByPk(item.id || item.product_id, { transaction: t });
                        if (!product) throw new Error(`Producto ID ${item.id} no encontrado`);

                        if (product.stock < item.quantity) {
                            throw new Error(`Stock insuficiente para ${product.name} (Requerido: ${item.quantity}, Disponible: ${product.stock})`);
                        }

                        await product.decrement({ stock: item.quantity }, { transaction: t });
                        await StockMovement.create({
                            product_id: product.id,
                            type: 'out',
                            quantity: item.quantity,
                            reason: 'sale',
                            notes: `Venta Mak (Editada) #${transaction.id}`,
                            created_by: req.user?.id,
                        }, { transaction: t });

                        const price = parseFloat(item.price); // Use current price or passed price? Usually passed to allow overrides or keep original price.
                        newTotalAmount += price * item.quantity;

                        newProductDetails.push({
                            product_id: product.id,
                            name: product.name,
                            quantity: item.quantity,
                            price: price
                        });
                    }
                }

                // Update transaction data fields with new calculation
                transaction.products = JSON.stringify(newProductDetails);
                transaction.amount = newTotalAmount;
            }
        }

        // 2. Standard Updates (for amount override if not auto-calc, method, desc)
        // If it was a 'venta_mak' and we passed products, amount is already updated above. 
        // If manual amount passed for other types, use it.
        if (transaction.transaction_type !== 'venta_mak' || !products) {
            if (amount !== undefined) transaction.amount = parseFloat(amount);
        }

        if (method) transaction.method = method;
        if (description) transaction.description = description;
        if (date) transaction.date = new Date(date);

        await transaction.save({ transaction: t });

        // 3. Sync Reservation (if applicable)
        // Only if it's a direct payment (reservation_payment). 
        // For 'charge' (venta_mak/makala linked to room), we don't update 'paid_amount', but the 'consumption_total' is dynamic so it self-corrects.
        if (transaction.transaction_type === 'reservation_payment' && transaction.reservation_id) {
            // We need to Recalculate Total Paid for this reservation to be safe, rather than incrementing diffs which can drift.
            const totalPaid = await Transaction.sum('amount', {
                where: {
                    reservation_id: transaction.reservation_id,
                    transaction_type: 'reservation_payment'
                },
                transaction: t
            });

            await Reservation.update(
                { paid_amount: totalPaid || 0 },
                { where: { id: transaction.reservation_id }, transaction: t }
            );
        }

        await t.commit();
        res.json(transaction);
    } catch (error) {
        await t.rollback();
        console.error('Error updating transaction:', error);
        res.status(500).json({ message: 'Error al actualizar registro', error: error.message });
    }
};

module.exports = {
    getTransactions,
    createVentaMakala,
    createVentaMak,
    createEgreso,
    updateTransaction
};
