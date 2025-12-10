const { Product, Category, StockMovement, User, sequelize } = require('../models');
const { Op } = require('sequelize');

// Get all products (with optional filtering)
const getProducts = async (req, res) => {
    try {
        const { category_id, search, in_stock } = req.query;
        const where = {};

        if (category_id) where.category_id = category_id;
        if (search) where.name = { [Op.like]: `%${search}%` };
        if (in_stock === 'true') where.stock = { [Op.gt]: 0 };

        const products = await Product.findAll({
            where,
            include: [{ model: Category, attributes: ['name'] }],
            order: [['name', 'ASC']],
        });
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ message: 'Error al obtener productos', error: error.message });
    }
};

// Create Product
const createProduct = async (req, res) => {
    try {
        const { name, price, stock, category_id } = req.body;

        // Validate category
        if (category_id) {
            const category = await Category.findByPk(category_id);
            if (!category) {
                return res.status(400).json({ message: 'Categoría inválida' });
            }
        }

        // Check if product already exists (same name and category)
        const existingProduct = await Product.findOne({
            where: {
                name: { [Op.like]: name }, // Case insensitive check might be better, but strict for now
                category_id
            }
        });

        if (existingProduct) {
            // Update stock of existing product
            const newStock = existingProduct.stock + (parseInt(stock) || 0);
            await existingProduct.update({ stock: newStock });

            // Create stock movement for the addition
            if (stock > 0) {
                await StockMovement.create({
                    product_id: existingProduct.id,
                    type: 'in',
                    quantity: stock,
                    reason: 'purchase',
                    notes: 'Stock agregado al crear producto existente',
                    created_by: req.user.id,
                });
            }

            return res.status(200).json(existingProduct);
        }

        const product = await Product.create({
            name,
            price,
            stock: stock || 0,
            category_id,
        });

        // Initial stock movement if stock > 0
        if (stock > 0) {
            await StockMovement.create({
                product_id: product.id,
                type: 'in',
                quantity: stock,
                reason: 'purchase', // Initial stock
                notes: 'Stock inicial',
                created_by: req.user.id,
            });
        }

        res.status(201).json(product);
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ message: 'Error al crear producto', error: error.message });
    }
};

// Update Product
const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, category_id } = req.body;

        const product = await Product.findByPk(id);
        if (!product) return res.status(404).json({ message: 'Producto no encontrado' });

        await product.update({ name, price, category_id });
        res.json(product);
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ message: 'Error al actualizar producto', error: error.message });
    }
};

// Update Stock (Add/Remove)
const updateStock = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { quantity, type, reason, notes } = req.body; // type: 'add' or 'subtract'

        const product = await Product.findByPk(id, { transaction: t });
        if (!product) {
            await t.rollback();
            return res.status(404).json({ message: 'Producto no encontrado' });
        }

        let newStock = product.stock;
        let movementType = 'in';

        if (type === 'add') {
            newStock += quantity;
            movementType = 'in';
        } else if (type === 'subtract') {
            if (product.stock < quantity) {
                await t.rollback();
                return res.status(400).json({ message: 'Stock insuficiente' });
            }
            newStock -= quantity;
            movementType = 'out';
        } else {
            await t.rollback();
            return res.status(400).json({ message: 'Tipo de operación inválido' });
        }

        await product.update({ stock: newStock }, { transaction: t });

        // Record movement
        await StockMovement.create({
            product_id: id,
            type: movementType,
            quantity: quantity,
            reason: reason || (type === 'add' ? 'purchase' : 'adjustment'),
            reference_type: 'manual',
            notes: notes || 'Ajuste manual de stock',
            created_by: req.user.id,
        }, { transaction: t });

        await t.commit();
        res.json({ message: 'Stock actualizado', product });
    } catch (error) {
        await t.rollback();
        console.error('Error updating stock:', error);
        res.status(500).json({ message: 'Error al actualizar stock', error: error.message });
    }
};

// Get Stock Movements (Global or Per Product)
const getStockMovements = async (req, res) => {
    try {
        const { id } = req.params;
        const where = {};
        if (id) where.product_id = id;

        const movements = await StockMovement.findAll({
            where,
            order: [['createdAt', 'DESC']],
            include: [
                { model: Product, attributes: ['name'] },
                { model: User, attributes: ['name'], required: false }
            ],
            limit: 100 // Limit to last 100 movements for performance
        });
        res.json(movements);
    } catch (error) {
        console.error('Error fetching movements:', error);
        res.status(500).json({ message: 'Error al obtener movimientos', error: error.message });
    }
};

// Delete Product
const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findByPk(id);
        if (!product) return res.status(404).json({ message: 'Producto no encontrado' });

        await product.destroy();
        res.json({ message: 'Producto eliminado' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ message: 'Error al eliminar producto', error: error.message });
    }
};

module.exports = {
    getProducts,
    createProduct,
    updateProduct,
    updateStock,
    deleteProduct,
    getStockMovements,
};
