const { Transaction, Reservation, Room, Guest, sequelize } = require('./models');
const { Op } = require('sequelize');

async function testScenario() {
    const t = await sequelize.transaction();
    try {
        console.log('--- STARTING PAYMENT SPLIT VERIFICATION (Direct DB) ---');

        // 1. Setup: Room 201 (Simulated)
        let room = await Room.findOne({ where: { number: '201' } });
        if (!room) {
            room = await Room.create({ number: '201', type: 'single', price: 100, status: 'available' }, { transaction: t });
        }

        let guest = await Guest.findOne();
        if (!guest) {
            guest = await Guest.create({ name: 'Test Guest', dni: '99999999', email: 'test@test.com' }, { transaction: t });
        }

        // 2. Create Reservation
        const reservation = await Reservation.create({
            room_id: room.id,
            guest_id: guest.id,
            start_date: new Date(),
            end_date: new Date(Date.now() + 86400000),
            total_amount: 100, // ROOM DEBT
            status: 'checked_in',
            paid_amount: 0,
            reservation_code: 'TEST-' + Date.now()
        }, { transaction: t });

        console.log(`Created Reservation ${reservation.id} (Debt: 100)`);

        // 3. Add Charges
        // Venta Mak (Stock) - 30
        await Transaction.create({
            reservation_id: reservation.id,
            room_id: room.id,
            type: 'charge',
            transaction_type: 'venta_mak',
            method: 'room_charge',
            category: 'Consumo Venta Mak', // Added category
            amount: 30,
            description: 'Soda & Chips',
            products: JSON.stringify([{ name: 'Soda', price: 30 }]),
            date: new Date()
        }, { transaction: t });

        // Venta Makala (Service) - 20
        await Transaction.create({
            reservation_id: reservation.id,
            room_id: room.id,
            type: 'charge',
            transaction_type: 'venta_makala',
            method: 'room_charge',
            category: 'Consumo Venta Makala', // Added category
            amount: 20,
            description: 'Laundry',
            date: new Date()
        }, { transaction: t });

        console.log('Added Charges: Mak (30), Makala (20). Total Debt should be 150.');

        // COMMIT SETUP so we can call the API or Controller function?
        // Actually, we want to test `addPayment` logic.
        // We can import the controller function, but it expects req, res.
        // Better to use axios strictly for the PAYMENT call, but against localhost.
        // OR mock req/res.
        // Let's use axios for the payment call because that runs the actual logic we modified.
        // The DB setup is done.

        await t.commit();
        console.log('Setup Committed. Calling API...');

        const axios = require('axios');
        const API_URL = 'http://localhost:3000/api';

        // 4. Pay 120
        try {
            await axios.post(`${API_URL}/reservations/${reservation.id}/payment`, {
                amount: 120,
                payment_method: 'cash',
                description: 'Partial Payment Test'
            });
            console.log('Payment 120 Success.');
        } catch (e) {
            console.error('Payment 120 Failed:', e.response?.data || e.message);
            return;
        }

        // 5. Verification
        const transactions = await Transaction.findAll({
            where: {
                reservation_id: reservation.id,
                type: 'income',
                transaction_type: 'reservation_payment'
            }
        });

        const paidRoom = transactions.find(t => t.category === 'Pago Reserva (Habitación)')?.amount;
        const paidMak = transactions.find(t => t.category === 'Pago Venta Mak')?.amount;
        const paidMakala = transactions.find(t => t.category === 'Pago Venta Makala')?.amount; // Should be undefined/0

        console.log(`Transactions found: Room=${paidRoom}, Mak=${paidMak}, Makala=${paidMakala}`);

        if (parseFloat(paidRoom) === 100 && parseFloat(paidMak) === 20) {
            console.log('✅ SUCCESS: Split 1 Correct (100 Room, 20 Mak).');
        } else {
            console.error(`❌ FAILURE: Expected 100/20. Got Room=${paidRoom}, Mak=${paidMak}`);
        }

        // 6. Pay Remaining 30
        try {
            await axios.post(`${API_URL}/reservations/${reservation.id}/payment`, {
                amount: 30,
                payment_method: 'cash',
                description: 'Final Payment Test'
            });
            console.log('Payment 30 Success.');
        } catch (e) {
            console.error('Payment 30 Failed:', e.response?.data || e.message);
            return;
        }

        const allTransactions = await Transaction.findAll({
            where: {
                reservation_id: reservation.id,
                type: 'income',
                transaction_type: 'reservation_payment'
            }
        });

        // We can sum them up now
        const sumRoom = allTransactions.filter(t => t.category === 'Pago Reserva (Habitación)').reduce((s, t) => s + parseFloat(t.amount), 0);
        const sumMak = allTransactions.filter(t => t.category === 'Pago Venta Mak').reduce((s, t) => s + parseFloat(t.amount), 0);
        const sumMakala = allTransactions.filter(t => t.category === 'Pago Venta Makala').reduce((s, t) => s + parseFloat(t.amount), 0);

        console.log(`Final Totals -> Room: ${sumRoom}, Mak: ${sumMak}, Makala: ${sumMakala}`);

        if (sumRoom === 100 && sumMak === 30 && sumMakala === 20) {
            console.log('✅ SUCCESS: Final Totals Correct.');
        } else {
            console.error('❌ FAILURE: Final Totals Incorrect.');
        }

        // Cleanup
        // await Transaction.destroy({ where: { reservation_id: reservation.id } });
        // await Reservation.destroy({ where: { id: reservation.id } });

    } catch (error) {
        console.error('Setup Error:', error);
        if (error.response) console.error(error.response.data);
        if (!t.finished) await t.rollback();
    }
}

testScenario();
