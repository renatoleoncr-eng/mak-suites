const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Reservation = sequelize.define('Reservation', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    reservation_code: {
        type: DataTypes.STRING(10),
        unique: true,
        allowNull: false,
        comment: 'Código único numérico secuencial',
    },
    // Foreign keys will be added in associations
    start_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
    },
    end_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
    },
    reservation_type: {
        type: DataTypes.ENUM('night', 'hourly'),
        defaultValue: 'night',
        allowNull: false,
    },
    start_time: {
        type: DataTypes.TIME,
        allowNull: true,
    },
    end_time: {
        type: DataTypes.TIME,
        allowNull: true,
    },
    status: {
        type: DataTypes.ENUM('reserved', 'checked_in', 'checked_out', 'cleaning', 'completed', 'cancelled'),
        defaultValue: 'reserved',
        allowNull: false,
    },
    total_amount: {
        type: DataTypes.FLOAT,
        defaultValue: 0,
    },
    paid_amount: {
        type: DataTypes.FLOAT,
        defaultValue: 0,
    },
    prepaid_amount: {
        type: DataTypes.FLOAT,
        defaultValue: 0,
        comment: 'Monto prepagado al momento de la reserva',
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    created_by: {
        type: DataTypes.INTEGER, // User ID
        allowNull: true,
    },
}, {
    paranoid: true, // Enable Soft Deletes
});

module.exports = Reservation;
