const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Guest = sequelize.define('Guest', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    email: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    doc_type: {
        type: DataTypes.STRING, // DNI, Passport, etc.
        allowNull: false,
    },
    doc_number: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    id_photo: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Filename of uploaded ID photo',
    },
    visit_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    last_visit: {
        type: DataTypes.DATE,
        allowNull: true,
    },
});

module.exports = Guest;
