const bcrypt = require('bcryptjs');
const Order = require('../models/Order');

/**
 * Mark an online escrow order as shipped: hash OTP in DB, plain OTP only via Socket.io.
 * @param {string} orderId
 * @param {{ user: { id: string }, io?: import('socket.io').Server }} req
 * @returns {Promise<object>} Plain order object (no hash, no OTP)
 */
async function markAsShipped(orderId, req) {
    const order = await Order.findById(orderId);
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
        const e = new Error('Ship flow is for online paid orders only.');
        e.statusCode = 400;
        throw e;
    }
    if (order.order_status !== 'paid' || order.paymentStatus !== 'paid' || order.escrowStatus !== 'held') {
        const e = new Error('Order must be paid (online) with escrow held before shipping.');
        e.statusCode = 400;
        throw e;
    }
    if (order.shipped_at) {
        const e = new Error('Order is already marked as shipped');
        e.statusCode = 400;
        throw e;
    }

    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    order.deliveryOTPHash = await bcrypt.hash(generatedOtp, 10);
    order.deliveryOTP = generatedOtp;
    order.order_status = 'shipped';
    order.shipped_at = new Date();
    await order.save();

    if (req.io) {
        req.io.to(order.consumer_id.toString()).emit('shipped_notification', {
            orderId: order._id.toString(),
            otp: generatedOtp
        });
    }

    const safe = order.toObject();
    delete safe.deliveryOTPHash;
    return safe;
}

/** Express handler: POST /api/orders/:id/ship */
async function shipOrder(req, res) {
    try {
        const safe = await markAsShipped(req.params.id, req);
        res.json(safe);
    } catch (err) {
        const code = err.statusCode || 500;
        console.error(err);
        res.status(code).json({ msg: err.message || 'Server Error' });
    }
}

module.exports = {
    markAsShipped,
    shipOrder
};
