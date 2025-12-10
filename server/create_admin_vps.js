const { sequelize, User } = require('./models');
const bcrypt = require('bcryptjs');

const run = async () => {
    try {
        console.log('--- INICIANDO CREACION DE ADMIN ---');
        await sequelize.authenticate();
        console.log('Base de datos conectada.');

        const h = await bcrypt.hash('admin123', 10);

        // Buscar usuario
        const user = await User.findOne({ where: { username: 'admin' } });

        if (user) {
            console.log('El usuario admin ya existe. Actualizando password...');
            user.password_hash = h;
            user.role = 'admin';
            await user.save();
            console.log('✅ ACTUALIZADO CORRECTAMENTE.');
        } else {
            console.log('El usuario no existe. Creando nuevo...');
            await User.create({
                username: 'admin',
                password_hash: h,
                role: 'admin',
                name: 'Admin General'
            });
            console.log('✅ CREADO CORRECTAMENTE.');
        }
        console.log('-----------------------------------');
        console.log('USUARIO: admin');
        console.log('PASS:    admin123');
        console.log('-----------------------------------');
    } catch (e) {
        console.error('ERROR:', e);
    }
};

run();
