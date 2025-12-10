const { User } = require('./models');
const bcrypt = require('bcryptjs');

async function fixAdminPassword() {
    try {
        const hashedPassword = await bcrypt.hash('admin123', 10);

        // Update 'admin'
        const admin = await User.findOne({ where: { username: 'admin' } });
        if (admin) {
            await admin.update({ password_hash: hashedPassword });
            console.log('✅ User "admin" password reset to "admin123"');
        } else {
            console.log('❌ User "admin" not found');
        }

        // Update 'Renato' just in case
        const renato = await User.findOne({ where: { username: 'Renato' } });
        if (renato) {
            await renato.update({ password_hash: hashedPassword });
            console.log('✅ User "Renato" password reset to "admin123"');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

fixAdminPassword();
