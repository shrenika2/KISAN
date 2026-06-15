const bcrypt = require('bcryptjs');
const Order = require('../models/Order');
const Payment = require('../models/Payment');

const MOCK_SESSION_PREFIX = 'mock_session_';

/** Buyer-only: OTP handshake completed; farmer release must not duplicate this to farmer room per product spec */
function notifyBuyerPaymentReleased(io, order) {
    if (!io || !order) return;
    const buyerId =
        order.consumer_id && order.consumer_id._id != null
            ? order.consumer_id._id.toString()
            : order.consumer_id.toString();
    io.to(buyerId).emit('payment_released', {
        orderId: order._id.toString(),
        message: 'Delivery confirmed! Your receipt is ready.'
    });
}

function notifyFarmerEscrow(io, order) {
    if (!io || !order?.farmer_id) return;
    const farmerId = order.farmer_id._id
        ? order.farmer_id._id.toString()
        : order.farmer_id.toString();
    io.to(farmerId).emit('escrow_payment_secured', {
        message: 'Payment Secured in Escrow. Please Ship.',
        orderId: order._id.toString()
    });
}

/**
 * Idempotent: sets paid + escrow held, payment row, farmer socket.
 * @param {object} opts
 * @param {string} opts.orderId
 * @param {string} opts.transactionId
 * @param {string|null} opts.consumerId - if set, must match order.consumer_id
 * @param {import('socket.io').Server} opts.io
 * @param {'stripe'|'mock'} opts.source
 */
async function ensureEscrowPaymentApplied(opts) {
    const { orderId, transactionId, consumerId, io, source } = opts;
    const order = await Order.findById(orderId);
    if (!order) {
        const e = new Error('Order not found');
        e.statusCode = 404;
        throw e;
    }
    if (consumerId && order.consumer_id.toString() !== consumerId) {
        const e = new Error('Not authorized');
        e.statusCode = 401;
        throw e;
    }

    const alreadyHeld = order.paymentStatus === 'paid' && order.escrowStatus === 'held';
    if (!alreadyHeld) {
        await Order.findByIdAndUpdate(orderId, {
            paymentStatus: 'paid',
            escrowStatus: 'held',
            order_status: 'paid',
            payment_date: new Date()
        });
    }

    const fresh = await Order.findById(orderId);
    const existingPayment = await Payment.findOne({ order_id: orderId });
    if (!existingPayment) {
        await Payment.create({
            order_id: orderId,
            consumer_id: fresh.consumer_id,
            farmer_id: fresh.farmer_id,
            amount: fresh.final_price || fresh.negotiated_price,
            payment_method: source === 'stripe' ? 'Card' : 'Mock',
            payment_status: 'success',
            transaction_id: transactionId,
            payment_date: new Date()
        });
    }

    if (!alreadyHeld || !existingPayment) {
        notifyFarmerEscrow(io, fresh);
    }
    return fresh;
}

function clientBase() {
    return process.env.CLIENT_URL || 'http://localhost:5173';
}

function getStripeOrNull() {
    const key = process.env.STRIPE_SECRET_KEY && String(process.env.STRIPE_SECRET_KEY).trim();
    return key ? require('stripe')(key) : null;
}

async function createSession(req, res) {
    try {
        const orderId = req.body.orderId || req.body.order_id;
        const product_name = req.body.product_name || req.body.productName || 'Order payment';
        const amount = Number(req.body.amount);

        if (!orderId) {
            return res.status(400).json({ msg: 'orderId is required' });
        }
        if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({ msg: 'Valid amount is required' });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ msg: 'Order not found' });
        }
        if (order.consumer_id.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }
        if (order.payment_method !== 'Online') {
            return res.status(400).json({ msg: 'Order is not an online payment order' });
        }
        if (order.paymentStatus === 'paid' && order.escrowStatus === 'held') {
            return res.status(400).json({ msg: 'Order is already paid' });
        }

        const stripe = getStripeOrNull();
        if (!stripe) {
            const mockUrl = `${clientBase()}/payment-mock/${orderId}`;
            return res.json({
                mockUrl,
                fallback: true,
                message: 'Stripe not configured — using simulated checkout'
            });
        }

        try {
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                metadata: { order_id: String(orderId) },
                line_items: [
                    {
                        price_data: {
                            currency: 'inr',
                            product_data: { name: product_name },
                            unit_amount: Math.round(amount * 100)
                        },
                        quantity: 1
                    }
                ],
                mode: 'payment',
                success_url: `${clientBase()}/success?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`,
                cancel_url: `${clientBase()}/cancel`
            });
            return res.json({ url: session.url, id: session.id });
        } catch (err) {
            console.error('Stripe create session failed:', err.message);
            const mockUrl = `${clientBase()}/payment-mock/${orderId}`;
            return res.json({
                mockUrl,
                fallback: true,
                message: 'Checkout failed — using simulated payment',
                error: err.message
            });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server Error' });
    }
}

