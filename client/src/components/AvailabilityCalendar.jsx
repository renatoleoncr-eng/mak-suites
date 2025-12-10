import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { format, addDays, startOfWeek, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, ChevronDown, User, Calendar, LogOut, Sparkles, Lock, CheckCircle, Check, SprayCan } from 'lucide-react';
import RoomManagementModal from './RoomManagementModal';

const AvailabilityCalendar = ({ onRoomClick, refreshTrigger, currentDate, onDateChange, user }) => {
    const dateInputRef = useRef(null);

    // Fallback internal state if props aren't provided
    const [internalDate, setInternalDate] = useState(new Date());

    // Use prop if available, otherwise internal state
    const startDate = currentDate || internalDate;

    // Helper to update date (prop or internal)
    const setStartDate = (date) => {
        if (onDateChange) {
            onDateChange(date);
        } else {
            setInternalDate(date);
        }
    };

    const [data, setData] = useState({ rooms: [], dates: [], availability: {} });
    const [loading, setLoading] = useState(true);

    const [collapsedFloors, setCollapsedFloors] = useState({});
    const [modalMode, setModalMode] = useState(null); // 'add_floor' or 'add_room'

    useEffect(() => {
        fetchAvailability();
    }, [startDate, refreshTrigger]);

    const toggleFloor = (floor) => {
        setCollapsedFloors(prev => ({
            ...prev,
            [floor]: !prev[floor]
        }));
    };

    const fetchAvailability = async () => {
        setLoading(true);
        try {
            const startStr = format(startDate, 'yyyy-MM-dd');
            const endStr = format(addDays(startDate, 7), 'yyyy-MM-dd');

            const res = await axios.get(`${API_URL}/rooms/availability?start_date=${startStr}&end_date=${endStr}`);
            setData(res.data);
        } catch (error) {
            console.error('Error fetching availability:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePrevWeek = () => {
        setStartDate(subDays(startDate, 7));
    };

    const handleNextWeek = () => {
        setStartDate(addDays(startDate, 7));
    };

    const handleToday = () => {
        setStartDate(new Date());
    };

    const handleDateChange = (e) => {
        const dateInput = e.target.value; // yyyy-MM-dd strings
        // Create date object in local timezone by appending time
        setStartDate(new Date(dateInput + 'T00:00:00'));
    };

    const handleCellClick = (room, date, cellData) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const clickedDate = new Date(date + 'T00:00:00');

        if (!onRoomClick) return;

        // MULTIPLE RESERVATIONS HANDLING
        if (cellData?.reservations && cellData.reservations.length > 1) {
            // Simple selection UI using window.prompt for this iteration to avoid new UI components complexity
            // Ideally should be a modal, but let's try a simpler approach if the user didn't ask for a full UI overhaul yet.
            // Better approach: Pass the *list* to the parent, and let the parent Show the list.
            // But `onRoomClick` expects a single reservation object typically.
            // Let's modify `onRoomClick` or the data passed to it.

            // Current Plan: Pass the first one for now, OR show a native confirm/prompt to pick?
            // "Show when click... detail of 2 reservations".
            // Let's assume the Dashboard Modal can handle a list? No, it expects one.
            // I will implement a small "Selector" logic here using `window.confirm` is bad.
            // I will use a simple internal state to show a "Selector Modal" inside this component?
            // No, the user said "mostar el detalle de 2 reservas". Maybe I should open a specific "List Modal".

            // Let's pass a special object to `onRoomClick`?
            // "onRoomClick" opens "ReservationManager" (the big modal).
            // Updating `ReservationManager` to handle a LIST is heavy.

            // PROPOSAL: Show a primitive browser prompt to choose:
            // "Hay 2 reservas:\n1. Juan\n2. Pedro\nIngrese numero:"

            let msg = "Existe múltiples reservas en esta fecha:\n";
            cellData.reservations.forEach((r, i) => {
                msg += `${i + 1}. ${r.reservation_code} - ${r.Guest?.name || 'Huésped'} (${r.status})\n`;
            });
            msg += "\nIngrese el número para ver detalles:";

            const choice = window.prompt(msg, "1");
            if (choice) {
                const index = parseInt(choice) - 1;
                if (index >= 0 && index < cellData.reservations.length) {
                    onRoomClick({
                        ...room,
                        existingReservation: cellData.reservations[index],
                        clickedDate: date
                    });
                }
            }
            return;
        }

        // Single Reservation
        if (cellData?.reservation) {
            onRoomClick({
                ...room,
                existingReservation: cellData.reservation,
                clickedDate: date
            });
        } else if (cellData?.status === 'available') {
            // Only allow new reservations on future dates (or yesterday)
            const minDate = subDays(today, 1);
            if (clickedDate < minDate) return;

            // Auto-select 1 night: Check-in = date, Check-out = date + 1
            const nextDay = new Date(clickedDate);
            nextDay.setDate(nextDay.getDate() + 1);

            onRoomClick({
                ...room,
                initialDate: date,
                initialEndDate: format(nextDay, 'yyyy-MM-dd')
            });
        }
    };

    const getStatusColor = (status) => {
        const colors = {
            'available': 'bg-blue-50 hover:bg-blue-100 text-blue-700', // Blue as requested
            'occupied': 'bg-red-100 text-red-800 border border-red-200',
            'reserved': 'bg-green-100 text-green-800 border border-green-200', // Changed to Green for contrast or keep Blue? User said "grid ... azul". 
            // Standard: Reserved=Blue, Occupied=Red, Available=White/Gray. 
            // User wants "grid to be blue". I'll assume available = blue-ish.
            'cleaning': 'bg-yellow-100 text-yellow-800 border border-yellow-200',
            'maintenance': 'bg-gray-200 text-gray-700',
            'completed': 'bg-gray-100 text-gray-500',
        };
        return colors[status] || 'bg-blue-50';
    };

    const getStatusText = (status, reservations) => {
        if (reservations && reservations.length > 1) {
            // Derived simplified status for conflicts/multiples
            const statuses = reservations.map(r => r.status);
            const hasOccupied = statuses.includes('occupied') || statuses.includes('checked_in');
            const hasReserved = statuses.includes('reserved') || statuses.includes('confirmed');

            if (hasOccupied && hasReserved) return 'Ocup + Reser';
            if (hasOccupied) return `Ocupado (${reservations.length})`;
            if (hasReserved) return `Reserva (${reservations.length})`;
            return `Múltiples (${reservations.length})`;
        }

        const map = {
            'available': 'Libre',
            'occupied': 'Ocupado',
            'checked_in': 'Ocupado',
            'reserved': 'Reserva',
            'confirmed': 'Reserva',
            'cleaning': 'Limpieza',
            'maintenance': 'Mant.',
            'completed': 'Cerrada',
        };
        return map[status] || status;
    };

    // Group rooms by floor
    const roomsByFloor = data.rooms.reduce((acc, room) => {
        const floor = room.floor;
        if (!acc[floor]) acc[floor] = [];
        acc[floor].push(room);
        return acc;
    }, {});

    if (loading) return <div className="p-8 text-center">Cargando calendario...</div>;

    return (
        <div className="bg-white rounded-lg shadow overflow-hidden">
            {/* Header Controls */}
            <div className="flex justify-between items-center p-4 border-b">
                <div className="flex items-center gap-4">
                    <button
                        onClick={handlePrevWeek}
                        className="p-2 hover:bg-gray-100 rounded-full transition"
                    >
                        <ChevronLeft size={20} />
                    </button>

                    {/* Clickable Month Header */}
                    <div
                        className="relative flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-3 py-1 rounded-md transition-colors"
                        onClick={() => dateInputRef.current?.showPicker()}
                    >
                        <h3 className="text-lg font-semibold capitalize select-none text-gray-800">
                            {format(startDate, 'MMMM yyyy', { locale: es })}
                        </h3>
                        <ChevronDown size={14} className="text-gray-500" />

                        <input
                            ref={dateInputRef}
                            type="date"
                            value={format(startDate, 'yyyy-MM-dd')}
                            onChange={handleDateChange}
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer -z-10" // Hidden but functional
                        />
                    </div>

                    <button
                        onClick={handleNextWeek}
                        className="p-2 hover:bg-gray-100 rounded-full transition"
                    >
                        <ChevronRight size={20} />
                    </button>
                    <button
                        onClick={handleToday}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition shadow-sm"
                    >
                        Hoy
                    </button>
                </div>

                {user?.role === 'admin' ? (
                    <div className="flex gap-2">
                        <button
                            onClick={() => setModalMode('add_floor')}
                            className="px-3 py-1 text-sm bg-gray-800 text-white rounded-md hover:bg-gray-900 transition flex items-center gap-1"
                        >
                            <span className="text-lg font-bold">+</span> Piso
                        </button>
                        <button
                            onClick={() => setModalMode('add_room')}
                            className="px-3 py-1 text-sm bg-blue-800 text-white rounded-md hover:bg-blue-900 transition flex items-center gap-1"
                        >
                            <span className="text-lg font-bold">+</span> Habitación
                        </button>
                    </div>
                ) : (
                    <div className="hidden lg:flex gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
                            <span>Disponible</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded"></div>
                            <span>Reservado</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div>
                            <span>Ocupado</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Calendar Grid */}
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 w-32 border-r">
                                Habitación
                            </th>
                            {data.dates.map(date => (
                                <th key={date} className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                                    <div className="font-bold">{format(new Date(date + 'T00:00:00'), 'EEE', { locale: es })}</div>
                                    <div className="text-gray-400">{format(new Date(date + 'T00:00:00'), 'd MMM')}</div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {(data.floors || []).map(floorObj => {
                            const floorNum = floorObj.number;
                            const roomsOnFloor = roomsByFloor[floorNum] || [];

                            return (
                                <React.Fragment key={floorNum}>
                                    <tr className="bg-gray-100 hover:bg-gray-200 cursor-pointer transition-colors" onClick={() => toggleFloor(floorNum)}>
                                        <td colSpan={8} className="px-4 py-2 text-sm font-bold text-gray-700 sticky left-0 bg-gray-100 z-10 flex items-center justify-between">
                                            <span>Piso {floorNum}</span>
                                            {collapsedFloors[floorNum] ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                        </td>
                                    </tr>
                                    {!collapsedFloors[floorNum] && roomsOnFloor.map(room => (
                                        <tr key={room.id}>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white z-10 border-r">
                                                {room.number} <span className="text-xs text-gray-500 font-normal">({room.type})</span>
                                            </td>
                                            {data.dates.map(date => {
                                                const cellData = data.availability[room.id]?.[date] || { status: 'available', available: true };
                                                return (
                                                    <td
                                                        key={`${room.id}-${date}`}
                                                        className="p-1 h-12"
                                                        onClick={() => handleCellClick(room, date, cellData)}
                                                    >
                                                        <div className={`w-full h-full rounded flex items-center justify-center text-xs font-medium transition-colors cursor-pointer ${getStatusColor(cellData.status)}`}>
                                                            {cellData.status !== 'available' && (
                                                                <div className="flex items-center gap-1">
                                                                    {(() => {
                                                                        const reservations = cellData.reservations && cellData.reservations.length > 0
                                                                            ? cellData.reservations
                                                                            : (cellData.reservation ? [cellData.reservation] : []);

                                                                        // Dedup statuses to avoid repeating same icon if not needed, or show all if multiple people?
                                                                        // User asked for "Ocupada + Reservada" -> Two icons.
                                                                        // So we map each reservation to an icon.

                                                                        // Max 2-3 icons to fit?
                                                                        const visibleReservations = reservations.slice(0, 3);

                                                                        return visibleReservations.map((r, i) => {
                                                                            let Icon = Calendar; // Default
                                                                            let title = r.status;
                                                                            let colorClass = "text-blue-700";

                                                                            if (r.status === 'occupied' || r.status === 'checked_in') {
                                                                                Icon = CheckCircle;
                                                                                title = "Huesped Hospedado";
                                                                                colorClass = "text-blue-600 font-bold";
                                                                            } else if (r.status === 'reserved' || r.status === 'confirmed') {
                                                                                Icon = Calendar;
                                                                                title = "Reserva Confirmada";
                                                                                colorClass = "text-blue-700";
                                                                            } else if (r.status === 'checked_out') {
                                                                                Icon = CheckCircle;
                                                                                title = "Salida / Por Limpiar";
                                                                                colorClass = "text-red-600 font-bold";
                                                                            } else if (r.status === 'cleaning') {
                                                                                Icon = SprayCan;
                                                                                title = "Limpieza";
                                                                                colorClass = "text-cyan-500";
                                                                            } else if (r.status === 'completed') {
                                                                                Icon = CheckCircle;
                                                                                title = "Completada";
                                                                                colorClass = "text-gray-500";
                                                                            }

                                                                            if (cellData.status === 'maintenance') {
                                                                                Icon = Lock;
                                                                                title = "Mantenimiento";
                                                                                colorClass = "text-gray-600";
                                                                                return <Lock key="maint" size={14} className={colorClass} title={title} />;
                                                                            }

                                                                            return (
                                                                                <div key={i} className="relative group">
                                                                                    <Icon size={16} className={colorClass} />
                                                                                    {/* Simple Tooltip */}
                                                                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none">
                                                                                        {title}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        });
                                                                    })()}
                                                                    {cellData.reservations && cellData.reservations.length > 3 && (
                                                                        <span className="text-xs font-bold text-gray-500">+{cellData.reservations.length - 3}</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {modalMode && (
                <RoomManagementModal
                    mode={modalMode}
                    onClose={() => setModalMode(null)}
                    onSuccess={() => {
                        setModalMode(null);
                        fetchAvailability();
                        if (refreshTrigger) window.location.reload(); // Hard refresh to ensure dashboard updates fully if needed, or rely on fetchAvailability
                    }}
                />
            )}
        </div>
    );
};

export default AvailabilityCalendar;
