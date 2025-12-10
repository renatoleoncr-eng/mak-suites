const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Transaction = sequelize.define('Transaction', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    reservation_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'ID de la reserva asociada (si aplica)',
    },
    type: {
        type: DataTypes.ENUM('income', 'expense', 'charge'),
        allowNull: false,
    },
    transaction_type: {
        type: DataTypes.ENUM('venta_makala', 'venta_mak', 'egreso', 'other'),
        allowNull: true,
        comment: 'Tipo específico de transacción para Caja',
    },
    category: {
        type: DataTypes.STRING, // room, restaurant, shop, salary, maintenance, etc.
        allowNull: false,
    },
    amount: {
        type: DataTypes.FLOAT,
        allowNull: false,
    },
    method: {
        type: DataTypes.ENUM('cash', 'yape', 'card', 'transfer', 'room_charge'),
        allowNull: false,
    },
    payment_evidence: {
        type: DataTypes.TEXT('long'), // base64 encoded image
        allowNull: true,
        comment: 'Evidencia de pago para métodos no efectivo',
    },
    products: {
        type: DataTypes.TEXT, // JSON string: [{product_id, quantity, price}]
        allowNull: true,
        comment: 'Productos vendidos en Venta Mak',
    },
    date: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    description: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    created_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'ID del usuario que creó la transacción',
    },
});

module.exports = Transaction;
