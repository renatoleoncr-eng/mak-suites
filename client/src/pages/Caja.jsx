import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import EditTransactionModal from '../components/EditTransactionModal';
import { useAuth } from '../context/AuthContext';
import { DollarSign, TrendingUp, TrendingDown, Calendar, ShoppingCart, Home, Trash2, Search, X, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { compressImage } from '../utils/imageUtils';

const Caja = () => {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    // Data for modals
    const [rooms, setRooms] = useState([]);
    const [products, setProducts] = useState([]);

    // Modals state
    const [activeModal, setActiveModal] = useState(null); // 'ventaMakala', 'ventaMak', 'egreso'

    // Form States
    const [makalaForm, setMakalaForm] = useState({ room_id: '', amount: '', method: 'cash', description: '', payment_evidence: '' });
    const [makForm, setMakForm] = useState({ cart: [], method: 'cash', description: '', payment_evidence: '', room_id: '' });
    const [egresoForm, setEgresoForm] = useState({ category: '', amount: '', description: '' });

    // Helper for Venta Mak UI
    const [searchTerm, setSearchTerm] = useState('');

    // --- Helper Functions ---
    const closeModals = () => {
        setActiveModal(null);
        setSearchTerm('');
        // Reset forms
        setMakalaForm({ room_id: '', amount: '', method: 'cash', description: '', payment_evidence: '' });
        setMakForm({ cart: [], method: 'cash', description: '', payment_evidence: '', room_id: '' });
        setEgresoForm({ category: '', amount: '', description: '' });
    };

    const handleFileChange = async (e, setForm) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const compressedBase64 = await compressImage(file);
                setForm(prev => ({ ...prev, payment_evidence: compressedBase64 }));
            } catch (error) {
                console.error('Error compressing image in Caja:', error);
                alert('Error al procesar la imagen');
            }
        }
    };

    // --- Shortcuts ---
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') closeModals();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeModal]);

    // --- Cart Logic for Venta Mak ---
    const addToCart = (product) => {
        if (product.stock <= 0) return;
        setMakForm(prev => {
            const existing = prev.cart.find(item => item.id === product.id);
            if (existing) {
                if (existing.quantity >= product.stock) return prev;
                return {
                    ...prev,
                    cart: prev.cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
                };
            }
            return {
                ...prev,
                cart: [...prev.cart, { id: product.id, name: product.name, price: product.price, quantity: 1, stock: product.stock }]
            };
        });
    };

    const removeFromCart = (productId) => {
        setMakForm(prev => ({
            ...prev,
            cart: prev.cart.filter(item => item.id !== productId)
        }));
    };

    const updateCartQuantity = (productId, delta) => {
        setMakForm(prev => ({
            ...prev,
            cart: prev.cart.map(item => {
                if (item.id === productId) {
                    const newQty = item.quantity + delta;
                    if (newQty <= 0) return item; // Min 1
                    if (newQty > item.stock) return item; // Max Stock
                    return { ...item, quantity: newQty };
                }
                return item;
            })
        }));
    };

    const cartTotal = makForm.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // --- Fetching ---
    useEffect(() => {
        fetchTransactions();
        fetchRooms();
        fetchProducts();
    }, [startDate, endDate]);

    const fetchTransactions = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${API_URL}/transactions`, {
                params: { startDate, endDate },
            });
            setTransactions(res.data);
        } catch (error) {
            console.error('Error fetching transactions:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchRooms = async () => {
        try {
            const res = await axios.get(`${API_URL}/rooms`);
            setRooms(res.data);
        } catch (error) {
            console.error('Error fetching rooms:', error);
        }
    };

    const fetchProducts = async () => {
        try {
            const res = await axios.get(`${API_URL}/products?in_stock=true`);
            setProducts(res.data.filter(p => p.stock > 0));

        } catch (error) {
            console.error('Error fetching products:', error);
        }
    };

    // --- Submit Handlers ---
    const [editForm, setEditForm] = useState({ id: null, amount: '', description: '', method: '', date: '' });

    const handleMakalaSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_URL}/transactions/venta-makala`, {
                ...makalaForm,
                amount: parseFloat(makalaForm.amount)
            });
            closeModals();
            fetchTransactions();
        } catch (error) {
            alert('Error: ' + (error.response?.data?.message || error.message));
        }
    };

    const handleMakSubmit = async (e) => {
        e.preventDefault();
        if (makForm.cart.length === 0) return alert('El carrito está vacío');
        try {
            await axios.post(`${API_URL}/transactions/venta-mak`, {
                products: makForm.cart,
                method: makForm.method,
                description: makForm.description,
                payment_evidence: makForm.payment_evidence,
                room_id: makForm.room_id
            });
            closeModals();
            fetchTransactions();
            fetchProducts(); // Refresh stock
        } catch (error) {
            alert('Error: ' + (error.response?.data?.message || error.message));
        }
    };

    const handleEgresoSubmit = async (e) => {
        e.preventDefault();

        // Calculate current cash balance
        const currentCashBalance = transactions.reduce((acc, curr) => {
            if (curr.method === 'cash') {
                return curr.type === 'income' ? acc + parseFloat(curr.amount) : acc - parseFloat(curr.amount);
            }
            return acc;
        }, 0);

        const amount = parseFloat(egresoForm.amount);
        if (amount > currentCashBalance) {
            alert(`No puedes registrar un egreso mayor al efectivo disponible (S/ ${currentCashBalance.toFixed(2)})`);
            return;
        }

        try {
            await axios.post(`${API_URL}/transactions/egreso`, {
                ...egresoForm,
                amount
            });
            alert('Egreso registrado correctamente');
            closeModals();
            fetchTransactions();
        } catch (error) {
            alert('Error: ' + (error.response?.data?.message || error.message));
        }
    };


    const openEditModal = (transaction) => {
        setEditForm(transaction); // Store entire transaction object
        setActiveModal('edit');
    };

    // --- Labels & Calcs ---
    const getTransactionTypeLabel = (type) => {
        const labels = {
            'venta_makala': 'Venta Makala',
            'venta_mak': 'Venta Mak',
            'reservation_payment': 'Reserva',
            'egreso': 'Egreso'
        };
        return labels[type] || type;
    };

    const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const totalBalance = totalIncome - totalExpense;

    const cashBalance = transactions.reduce((acc, curr) => {
        if (curr.method === 'cash') {
            return curr.type === 'income' ? acc + parseFloat(curr.amount) : acc - parseFloat(curr.amount);
        }
        return acc;
    }, 0);

    return (
        <div className="p-8">
            <div className="flex justify-start items-center mb-6 gap-4">
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700">Desde:</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border rounded p-2" />
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700">Hasta:</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border rounded p-2" />
                </div>
            </div >

            {/* Summary Cards */}
            < div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8" >
                <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm text-gray-500 uppercase font-semibold">Ingresos</p>
                            <h3 className="text-2xl font-bold mt-1 text-green-600">S/ {totalIncome.toFixed(2)}</h3>
                        </div>
                        <div className="p-2 bg-green-100 rounded-full text-green-600"><TrendingUp size={24} /></div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border-l-4 border-red-500">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm text-gray-500 uppercase font-semibold">Egresos</p>
                            <h3 className="text-2xl font-bold mt-1 text-red-600">S/ {totalExpense.toFixed(2)}</h3>
                        </div>
                        <div className="p-2 bg-red-100 rounded-full text-red-600"><TrendingDown size={24} /></div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm text-gray-500 uppercase font-semibold">Balance Total</p>
                            <h3 className={`text-2xl font-bold mt-1 ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                S/ {totalBalance.toFixed(2)}
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">Efectivo: S/ {cashBalance.toFixed(2)}</p>
                        </div>
                        <div className="p-2 bg-blue-100 rounded-full text-blue-600"><DollarSign size={24} /></div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 justify-center">
                    <button
                        onClick={() => setActiveModal('ventaMakala')}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
                    >
                        <Home size={20} /> Nueva Venta Makala
                    </button>
                    <button
                        onClick={() => setActiveModal('ventaMak')}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2"
                    >
                        <ShoppingCart size={20} /> Nueva Venta Mak
                    </button>
                    <button
                        onClick={() => setActiveModal('egreso')}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition flex items-center justify-center gap-2"
                    >
                        <TrendingDown size={20} /> Registrar Egreso
                    </button>
                </div>
            </div >

            {/* Transactions Table */}
            {
                loading ? (
                    <div className="text-center py-10">Cargando transacciones...</div>
                ) : (
                    <div className="bg-white rounded-lg shadow overflow-hidden overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Habitación</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monto</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Método</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {transactions.filter(t => t.type !== 'charge').map((transaction) => (
                                    <tr key={transaction.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {format(new Date(transaction.date), 'dd/MM/yyyy HH:mm')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                            {transaction.Creator?.name || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full 
                                            ${transaction.type === 'income' ? 'bg-green-100 text-green-800' :
                                                    transaction.type === 'expense' ? 'bg-red-100 text-red-800' :
                                                        'bg-orange-100 text-orange-800'}`}>
                                                {getTransactionTypeLabel(transaction.transaction_type)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{transaction.category}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {transaction.Room ? `#${transaction.Room.number}` : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            S/ {parseFloat(transaction.amount).toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{transaction.method}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500 relative group">
                                            {transaction.description || '-'}
                                            {['venta_makala', 'venta_mak', 'egreso'].includes(transaction.transaction_type) && (
                                                <button
                                                    onClick={() => openEditModal(transaction)}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 text-blue-600 hover:bg-blue-50 rounded"
                                                    title="Editar"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            }

            {/* Venta Makala Modal */}
            {
                activeModal === 'ventaMakala' && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                            <h2 className="text-xl font-bold mb-4">Nueva Venta Makala</h2>
                            <form onSubmit={handleMakalaSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Habitación</label>
                                    <select
                                        required
                                        value={makalaForm.room_id}
                                        onChange={(e) => setMakalaForm({ ...makalaForm, room_id: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2"
                                    >
                                        <option value="">Seleccionar Habitación</option>
                                        {rooms.filter(room => room.has_checked_in_reservation).map(room => (
                                            <option key={room.id} value={room.id}>#{room.number} - {room.type}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Monto (S/)</label>
                                    <input
                                        required
                                        type="number"
                                        step="0.01"
                                        value={makalaForm.amount}
                                        onChange={(e) => setMakalaForm({ ...makalaForm, amount: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Método de Pago</label>
                                    <select
                                        value={makalaForm.method}
                                        onChange={(e) => setMakalaForm({ ...makalaForm, method: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2"
                                    >
                                        <option value="cash">Efectivo</option>
                                        <option value="card">Tarjeta</option>
                                        <option value="transfer">Transferencia</option>
                                        <option value="yape">Yape</option>
                                        {makalaForm.room_id && <option value="room_charge">Cargo a Habitación</option>}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Descripción</label>
                                    <textarea
                                        value={makalaForm.description}
                                        onChange={(e) => setMakalaForm({ ...makalaForm, description: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2"
                                    />
                                </div>
                                {makalaForm.method !== 'cash' && makalaForm.method !== 'room_charge' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Evidencia de Pago</label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => handleFileChange(e, setMakalaForm)}
                                            className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                        />
                                    </div>
                                )}
                                <div className="flex justify-end gap-2 mt-4">
                                    <button
                                        type="button"
                                        onClick={closeModals}
                                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                    >
                                        Registrar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Venta Mak Modal (POS Style) */}
            {
                activeModal === 'ventaMak' && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl h-[90vh] lg:h-[85vh] flex flex-col lg:flex-row overflow-hidden">

                            {/* Left: Product Grid */}
                            <div className="flex-1 flex flex-col border-r bg-gray-50">
                                <div className="p-4 border-b bg-white shadow-sm z-10">
                                    <h2 className="text-xl font-bold mb-2 text-gray-800">Productos</h2>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                                        <input
                                            type="text"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            placeholder="Buscar productos..."
                                            className="pl-10 w-full rounded-lg border-gray-300 shadow-sm border p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4">
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(product => (
                                            <div
                                                key={product.id}
                                                onClick={() => addToCart(product)}
                                                className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 cursor-pointer transition-all active:scale-95 flex flex-col justify-between h-32 group"
                                            >
                                                <div>
                                                    <h3 className="font-bold text-gray-800 line-clamp-2 leading-tight group-hover:text-blue-600 transition">{product.name}</h3>
                                                    <p className="text-xs text-gray-500 mt-1">Stock: <span className="font-medium text-gray-700">{product.stock}</span></p>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-bold text-lg text-blue-600">S/ {product.price}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Right: Cart & Payment */}
                            <div className="w-full lg:w-[400px] flex flex-col bg-white h-1/2 lg:h-full relative z-20 shadow-2xl border-t lg:border-t-0 lg:border-l">
                                <div className="p-4 flex justify-between items-center border-b bg-gray-50">
                                    <h2 className="text-lg font-bold flex items-center gap-2 text-gray-700"><ShoppingCart size={20} /> Carrito</h2>
                                    <button onClick={closeModals} className="text-gray-400 hover:text-gray-600 transition p-1 rounded-full hover:bg-gray-200">
                                        <X size={24} />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                    {makForm.cart.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                            <ShoppingCart size={48} className="mb-2 opacity-20" />
                                            <p>Carrito vacío</p>
                                        </div>
                                    ) : (
                                        makForm.cart.map(item => (
                                            <div key={item.id} className="flex justify-between items-center bg-white border rounded-lg p-3 shadow-sm">
                                                <div className="flex-1">
                                                    <div className="font-medium text-gray-900">{item.name}</div>
                                                    <div className="text-sm text-blue-600 font-semibold">S/ {(item.price * item.quantity).toFixed(2)}</div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center border rounded-md overflow-hidden">
                                                        <button onClick={() => updateCartQuantity(item.id, -1)} className="px-2 py-1 bg-gray-100 hover:bg-gray-200">-</button>
                                                        <span className="px-2 font-medium w-8 text-center">{item.quantity}</span>
                                                        <button onClick={() => updateCartQuantity(item.id, 1)} className="px-2 py-1 bg-gray-100 hover:bg-gray-200">+</button>
                                                    </div>
                                                    <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600">
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="p-4 border-t bg-gray-50 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
                                    <div className="flex justify-between items-end mb-4">
                                        <span className="text-gray-500 font-medium">Total a Pagar</span>
                                        <span className="text-3xl font-bold text-gray-900">S/ {cartTotal.toFixed(2)}</span>
                                    </div>

                                    <form onSubmit={handleMakSubmit} className="space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-500 mb-1">Habitación (Opcional)</label>
                                                <select
                                                    value={makForm.room_id}
                                                    onChange={(e) => setMakForm({ ...makForm, room_id: e.target.value })}
                                                    className="w-full rounded border-gray-300 p-2 text-sm"
                                                >
                                                    <option value="">Ninguna</option>
                                                    {rooms.filter(r => r.has_checked_in_reservation).map(r => (
                                                        <option key={r.id} value={r.id}>
                                                            {r.number}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-500 mb-1">Método Pago</label>
                                                <select
                                                    value={makForm.method}
                                                    onChange={(e) => setMakForm({ ...makForm, method: e.target.value })}
                                                    className="w-full rounded border-gray-300 p-2 text-sm"
                                                >
                                                    <option value="cash">Efectivo</option>
                                                    <option value="card">Tarjeta</option>
                                                    <option value="yape">Yape</option>
                                                    {makForm.room_id && <option value="room_charge">Cargo Hab.</option>}
                                                </select>
                                            </div>
                                        </div>

                                        {(makForm.method !== 'cash' && makForm.method !== 'room_charge') && (
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => handleFileChange(e, setMakForm)}
                                                className="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:bg-blue-50 file:text-blue-700"
                                            />
                                        )}

                                        <button
                                            type="submit"
                                            disabled={makForm.cart.length === 0}
                                            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                                        >
                                            Cobrar S/ {cartTotal.toFixed(2)}
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Egreso Modal */}
            {
                activeModal === 'egreso' && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                            <h2 className="text-xl font-bold mb-4">Registrar Egreso</h2>
                            <form onSubmit={handleEgresoSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Categoría</label>
                                    <select
                                        required
                                        value={egresoForm.category}
                                        onChange={(e) => setEgresoForm({ ...egresoForm, category: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2"
                                    >
                                        <option value="">Seleccionar Categoría</option>
                                        <option value="Compras">Compras</option>
                                        <option value="Servicios">Servicios</option>
                                        <option value="Salarios">Salarios</option>
                                        <option value="Mantenimiento">Mantenimiento</option>
                                        <option value="Otros">Otros</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Monto (S/)</label>
                                    <input
                                        required
                                        type="number"
                                        step="0.01"
                                        value={egresoForm.amount}
                                        onChange={(e) => setEgresoForm({ ...egresoForm, amount: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Descripción</label>
                                    <textarea
                                        required
                                        value={egresoForm.description}
                                        onChange={(e) => setEgresoForm({ ...egresoForm, description: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2"
                                    />
                                </div>
                                <div className="flex justify-end gap-2 mt-4">
                                    <button
                                        type="button"
                                        onClick={closeModals}
                                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                                    >
                                        Registrar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Edit Modal */}
            <EditTransactionModal
                transaction={activeModal === 'edit' ? editForm : null} // editForm holds the transaction object usually
                isOpen={activeModal === 'edit'}
                onClose={closeModals}
                onSuccess={fetchTransactions}
            />
        </div >
    );
};

export default Caja;
