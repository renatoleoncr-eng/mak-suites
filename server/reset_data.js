const { sequelize, Reservation, Transaction, Guest, Product, Room, StockMovement } = require('./models');

const resetData = async () => {
    try {
        console.log('Starting data reset...');

        // 1. Clear Transactions (Linked to Reservations)
        await Transaction.destroy({ where: {}, force: true });
        console.log('✓ Transactions cleared (Hard Delete)');

        // 2. Clear Stock Movements
        await StockMovement.destroy({ where: {}, force: true });
        console.log('✓ Stock Movements cleared (Hard Delete)');

        // 3. Clear Reservations
        await Reservation.destroy({ where: {}, force: true });
        console.log('✓ Reservations cleared (Hard Delete)');

        // 4. Clear Guests
        await Guest.destroy({ where: {}, force: true });
        console.log('✓ Guests cleared (Hard Delete)');

        // 5. Reset Room Status
        await Room.update({ status: 'available', cleaning_status: 'clean' }, { where: {} });
        console.log('✓ Rooms reset to Available & Clean');

        // 6. Reset Product Stock
        await Product.update({ stock: 0 }, { where: {} });
        console.log('✓ Product stock reset to 0');

        console.log('Data reset complete!');
        process.exit(0);
    } catch (error) {
        console.error('Error resetting data:', error);
        process.exit(1);
    }
};

resetData();
