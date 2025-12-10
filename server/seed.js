const { sequelize, User, Room } = require('./models');
const bcrypt = require('bcryptjs');

const seedDatabase = async () => {
    try {
        await sequelize.sync({ force: true }); // Reset DB
        console.log('Database synced.');

        // Create Admin User
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash('admin123', salt);

        await User.create({
            username: 'admin',
            password_hash: passwordHash,
            role: 'admin',
            name: 'Administrador',
        });
        console.log('Usuario admin creado.');

        // Create Counter User
        const counterHash = await bcrypt.hash('counter123', salt);
        await User.create({
            username: 'counter',
            password_hash: counterHash,
            role: 'counter',
            name: 'Recepcionista',
        });
        console.log('Usuario counter creado.');

        // Create 31 Specific Rooms
        const rooms = [
            // Piso 1 (9 habitaciones)
            { number: '101', floor: 1, type: 'Matrimonial', status: 'available', price_per_night: 99 },
            { number: '102', floor: 1, type: 'Matrimonial', status: 'available', price_per_night: 99 },
            { number: '103', floor: 1, type: 'Simple', status: 'available', price_per_night: 89 },
            { number: '104', floor: 1, type: 'Doble Ventilador', status: 'available', price_per_night: 129 },
            { number: '105', floor: 1, type: 'Jacuzzi', status: 'available', price_per_night: 169 },
            { number: '106', floor: 1, type: 'Tina', status: 'available', price_per_night: 129 },
            { number: '107', floor: 1, type: 'Doble cocina', status: 'available', price_per_night: 139 },
            { number: '108', floor: 1, type: 'Terraza', status: 'available', price_per_night: 159 },
            { number: '109', floor: 1, type: 'Suite', status: 'available', price_per_night: 159 },

            // Piso 2 (11 habitaciones)
            { number: '201', floor: 2, type: 'Matrimonial', status: 'available', price_per_night: 99 },
            { number: '202', floor: 2, type: 'Matrimonial', status: 'available', price_per_night: 99 },
            { number: '203', floor: 2, type: 'Matrimonial', status: 'available', price_per_night: 99 },
            { number: '204', floor: 2, type: 'Matrimonial', status: 'available', price_per_night: 99 },
            { number: '205', floor: 2, type: 'Simple', status: 'available', price_per_night: 89 },
            { number: '206', floor: 2, type: 'Doble ventilador', status: 'available', price_per_night: 129 },
            { number: '207', floor: 2, type: 'Jacuzzi', status: 'available', price_per_night: 169 },
            { number: '208', floor: 2, type: 'Suite cocina', status: 'available', price_per_night: 129 },
            { number: '209', floor: 2, type: 'Suite cocina', status: 'available', price_per_night: 129 },
            { number: '210', floor: 2, type: 'Matrimonial', status: 'available', price_per_night: 99 },
            { number: '211', floor: 2, type: 'Suite cocina', status: 'available', price_per_night: 129 },

            // Piso 3 (11 habitaciones)
            { number: '301', floor: 3, type: 'Matrimonial', status: 'available', price_per_night: 99 },
            { number: '302', floor: 3, type: 'Matrimonial', status: 'available', price_per_night: 99 },
            { number: '303', floor: 3, type: 'Triple A/C', status: 'available', price_per_night: 179 },
            { number: '304', floor: 3, type: 'Doble A/C', status: 'available', price_per_night: 159 },
            { number: '305', floor: 3, type: 'Triple ventilador', status: 'available', price_per_night: 159 },
            { number: '306', floor: 3, type: 'Doble ventilador', status: 'available', price_per_night: 139 },
            { number: '307', floor: 3, type: 'Jacuzzi', status: 'available', price_per_night: 169 },
            { number: '308', floor: 3, type: 'Suite', status: 'available', price_per_night: 129 },
            { number: '309', floor: 3, type: 'Doble A/C', status: 'available', price_per_night: 139 },
            { number: '310', floor: 3, type: 'Suite A/C', status: 'available', price_per_night: 129 },
            { number: '311', floor: 3, type: 'Suite A/C', status: 'available', price_per_night: 129 },
        ];

        await Room.bulkCreate(rooms);
        console.log(`${rooms.length} habitaciones creadas.`);

        console.log('Seeding complete.');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
};

seedDatabase();
