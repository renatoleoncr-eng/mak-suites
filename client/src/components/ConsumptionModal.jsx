import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { X, Search, Plus, Minus, ShoppingCart } from 'lucide-react';

const ConsumptionModal = ({ reservation, onClose, onSuccess }) => {
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchProducts();
    }, []);

    useEffect(() => {
        if (!searchTerm) {
            setFilteredProducts(products);
        } else {
            const lower = searchTerm.toLowerCase();
            setFilteredProducts(products.filter(p =>
                p.name.toLowerCase().includes(lower) ||
                p.Category?.name.toLowerCase().includes(lower)
            ));
        }
    }, [searchTerm, products]);

    // Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/products`);
            // Filter only products with stock > 0
            const available = res.data.filter(p => p.stock > 0);
            setProducts(available);
            setFilteredProducts(available);
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setLoading(false);
        }
    };

    const addToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                // Check stock
                if (existing.quantity >= product.stock) return prev;
                return prev.map(item =>
                    item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            } else {
                return [...prev, { ...product, quantity: 1 }];
            }
        });
    };

    const removeFromCart = (productId) => {
        setCart(prev => prev.filter(item => item.id !== productId));
    };

    const updateQuantity = (productId, delta) => {
        setCart(prev => {
            return prev.map(item => {
                if (item.id === productId) {
                    const newQty = item.quantity + delta;
                    if (newQty <= 0) return item; // Don't remove, just min 1
                    // Check stock
                    const product = products.find(p => p.id === productId);
                    if (newQty > product.stock) return item;
                    return { ...item, quantity: newQty };
                }
                return item;
            });
        });
    };

    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const handleSubmit = async () => {
        if (cart.length === 0) return;
        setSubmitting(true);
        try {
            await axios.post(`${API_URL}/reservations/${reservation.id}/consumption`, {
                products: cart.map(item => ({
                    id: item.id,
                    quantity: item.quantity,
                    price: item.price,
                    name: item.name
                })),
                description: `Consumo Room Service / Minibar`
            });
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error submitting consumption:', error);
            alert(error.response?.data?.message || 'Error al registrar consumo');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Agregar Consumo</h2>
                        <p className="text-sm text-gray-500">
                            Habitación #{reservation.Room?.number} - {reservation.Guest?.name}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Product List (Left) */}
                    <div className="flex-1 p-6 border-r overflow-y-auto">
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="Buscar productos..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 p-2 border rounded-md"
                            />
                        </div>

                        {loading ? (
                            <div className="text-center py-8">Cargando productos...</div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {filteredProducts.map(product => (
                                    <div
                                        key={product.id}
                                        onClick={() => addToCart(product)}
                                        className="p-3 border rounded-lg hover:bg-blue-50 cursor-pointer transition flex justify-between items-center group"
                                    >
                                        <div>
                                            <div className="font-medium text-gray-800">{product.name}</div>
                                            <div className="text-xs text-gray-500">Stock: {product.stock}</div>
                                        </div>
                                        <div className="font-bold text-blue-600">S/ {product.price}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Cart (Right) */}
                    <div className="w-1/3 bg-gray-50 p-6 flex flex-col">
                        <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                            <ShoppingCart size={20} />
                            Pedido Actual
                        </h3>

                        <div className="flex-1 overflow-y-auto space-y-3">
                            {cart.length === 0 ? (
                                <p className="text-gray-500 italic text-sm text-center py-8">
                                    Seleccione productos de la lista
                                </p>
                            ) : (
                                cart.map(item => (
                                    <div key={item.id} className="bg-white p-3 rounded shadow-sm">
                                        <div className="flex justify-between mb-2">
                                            <span className="font-medium text-sm">{item.name}</span>
                                            <button
                                                onClick={() => removeFromCart(item.id)}
                                                className="text-red-400 hover:text-red-600"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => updateQuantity(item.id, -1)}
                                                    className="p-1 rounded bg-gray-100 hover:bg-gray-200"
                                                >
                                                    <Minus size={14} />
                                                </button>
                                                <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                                                <button
                                                    onClick={() => updateQuantity(item.id, 1)}
                                                    className="p-1 rounded bg-gray-100 hover:bg-gray-200"
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            </div>
                                            <span className="font-bold text-gray-700">
                                                S/ {(item.price * item.quantity).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="mt-4 pt-4 border-t">
                            <div className="flex justify-between items-center mb-4">
                                <span className="font-medium text-gray-700">Total</span>
                                <span className="text-xl font-bold text-blue-600">S/ {cartTotal.toFixed(2)}</span>
                            </div>
                            <button
                                onClick={handleSubmit}
                                disabled={cart.length === 0 || submitting}
                                className="w-full py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitting ? 'Cargando...' : 'Cargar a la Habitación'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConsumptionModal;
