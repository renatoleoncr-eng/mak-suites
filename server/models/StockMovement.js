const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StockMovement = sequelize.define('StockMovement', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    // product_id will be added in associations
    type: {
        type: DataTypes.ENUM('in', 'out'),
        allowNull: false,
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    reason: {
        type: DataTypes.STRING, // 'purchase', 'sale', 'adjustment', 'waste'
        allowNull: false,
    },
    reference_type: {
        type: DataTypes.STRING, // 'transaction', 'manual'
        allowNull: true,
    },
    reference_id: {
        type: DataTypes.INTEGER, // ID of Transaction if sale
        allowNull: true,
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    created_by: {
        type: DataTypes.INTEGER, // User ID
        allowNull: true,
    },
});

module.exports = StockMovement;
