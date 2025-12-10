const { sequelize, User } = require('./models');
const bcrypt = require('bcryptjs');

const createAdmin = async () => {
    try {
        console.log('Connecting to database...');
        await sequelize.authenticate();
        console.log('Database connected.');

        const username = 'admin';
        const password = 'admin123';
        const hashedPassword = await bcrypt.hash(password, 10);

        const [user, created] = await User.findOrCreate({
            where: { username },
            defaults: {
                password: hashedPassword,
                role: 'admin',
                name: 'Administrador General'
            }
        });

        if (!created) {
            console.log('User exists. Updating password...');
            user.password = hashedPassword;
            await user.save();
        }

        console.log(`\nSUCCESS! User '${username}' is ready.`);
        console.log(`Password: ${password}`);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

createAdmin();
