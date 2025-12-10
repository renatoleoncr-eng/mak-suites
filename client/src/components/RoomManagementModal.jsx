import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { X, Trash2, Edit, Plus, Save } from 'lucide-react';

const RoomManagementModal = ({ mode, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [floors, setFloors] = useState([]);
    const [rooms, setRooms] = useState([]); // All rooms for listing
    const [view, setView] = useState('list'); // 'list' | 'form'

    // Forms
    const [floorForm, setFloorForm] = useState({ number: '' });

    const initialRoomForm = {
        id: null,
        floor_id: '',
        number: '',
        type: 'Matrimonial',
        customType: '',
        price_per_night: ''
    };
    const [roomForm, setRoomForm] = useState(initialRoomForm);
    const [isCustomType, setIsCustomType] = useState(false);

    // Standard Room Types
    const standardTypes = ['Simple', 'Matrimonial', 'Doble', 'Triple', 'Suite', 'Suite A/C', 'Doble Ventilador', 'Jacuzzi', 'Tina', 'Doble cocina', 'Terraza', 'Suite cocina'];

    // Close on ESC
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    useEffect(() => {
        if (mode === 'add_floor') {
            fetchFloors();
        } else if (mode === 'add_room') {
            fetchFloors();
            fetchRooms();
        }
    }, [mode]);

    const fetchFloors = async () => {
        try {
            const res = await axios.get(`${API_URL}/rooms/floors`);
            setFloors(res.data);
            if (res.data.length > 0 && !roomForm.floor_id) {
                setRoomForm(prev => ({ ...prev, floor_id: res.data[0].id }));
            }
        } catch (error) {
            console.error('Error fetching floors:', error);
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

    // --- Floor Logic ---
    const handleFloorSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await axios.post(`${API_URL}/rooms/floors`, floorForm);
            alert('Piso creado exitosamente');
            setFloorForm({ number: '' });
            fetchFloors();
            onSuccess(); // Refresh calendar if needed
        } catch (error) {
            alert('Error: ' + (error.response?.data?.message || error.message));
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteFloor = async (id) => {
        if (!window.confirm('¿Eliminar piso? Solo se puede si no tiene habitaciones.')) return;
        try {
            await axios.delete(`${API_URL}/rooms/floors/${id}`);
            fetchFloors();
            onSuccess();
        } catch (error) {
            alert('Error: ' + (error.response?.data?.message || error.message));
        }
    };

    // --- Room Logic ---
    const handleRoomSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const finalType = isCustomType ? roomForm.customType : roomForm.type;
        if (!finalType) {
            alert('El tipo de habitación es requerido');
            setLoading(false);
            return;
        }

        const payload = {
            number: roomForm.number,
            floor_id: roomForm.floor_id,
            type: finalType,
            price_per_night: parseFloat(roomForm.price_per_night)
        };

        try {
            if (roomForm.id) {
                // Update
                await axios.put(`${API_URL}/rooms/${roomForm.id}`, payload);
                alert('Habitación actualizada');
            } else {
                // Create
                await axios.post(`${API_URL}/rooms`, payload);
                alert('Habitación creada');
            }

            fetchRooms();
            onSuccess();
            setView('list'); // Return to list view
            setRoomForm(initialRoomForm); // Reset form
            setIsCustomType(false);
        } catch (error) {
            alert('Error: ' + (error.response?.data?.message || error.message));
        } finally {
            setLoading(false);
        }
    };

    const handleEditRoom = (room) => {
        // Find floor id based on number (since room.floor is number)
        const floorObj = floors.find(f => f.number === room.floor);
        const floorId = floorObj ? floorObj.id : '';

        // Check if type is custom
        const isStandard = standardTypes.includes(room.type);

        setRoomForm({
            id: room.id,
            floor_id: floorId,
            number: room.number,
            type: isStandard ? room.type : 'Otro',
            customType: isStandard ? '' : room.type,
            price_per_night: room.price_per_night
        });
        setIsCustomType(!isStandard);
        setView('form');
    };

    const handleDeleteRoom = async (id) => {
        if (!window.confirm('¿Eliminar habitación? Se requiere que no tenga reservas activas.')) return;
        try {
            await axios.delete(`${API_URL}/rooms/${id}`);
            fetchRooms();
            onSuccess();
        } catch (error) {
            alert('Error: ' + (error.response?.data?.message || error.message));
        }
    };

    // Helper to get merged types
    const getRoomTypes = () => {
        // We can add dynamically found types from existing rooms if we want, 
        // but for now standard + Custom option is good.
        return standardTypes;
    };

    return (
        <div className="fixed inset-0 bg-green-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
                <div className="flex justify-between items-center p-4 border-b shrink-0">
                    <h2 className="text-xl font-bold text-gray-800">
                        {mode === 'add_floor' ? 'Gestionar Pisos' : (view === 'list' ? 'Gestionar Habitaciones' : (roomForm.id ? 'Editar Habitación' : 'Nueva Habitación'))}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto grow">
                    {/* --- FLOOR MODE --- */}
                    {mode === 'add_floor' && (
                        <div className="space-y-6">
                            {/* Create Floor */}
                            <form onSubmit={handleFloorSubmit} className="flex gap-4 items-end bg-gray-50 p-4 rounded-md">
                                <div className="grow">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nuevo Piso (Número)</label>
                                    <input
                                        type="number"
                                        required
                                        value={floorForm.number}
                                        onChange={(e) => setFloorForm({ number: e.target.value })}
                                        className="w-full border rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Ej: 5"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 h-10"
                                >
                                    Agregar
                                </button>
                            </form>

                            {/* List Floors */}
                            <div className="border rounded-md overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-100 text-gray-700 uppercase">
                                        <tr>
                                            <th className="px-4 py-3">Piso</th>
                                            <th className="px-4 py-3 text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {floors.map(f => (
                                            <tr key={f.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 font-medium">Piso {f.number}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        onClick={() => handleDeleteFloor(f.id)}
                                                        className="text-red-600 hover:text-red-800 p-1"
                                                        title="Eliminar Piso"
                                                    >
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

                    {/* --- ROOM MODE --- */}
                    {mode === 'add_room' && (
                        <>
                            {view === 'list' ? (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <p className="text-sm text-gray-500">{rooms.length} habitaciones encontradas</p>
                                        <button
                                            onClick={() => {
                                                setRoomForm(initialRoomForm);
                                                setIsCustomType(false);
                                                // Default floor selection
                                                if (floors.length > 0) setRoomForm(prev => ({ ...prev, floor_id: floors[0].id }));
                                                setView('form');
                                            }}
                                            className="bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 flex items-center gap-2 text-sm"
                                        >
                                            <Plus size={16} /> Nueva Habitación
                                        </button>
                                    </div>

                                    <div className="border rounded-md overflow-hidden">
                                        <div className="max-h-[400px] overflow-y-auto">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-gray-100 text-gray-700 uppercase sticky top-0">
                                                    <tr>
                                                        <th className="px-4 py-3">Hab.</th>
                                                        <th className="px-4 py-3">Piso</th>
                                                        <th className="px-4 py-3">Tipo</th>
                                                        <th className="px-4 py-3">Precio</th>
                                                        <th className="px-4 py-3 text-right">Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {rooms.map(room => (
                                                        <tr key={room.id} className="hover:bg-gray-50">
                                                            <td className="px-4 py-3 font-bold">{room.number}</td>
                                                            <td className="px-4 py-3">{room.floor}</td>
                                                            <td className="px-4 py-3">{room.type}</td>
                                                            <td className="px-4 py-3">S/ {room.price_per_night}</td>
                                                            <td className="px-4 py-3 text-right space-x-2">
                                                                <button onClick={() => handleEditRoom(room)} className="text-blue-600 hover:text-blue-800"><Edit size={16} /></button>
                                                                <button onClick={() => handleDeleteRoom(room.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={handleRoomSubmit} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Piso</label>
                                            <select
                                                required
                                                value={roomForm.floor_id}
                                                onChange={(e) => setRoomForm({ ...roomForm, floor_id: e.target.value })}
                                                className="w-full border rounded-md p-2"
                                            >
                                                <option value="">Seleccionar Piso</option>
                                                {floors.map(f => (
                                                    <option key={f.id} value={f.id}>Piso {f.number}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
                                            <input
                                                type="text"
                                                required
                                                value={roomForm.number}
                                                onChange={(e) => setRoomForm({ ...roomForm, number: e.target.value })}
                                                className="w-full border rounded-md p-2"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                                            <select
                                                value={isCustomType ? 'Otro' : roomForm.type}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === 'Otro') {
                                                        setIsCustomType(true);
                                                        setRoomForm(prev => ({ ...prev, customType: '' }));
                                                    } else {
                                                        setIsCustomType(false);
                                                        setRoomForm(prev => ({ ...prev, type: val }));
                                                    }
                                                }}
                                                className="w-full border rounded-md p-2"
                                            >
                                                {getRoomTypes().map(t => (
                                                    <option key={t} value={t}>{t}</option>
                                                ))}
                                                <option value="Otro">Otro / Nuevo...</option>
                                            </select>
                                            {isCustomType && (
                                                <input
                                                    type="text"
                                                    required={isCustomType}
                                                    value={roomForm.customType}
                                                    onChange={(e) => setRoomForm({ ...roomForm, customType: e.target.value })}
                                                    className="w-full border rounded-md p-2 mt-2 bg-yellow-50"
                                                    placeholder="Escriba el nuevo tipo"
                                                    autoFocus
                                                />
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Precio (S/)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                required
                                                value={roomForm.price_per_night}
                                                onChange={(e) => setRoomForm({ ...roomForm, price_per_night: e.target.value })}
                                                className="w-full border rounded-md p-2"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-4 border-t">
                                        <button
                                            type="button"
                                            onClick={() => setView('list')}
                                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                                        >
                                            <Save size={18} />
                                            {loading ? 'Guardando...' : 'Guardar'}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RoomManagementModal;
