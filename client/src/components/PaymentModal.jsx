import React, { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { X, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { compressImage } from '../utils/imageUtils';

const PaymentModal = ({ reservation, onClose, onSuccess }) => {
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('cash');
    const [description, setDescription] = useState('');
    const [paymentEvidence, setPaymentEvidence] = useState('');
    const [imagePreview, setImagePreview] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitError, setSubmitError] = useState('');

    // Calc Logic
    const roomPrice = parseFloat(reservation.total_amount || 0);
    const consumptionTotal = parseFloat(reservation.consumption_total || 0);
    const grandTotal = roomPrice + consumptionTotal;
    const paidAmount = parseFloat(reservation.paid_amount || 0);
    const remainingAmount = grandTotal - paidAmount;

    // Shortcuts
    React.useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const compressedBase64 = await compressImage(file);
                setPaymentEvidence(compressedBase64);
                setImagePreview(compressedBase64);
                setSubmitError(''); // Clear error on change
            } catch (error) {
                console.error('PaymentModal compression error:', error);
                setSubmitError('Error al procesar la imagen');
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitError('');

        if (!amount || parseFloat(amount) <= 0) {
            setSubmitError('Ingrese un monto válido');
            return;
        }

        if (parseFloat(amount) > remainingAmount + 0.5) { // Small buffer for float errors
            setSubmitError(`El monto no puede exceder la deuda pendiente (S/ ${remainingAmount.toFixed(2)})`);
            return;
        }

        if (method !== 'cash' && !paymentEvidence) {
            setSubmitError('Es obligatorio adjuntar la evidencia para este método de pago.');
            return;
        }

        setLoading(true);
        try {
            await axios.post(
                `${API_URL}/reservations/${reservation.id}/payment`,
                {
                    amount: parseFloat(amount),
                    payment_method: method,
                    description: description || `Pago adicional - Reserva #${reservation.reservation_code}`,
                    payment_evidence: method !== 'cash' ? paymentEvidence : null
                }
            );
            alert('Pago registrado exitosamente');
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error registering payment:', error);
            setSubmitError(error.response?.data?.message || 'Error al registrar pago');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b">
                    <h2 className="text-2xl font-bold text-gray-800">Registrar Pago</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X size={24} />
                    </button>
                </div>

                {/* Reservation Details */}
                <div className="p-6 bg-gray-50 border-b">
                    <h3 className="font-semibold text-lg mb-3">Estado de Cuenta</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="col-span-2 flex justify-between border-b pb-2">
                            <span className="text-gray-600">Alojamiento ({reservation.Room?.number}):</span>
                            <span className="font-medium">S/ {roomPrice.toFixed(2)}</span>
                        </div>
                        <div className="col-span-2 flex justify-between border-b pb-2">
                            <span className="text-gray-600">Consumos / Extras:</span>
                            <span className="font-medium">S/ {consumptionTotal.toFixed(2)}</span>
                        </div>

                        <div className="col-span-2 flex justify-between items-center pt-1">
                            <span className="font-bold text-gray-800">Total General:</span>
                            <span className="font-bold text-lg text-blue-600">S/ {grandTotal.toFixed(2)}</span>
                        </div>

                        <div className="col-span-2 flex justify-between items-center text-green-700">
                            <span>Pagado hasta hoy:</span>
                            <span className="font-bold">- S/ {paidAmount.toFixed(2)}</span>
                        </div>

                        <div className="col-span-2 flex justify-between items-center mt-2 pt-2 border-t border-gray-300">
                            <span className="font-bold text-gray-800 text-lg">Deuda Pendiente:</span>
                            <span className={`font-bold text-xl ${remainingAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                S/ {remainingAmount.toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Payment Form */}
                <form onSubmit={handleSubmit} className="p-6">
                    <div className="space-y-4">
                        {/* Amount */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Monto a Pagar *
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                max={remainingAmount}
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                onWheel={(e) => e.target.blur()}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                placeholder={`Máximo: S/ ${remainingAmount.toFixed(2)}`}
                                required
                            />
                        </div>

                        {/* Payment Method */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Método de Pago *
                            </label>
                            <select
                                value={method}
                                onChange={(e) => setMethod(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="cash">Efectivo</option>
                                <option value="yape">Yape</option>
                                <option value="card">Tarjeta</option>
                                <option value="transfer">Transferencia</option>
                            </select>
                        </div>

                        {/* Payment Evidence (if not cash) */}
                        {method !== 'cash' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Evidencia de Pago * (Captura/Foto)
                                </label>
                                <div className="mt-1 flex items-center gap-4">
                                    <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer">
                                        <Upload size={18} />
                                        Subir Imagen
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            onChange={handleImageUpload}
                                            className="hidden"
                                        />
                                    </label>
                                    {imagePreview && (
                                        <span className="text-sm text-green-600">✓ Imagen cargada</span>
                                    )}
                                </div>
                                {imagePreview && (
                                    <div className="mt-3">
                                        <img
                                            src={imagePreview}
                                            alt="Preview"
                                            className="max-w-xs max-h-48 rounded border"
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Descripción (Opcional)
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                rows="2"
                                placeholder="Notas adicionales..."
                            />
                        </div>
                    </div>

                    {/* Submit Error */}
                    {submitError && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                            ⚠️ {submitError}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                            disabled={loading}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
                            disabled={loading}
                        >
                            {loading ? 'Procesando...' : 'Registrar Pago'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


export default PaymentModal;
