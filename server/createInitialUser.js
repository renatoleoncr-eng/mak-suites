const { User } = require('./models');
const bcrypt = require('bcryptjs');

async function createInitialUser() {
    try {
        // Check if any users exist
        const userCount = await User.count();

        if (userCount === 0) {
            console.log('No users found. Creating initial admin user...');

            const hashedPassword = await bcrypt.hash('counter123', 10);

            await User.create({
                username: 'admin',
                password_hash: hashedPassword,
                name: 'Administrador',
                role: 'admin'
            });

            console.log('✅ Admin user created successfully!');
            console.log('Username: admin');
            console.log('Password: admin123');
        } else {
            console.log('Users already exist in database');
            const users = await User.findAll({ attributes: ['id', 'username', 'name', 'role'] });
            console.log('Existing users:', JSON.stringify(users, null, 2));
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

createInitialUser();
