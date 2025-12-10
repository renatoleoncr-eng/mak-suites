import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { Package, Plus, Minus, Edit2, Trash2, History, Layers, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

const Inventory = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('products'); // 'products' or 'movements'
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [movements, setMovements] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modals
    const [showProductModal, setShowProductModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [showStockModal, setShowStockModal] = useState(false);

    // Form States
    const [currentProduct, setCurrentProduct] = useState({ name: '', price: '', stock: '', category_id: '' });
    const [currentCategory, setCurrentCategory] = useState({ name: '', description: '' });
    const [stockAdjustment, setStockAdjustment] = useState({ id: null, type: 'add', quantity: '', reason: '', notes: '' });
    const [isEditing, setIsEditing] = useState(false);

    // ESC Key Handler
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setShowProductModal(false);
                setShowCategoryModal(false);
                setShowStockModal(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (activeTab === 'movements') {
            fetchMovements();
        }
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [prodRes, catRes] = await Promise.all([
                axios.get(`${API_URL}/products`),
                axios.get(`${API_URL}/categories`)
            ]);
            setProducts(prodRes.data);
            setCategories(catRes.data);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMovements = async () => {
        try {
            const res = await axios.get(`${API_URL}/products/movements`);
            setMovements(res.data);
        } catch (error) {
            console.error('Error fetching movements:', error);
        }
    };

    // Helper to get category name
    const getCategoryName = (id) => {
        const cat = categories.find(c => c.id === id);
        return cat ? cat.name : 'Sin Categoría';
    };

    // --- Product Handlers ---
    const handleSaveProduct = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...currentProduct,
                price: parseFloat(currentProduct.price),
                stock: parseInt(currentProduct.stock || 0),
                category_id: currentProduct.category_id || null
            };

            if (isEditing) {
                await axios.put(`${API_URL}/products/${currentProduct.id}`, payload);
            } else {
                await axios.post(`${API_URL}/products`, payload);
            }
            setShowProductModal(false);
            fetchData();
            setCurrentProduct({ name: '', price: '', stock: '', category_id: '' });
            setIsEditing(false);
        } catch (error) {
            alert('Error al guardar producto: ' + (error.response?.data?.message || error.message));
        }
    };

    const handleDeleteProduct = async (id) => {
        if (!window.confirm('¿Estás seguro de eliminar este producto?')) return;
        try {
            await axios.delete(`${API_URL}/products/${id}`);
            fetchData();
        } catch (error) {
            alert('Error al eliminar: ' + (error.response?.data?.message || error.message));
        }
    };

    // --- Category Handlers ---
    const handleSaveCategory = async (e) => {
        e.preventDefault();
        try {
            if (currentCategory.id) {
                await axios.put(`${API_URL}/categories/${currentCategory.id}`, currentCategory);
            } else {
                await axios.post(`${API_URL}/categories`, currentCategory);
            }
            // Refresh categories
            const res = await axios.get(`${API_URL}/categories`);
            setCategories(res.data);
            setCurrentCategory({ name: '', description: '' });
            alert('Categoría guardada');
        } catch (error) {
            alert('Error al guardar categoría: ' + (error.response?.data?.message || error.message));
        }
    };

    const handleDeleteCategory = async (id) => {
        if (!window.confirm('¿Estás seguro de eliminar esta categoría?')) return;
        try {
            await axios.delete(`${API_URL}/categories/${id}`);
            const res = await axios.get(`${API_URL}/categories`);
            setCategories(res.data);
            alert('Categoría eliminada');
        } catch (error) {
            alert('Error al eliminar categoría: ' + (error.response?.data?.message || error.message));
        }
    };

    // --- Stock Handlers ---
    const openStockModal = (product, type) => {
        setStockAdjustment({
            id: product.id,
            productName: product.name,
            type,
            quantity: '',
            reason: type === 'add' ? 'purchase' : 'adjustment',
            notes: ''
        });
        setShowStockModal(true);
    };

    const handleStockSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_URL}/products/${stockAdjustment.id}/stock`, {
                type: stockAdjustment.type,
                quantity: parseInt(stockAdjustment.quantity),
                reason: stockAdjustment.reason,
                notes: stockAdjustment.notes
            });
            setShowStockModal(false);
            fetchData();
            if (activeTab === 'movements') fetchMovements();
            alert('Stock actualizado');
        } catch (error) {
            alert('Error al actualizar stock: ' + (error.response?.data?.message || error.message));
        }
    };

    return (
        <div className="p-8">
            <div className="flex justify-end items-center mb-6 gap-2">
                {user?.role === 'admin' && (
                    <button
                        onClick={() => setShowCategoryModal(true)}
                        className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
                    >
                        <Layers size={20} />
                        Categorías
                    </button>
                )}
                {user?.role === 'admin' && (
                    <button
                        onClick={() => {
                            setIsEditing(false);
                            setCurrentProduct({ name: '', price: '', stock: '', category_id: '' });
                            setShowProductModal(true);
                        }}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                    >
                        <Plus size={20} />
                        Nuevo Producto
                    </button>
                )}
            </div>

            {/* Tabs */}
            < div className="flex border-b mb-6" >
                <button
                    className={`px-6 py-3 font-medium ${activeTab === 'products' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setActiveTab('products')}
                >
                    Productos y Disponibilidad
                </button>
                <button
                    className={`px-6 py-3 font-medium ${activeTab === 'movements' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => {
                        setActiveTab('movements');
                        fetchMovements();
                    }}
                >
                    Movimientos de Stock
                </button>
            </div >

            {
                loading ? (
                    <div className="text-center py-10" > Cargando...</div>
                ) : (
                    <>
                        {activeTab === 'products' && (
                            <div className="bg-white rounded-lg shadow overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Precio</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {products.map((product) => (
                                            <tr key={product.id}>
                                                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{product.name}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                                    <span className="px-2 py-1 bg-gray-100 rounded-full text-xs">
                                                        {product.Category?.name || 'Sin Categoría'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`font-bold ${product.stock < 10 ? 'text-red-600' : 'text-green-600'}`}>
                                                        {product.stock}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-900">S/ {product.price.toFixed(2)}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                                    {user?.role === 'admin' && (
                                                        <>
                                                            <button
                                                                onClick={() => openStockModal(product, 'add')}
                                                                className="text-green-600 hover:text-green-900 inline-flex items-center gap-1 bg-green-50 px-2 py-1 rounded border border-green-200"
                                                                title="Agregar Stock"
                                                            >
                                                                <Plus size={14} /> Agregar Stock
                                                            </button>
                                                            <button
                                                                onClick={() => openStockModal(product, 'subtract')}
                                                                className="text-red-600 hover:text-red-900 inline-flex items-center gap-1 bg-red-50 px-2 py-1 rounded border border-red-200"
                                                                title="Quitar Stock"
                                                            >
                                                                <Minus size={14} /> Quitar Stock
                                                            </button>
                                                            <span className="text-gray-300">|</span>
                                                        </>
                                                    )}
                                                    <button
                                                        onClick={() => {
                                                            setIsEditing(true);
                                                            setCurrentProduct(product);
                                                            setShowProductModal(true);
                                                        }}
                                                        className="text-blue-600 hover:text-blue-900"
                                                    >
                                                        <Edit2 size={18} />
                                                    </button>
                                                    {user?.role === 'admin' && (
                                                        <button
                                                            onClick={() => handleDeleteProduct(product.id)}
                                                            className="text-red-600 hover:text-red-900 ml-2"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {activeTab === 'movements' && (
                            <div className="bg-white rounded-lg shadow overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Razón</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notas</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {movements.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                                                    No hay movimientos registrados.
                                                </td>
                                            </tr>
                                        ) : (
                                            movements.map((mov) => (
                                                <tr key={mov.id}>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {format(new Date(mov.createdAt), 'dd/MM/yyyy HH:mm')}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                                                        {mov.Product?.name || 'Producto Eliminado'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${mov.type === 'in' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                            {mov.type === 'in' ? 'Entrada' : 'Salida'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap font-bold">
                                                        {mov.type === 'in' ? '+' : '-'}{mov.quantity}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                                                        {mov.reason === 'purchase' ? 'Compra' :
                                                            mov.reason === 'sale' ? 'Venta' :
                                                                mov.reason === 'adjustment' ? 'Ajuste' :
                                                                    mov.reason === 'waste' ? 'Merma' :
                                                                        mov.reason === 'return' ? 'Devolución' : mov.reason}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {mov.User?.name || '-'}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-500 truncate max-w-xs">
                                                        {mov.notes || '-'}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )
            }

            {/* Product Modal */}
            {
                showProductModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                            <h2 className="text-xl font-bold mb-4">{isEditing ? 'Editar Producto' : 'Nuevo Producto'}</h2>
                            <form onSubmit={handleSaveProduct} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Nombre</label>
                                    <input
                                        required
                                        type="text"
                                        value={currentProduct.name}
                                        onChange={(e) => setCurrentProduct({ ...currentProduct, name: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Categoría</label>
                                    <select
                                        value={currentProduct.category_id}
                                        onChange={(e) => setCurrentProduct({ ...currentProduct, category_id: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2"
                                    >
                                        <option value="">Seleccionar Categoría</option>
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Precio (S/)</label>
                                        <input
                                            required
                                            type="number"
                                            step="0.01"
                                            value={currentProduct.price}
                                            onChange={(e) => setCurrentProduct({ ...currentProduct, price: e.target.value })}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Stock Inicial</label>
                                        <input
                                            required
                                            type="number"
                                            disabled={isEditing} // Disable stock edit directly, force use of adjustment
                                            value={currentProduct.stock}
                                            onChange={(e) => setCurrentProduct({ ...currentProduct, stock: e.target.value })}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 mt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowProductModal(false)}
                                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                    >
                                        Guardar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Category Modal */}
            {
                showCategoryModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                            <h2 className="text-xl font-bold mb-4">Gestionar Categorías</h2>
                            <form onSubmit={handleSaveCategory} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Nombre</label>
                                    <input
                                        required
                                        type="text"
                                        value={currentCategory.name}
                                        onChange={(e) => setCurrentCategory({ ...currentCategory, name: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Descripción</label>
                                    <textarea
                                        value={currentCategory.description}
                                        onChange={(e) => setCurrentCategory({ ...currentCategory, description: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2"
                                    />
                                </div>
                                <div className="flex justify-end gap-2 mt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowCategoryModal(false)}
                                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                                    >
                                        Cerrar
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                                    >
                                        Guardar
                                    </button>
                                </div>
                            </form>

                            <div className="mt-6 border-t pt-4">
                                <h3 className="font-medium mb-2">Categorías Existentes</h3>
                                <div className="max-h-40 overflow-y-auto space-y-2">
                                    {categories.map(cat => (
                                        <div key={cat.id} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                                            <span>{cat.name}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteCategory(cat.id)}
                                                className="text-red-600 hover:text-red-800 text-sm"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Stock Adjustment Modal */}
            {
                showStockModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                            <h2 className="text-xl font-bold mb-4">
                                {stockAdjustment.type === 'add' ? 'Agregar Stock' : 'Quitar Stock'} - {stockAdjustment.productName}
                            </h2>
                            <form onSubmit={handleStockSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Cantidad</label>
                                    <input
                                        required
                                        type="number"
                                        min="1"
                                        value={stockAdjustment.quantity}
                                        onChange={(e) => setStockAdjustment({ ...stockAdjustment, quantity: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Razón</label>
                                    <select
                                        required
                                        value={stockAdjustment.reason}
                                        onChange={(e) => setStockAdjustment({ ...stockAdjustment, reason: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2"
                                    >
                                        <option value="">Seleccionar Razón</option>
                                        {stockAdjustment.type === 'add' ? (
                                            <>
                                                <option value="purchase">Compra</option>
                                                <option value="return">Devolución</option>
                                                <option value="adjustment">Ajuste</option>
                                            </>
                                        ) : (
                                            <>
                                                <option value="sale">Venta</option>
                                                <option value="waste">Merma</option>
                                                <option value="adjustment">Ajuste</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Notas</label>
                                    <textarea
                                        value={stockAdjustment.notes}
                                        onChange={(e) => setStockAdjustment({ ...stockAdjustment, notes: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2"
                                    />
                                </div>
                                <div className="flex justify-end gap-2 mt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowStockModal(false)}
                                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className={`px-4 py-2 text-white rounded ${stockAdjustment.type === 'add' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                                    >
                                        Confirmar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default Inventory;