async function confirmMockPayment(req, res) {
    try {
        const order_id = req.body.order_id || req.body.orderId;
        if (!order_id) {
            return res.status(400).json({ msg: 'order_id is required' });
        }
        const transactionId = `${MOCK_SESSION_PREFIX}${order_id}_${Date.now()}`;
        await ensureEscrowPaymentApplied({
            orderId: order_id,
            transactionId,
            consumerId: req.user.id,
            io: req.io,
            source: 'mock'
        });
        return res.json({ success: true, msg: 'Simulated payment applied; escrow held' });
    } catch (err) {
        const code = err.statusCode || 500;
        return res.status(code).json({ msg: err.message || 'Server Error' });
    }
}

/**
 * Atomic OTP handshake: farmer verifies buyer code, escrow released, hash removed.
 * @param {string} orderId
 * @param {string} otp
 * @param {{ user: { id: string }, io?: import('socket.io').Server }} req
 */
async function confirmDeliveryOrder(orderId, otp, req) {
    const otpDigits = String(otp != null ? otp : '')
        .trim()
        .replace(/\D/g, '');
    if (otpDigits.length !== 6) {
        const e = new Error('Enter the 6-digit delivery code from the buyer.');
        e.statusCode = 400;
        throw e;
    }

    const order = await Order.findById(orderId).select('+deliveryOTPHash');
    if (!order) {
        const e = new Error('Order not found');
        e.statusCode = 404;
        throw e;
    }
    if (order.farmer_id.toString() !== String(req.user.id)) {
        const e = new Error('Not authorized');
        e.statusCode = 401;
        throw e;
    }
    if (order.payment_method !== 'Online') {
        const e = new Error('OTP handoff applies to online escrow orders only.');
        e.statusCode = 400;
        throw e;
    }
    if (order.order_status !== 'shipped' || order.escrowStatus !== 'held') {
        const e = new Error('Order must be shipped with escrow held to verify delivery.');
        e.statusCode = 400;
        throw e;
    }
    if (order.paymentStatus !== 'paid') {
        const e = new Error('Order is not awaiting delivery confirmation.');
        e.statusCode = 400;
        throw e;
    }
    if (!order.deliveryOTPHash) {
        const e = new Error('No delivery code on file. Re-ship or contact support.');
        e.statusCode = 400;
        throw e;
    }

    const match = await bcrypt.compare(otpDigits, order.deliveryOTPHash);
    if (!match) {
        const e = new Error('Invalid Delivery Code. Please check with the Buyer.');
        e.statusCode = 400;
        throw e;
    }

    await Order.findByIdAndUpdate(order._id, {
        order_status: 'completed',
        escrowStatus: 'released',
        deliveryConfirmation: true,
        completed_at: Date.now(),
        receiptGeneratedAt: Date.now(),
        $unset: { deliveryOTPHash: 1, deliveryOTP: 1 }
    });

    const fresh = await Order.findById(orderId)
        .populate('product_id')
        .populate('consumer_id', 'name email village district phone')
        .populate('farmer_id', 'name email village district phone');

    notifyBuyerPaymentReleased(req.io, fresh);
    return fresh;
}

/**
 * POST /api/payment/confirm-delivery (body: orderId, otp) or POST /api/orders/:id/confirm-delivery
 */
async function confirmDelivery(req, res) {
    try {
        const orderId = req.params.id || req.body.orderId || req.body.order_id;
        if (!orderId) {
            return res.status(400).json({ msg: 'order id is required' });
        }
        const fresh = await confirmDeliveryOrder(orderId, req.body?.otp, req);
        return res.json(fresh);
    } catch (err) {
        const code = err.statusCode || 500;
        if (code >= 500) console.error(err);
        return res.status(code).json({ msg: err.message || 'Server Error' });
    }
}

async function stripeWebhook(req, res) {
    const stripeKey = process.env.STRIPE_SECRET_KEY && String(process.env.STRIPE_SECRET_KEY).trim();
    const secret = process.env.STRIPE_WEBHOOK_SECRET && String(process.env.STRIPE_WEBHOOK_SECRET).trim();
    if (!stripeKey || !secret) {
        return res.status(503).send('Webhook not configured');
    }

    const stripe = require('stripe')(stripeKey);
    const sig = req.headers['stripe-signature'];

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (err) {
        console.error('Webhook signature failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            if (session.payment_status !== 'paid') {
                return res.json({ received: true });
            }
            const orderId = session.metadata?.order_id;
            if (!orderId) {
                console.error('Webhook: missing order_id in metadata');
                return res.status(400).json({ msg: 'Missing order metadata' });
            }
            await ensureEscrowPaymentApplied({
                orderId,
                transactionId: session.id,
                consumerId: null,
                io: req.io,
                source: 'stripe'
            });
        }
        return res.json({ received: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ msg: err.message });
    }
}

module.exports = {
    ensureEscrowPaymentApplied,
    notifyFarmerEscrow,
    notifyBuyerPaymentReleased,
    confirmDeliveryOrder,
    MOCK_SESSION_PREFIX,
    createSession,
    confirmMockPayment,
    confirmDelivery,
    stripeWebhook,
    getStripeOrNull,
    clientBase
};
