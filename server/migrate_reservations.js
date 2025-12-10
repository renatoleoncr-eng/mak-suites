const { sequelize } = require('./models');

async function migrate() {
    try {
        const queryInterface = sequelize.getQueryInterface();
        const tableDescription = await queryInterface.describeTable('Reservations');

        if (!tableDescription.reservation_type) {
            console.log('Adding reservation_type column...');
            await queryInterface.addColumn('Reservations', 'reservation_type', {
                type: 'TEXT', // SQLite uses TEXT for ENUM
                defaultValue: 'night',
                allowNull: false
            });
        }

        if (!tableDescription.start_time) {
            console.log('Adding start_time column...');
            await queryInterface.addColumn('Reservations', 'start_time', {
                type: 'TIME',
                allowNull: true
            });
        }

        if (!tableDescription.end_time) {
            console.log('Adding end_time column...');
            await queryInterface.addColumn('Reservations', 'end_time', {
                type: 'TIME',
                allowNull: true
            });
        }

        console.log('Migration completed successfully');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        process.exit();
    }
}

migrate();
