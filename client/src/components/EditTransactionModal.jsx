import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { X, Search, Trash2, ShoppingCart, Loader } from 'lucide-react';
import { format } from 'date-fns';

const EditTransactionModal = ({ transaction, isOpen, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [type, setType] = useState('simple'); // 'simple' or 'venta_mak'

    // Simple Form State
    const [formData, setFormData] = useState({
        amount: '',
        description: '',
        method: '',
        date: ''
    });

    // Venta Mak State
    const [cart, setCart] = useState([]);
    const [products, setProducts] = useState([]); // Available products
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen && transaction) {
            // Initialize simple form
            setFormData({
                amount: transaction.amount,
                description: transaction.description || '',
                method: transaction.method,
                date: format(new Date(transaction.date), 'yyyy-MM-dd HH:mm')
            });

            // Determine type
            if (transaction.transaction_type === 'venta_mak' && transaction.products) {
                setType('venta_mak');
                fetchProducts();

                // Parse existing cart
                try {
                    const parsed = typeof transaction.products === 'string'
                        ? JSON.parse(transaction.products)
                        : transaction.products;

                    // Initialize cart (needs id, name, price at minimum)
                    setCart(parsed.map(p => ({
                        id: p.product_id || p.id,
                        name: p.name,
                        price: parseFloat(p.price),
                        quantity: p.quantity,
                    })));
                } catch (e) {
                    console.error("Error parsing products", e);
                }
            } else {
                setType('simple');
            }
        }
    }, [isOpen, transaction]);

    const fetchProducts = async () => {
        try {
            const res = await axios.get(`${API_URL}/products?in_stock=true`);
            setProducts(res.data);
        } catch (error) {
            console.error('Error fetching products:', error);
        }
    };

    // --- Cart Logic (Venta Mak) ---
    const addToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
            }
            return [...prev, { id: product.id, name: product.name, price: parseFloat(product.price), quantity: 1 }];
        });
    };

    const removeFromCart = (productId) => {
        setCart(prev => prev.filter(item => item.id !== productId));
    };

    const updateCartQuantity = (productId, delta) => {
        setCart(prev => prev.map(item => {
            if (item.id === productId) {
                const newQty = item.quantity + delta;
                return newQty > 0 ? { ...item, quantity: newQty } : item;
            }
            return item;
        }));
    };

    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // --- Submit ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                method: formData.method,
                description: formData.description,
                date: formData.date
            };

            if (type === 'venta_mak') {
                payload.products = cart.map(item => ({
                    id: item.id,
                    quantity: item.quantity,
                    price: item.price
                }));
            } else {
                payload.amount = parseFloat(formData.amount);
            }

            await axios.put(`${API_URL}/transactions/${transaction.id}`, payload);

            onSuccess();
            onClose();
        } catch (error) {
            alert('Error updating transaction: ' + (error.response?.data?.message || error.message));
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className={`bg-white rounded-lg shadow-xl w-full ${type === 'venta_mak' ? 'max-w-4xl h-[80vh]' : 'max-w-md'} flex flex-col`}>

                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-lg font-bold text-gray-800">Editar Transacción #{transaction?.id}</h3>
                    <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-700" /></button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">

                    {/* Venta Mak: Product Selector (Left Panel) */}
                    {type === 'venta_mak' && (
                        <div className="w-full md:w-1/2 border-r bg-gray-50 flex flex-col">
                            <div className="p-3 border-b">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Buscar productos..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-3 content-start">
                                {products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(product => (
                                    <div
                                        key={product.id}
                                        onClick={() => addToCart(product)}
                                        className="bg-white p-3 rounded shadow-sm border cursor-pointer hover:border-blue-400 active:scale-95 transition"
                                    >
                                        <div className="font-semibold text-sm line-clamp-1">{product.name}</div>
                                        <div className="flex justify-between items-center mt-1">
                                            <span className="text-xs text-gray-500">Stock: {product.stock}</span>
                                            <span className="text-sm font-bold text-blue-600">S/ {product.price}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Form / Cart (Right/Main Panel) */}
                    <div className={`flex-1 p-6 overflow-y-auto ${type === 'venta_mak' ? 'bg-white' : ''}`}>
                        <form onSubmit={handleSubmit} className="space-y-4">

                            {/* Simple Amount (Hidden for Venta Mak since it's calc'd) */}
                            {type !== 'venta_mak' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Monto (S/)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={formData.amount}
                                        onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                        className="w-full border rounded-md p-2"
                                    />
                                </div>
                            )}

                            {/* Venta Mak Cart Display */}
                            {type === 'venta_mak' && (
                                <div className="mb-4">
                                    <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2"><ShoppingCart size={18} /> Carrito Editado</h4>
                                    <div className="border rounded-lg overflow-hidden bg-gray-50">
                                        <div className="max-h-60 overflow-y-auto divide-y">
                                            {cart.length === 0 ? (
                                                <p className="p-4 text-center text-gray-400 text-sm">Carrito vacío</p>
                                            ) : (
                                                cart.map(item => (
                                                    <div key={item.id} className="flex justify-between items-center p-2 bg-white">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-medium truncate">{item.name}</div>
                                                            <div className="text-xs text-gray-500">S/ {item.price} x {item.quantity}</div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex items-center border rounded bg-white">
                                                                <button type="button" onClick={() => updateCartQuantity(item.id, -1)} className="px-2 hover:bg-gray-100">-</button>
                                                                <span className="text-sm w-4 text-center">{item.quantity}</span>
                                                                <button type="button" onClick={() => updateCartQuantity(item.id, 1)} className="px-2 hover:bg-gray-100">+</button>
                                                            </div>
                                                            <button type="button" onClick={() => removeFromCart(item.id)} className="text-red-500 p-1 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                        <div className="p-3 bg-gray-100 border-t flex justify-between items-center">
                                            <span className="font-semibold text-gray-700">Nuevo Total:</span>
                                            <span className="font-bold text-lg text-blue-700">S/ {cartTotal.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-orange-600 mt-2">
                                        ⚠️ Al guardar, el stock se recalculará (Devolución de lo anterior + Descuento de lo nuevo).
                                    </p>
                                </div>
                            )}

                            {/* Common Fields */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full border rounded-md p-2 h-20"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Método</label>
                                    <select
                                        value={formData.method}
                                        onChange={e => setFormData({ ...formData, method: e.target.value })}
                                        className="w-full border rounded-md p-2"
                                    >
                                        <option value="cash">Efectivo</option>
                                        <option value="card">Tarjeta</option>
                                        <option value="yape">Yape</option>
                                        <option value="plin">Plin</option>
                                        <option value="transfer">Transferencia</option>
                                        <option value="room_charge">Cargo Habitación</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                                    <input
                                        type="datetime-local"
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                        className="w-full border rounded-md p-2"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3 justify-end border-t mt-4">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || (type === 'venta_mak' && cart.length === 0)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
                                >
                                    {loading && <Loader size={16} className="animate-spin" />}
                                    Guardar Cambios
                                </button>
                            </div>

                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditTransactionModal;
