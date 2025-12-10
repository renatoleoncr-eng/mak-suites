import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { X, Calendar, User, CreditCard, LogOut, CheckCircle, AlertCircle, Edit, Trash2, ShoppingBag } from 'lucide-react';
import ConsumptionModal from './ConsumptionModal';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { compressImage, dataURLtoFile } from '../utils/imageUtils'; // Import compression utility
import EditTransactionModal from './EditTransactionModal';



const ReservationManager = ({
    isOpen,
    onClose,
    onSuccess,
    mode = 'create', // create, view, edit, checkin, checkout
    initialData = null, // For create mode (e.g. from calendar)
    reservation = null, // For view, edit, checkin, checkout
    rooms = [],
    user
}) => {
    if (!isOpen) return null;

    // --- State Management ---
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('details'); // details, payment, history
    const [fullReservation, setFullReservation] = useState(reservation); // Store fetched reservation data with consumption_total

    // Form Data State
    const [formData, setFormData] = useState({
        room_id: '',
        guest_name: '',
        guest_doc_type: 'DNI',
        guest_doc_number: '',
        guest_phone: '',
        guest_email: '',
        start_date: '',
        end_date: '',
        reservation_type: 'night',
        start_time: '10:00',
        end_time: '12:00',
        prepaid_amount: 0,
        total_amount: 0,
        notes: '',
    });

    // Dynamic Pricing state
    const [isDynamicPrice, setIsDynamicPrice] = useState(false);
    const [customPrice, setCustomPrice] = useState(0);

    // Edit Transaction State
    const [editingTransaction, setEditingTransaction] = useState(null);

    // Check-in Validation State
    const [checkinFile, setCheckinFile] = useState(null);
    const [validatingDNI, setValidatingDNI] = useState(false);
    const [dniValidated, setDniValidated] = useState(false);
    const [validationMessage, setValidationMessage] = useState('');

    // Check-out State
    const [transactions, setTransactions] = useState([]);
    const [showConsumptionModal, setShowConsumptionModal] = useState(false);

    // Payment Evidence State
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [paymentEvidence, setPaymentEvidence] = useState(null);

    // --- Shortcuts ---
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // --- Initialization ---
    useEffect(() => {
        if (mode === 'create') {
            initializeCreateMode();
        } else if (reservation) {
            initializeExistingMode();
        }
    }, [mode, initialData, reservation]);

    const initializeCreateMode = () => {
        const today = new Date();
        // Use initialData from calendar if available, otherwise today
        // Append T00:00:00 to ensure local time parsing
        const initialStart = initialData?.start_date
            ? new Date(initialData.start_date + 'T00:00:00')
            : today;

        const initialEnd = addDays(initialStart, 1);

        setFormData({
            room_id: initialData?.room_id || '',
            guest_name: '',
            guest_doc_type: 'DNI',
            guest_doc_number: '',
            guest_phone: '',
            guest_email: '',
            start_date: format(initialStart, 'yyyy-MM-dd'),
            end_date: format(initialEnd, 'yyyy-MM-dd'),
            reservation_type: 'night',
            start_time: '10:00',
            end_time: '12:00',
            prepaid_amount: 0,
            total_amount: 0,
            notes: '',
        });
        setIsDynamicPrice(false);
        setCustomPrice(0);
    };

    const initializeExistingMode = async () => {
        if (!reservation) return;

        // 1. Initialize from prop data immediately (Fallback/Instant Load)
        const populateFromData = (data) => {
            setFormData({
                room_id: data.room_id,
                guest_name: data.Guest?.name || '',
                guest_doc_type: data.Guest?.doc_type || 'DNI',
                guest_doc_number: data.Guest?.doc_number || '',
                guest_phone: data.Guest?.phone || '',
                guest_email: data.Guest?.email || '',
                start_date: data.start_date,
                end_date: data.end_date,
                reservation_type: data.reservation_type,
                start_time: data.start_time || '10:00',
                end_time: data.end_time || '12:00',
                prepaid_amount: data.prepaid_amount || 0,
                total_amount: data.total_amount,
                notes: data.notes || '',
            });

            setCustomPrice(data.total_amount);

            // Check if stored total differs from standard calculation
            // If so, it's a dynamic price and we should flag it so it doesn't get recalculated
            const room = rooms.find(r => r.id === data.room_id) || data.Room;
            let standardTotal = 0;
            if (room) {
                const start = new Date(data.start_date + 'T00:00:00');
                const end = new Date(data.end_date + 'T00:00:00');
                if (data.reservation_type === 'night') {
                    const nights = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
                    standardTotal = nights * parseFloat(room.price_per_night);
                } else {
                    standardTotal = parseFloat(room.price_per_night);
                }
            }

            const storedTotal = parseFloat(data.total_amount || 0);

            // If stored total is different from standard total (with small tolerance), treat as dynamic
            if (Math.abs(storedTotal - standardTotal) > 0.1) {
                setIsDynamicPrice(true);
            } else {
                setIsDynamicPrice(false);
            }

            setFullReservation(data);
        };

        populateFromData(reservation);

        // 2. Refetch full data to ensure we have latest fields (like consumption_total)
        if (reservation.id && (mode === 'view' || mode === 'edit' || mode === 'checkin' || mode === 'checkout')) {
            try {
                const res = await axios.get(`${API_URL}/reservations/${reservation.id}`);
                const fetchedReservation = res.data;
                populateFromData(fetchedReservation);
            } catch (error) {
                console.error('Error fetching full reservation data:', error);
                // We already have data from prop, so UI won't be empty
            }
        }

        if (mode === 'view' || mode === 'edit' || mode === 'checkin' || mode === 'checkout') {
            fetchTransactions();
        }
    };

    const fetchTransactions = async () => {
        try {
            const res = await axios.get(`${API_URL}/transactions`);
            // Filter client-side for now as per original implementation
            const reservationTransactions = res.data.filter(t => t.reservation_id === reservation.id);
            setTransactions(reservationTransactions);
        } catch (error) {
            console.error('Error fetching transactions:', error);
        }
    };

    // --- Logic & Calculations ---
    const selectedRoom = rooms.find(r => r.id === parseInt(formData.room_id)) || (reservation?.Room);

    const calculateTotal = () => {
        if (mode === 'edit' || isDynamicPrice) return parseFloat(customPrice) || 0;
        if (!selectedRoom) return 0;

        if (formData.reservation_type === 'night') {
            const start = new Date(formData.start_date + 'T00:00:00');
            const end = new Date(formData.end_date + 'T00:00:00');
            const nights = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
            return nights * selectedRoom.price_per_night;
        } else {
            return selectedRoom.price_per_night;
        }
    };

    const currentTotal = calculateTotal();
    // Use fullReservation if available (contains consumption_total from backend), otherwise use reservation prop
    const activeReservation = fullReservation || reservation;
    const paidAmount = activeReservation ? parseFloat(activeReservation.paid_amount || 0) : parseFloat(formData.prepaid_amount || 0);

    // Use consumption_total from backend (already calculated and included in reservation object)
    const consumptionTotal = activeReservation ? parseFloat(activeReservation.consumption_total || 0) : 0;

    console.log('[ReservationManager] activeReservation:', activeReservation);
    console.log('[ReservationManager] consumption_total from activeReservation:', activeReservation?.consumption_total);
    console.log('[ReservationManager] consumptionTotal:', consumptionTotal);

    const grandTotal = currentTotal + consumptionTotal;
    const dueAmount = grandTotal - paidAmount;

    // --- Handlers ---
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const newData = { ...prev, [name]: value };

            // Date Logic (same as fixed ReservationModal)
            if (name === 'start_date' && prev.reservation_type === 'night') {
                const startDate = new Date(value + 'T00:00:00');
                const nextDay = addDays(startDate, 1);
                newData.end_date = format(nextDay, 'yyyy-MM-dd');
            }
            if (name === 'start_date' && prev.reservation_type === 'hourly') {
                newData.end_date = value;
            }

            return newData;
        });
    };

    const handleFileChange = async (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        setDniValidated(false);
        setValidationMessage('');
        setCheckinFile(null);
        setValidatingDNI(true);

        try {
            // Compress image
            const compressedBase64 = await compressImage(selectedFile);
            const compressedFile = dataURLtoFile(compressedBase64, selectedFile.name);

            const formDataN8N = new FormData();
            formDataN8N.append('file', compressedFile);
            formDataN8N.append('doc_number', formData.guest_doc_number);

            const response = await axios.post(
                'https://facturas-mak-n8n.bluzcx.easypanel.host/webhook/validar-dni-checkin',
                formDataN8N,
                {
                    headers: { 'Content-Type': 'multipart/form-data' }
                }
            );

            console.log('N8N Response:', response.data);

            setDniValidated(true);
            setCheckinFile(compressedFile); // Use the compressed file for any further local usage

            // Intenta mostrar mensaje del webhook, o uno genérico
            const msg = response.data?.message || 'Documento validado correctamente';
            setValidationMessage(`✓ ${msg}`);

        } catch (error) {
            console.error('N8N Validation Error:', error);
            setDniValidated(false);
            // Si el error tiene respuesta con mensaje, mostrarlo
            const errorMsg = error.response?.data?.message || 'Error al validar el documento con N8N';
            setValidationMessage(`✕ ${errorMsg}`);
        } finally {
            setValidatingDNI(false);
        }
    };

    // Validation State
    const [submitError, setSubmitError] = useState('');

    const handlePaymentEvidenceChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                // Compress image before setting state
                const compressedBase64 = await compressImage(file);
                setPaymentEvidence(compressedBase64);
                setSubmitError(''); // Clear error
            } catch (error) {
                console.error('Error compressing image:', error);
                setSubmitError('Error al procesar la imagen. Intente con otra.');
            }
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('¿Está seguro de eliminar esta reserva? Esta acción no se puede deshacer.')) return;

        // Validation: Consumption Payment Check
        // If they haven't paid at least the consumption amount, block deletion.
        if (paidAmount < consumptionTotal) {
            setSubmitError(`No se puede eliminar: Existen consumos pendientes (S/ ${consumptionTotal.toFixed(2)}) y solo se ha pagado S/ ${paidAmount.toFixed(2)}. Debe regularizar los pagos antes de eliminar.`);
            return;
        }

        setLoading(true);
        try {
            await axios.delete(`${API_URL}/reservations/${reservation.id}`);
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Delete failed:', error);
            setSubmitError(error.response?.data?.message || 'Error al eliminar la reserva');
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setSubmitError('');

        try {
            // Validate Dates
            if (formData.reservation_type === 'night') {
                if (formData.end_date <= formData.start_date) {
                    setSubmitError('La fecha de salida debe ser posterior a la fecha de ingreso.');
                    setLoading(false);
                    return;
                }
            }

            if (mode === 'create') {
                if (parseFloat(formData.prepaid_amount) > 0) {
                    if (paymentMethod !== 'cash' && !paymentEvidence) {
                        setSubmitError('Para pagos que no son en efectivo, es obligatorio adjuntar la evidencia de pago.');
                        setLoading(false);
                        return;
                    }
                }

                const payload = {
                    ...formData,
                    room_id: parseInt(formData.room_id),
                    created_by: user.id,
                    total_amount: isDynamicPrice ? parseFloat(customPrice) : undefined,
                    start_time: formData.reservation_type === 'hourly' ? '00:00' : formData.start_time,
                    end_time: formData.reservation_type === 'hourly' ? '23:59' : formData.end_time,
                    payment_method: paymentMethod, // Add payment method
                    payment_evidence: paymentEvidence // Add payment evidence
                };
                await axios.post(`${API_URL}/reservations`, payload);
            }
            else if (mode === 'edit') {
                await axios.put(`${API_URL}/reservations/${reservation.id}`, {
                    ...formData,
                    total_amount: parseFloat(customPrice)
                });
            }
            else if (mode === 'checkin') {
                // Validation: Prevent early check-in
                const todayStr = format(new Date(), 'yyyy-MM-dd');
                if (todayStr < formData.start_date) {
                    throw new Error('El check-in no puede realizarse antes de la fecha de reserva. Edite la reserva si necesita adelantarla.');
                }

                if (!dniValidated) throw new Error('Debe validar el DNI');
                const fd = new FormData();
                fd.append('guest_phone', formData.guest_phone);
                fd.append('guest_email', formData.guest_email);
                fd.append('id_photo', checkinFile);
                await axios.post(`${API_URL}/reservations/${reservation.id}/checkin`, fd, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }
            else if (mode === 'checkout') {
                if (dueAmount > 0.01) throw new Error(`Pendiente de pago: S/ ${dueAmount.toFixed(2)}`);
                await axios.post(`${API_URL}/reservations/${reservation.id}/checkout`);
            }

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Action failed:', error);
            setSubmitError(error.response?.data?.message || error.message);
        } finally {
            setLoading(false);
        }
    };

    // --- Render Helpers ---
    const getTitle = () => {
        switch (mode) {
            case 'create': return 'Nueva Reserva';
            case 'edit': return 'Editar Reserva';
            case 'view': return 'Detalle de Reserva';
            case 'checkin': return 'Check-in';
            case 'checkout': return 'Check-out';
            default: return 'Reserva';
        }
    };

    const isReadOnly = mode === 'view' || mode === 'checkout' || (mode === 'checkin' && activeTab === 'details');

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b bg-gray-50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">{getTitle()}</h2>
                        {reservation && (
                            <p className="text-sm text-blue-600 font-mono font-bold">#{reservation.reservation_code}</p>
                        )}
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X size={24} />
                    </button>
                </div>

                {/* Tabs for View/Edit modes */}
                {(true) && (
                    <>
                        <div className="flex border-b px-6">
                            <button
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'details' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                onClick={() => setActiveTab('details')}
                            >
                                Detalles
                            </button>
                            {(mode === 'view' || mode === 'checkout') && (
                                <button
                                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'history' ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                    onClick={() => setActiveTab('history')}
                                >
                                    Movimientos y Pagos
                                </button>
                            )}
                        </div>

                        {/* Content */}
                        <div className="p-6 flex-1 overflow-y-auto">
                            {activeTab === 'details' && (
                                <form onSubmit={handleSubmit} className="space-y-6">

                                    {/* Room & Guest Section */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Room Selection */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Habitación</label>
                                            {mode === 'create' && !initialData?.room_id ? (
                                                <select
                                                    name="room_id"
                                                    value={formData.room_id}
                                                    onChange={handleChange}
                                                    required
                                                    className="w-full rounded-md border-gray-300 shadow-sm border p-2"
                                                >
                                                    <option value="">Seleccione...</option>
                                                    {rooms.map(r => (
                                                        <option key={r.id} value={r.id}>{r.number} ({r.type}) - S/{r.price_per_night}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <div className="p-2 bg-gray-100 rounded border text-gray-700">
                                                    {selectedRoom ? `Habitación ${selectedRoom.number} (${selectedRoom.type})` : 'No seleccionada'}
                                                </div>
                                            )}
                                        </div>

                                        {/* Guest Name */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Huésped</label>
                                            <input
                                                type="text"
                                                name="guest_name"
                                                value={formData.guest_name}
                                                onChange={handleChange}
                                                disabled={isReadOnly}
                                                required
                                                className={`w-full rounded-md border p-2 ${isReadOnly ? 'bg-gray-100' : 'border-gray-300'}`}
                                            />
                                        </div>

                                        {/* Doc Number */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">DNI / Documento</label>
                                            <input
                                                type="text"
                                                name="guest_doc_number"
                                                value={formData.guest_doc_number}
                                                onChange={handleChange}
                                                disabled={isReadOnly}
                                                required
                                                className={`w-full rounded-md border p-2 ${isReadOnly ? 'bg-gray-100' : 'border-gray-300'}`}
                                            />
                                        </div>

                                        {/* Dates & Type */}
                                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Reserva</label>
                                                <select
                                                    name="reservation_type"
                                                    value={formData.reservation_type}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val === 'hourly') {
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                reservation_type: val,
                                                                end_date: prev.start_date
                                                            }));
                                                            setIsDynamicPrice(true);
                                                            if (mode === 'edit') setCustomPrice(0); // Reset to 0 for hourly editing
                                                        } else if (val === 'night') {
                                                            // Logic for switching back to night
                                                            const startDate = new Date(formData.start_date + 'T00:00:00');
                                                            const nextDay = addDays(startDate, 1);

                                                            setFormData(prev => ({
                                                                ...prev,
                                                                reservation_type: val,
                                                                end_date: format(nextDay, 'yyyy-MM-dd')
                                                            }));
                                                            setIsDynamicPrice(false);

                                                            // Reset to standard price
                                                            if (mode === 'edit' && selectedRoom) {
                                                                const standardPrice = selectedRoom.price_per_night; // Default to 1 night on switch
                                                                setCustomPrice(standardPrice);
                                                            }
                                                        } else {
                                                            handleChange(e);
                                                        }
                                                    }}
                                                    disabled={isReadOnly}
                                                    className={`w-full rounded-md border p-2 ${isReadOnly ? 'bg-gray-100' : 'border-gray-300'}`}
                                                >
                                                    <option value="night">Por Noche</option>
                                                    <option value="hourly">Por Horas</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    {formData.reservation_type === 'night' ? 'Fechas (Entrada -> Salida)' : 'Fecha de Reserva'}
                                                </label>
                                                <div className="flex gap-2 items-center">
                                                    <input
                                                        type="date"
                                                        name="start_date"
                                                        value={formData.start_date}
                                                        onChange={handleChange}
                                                        min={format(addDays(new Date(), -1), 'yyyy-MM-dd')}
                                                        disabled={isReadOnly || (mode === 'edit' && user?.role !== 'admin')}
                                                        required
                                                        className={`w-full rounded-md border p-2 ${isReadOnly ? 'bg-gray-100' : 'border-gray-300'}`}
                                                    />

                                                    {formData.reservation_type === 'night' && (
                                                        <>
                                                            <span className="text-gray-400">→</span>
                                                            <input
                                                                type="date"
                                                                name="end_date"
                                                                value={formData.end_date}
                                                                onChange={handleChange}
                                                                disabled={isReadOnly}
                                                                required
                                                                className={`w-full rounded-md border p-2 ${isReadOnly ? 'bg-gray-100' : 'border-gray-300'}`}
                                                            />
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Check-in Specific Fields */}
                                    {mode === 'checkin' && (
                                        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 space-y-4">
                                            <h3 className="font-semibold text-yellow-900">Requisitos de Check-in</h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Celular *</label>
                                                    <input
                                                        type="tel"
                                                        name="guest_phone"
                                                        value={formData.guest_phone}
                                                        onChange={handleChange}
                                                        required
                                                        className="w-full rounded-md border-gray-300 border p-2"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Email *</label>
                                                    <input
                                                        type="email"
                                                        name="guest_email"
                                                        value={formData.guest_email}
                                                        onChange={handleChange}
                                                        required
                                                        className="w-full rounded-md border-gray-300 border p-2"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Foto DNI *</label>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleFileChange}
                                                    required
                                                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                                />
                                                {validatingDNI && <p className="text-sm text-blue-600 mt-1">Validando...</p>}
                                                {validationMessage && (
                                                    <p className={`text-sm mt-1 ${dniValidated ? 'text-green-600' : 'text-red-600'}`}>
                                                        {validationMessage}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Financials */}
                                    <div className="bg-gray-50 p-4 rounded-lg border">
                                        <div className="flex justify-between items-center mb-2">
                                            <h3 className="font-semibold text-gray-900">Detalles Financieros</h3>
                                            {(mode === 'create' || mode === 'edit') && (
                                                <label className="flex items-center text-sm text-gray-600">
                                                    <input
                                                        type="checkbox"
                                                        checked={isDynamicPrice}
                                                        onChange={(e) => setIsDynamicPrice(e.target.checked)}
                                                        className="mr-2"
                                                    />
                                                    Tarifa Dinámica
                                                </label>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                            <div>
                                                <label className="block text-xs text-gray-500">Costo Reserva</label>
                                                {mode === 'create' || mode === 'edit' ? (
                                                    <div className="relative">
                                                        <span className="absolute left-2 top-2 text-gray-500">S/</span>
                                                        <input
                                                            type="number"
                                                            value={isDynamicPrice ? customPrice : currentTotal}
                                                            onChange={(e) => setCustomPrice(e.target.value)}
                                                            onWheel={(e) => e.target.blur()}
                                                            disabled={!isDynamicPrice}
                                                            className={`w-full pl-6 rounded border p-1 ${!isDynamicPrice && 'bg-gray-100'}`}
                                                        />
                                                    </div>
                                                ) : (
                                                    <p className="font-bold text-lg">S/ {currentTotal.toFixed(2)}</p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500">Consumos</label>
                                                <p className="font-bold text-lg text-orange-600">S/ {consumptionTotal.toFixed(2)}</p>
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500">Total a Pagar</label>
                                                <p className="font-bold text-lg text-blue-600">S/ {grandTotal.toFixed(2)}</p>
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500">Pagado</label>
                                                {mode === 'create' ? (
                                                    <div className="relative">
                                                        <span className="absolute left-2 top-2 text-gray-500">S/</span>
                                                        <input
                                                            type="number"
                                                            name="prepaid_amount"
                                                            value={formData.prepaid_amount}
                                                            onChange={handleChange}
                                                            onWheel={(e) => e.target.blur()}
                                                            className="w-full pl-6 rounded border p-1"
                                                        />
                                                    </div>
                                                ) : (
                                                    <p className="font-bold text-lg text-green-600">S/ {paidAmount.toFixed(2)}</p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500">Debe</label>
                                                <p className={`font-bold text-lg ${dueAmount > 0.01 ? 'text-red-600' : 'text-green-600'}`}>
                                                    S/ {dueAmount.toFixed(2)}
                                                </p>
                                            </div>
                                        </div>

                                        {mode === 'create' && parseFloat(formData.prepaid_amount) > 0 && (
                                            <div className="mt-4 pt-4 border-t border-gray-200">
                                                <div className="p-3 bg-blue-50 rounded border border-blue-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-semibold text-blue-800 mb-1">Método de Pago</label>
                                                        <select
                                                            value={paymentMethod}
                                                            onChange={(e) => setPaymentMethod(e.target.value)}
                                                            className="w-full rounded border-blue-300 text-sm p-1"
                                                        >
                                                            <option value="cash">Efectivo</option>
                                                            <option value="yape">Yape</option>
                                                            <option value="card">Tarjeta</option>
                                                            <option value="transfer">Transferencia</option>
                                                        </select>
                                                    </div>
                                                    {paymentMethod !== 'cash' && (
                                                        <div>
                                                            <label className="block text-xs font-semibold text-blue-800 mb-1">Evidencia de Pago *</label>
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                onChange={handlePaymentEvidenceChange}
                                                                className="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:bg-white file:text-blue-700"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Notes */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                                        <textarea
                                            name="notes"
                                            value={formData.notes}
                                            onChange={handleChange}
                                            disabled={isReadOnly}
                                            rows="2"
                                            className={`w-full rounded-md border p-2 ${isReadOnly ? 'bg-gray-100' : 'border-gray-300'}`}
                                        />
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col gap-2 pt-4 border-t">
                                        {submitError && (
                                            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                                                ⚠️ {submitError}
                                            </div>
                                        )}
                                        <div className="flex justify-between w-full">
                                            {reservation ? (
                                                <button
                                                    type="button"
                                                    onClick={handleDelete}
                                                    disabled={loading}
                                                    className="px-4 py-2 border border-red-200 text-red-600 rounded hover:bg-red-50 flex items-center gap-2"
                                                >
                                                    <Trash2 size={18} />
                                                    Eliminar
                                                </button>
                                            ) : <div></div>}

                                            <div className="flex gap-3 ml-auto">
                                                <button type="button" onClick={onClose} className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-50">
                                                    Cancelar
                                                </button>
                                                {mode !== 'view' && (
                                                    <button
                                                        type="submit"
                                                        disabled={loading || (mode === 'checkin' && !dniValidated) || (mode === 'checkout' && dueAmount > 0.01)}
                                                        className={`px-4 py-2 rounded text-white font-medium ${mode === 'checkout' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                                                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                                                    >
                                                        {loading ? 'Procesando...' :
                                                            mode === 'create' ? 'Crear Reserva' :
                                                                mode === 'edit' ? 'Guardar Cambios' :
                                                                    mode === 'checkin' ? 'Confirmar Check-in' :
                                                                        mode === 'checkout' ? 'Confirmar Check-out' : 'Guardar'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </form>
                            )}
                            {activeTab === 'history' && (
                                <div className="space-y-6">
                                    {/* Charges Section */}
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="font-semibold text-gray-700">Consumos / Cargos a la Habitación</h4>
                                            {(mode === 'view' || mode === 'checkout') && (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowConsumptionModal(true)}
                                                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                                                >
                                                    <ShoppingBag size={16} />
                                                    Agregar Consumo
                                                </button>
                                            )}
                                        </div>
                                        {transactions.filter(t => t.method === 'room_charge').length === 0 ? (
                                            <p className="text-gray-500 text-sm italic">No hay consumos cargados.</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {transactions.filter(t => t.method === 'room_charge').map(t => (
                                                    <div key={t.id} className="flex justify-between items-start p-3 bg-orange-50 rounded border border-orange-100">
                                                        <div className="flex-1">
                                                            {t.transaction_type === 'venta_mak' && t.products ? (
                                                                <div className="mb-1">
                                                                    <p className="font-bold text-gray-800 text-sm mb-1">Venta Mak</p>
                                                                    {(() => {
                                                                        try {
                                                                            const products = typeof t.products === 'string' ? JSON.parse(t.products) : t.products;
                                                                            return (
                                                                                <ul className="text-sm text-gray-600 space-y-1">
                                                                                    {products.map((p, i) => (
                                                                                        <li key={i} className="flex items-center gap-2">
                                                                                            <span className="font-mono text-xs font-bold bg-orange-100 text-orange-700 px-1.5 rounded">{p.quantity}x</span>
                                                                                            <span>{p.name}</span>
                                                                                        </li>
                                                                                    ))}
                                                                                </ul>
                                                                            );
                                                                        } catch (e) {
                                                                            return <p className="font-medium text-gray-800">{t.description}</p>;
                                                                        }
                                                                    })()}
                                                                </div>
                                                            ) : (
                                                                <p className="font-medium text-gray-800">{t.description}</p>
                                                            )}
                                                            <p className="text-xs text-gray-500 mt-1">
                                                                {format(new Date(t.date), 'dd/MM/yyyy HH:mm', { locale: es })} - {t.category}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-orange-600 whitespace-nowrap ml-4">+ S/ {parseFloat(t.amount).toFixed(2)}</span>
                                                            {user?.role === 'admin' && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setEditingTransaction(t)}
                                                                    className="text-blue-500 hover:text-blue-700 p-1"
                                                                    title="Editar"
                                                                >
                                                                    <Edit size={16} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Payments Section */}
                                    <div>
                                        <h4 className="font-semibold text-gray-700 mb-2">Pagos Realizados</h4>
                                        {transactions.filter(t => t.transaction_type === 'reservation_payment').length === 0 ? (
                                            <p className="text-gray-500 text-sm italic">No hay pagos registrados.</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {transactions.filter(t => t.transaction_type === 'reservation_payment').map(t => (
                                                    <div key={t.id} className="flex justify-between items-center p-3 bg-green-50 rounded border border-green-100">
                                                        <div>
                                                            <p className="font-medium text-gray-800">{t.description}</p>
                                                            <p className="text-xs text-gray-500">
                                                                {format(new Date(t.date), 'dd/MM/yyyy HH:mm', { locale: es })} - {t.method}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-green-600 whitespace-nowrap ml-4">- S/ {parseFloat(t.amount).toFixed(2)}</span>
                                                            {user?.role === 'admin' && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setEditingTransaction(t)}
                                                                    className="text-blue-500 hover:text-blue-700 p-1"
                                                                    title="Editar"
                                                                >
                                                                    <Edit size={16} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}


                            {showConsumptionModal && (
                                <ConsumptionModal
                                    reservation={reservation}
                                    isOpen={showConsumptionModal}
                                    onClose={() => setShowConsumptionModal(false)}
                                    onSuccess={() => {
                                        setShowConsumptionModal(false);
                                        fetchReservationData();
                                    }}
                                />
                            )}

                            <EditTransactionModal
                                transaction={editingTransaction}
                                isOpen={!!editingTransaction}
                                onClose={() => setEditingTransaction(null)}
                                onSuccess={() => {
                                    setEditingTransaction(null);
                                    fetchReservationData();
                                }}
                            />

                        </div>
                    </>
                )
                }
            </div >
        </div >
    );
};

export default ReservationManager;
