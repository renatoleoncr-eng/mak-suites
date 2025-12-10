const { Category, Product } = require('../models');

// Get all categories
const getCategories = async (req, res) => {
    try {
        const categories = await Category.findAll({
            include: [{ model: Product, attributes: ['id'] }] // Optional: count products later if needed
        });
        res.json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ message: 'Error al obtener categorías', error: error.message });
    }
};

// Create category (Admin only)
const createCategory = async (req, res) => {
    try {
        const { name, description } = req.body;

        // Check if category exists
        const existing = await Category.findOne({ where: { name } });
        if (existing) {
            return res.status(400).json({ message: 'La categoría ya existe' });
        }

        const category = await Category.create({
            name,
            description,
            created_by: req.user.id
        });

        res.status(201).json(category);
    } catch (error) {
        console.error('Error creating category:', error);
        res.status(500).json({ message: 'Error al crear categoría', error: error.message });
    }
};

// Update category (Admin only)
const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        const category = await Category.findByPk(id);
        if (!category) {
            return res.status(404).json({ message: 'Categoría no encontrada' });
        }

        await category.update({ name, description });
        res.json(category);
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({ message: 'Error al actualizar categoría', error: error.message });
    }
};

// Delete category (Admin only)
const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;

        const category = await Category.findByPk(id);
        if (!category) {
            return res.status(404).json({ message: 'Categoría no encontrada' });
        }

        // Check if category has products
        const productsCount = await Product.count({ where: { category_id: id } });
        if (productsCount > 0) {
            return res.status(400).json({ message: 'No se puede eliminar una categoría con productos asociados' });
        }

        await category.destroy();
        res.json({ message: 'Categoría eliminada exitosamente' });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ message: 'Error al eliminar categoría', error: error.message });
    }
};

module.exports = {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
};
