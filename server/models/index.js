const sequelize = require('../config/database');
const User = require('./User');
const Room = require('./Room');
const Guest = require('./Guest');
const Reservation = require('./Reservation');
const Transaction = require('./Transaction');
const Product = require('./Product');
const Category = require('./Category');
const StockMovement = require('./StockMovement');
const Floor = require('./Floor');

// Associations
Room.hasMany(Reservation, { foreignKey: 'room_id' });
Reservation.belongsTo(Room, { foreignKey: 'room_id' });

Guest.hasMany(Reservation, { foreignKey: 'guest_id' });
Reservation.belongsTo(Guest, { foreignKey: 'guest_id' });

Reservation.hasMany(Transaction, { foreignKey: 'reservation_id' });
Transaction.belongsTo(Reservation, { foreignKey: 'reservation_id' });

// New Associations for Phase 2
Category.hasMany(Product, { foreignKey: 'category_id' });
Product.belongsTo(Category, { foreignKey: 'category_id' });

Product.hasMany(StockMovement, { foreignKey: 'product_id' });
StockMovement.belongsTo(Product, { foreignKey: 'product_id' });

User.hasMany(StockMovement, { foreignKey: 'created_by' });
StockMovement.belongsTo(User, { foreignKey: 'created_by' });

Room.hasMany(Transaction, { foreignKey: 'room_id' });
Transaction.belongsTo(Room, { foreignKey: 'room_id' });

Transaction.belongsTo(User, { foreignKey: 'created_by', as: 'Creator' });
User.hasMany(Transaction, { foreignKey: 'created_by' });

// Sync function
const syncDatabase = async () => {
    try {
        await sequelize.sync({ alter: false }); // Changed to false to avoid schema conflicts
        console.log('Database synced successfully');
    } catch (error) {
        console.error('Error syncing database:', error);
    }
};

module.exports = {
    sequelize,
    syncDatabase,
    User,
    Room,
    Guest,
    Reservation,
    Transaction,
    Product,
    Category,
    StockMovement,
    Floor,
};
