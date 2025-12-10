import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import AvailabilityCalendar from '../components/AvailabilityCalendar';
import ReservationManager from '../components/ReservationManager';

const CalendarPage = () => {
    const { user } = useAuth();
    const [rooms, setRooms] = useState([]);
    const [refreshCalendar, setRefreshCalendar] = useState(0);

    // Persistence Logic
    const [calendarDate, setCalendarDate] = useState(() => {
        try {
            const saved = localStorage.getItem('calendarDate');
            if (saved) {
                const date = new Date(saved);
                // Check if date is valid
                if (!isNaN(date.getTime())) {
                    return date;
                }
            }
        } catch (e) {
            console.error('Error parsing saved date:', e);
        }
        return new Date();
    });

    const handleDateChange = (date) => {
        setCalendarDate(date);
        localStorage.setItem('calendarDate', date.toISOString());
    };

    // Modal State
    const [managerState, setManagerState] = useState({
        isOpen: false,
        mode: 'create', // create, view, edit, checkin, checkout
        reservation: null,
        initialData: null
    });

    useEffect(() => {
        fetchRooms();
    }, []);

    const fetchRooms = async () => {
        try {
            const res = await axios.get(`${API_URL}/rooms`);
            setRooms(res.data);
        } catch (error) {
            console.error('Error fetching rooms:', error);
        }
    };

    const handleSuccess = () => {
        setRefreshCalendar(prev => prev + 1);
        setManagerState({ isOpen: false, mode: 'create', reservation: null, initialData: null });
    };

    const openManager = (mode, reservation = null, initialData = null) => {
        setManagerState({
            isOpen: true,
            mode,
            reservation,
            initialData
        });
    };

    return (
        <div className="p-8">
            <AvailabilityCalendar
                refreshTrigger={refreshCalendar}
                currentDate={calendarDate}
                onDateChange={handleDateChange}
                onRoomClick={(room) => {
                    if (room.existingReservation) {
                        openManager('view', room.existingReservation);
                    } else {
                        openManager('create', null, { room_id: room.id, start_date: room.initialDate });
                    }
                }}
                user={user}
            />

            <ReservationManager
                isOpen={managerState.isOpen}
                onClose={() => setManagerState({ ...managerState, isOpen: false })}
                onSuccess={handleSuccess}
                mode={managerState.mode}
                initialData={managerState.initialData}
                reservation={managerState.reservation}
                rooms={rooms}
                user={user}
            />
        </div>
    );
};

export default CalendarPage;
