const axios = require('axios');

// N8N Webhook URLs (These should be configured in .env)
const N8N_CHECKIN_WEBHOOK = process.env.N8N_CHECKIN_WEBHOOK || 'http://localhost:5678/webhook/checkin';
const N8N_CHECKOUT_WEBHOOK = process.env.N8N_CHECKOUT_WEBHOOK || 'http://localhost:5678/webhook/checkout';
const N8N_RESERVATION_UPDATE_WEBHOOK = process.env.N8N_RESERVATION_UPDATE_WEBHOOK || 'http://localhost:5678/webhook/reservation-update';

/**
 * Send Check-in notification to N8N
 * N8N will handle WhatsApp message sending based on visit count
 */
const sendCheckInNotification = async (guestData, reservationData) => {
    try {
        const payload = {
            guest: {
                name: guestData.name,
                phone: guestData.phone,
                email: guestData.email,
                visit_count: guestData.visit_count,
                doc_number: guestData.doc_number,
            },
            reservation: {
                room_number: reservationData.room_number,
                start_date: reservationData.start_date,
                end_date: reservationData.end_date,
            },
            message_type: getMessageType(guestData.visit_count),
            timestamp: new Date().toISOString(),
        };

        console.log('[N8N] Sending check-in webhook:', payload);

        // Send to N8N
        const response = await axios.post(N8N_CHECKIN_WEBHOOK, payload, {
            timeout: 5000,
            headers: { 'Content-Type': 'application/json' },
        });

        console.log('[N8N] Check-in webhook sent successfully:', response.status);
        return { success: true, data: response.data };
    } catch (error) {
        console.error('[N8N] Error sending check-in webhook:', error.message);
        // Don't fail the check-in if webhook fails
        return { success: false, error: error.message };
    }
};

/**
 * Send Check-out notification to N8N
 */
const sendCheckOutNotification = async (guestData, reservationData) => {
    try {
        const payload = {
            guest: {
                name: guestData.name,
                phone: guestData.phone,
            },
            reservation: {
                room_number: reservationData.room_number,
            },
            timestamp: new Date().toISOString(),
        };

        console.log('[N8N] Sending check-out webhook:', payload);

        const response = await axios.post(N8N_CHECKOUT_WEBHOOK, payload, {
            timeout: 5000,
            headers: { 'Content-Type': 'application/json' },
        });

        console.log('[N8N] Check-out webhook sent successfully:', response.status);
        return { success: true, data: response.data };
    } catch (error) {
        console.error('[N8N] Error sending check-out webhook:', error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Send Reservation Update notification to N8N
 * N8N will send email to renato.leoncr@gmail.com with changed fields
 */
const sendReservationUpdateNotification = async (reservationCode, changedFields, updatedBy) => {
    try {
        const payload = {
            reservation_code: reservationCode,
            changed_fields: changedFields, // Array of { field, old_value, new_value }
            updated_by: updatedBy, // User name or email
            timestamp: new Date().toISOString(),
            recipient: 'renato.leoncr@gmail.com',
        };

        console.log('[N8N] Sending reservation update webhook:', payload);

        const response = await axios.post(N8N_RESERVATION_UPDATE_WEBHOOK, payload, {
            timeout: 5000,
            headers: { 'Content-Type': 'application/json' },
        });

        console.log('[N8N] Reservation update webhook sent successfully:', response.status);
        return { success: true, data: response.data };
    } catch (error) {
        console.error('[N8N] Error sending reservation update webhook:', error.message);
        // Don't fail the update if webhook fails
        return { success: false, error: error.message };
    }
};

/**
 * Determine message type based on visit count
 */
const getMessageType = (visitCount) => {
    if (visitCount === 1) return 'first_visit';
    if (visitCount === 2) return 'second_visit';
    return 'loyal_customer'; // 3+
};

/**
 * Validate DNI from image using N8N OCR
 * @param {Buffer} imageBuffer - Image file buffer
 * @param {string} expectedDNI - Expected DNI number from reservation
 * @returns {Promise<{success: boolean, extractedDNI?: string, error?: string}>}
 */
const validateDNI = async (imageBuffer, expectedDNI) => {
    try {
        const N8N_DNI_VALIDATION_WEBHOOK = process.env.N8N_DNI_VALIDATION_WEBHOOK ||
            'https://facturas-mak-n8n.bluzcx.easypanel.host/webhook-test/validar-dni-checkin';

        console.log('[N8N] Validating DNI with expected value:', expectedDNI);

        // Create form data with image
        const FormData = require('form-data');
        const formData = new FormData();
        formData.append('image', imageBuffer, { filename: 'dni.jpg' });
        formData.append('expected_dni', expectedDNI);

        const response = await axios.post(N8N_DNI_VALIDATION_WEBHOOK, formData, {
            timeout: 30000, // 30 seconds for OCR processing
            headers: {
                ...formData.getHeaders(),
            },
        });

        console.log('[N8N] DNI validation response:', response.data);

        // Expected response format: { success: true/false, extracted_dni: "12345678", message: "..." }
        if (response.data.success) {
            return {
                success: true,
                extractedDNI: response.data.extracted_dni,
                message: response.data.message || 'DNI validado correctamente'
            };
        } else {
            return {
                success: false,
                extractedDNI: response.data.extracted_dni,
                error: response.data.message || 'El DNI no coincide con el registrado en la reserva'
            };
        }
    } catch (error) {
        console.error('[N8N] Error validating DNI:', error.message);
        return {
            success: false,
            error: error.response?.data?.message || 'Error al validar DNI. Por favor, intente nuevamente.'
        };
    }
};

module.exports = {
    sendCheckInNotification,
    sendCheckOutNotification,
    sendReservationUpdateNotification,
    validateDNI,
};
