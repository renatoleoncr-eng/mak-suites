const { sequelize, User } = require('./models');
const bcrypt = require('bcryptjs');

const run = async () => {
    try {
        console.log('--- DIAGNOSTICO DE LOGIN ---');
        await sequelize.authenticate();
        console.log('Base de datos conectada.');

        const username = 'admin'; // El usuario que intentamos probar
        const password = 'admin123'; // La contraseña que intentamos probar

        console.log(`Buscando usuario: "${username}"...`);
        const user = await User.findOne({ where: { username } });

        if (!user) {
            console.log('❌ ERROR: El usuario NO existe en la base de datos.');
            return;
        }

        console.log('✅ Usuario encontrado.');
        console.log('ID:', user.id);
        console.log('Role:', user.role);
        console.log('Stored Hash:', user.password_hash); // Ver si tiene hash

        console.log(`Probando contraseña: "${password}"...`);
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (isMatch) {
            console.log('✅ ÉXITO: La contraseña coincide. El problema NO es la base de datos.');
        } else {
            console.log('❌ FALLO: La contraseña NO coincide con el hash guardado.');
        }

    } catch (e) {
        console.error('ERROR GRAVE:', e);
    }
};

run();
