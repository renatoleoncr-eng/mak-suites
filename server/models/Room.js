const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Room = sequelize.define('Room', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    number: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    floor: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    type: {
        type: DataTypes.STRING, // e.g., 'Single', 'Double', 'Suite'
        allowNull: false,
    },
    status: {
        type: DataTypes.ENUM('available', 'occupied', 'cleaning', 'maintenance'),
        defaultValue: 'available',
        allowNull: false,
    },
    price_per_night: {
        type: DataTypes.FLOAT,
        allowNull: false,
    },
});

module.exports = Room;
