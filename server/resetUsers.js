const bcrypt = require('bcryptjs');
const { User } = require('./models');

async function resetUsers() {
    try {
        console.log('🔄 Resetting users...');

        // Admin user
        const adminPasswordHash = await bcrypt.hash('admin123', 10);
        const [admin, adminCreated] = await User.findOrCreate({
            where: { username: 'admin' },
            defaults: {
                username: 'admin',
                password_hash: adminPasswordHash,
                role: 'admin',
                name: 'Administrador'
            }
        });

        if (!adminCreated) {
            await admin.update({
                password_hash: adminPasswordHash,
                role: 'admin',
                name: 'Administrador'
            });
            console.log('✅ Admin user updated');
        } else {
            console.log('✅ Admin user created');
        }

        // Counter user
        const counterPasswordHash = await bcrypt.hash('counter123', 10);
        const [counter, counterCreated] = await User.findOrCreate({
            where: { username: 'counter' },
            defaults: {
                username: 'counter',
                password_hash: counterPasswordHash,
                role: 'counter',
                name: 'Counter User'
            }
        });

        if (!counterCreated) {
            await counter.update({
                password_hash: counterPasswordHash,
                role: 'counter',
                name: 'Counter User'
            });
            console.log('✅ Counter user updated');
        } else {
            console.log('✅ Counter user created');
        }

        console.log('\n📋 Credentials:');
        console.log('Admin: username=admin, password=admin123');
        console.log('Counter: username=counter, password=counter123');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error resetting users:', error);
        process.exit(1);
    }
}

resetUsers();
