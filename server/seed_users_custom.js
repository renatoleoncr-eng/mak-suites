const { sequelize, User } = require('./models');
const bcrypt = require('bcryptjs');

const seedCustomUsers = async () => {
    try {
        console.log('Iniciando creación de usuarios personalizados...');

        // No forzamos la resincronización completa (force: true) para NO BORRAR habitaciones ni productos
        // Solo vamos a gestionar usuarios.
        // OJO: Si ya existen usuarios con estos username, fallará por duplicado.
        // Para producción limpia, lo ideal es borrar usuarios previos o manejarlo con findOrCreate.

        // Vamos a limpiar la tabla de usuarios primero para asegurar IDs limpios (Opcional, pero recomendado para este seed inicial)
        // await User.destroy({ where: {}, truncate: true }); 
        // Comentado para no borrar datos accidentalmente si se corre después. 
        // Si es la primera vez, sequelize.sync() ya habrá creado la tabla vacía.

        const salt = await bcrypt.genSalt(10);

        // 1. Renato (Admin)
        const renatoHash = await bcrypt.hash('Ralc123$', salt);
        await User.create({
            username: 'Renato',
            password_hash: renatoHash,
            role: 'admin', // Asumo 'admin' tiene permisos totales
            name: 'Renato Admin',
        });
        console.log('✓ Usuario Renato (Admin) creado.');

        // 2. Christian (Counter)
        const christianHash = await bcrypt.hash('Christian123', salt);
        await User.create({
            username: 'Christian',
            password_hash: christianHash,
            role: 'counter',
            name: 'Christian Recepción',
        });
        console.log('✓ Usuario Christian (Counter) creado.');

        // 3. Claudio (Counter)
        const claudioHash = await bcrypt.hash('Claudio123', salt);
        await User.create({
            username: 'Claudio',
            password_hash: claudioHash,
            role: 'counter',
            name: 'Claudio Recepción',
        });
        console.log('✓ Usuario Claudio (Counter) creado.');

        // 4. Evelyn (Counter)
        const evelynHash = await bcrypt.hash('Evelyn123', salt);
        await User.create({
            username: 'Evelyn',
            password_hash: evelynHash,
            role: 'counter',
            name: 'Evelyn Recepción',
        });
        console.log('✓ Usuario Evelyn (Counter) creado.');

        console.log('Todos los usuarios han sido creados exitosamente.');
        process.exit(0);
    } catch (error) {
        console.error('Error al crear usuarios:', error);
        process.exit(1);
    }
};

seedCustomUsers();
