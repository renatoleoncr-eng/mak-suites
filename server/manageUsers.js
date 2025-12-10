const { User } = require('./models');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Función de autenticación
const authenticate = async () => {
    console.log('\n🔒 === Autenticación Requerida ===\n');
    console.log('Para gestionar usuarios, debes autenticarte como administrador.\n');

    const username = await question('Username: ');
    const password = await question('Contraseña: ');

    const user = await User.findOne({ where: { username } });

    if (!user) {
        console.log('\n❌ Usuario no encontrado');
        process.exit(1);
    }

    if (user.role !== 'admin') {
        console.log('\n❌ Acceso denegado. Solo administradores pueden gestionar usuarios.');
        process.exit(1);
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
        console.log('\n❌ Contraseña incorrecta');
        process.exit(1);
    }

    console.log(`\n✅ Autenticación exitosa. Bienvenido, ${user.name}\n`);
    return user;
};

const manageUsers = async () => {
    try {
        console.log('\n=== Gestión de Usuarios ===\n');
        console.log('1. Crear nuevo usuario');
        console.log('2. Cambiar contraseña de usuario existente');
        console.log('3. Listar todos los usuarios');
        console.log('4. Eliminar usuario');
        console.log('5. Salir\n');

        const option = await question('Selecciona una opción (1-5): ');

        switch (option) {
            case '1':
                await createUser();
                break;
            case '2':
                await changePassword();
                break;
            case '3':
                await listUsers();
                break;
            case '4':
                await deleteUser();
                break;
            case '5':
                console.log('Saliendo...');
                process.exit(0);
                break;
            default:
                console.log('Opción inválida');
                await manageUsers();
        }

        // Volver al menú principal
        const continueOption = await question('\n¿Deseas realizar otra operación? (s/n): ');
        if (continueOption.toLowerCase() === 's') {
            await manageUsers();
        } else {
            console.log('¡Hasta luego!');
            process.exit(0);
        }
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

const createUser = async () => {
    console.log('\n--- Crear Nuevo Usuario ---\n');

    const username = await question('Username: ');
    const name = await question('Nombre completo: ');
    const password = await question('Contraseña: ');
    const roleInput = await question('Rol (admin/counter) [counter]: ');
    const role = roleInput || 'counter';

    if (role !== 'admin' && role !== 'counter') {
        console.log('❌ Rol inválido. Debe ser "admin" o "counter"');
        return;
    }

    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
        console.log(`❌ El usuario "${username}" ya existe`);
        return;
    }

    // Crear hash de la contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Crear usuario
    await User.create({
        username,
        password_hash: passwordHash,
        role,
        name,
    });

    console.log(`\n✅ Usuario "${username}" creado exitosamente`);
    console.log(`   Nombre: ${name}`);
    console.log(`   Rol: ${role}`);
};

const changePassword = async () => {
    console.log('\n--- Cambiar Contraseña ---\n');

    const username = await question('Username del usuario: ');
    const user = await User.findOne({ where: { username } });

    if (!user) {
        console.log(`❌ Usuario "${username}" no encontrado`);
        return;
    }

    const newPassword = await question('Nueva contraseña: ');
    const confirmPassword = await question('Confirmar contraseña: ');

    if (newPassword !== confirmPassword) {
        console.log('❌ Las contraseñas no coinciden');
        return;
    }

    // Crear hash de la nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Actualizar usuario
    await user.update({ password_hash: passwordHash });

    console.log(`\n✅ Contraseña de "${username}" actualizada exitosamente`);
};

const listUsers = async () => {
    console.log('\n--- Lista de Usuarios ---\n');

    const users = await User.findAll({
        attributes: ['id', 'username', 'name', 'role'],
        order: [['role', 'DESC'], ['username', 'ASC']],
    });

    if (users.length === 0) {
        console.log('No hay usuarios en el sistema');
        return;
    }

    console.log('ID | Username      | Nombre                | Rol');
    console.log('---|---------------|----------------------|--------');
    users.forEach(user => {
        const id = user.id.toString().padEnd(2);
        const username = user.username.padEnd(13);
        const name = user.name.padEnd(20);
        const role = user.role;
        console.log(`${id} | ${username} | ${name} | ${role}`);
    });
    console.log('');
};

const deleteUser = async () => {
    console.log('\n--- Eliminar Usuario ---\n');

    const username = await question('Username del usuario a eliminar: ');
    const user = await User.findOne({ where: { username } });

    if (!user) {
        console.log(`❌ Usuario "${username}" no encontrado`);
        return;
    }

    // Mostrar información del usuario
    console.log(`\n⚠️  Vas a eliminar el siguiente usuario:`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Nombre: ${user.name}`);
    console.log(`   Rol: ${user.role}`);

    const confirm = await question('\n¿Estás seguro? Esta acción no se puede deshacer (s/n): ');

    if (confirm.toLowerCase() !== 's') {
        console.log('❌ Operación cancelada');
        return;
    }

    // Eliminar usuario
    await user.destroy();

    console.log(`\n✅ Usuario "${username}" eliminado exitosamente`);
};

// Iniciar el programa con autenticación
const startProgram = async () => {
    try {
        await authenticate();
        await manageUsers();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

startProgram();
