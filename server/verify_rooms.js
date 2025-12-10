const { sequelize, Room, Floor } = require('./models');

const check = async () => {
    try {
        const roomCount = await Room.count();
        const floorCount = await Floor.count();
        console.log(`ROOM_COUNT: ${roomCount}`);
        console.log(`FLOOR_COUNT: ${floorCount}`);

        if (roomCount > 0) {
            const rooms = await Room.findAll({ limit: 5 });
            console.log('Sample Rooms:', JSON.stringify(rooms, null, 2));
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
};

check();
