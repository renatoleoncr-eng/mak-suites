const { Reservation } = require('./models');

async function checkReservation() {
    try {
        const reservation = await Reservation.findByPk(21);
        if (!reservation) {
            console.log('Reservation 21 not found');
            return;
        }
        console.log('Reservation 21:');
        console.log('Start Date:', reservation.start_date);
        console.log('End Date:', reservation.end_date);
        console.log('Type:', reservation.reservation_type);
    } catch (error) {
        console.error('Error:', error);
    }
}

checkReservation();
