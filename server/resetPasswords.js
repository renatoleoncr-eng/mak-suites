const { User } = require('./models');
const bcrypt = require('bcryptjs');

async function resetPasswords() {
    try {
        // Reset admin password to 'admin123'
        const admin = await User.findOne({ where: { username: 'admin' } });
        if (admin) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await admin.update({ password_hash: hashedPassword });
            console.log('✅ Admin password reset to: admin123');
        } else {
            console.log('❌ Admin user not found');
        }

        // Reset counter password to 'counter123'
        const counter = await User.findOne({ where: { username: 'counter' } });
        if (counter) {
            const hashedPassword = await bcrypt.hash('counter123', 10);
            await counter.update({ password_hash: hashedPassword });
            console.log('✅ Counter password reset to: counter123');
        } else {
            console.log('❌ Counter user not found');
        }

        console.log('\n🔐 Credenciales actualizadas:');
        console.log('Admin: admin / admin123');
        console.log('Counter: counter / counter123');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

resetPasswords();
