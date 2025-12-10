import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import ReservationManager from '../components/ReservationManager';
import { useNavigate } from 'react-router-dom';

const NewReservationPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [rooms, setRooms] = useState([]);

    // Always open in create mode
    const [isOpen, setIsOpen] = useState(true);

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
        // After creating, maybe redirect to calendar or dashboard? 
        // Or just close and show success?
        // User asked for a primary section. Let's redirect to Dashboard (Habitaciones) or Calendar
        alert('Reserva creada exitosamente');
        navigate('/calendar');
    };

    const handleClose = () => {
        // Go back to previous page (Calendar, Dashboard, etc.)
        navigate(-1);
    };

    return (
        <div className="p-8 flex justify-center items-start min-h-screen bg-gray-50">
            {/* We render the modal directly. Since ReservationManager is a modal, 
                 we might want to render it inline or just let it be a modal over an empty background.
                 Given the component structure, it's designed as a fixed overlay. 
                 So we'll just render it with isOpen=true. 
             */}
            <ReservationManager
                isOpen={isOpen}
                onClose={handleClose}
                onSuccess={handleSuccess}
                mode="create"
                initialData={null}
                reservation={null}
                rooms={rooms}
                user={user}
            />
        </div>
    );
};

export default NewReservationPage;
