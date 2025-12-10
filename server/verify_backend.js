const axios = require('axios');

const API_URL = 'http://localhost:3000/api';
let token = '';
let reservationId = '';
let roomId = 1;

async function run() {
    try {
        // 1. Login
        console.log('Logging in...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });
        token = loginRes.data.token;
        console.log('Login successful.');

        // 2. Create or Find Reservation
        console.log('Setting up reservation...');
        const startDate = new Date().toISOString().split('T')[0];
        const endDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];

        try {
            const resRes = await axios.post(`${API_URL}/reservations`, {
                room_id: roomId,
                guest_name: 'Backend Verifier',
                guest_doc_number: '99999999',
                start_date: startDate,
                end_date: endDate,
                total_amount: 100,
                prepaid_amount: 0
            }, { headers: { Authorization: `Bearer ${token}` } });
            reservationId = resRes.data.reservation.id;
            console.log(`Reservation created. ID: ${reservationId}`);
        } catch (e) {
            console.log('Reservation creation failed, finding active reservation...');
            const activeRes = await axios.get(`${API_URL}/reservations?status=reserved`, { headers: { Authorization: `Bearer ${token}` } });
            if (activeRes.data.length > 0) {
                const res = activeRes.data[0];
                reservationId = res.id;
                roomId = res.room_id;
                console.log(`Found active reservation ID: ${reservationId} for Room ${roomId}`);
            } else {
                throw new Error('No active reservations found and could not create one.');
            }
        }

        // 3. Get Initial State
        const initialRes = await axios.get(`${API_URL}/reservations/${reservationId}`, { headers: { Authorization: `Bearer ${token}` } });
        const initialTotal = parseFloat(initialRes.data.total_amount);
        console.log(`Initial Total Amount: ${initialTotal}`);

        // 4. Create Room Charge Transaction
        console.log('Creating room charge transaction (10.00)...');
        await axios.post(`${API_URL}/transactions/venta-mak`, {
            products: [{ id: 1, name: 'Test Product', price: 10, quantity: 1 }],
            method: 'room_charge',
            room_id: roomId,
            description: 'Backend Verification Charge'
        }, { headers: { Authorization: `Bearer ${token}` } });

        // 5. Verify Total Amount Unchanged
        const updatedRes = await axios.get(`${API_URL}/reservations/${reservationId}`, { headers: { Authorization: `Bearer ${token}` } });
        const finalTotal = parseFloat(updatedRes.data.total_amount);
        console.log(`Final Total Amount: ${finalTotal}`);

        if (initialTotal === finalTotal) {
            console.log('SUCCESS: Reservation total_amount remained unchanged.');
        } else {
            console.error(`FAILURE: Reservation total_amount changed from ${initialTotal} to ${finalTotal}`);
        }

        // 6. Try Checkout (Should Fail)
        console.log('Attempting Checkout (Should Fail)...');
        try {
            await axios.post(`${API_URL}/reservations/${reservationId}/checkout`, {}, { headers: { Authorization: `Bearer ${token}` } });
            console.error('FAILURE: Checkout succeeded but should have failed.');
        } catch (error) {
            console.log('SUCCESS: Checkout failed as expected:', error.response?.data?.message);
        }

        // 7. Calculate Debt and Pay
        // We need to fetch transactions to know exact debt if we reused a reservation
        const transactionsRes = await axios.get(`${API_URL}/transactions`, { headers: { Authorization: `Bearer ${token}` } });
        const resTransactions = transactionsRes.data.filter(t => t.reservation_id === reservationId);

        const consumptionTotal = resTransactions
            .filter(t => t.method === 'room_charge')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);

        const paidTotal = resTransactions
            .filter(t => t.transaction_type === 'reservation_payment')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);

        // Also account for initial prepaid_amount if it wasn't recorded as a transaction (though it should be)
        // The controller adds a transaction for prepaid, so summing transactions should be enough.
        // However, reservation.paid_amount is the source of truth for payments.
        const currentPaid = parseFloat(updatedRes.data.paid_amount || 0);

        const grandTotal = finalTotal + consumptionTotal;
        const debt = grandTotal - currentPaid;

        console.log(`Calculated Debt: ${debt} (Base: ${finalTotal}, Consumptions: ${consumptionTotal}, Paid: ${currentPaid})`);

        if (debt > 0) {
            console.log(`Paying debt of ${debt}...`);
            await axios.post(`${API_URL}/reservations/${reservationId}/payment`, {
                amount: debt,
                payment_method: 'cash',
                description: 'Full Payment for Verification'
            }, { headers: { Authorization: `Bearer ${token}` } });
        }

        // 8. Try Checkout Again (Should Succeed)
        console.log('Attempting Checkout Again (Should Succeed)...');
        await axios.post(`${API_URL}/reservations/${reservationId}/checkout`, {}, { headers: { Authorization: `Bearer ${token}` } });
        console.log('SUCCESS: Checkout successful.');

    } catch (error) {
        console.error('Verification failed:', error.response?.data || error.message);
    }
}

run();
