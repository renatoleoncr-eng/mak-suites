const { User } = require('./models');
const bcrypt = require('bcryptjs');

async function createCounterUser() {
    try {
        console.log('Checking for counter user...');

        let user = await User.findOne({ where: { username: 'counter' } });

        if (!user) {
            console.log('Counter user not found. Creating...');
            const hashedPassword = await bcrypt.hash('counter123', 10);

            await User.create({
                username: 'counter',
                password_hash: hashedPassword,
                name: 'Recepcionista',
                role: 'counter'
            });

            console.log('✅ Counter user created successfully!');
        } else {
            console.log('Counter user already exists. Resetting password...');
            const hashedPassword = await bcrypt.hash('counter123', 10);
            user.password_hash = hashedPassword;
            await user.save();
            console.log('✅ Counter user password reset to: counter123');
        }

        console.log('Username: counter');
        console.log('Password: counter123');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

createCounterUser();
