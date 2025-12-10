const { Transaction, Reservation, Room, sequelize } = require('./models');
const { Op } = require('sequelize');

async function testScenario() {
    try {
        console.log('--- STARTING VERIFICATION SCENARIO ---');

        // 1. Setup: Confirm Room 101 and its reservations
        const room = await Room.findOne({ where: { number: '101' } });
        if (!room) throw new Error('Room 101 not found');

        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
        console.log(`📅 Today's Date (Server): ${today}`);

        const reservations = await Reservation.findAll({
            where: { room_id: room.id, status: { [Op.in]: ['checked_in', 'reserved'] } }
        });

        console.log(`\n📋 Found ${reservations.length} active/reserved bookings for Room 101:`);
        reservations.forEach(r => {
            const isToday = (r.start_date <= today && r.end_date > today);
            console.log(`   - ID: ${r.id} | Dates: ${r.start_date} to ${r.end_date} | Status: ${r.status} | Active Today? ${isToday ? 'YES ✅' : 'NO ❌'}`);
        });

        // 2. Simulate logic used in transactionController
        console.log('\n🔄 Simulating "Find Active Reservation" Logic...');

        const activeRes = await Reservation.findOne({
            where: {
                room_id: room.id,
                status: { [Op.in]: ['checked_in', 'reserved'] },
                start_date: { [Op.lte]: today },
                end_date: { [Op.gt]: today }
            },
            order: [['start_date', 'DESC']]
        });

        if (!activeRes) {
            console.error('❌ ERROR: System could not find a valid reservation for TODAY.');
            return;
        }

        console.log(`✅ System selected Reservation ID: ${activeRes.id}`);

        // 3. Verify correctness
        const correctRes = reservations.find(r => r.start_date <= today && r.end_date > today);

        if (activeRes.id === correctRes.id) {
            console.log('\n✨ SUCCESS: The system correctly linked the transaction to the reservation active today.');
        } else {
            console.error(`\n❌ FAILURE: Linked to ID ${activeRes.id}, expected ID ${correctRes.id}`);
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

testScenario();
