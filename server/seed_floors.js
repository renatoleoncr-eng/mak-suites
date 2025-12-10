const { sequelize, Floor } = require('./models');

const seedFloors = async () => {
    try {
        console.log('Seeding Floors...');
        const floors = [
            { number: 1 },
            { number: 2 },
            { number: 3 }
        ];

        for (const f of floors) {
            await Floor.findOrCreate({
                where: { number: f.number },
                defaults: f
            });
        }
        console.log('Floors seeded successfully.');
    } catch (e) {
        console.error('Error seeding floors:', e);
    } finally {
        process.exit();
    }
};

seedFloors();
