const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const auth = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');

const { getStripeOrNull, ensureEscrowPaymentApplied } = paymentController;
const stripe = () => getStripeOrNull();

// Legacy alias — prefer POST /api/payment/create-session
router.post('/create-checkout-session', auth, async (req, res) => {
    return paymentController.createSession(req, res);
});

router.post('/verify-payment', auth, async (req, res) => {
    const { session_id, order_id } = req.body;

    try {
        if (!session_id) {
            return res.status(400).json({ msg: 'Session ID is missing.' });
        }

        if (session_id.startsWith('demo_session_')) {
            const trusted_order_id = order_id || session_id.replace(/^demo_session_/, '');
            if (!trusted_order_id) {
                return res.status(400).json({ msg: 'Order id missing for demo payment.' });
            }
            try {
                await ensureEscrowPaymentApplied({
                    orderId: trusted_order_id,
                    transactionId: session_id,
                    consumerId: req.user.id,
                    io: req.io,
                    source: 'mock'
                });
            } catch (e) {
                return res.status(e.statusCode || 500).json({ msg: e.message });
            }
            return res.json({ success: true, msg: 'Demo payment recorded — escrow held on platform', demo: true });
        }

        const st = stripe();
        if (!st) {
            return res.status(503).json({ msg: 'Stripe is not configured.' });
        }

        const session = await st.checkout.sessions.retrieve(session_id);

        if (session.payment_status !== 'paid') {
            return res.status(400).json({ msg: 'Payment was not verified by Stripe.' });
        }

        const trusted_order_id = session.metadata?.order_id;

        if (!trusted_order_id) {
            return res.status(400).json({ msg: 'Order metadata missing from Stripe session.' });
        }

        await ensureEscrowPaymentApplied({
            orderId: trusted_order_id,
            transactionId: session_id,
            consumerId: req.user.id,
            io: req.io,
            source: 'stripe'
        });

        res.json({ success: true, msg: 'Payment verified — funds held in escrow until you confirm delivery' });
    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({ msg: err.message });
        }
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.post('/process', auth, async (req, res) => {

    const { order_id } = req.body;

    try {
        const tid = 'TXN_' + Date.now();
        await paymentController.ensureEscrowPaymentApplied({
            orderId: order_id,
            transactionId: tid,
            consumerId: req.user.id,
            io: req.io,
            source: 'mock'
        });
        const payment = await Payment.findOne({ order_id }).sort({ createdAt: -1 });
        res.json({ msg: 'Payment Successful', payment });
    } catch (err) {
        console.error(err.message);
        res.status(err.statusCode || 500).json({ msg: err.message || 'Server Error' });
    }
});

module.exports = router;
