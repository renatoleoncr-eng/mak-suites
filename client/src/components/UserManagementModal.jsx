import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { X, UserPlus, Edit, Trash2, Shield, ArrowLeft, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const UserManagementModal = ({ isOpen, onClose }) => {
    const { user: currentUser } = useAuth();

    // Views: 'list' | 'form'
    const [view, setView] = useState('list');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // List State
    const [users, setUsers] = useState([]);

    // Form State (Create/Edit)
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({
        username: '',
        name: '',
        role: 'counter',
        password: '',
        confirmPassword: ''
    });

    // Password Confirmation State
    const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
    const [confirmAction, setConfirmAction] = useState(null); // 'save' or 'delete'
    const [confirmPayload, setConfirmPayload] = useState(null); // data for the action
    const [adminPassword, setAdminPassword] = useState('');

    useEffect(() => {
        if (isOpen) {
            setView('list');
            fetchUsers();
            setError('');
            setShowPasswordConfirm(false);
            setAdminPassword('');
        }
    }, [isOpen]);

    // Handle ESC key
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/users`);
            setUsers(res.data);
        } catch (err) {
            setError('Error al cargar usuarios');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (user) => {
        setEditingUser(user);
        setFormData({
            username: user.username,
            name: user.name,
            role: user.role,
            password: '',
            confirmPassword: ''
        });
        setView('form');
        setError('');
    };

    const handleCreate = () => {
        setEditingUser(null);
        setFormData({
            username: '',
            name: '',
            role: 'counter',
            password: '',
            confirmPassword: ''
        });
        setView('form');
        setError('');
    };

    // --- ACCIONES REQUERIDAS DE CONFIRMACIÓN ---

    const initiateDelete = (userId) => {
        setConfirmAction('delete');
        setConfirmPayload(userId);
        setError('');
        setAdminPassword('');
        setShowPasswordConfirm(true);
    };

    const initiateSave = (e) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        if (!editingUser && !formData.password) {
            setError('La contraseña es obligatoria para nuevos usuarios');
            return;
        }

        setConfirmAction('save');
        setConfirmPayload(null); // No specific payload needed, uses formData
        setError('');
        setAdminPassword('');
        setShowPasswordConfirm(true);
    };

    // --- EJECUCIÓN FINAL TRAS CONFIRMACIÓN ---

    const executeAction = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // 1. Verify Admin Password
            const verifyRes = await axios.post(`${API_URL}/auth/verify`, {
                username: currentUser.username, // Use logged-in admin's username
                password: adminPassword
            });

            if (!verifyRes.data.valid) {
                setError('Contraseña incorrecta. No se realizaron cambios.');
                setLoading(false);
                return;
            }

            // 2. Execute Resulting Action
            if (confirmAction === 'delete') {
                await axios.delete(`${API_URL}/users/${confirmPayload}`);
                setShowPasswordConfirm(false);
                fetchUsers(); // Refresh list
            } else if (confirmAction === 'save') {
                const payload = {
                    username: formData.username,
                    name: formData.name,
                    role: formData.role
                };
                if (formData.password) {
                    payload.password = formData.password;
                }

                if (editingUser) {
                    await axios.put(`${API_URL}/users/${editingUser.id}`, payload);
                } else {
                    await axios.post(`${API_URL}/auth/register`, payload);
                }
                setShowPasswordConfirm(false);
                setView('list');
                fetchUsers();
            }

        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'Error al procesar la solicitud');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b bg-gray-50 sticky top-0 z-10">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Shield className="text-blue-600" />
                        {view === 'list' && 'Gestionar Usuarios'}
                        {view === 'form' && (editingUser ? 'Editar Usuario' : 'Crear Usuario')}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6">
                    {/* List View */}
                    {view === 'list' && (
                        <div>
                            <div className="flex justify-end mb-4">
                                <button
                                    onClick={handleCreate}
                                    className="px-4 py-2 bg-green-600 text-white rounded flex items-center gap-2 hover:bg-green-700 font-medium transition"
                                >
                                    <UserPlus size={18} />
                                    Nuevo Usuario
                                </button>
                            </div>
                            <div className="overflow-x-auto border rounded-lg">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-gray-100 text-left text-sm text-gray-600 uppercase tracking-wider">
                                            <th className="p-3 border-b">Nombre</th>
                                            <th className="p-3 border-b">Usuario</th>
                                            <th className="p-3 border-b">Rol</th>
                                            <th className="p-3 border-b text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {users.map(u => (
                                            <tr key={u.id} className="hover:bg-gray-50 transition">
                                                <td className="p-3 font-medium text-gray-900">{u.name}</td>
                                                <td className="p-3 font-mono text-sm text-gray-600">{u.username}</td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                                                        {u.role === 'admin' ? 'Administrador' : 'Recepcionista'}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-right space-x-2">
                                                    <button onClick={() => handleEdit(u)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition" title="Editar">
                                                        <Edit size={18} />
                                                    </button>
                                                    <button onClick={() => initiateDelete(u.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded transition" title="Eliminar">
                                                        <Trash2 size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Form View */}
                    {view === 'form' && (
                        <form onSubmit={initiateSave} className="space-y-4 max-w-lg mx-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
                                    <input
                                        type="text"
                                        value={formData.username}
                                        onChange={e => setFormData({ ...formData, username: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                                <select
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="counter">Recepcionista (Counter)</option>
                                    <option value="admin">Administrador</option>
                                </select>
                            </div>

                            <div className="border-t pt-4 mt-4">
                                <h4 className="text-sm font-semibold text-gray-900 mb-3">
                                    {editingUser ? 'Cambiar Contraseña (Opcional)' : 'Contraseña'}
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">
                                            {editingUser ? 'Nueva Contraseña' : 'Contraseña'}
                                        </label>
                                        <input
                                            type="password"
                                            value={formData.password}
                                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder={editingUser ? 'Dejar en blanco para mantener' : ''}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Confirmar Contraseña</label>
                                        <input
                                            type="password"
                                            value={formData.confirmPassword}
                                            onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder={editingUser ? 'Confirmar nueva contraseña' : ''}
                                        />
                                    </div>
                                </div>
                            </div>

                            {error && !showPasswordConfirm && <p className="text-red-600 text-sm font-medium bg-red-50 p-2 rounded">{error}</p>}

                            <div className="pt-4 flex justify-between">
                                <button
                                    type="button"
                                    onClick={() => setView('list')}
                                    className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition"
                                >
                                    <ArrowLeft size={16} />
                                    Volver
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition shadow-sm"
                                >
                                    {loading ? 'Procesando...' : (editingUser ? 'Guardar Cambios' : 'Crear Usuario')}
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                {/* --- PASSWORD CONFIRMATION MODAL --- */}
                {showPasswordConfirm && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-30 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm border border-gray-200 p-6 animate-in fade-in zoom-in duration-200">
                            <div className="text-center mb-6">
                                <div className="bg-yellow-100 p-3 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                                    <Lock className="text-yellow-600" size={24} />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900">Confirmación de Seguridad</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    Para {confirmAction === 'save' ? 'guardar los cambios' : 'eliminar este usuario'},
                                    ingrese su contraseña actual.
                                </p>
                            </div>

                            <form onSubmit={executeAction}>
                                <div className="mb-4">
                                    <input
                                        type="password"
                                        placeholder="Su contraseña de administrador"
                                        className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-lg"
                                        value={adminPassword}
                                        onChange={(e) => setAdminPassword(e.target.value)}
                                        autoFocus
                                        required
                                    />
                                </div>

                                {error && <p className="text-red-600 text-sm font-medium text-center mb-4">{error}</p>}

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => { setShowPasswordConfirm(false); setError(''); }}
                                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className={`flex-1 px-4 py-2 rounded-lg text-white font-medium transition shadow-sm
                                            ${confirmAction === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}
                                        `}
                                        disabled={loading}
                                    >
                                        {loading ? 'Verificando...' : 'Confirmar'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default UserManagementModal;
