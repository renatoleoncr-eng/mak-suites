import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Edit, LogOut, DollarSign, Trash2, Eye, SprayCan } from 'lucide-react';
import ReservationManager from '../components/ReservationManager';
import PaymentModal from '../components/PaymentModal'; // Keeping PaymentModal separate for now as it wasn't explicitly requested to be merged, but could be later.

const Dashboard = () => {
    const { user } = useAuth();
    const [rooms, setRooms] = useState([]);
    const [reservations, setReservations] = useState([]);
    const [loading, setLoading] = useState(true);
    // Removed view state - Dashboard is now List View only
    const [reservationSubTab, setReservationSubTab] = useState('active');
    const [showCompleted, setShowCompleted] = useState(false);
    const [refreshCalendar, setRefreshCalendar] = useState(0);

    // Unified Modal State
    const [managerState, setManagerState] = useState({
        isOpen: false,
        mode: 'create', // create, view, edit, checkin, checkout
        reservation: null,
        initialData: null
    });

    const [selectedReservationForPayment, setSelectedReservationForPayment] = useState(null);

    useEffect(() => {
        fetchRooms();
        fetchReservations();
    }, []);

    const fetchRooms = async () => {
        try {
            const res = await axios.get(`${API_URL}/rooms`);
            setRooms(res.data);
        } catch (error) {
            console.error('Error fetching rooms:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchReservations = async () => {
        try {
            const res = await axios.get(`${API_URL}/reservations`);
            setReservations(res.data);
        } catch (error) {
            console.error('Error fetching reservations:', error);
        }
    };

    const markRoomAsClean = async (roomId) => {
        try {
            await axios.put(`${API_URL}/rooms/${roomId}/clean`);
            fetchRooms();
            fetchReservations(); // Refresh reservations to remove from "Por Limpiar" list
            alert('Habitación marcada como limpia');
        } catch (error) {
            console.error('Error marking room as clean:', error);
            alert('Error al marcar habitación como limpia');
        }
    };

    const handleSuccess = () => {
        fetchRooms();
        fetchReservations();
        setRefreshCalendar(prev => prev + 1);
        setManagerState({ isOpen: false, mode: 'create', reservation: null, initialData: null });
        setSelectedReservationForPayment(null);
    };

    const openManager = (mode, reservation = null, initialData = null) => {
        setManagerState({
            isOpen: true,
            mode,
            reservation,
            initialData
        });
    };

    const handleDeleteReservation = async (reservationId) => {
        if (!window.confirm('¿Está seguro de eliminar esta reserva? Esta acción no se puede deshacer.')) {
            return;
        }

        try {
            await axios.delete(`${API_URL}/reservations/${reservationId}`);
            alert('Reserva eliminada exitosamente');
            handleSuccess();
        } catch (error) {
            console.error('Error deleting reservation:', error);
            alert(error.response?.data?.message || 'Error al eliminar reserva');
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'reserved':
                return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Hab Reservada</span>;
            case 'checked_in':
                return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Huesped Hospedado</span>;
            case 'checked_out':
                return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Por Limpiar</span>;
            case 'cleaning':
                return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">Limpiando</span>;
            case 'completed':
                return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">Completada</span>;
            default:
                return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">{status}</span>;
        }
    };

    const activeReservations = reservations.filter(r => {
        if (user?.role === 'counter' && r.status === 'completed') return false;
        if (user?.role === 'admin' && r.status === 'completed' && !showCompleted) return false;
        return r.status === 'reserved' || r.status === 'checked_in' || r.status === 'checked_out' || r.status === 'cleaning' || r.status === 'completed';
    });

    const cleaningReservations = reservations.filter(r =>
        r.status === 'checked_out' || r.status === 'cleaning'
    );

    // In render:
    return (
        <div className="p-8">
            {loading ? (
                <div className="text-center py-10">Cargando...</div>
            ) : (
                <div>
                    <div className="flex flex-wrap gap-2 mb-4 mt-4">
                        <button
                            onClick={() => setReservationSubTab('active')}
                            className="px-4 py-2 rounded-md font-medium bg-blue-600 text-white"
                        >
                            Administrar Reservas ({activeReservations.length})
                        </button>
                        {user?.role === 'admin' && (
                            <button
                                onClick={() => setShowCompleted(!showCompleted)}
                                className={`ml-auto px-4 py-2 rounded-md font-medium ${showCompleted ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                            >
                                {showCompleted ? 'Ocultar' : 'Mostrar'} Completadas
                            </button>
                        )}
                    </div>

                    {reservationSubTab === 'active' && (
                        <div className="bg-white rounded-lg shadow">
                            {activeReservations.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">No hay reservas activas</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Habitación</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Huésped</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fechas</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Debe</th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {activeReservations.map((reservation) => {
                                                const consumptionTotal = parseFloat(reservation.consumption_total || 0);
                                                const grandTotal = parseFloat(reservation.total_amount) + consumptionTotal;
                                                const dueAmount = grandTotal - parseFloat(reservation.paid_amount || 0);
                                                return (
                                                    <tr key={reservation.id} className="hover:bg-gray-50">
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="text-sm font-mono font-bold text-blue-600">{reservation.reservation_code}</div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(reservation.status)}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="text-sm font-medium text-gray-900">#{reservation.Room?.number}</div>
                                                            <div className="text-xs text-gray-500">{reservation.Room?.type}</div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="text-sm text-gray-900">{reservation.Guest?.name}</div>
                                                            <div className="text-xs text-gray-500">{reservation.Guest?.doc_number}</div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {reservation.reservation_type === 'hourly' ? (
                                                                <div className="flex flex-col">
                                                                    <span className="font-semibold">{reservation.start_date}</span>
                                                                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full w-fit mt-1">Por horas</span>
                                                                </div>
                                                            ) : (
                                                                <div className="flex flex-col">
                                                                    <span>{reservation.start_date}</span>
                                                                    <span className="text-gray-400 text-xs text-center">↓</span>
                                                                    <span>{reservation.end_date}</span>
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                                            S/ {dueAmount.toFixed(2)}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm font-medium">
                                                            <div className="flex flex-wrap gap-2 justify-end">
                                                                <button
                                                                    onClick={() => openManager('view', reservation)}
                                                                    className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                                                                    title="Ver Detalles"
                                                                >
                                                                    <Eye size={14} className="mr-1" />
                                                                    Ver
                                                                </button>
                                                                {reservation.status === 'reserved' && (
                                                                    <button
                                                                        onClick={() => openManager('checkin', reservation)}
                                                                        className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700"
                                                                        title="Check-in"
                                                                    >
                                                                        <UserPlus size={14} className="mr-1" />
                                                                        Check-in
                                                                    </button>
                                                                )}
                                                                {reservation.status === 'checked_in' && (
                                                                    <button
                                                                        onClick={() => openManager('checkout', reservation)}
                                                                        className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700"
                                                                        title="Check-out"
                                                                    >
                                                                        <LogOut size={14} className="mr-1" />
                                                                        Check-out
                                                                    </button>
                                                                )}
                                                                {(reservation.status === 'checked_out' || reservation.status === 'cleaning') && (
                                                                    <button
                                                                        onClick={() => markRoomAsClean(reservation.room_id)}
                                                                        className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-white bg-cyan-600 hover:bg-cyan-700"
                                                                        title="Confirmar Limpieza"
                                                                    >
                                                                        <SprayCan size={14} className="mr-1" />
                                                                        Limpieza
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => setSelectedReservationForPayment(reservation)}
                                                                    className="inline-flex items-center px-2 py-1 border border-blue-500 text-xs font-medium rounded text-blue-600 bg-white hover:bg-blue-50"
                                                                    title="Registrar Pago"
                                                                >
                                                                    <DollarSign size={14} className="mr-1" />
                                                                    Pago
                                                                </button>
                                                                <button
                                                                    onClick={() => openManager('edit', reservation)}
                                                                    className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                                                                    title="Editar Reserva"
                                                                >
                                                                    <Edit size={14} className="mr-1" />
                                                                    Editar
                                                                </button>
                                                                {user?.role === 'admin' && (
                                                                    <button
                                                                        onClick={() => handleDeleteReservation(reservation.id)}
                                                                        className="inline-flex items-center px-2 py-1 border border-red-500 text-xs font-medium rounded text-red-600 bg-white hover:bg-red-50"
                                                                        title="Eliminar"
                                                                    >
                                                                        <Trash2 size={14} className="mr-1" />
                                                                        Eliminar
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <ReservationManager
                isOpen={managerState.isOpen}
                mode={managerState.mode}
                reservation={managerState.reservation}
                initialData={managerState.initialData}
                rooms={rooms}
                user={user}
                onClose={() => setManagerState(prev => ({ ...prev, isOpen: false }))}
                onSuccess={handleSuccess}
            />

            {selectedReservationForPayment && (
                <PaymentModal
                    reservation={selectedReservationForPayment}
                    onClose={() => setSelectedReservationForPayment(null)}
                    onSuccess={handleSuccess}
                />
            )}
        </div>
    );
};

export default Dashboard;
