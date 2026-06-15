const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const isFarmer = require('../middleware/isFarmer');
const { confirmDelivery } = require('../controllers/paymentController');
const { shipOrder } = require('../controllers/orderController');

// Place an order
router.post('/', auth, async (req, res) => {
    const { product_id, farmer_id, requested_quantity, original_price, negotiated_price, payment_method } = req.body;

    try {
        // Atomic update to decrement quantity and prevent race conditions (overselling)
        const updatedProduct = await Product.findOneAndUpdate(
            { _id: product_id, quantity: { $gte: requested_quantity } },
            { $inc: { quantity: -requested_quantity } },
            { new: true }
        );

        if (!updatedProduct) {
            return res.status(400).json({ msg: 'Product not found or not enough quantity available' });
        }

        const effectiveNegotiatedPrice = negotiated_price || original_price;

        const order = new Order({
            product_id,
            farmer_id,
            consumer_id: req.user.id,
            requested_quantity,
            original_price,
            negotiated_price: effectiveNegotiatedPrice,
            payment_method,
            final_price: effectiveNegotiatedPrice, // Defaulting for simple flow
            order_status: 'requested',
            order_date: Date.now()
        });

        await order.save();

        // Set status to inactive if inventory is exactly depleted
        if (updatedProduct.quantity === 0) {
            updatedProduct.status = 'inactive';
            await updatedProduct.save();
        }

        res.json(order);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Complete an order
router.put('/:id/complete', auth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ msg: 'Order not found' });

        // Only consumer can mark as completed
        if (order.consumer_id.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        order.order_status = 'completed';
        order.completed_at = Date.now();
        order.receiptGeneratedAt = Date.now();
        await order.save();

        res.json(order);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Get My Orders (Consumer)
router.get('/my-orders', auth, async (req, res) => {
    try {
        const orders = await Order.find({ consumer_id: req.user.id })
            .populate('product_id', 'crop_name image_url')
            .populate('farmer_id', 'name phone')
            .sort({ order_date: -1 });
        res.json(orders);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Get Farmer Orders (Orders received by farmer)
router.get('/farmer-orders', [auth, isFarmer], async (req, res) => {
    try {
        const orders = await Order.find({ farmer_id: req.user.id })
            .populate('product_id', 'crop_name image_url')
            .populate('consumer_id', 'name phone')
            .sort({ order_date: -1 });
        res.json(orders);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

async function releaseEscrowOrder(orderId, userId) {
    const order = await Order.findById(orderId);
    if (!order) {
        const err = new Error('NOT_FOUND');
        err.status = 404;
        err.msg = 'Order not found';
        throw err;
    }
    if (order.consumer_id.toString() !== userId) {
        const err = new Error('FORBIDDEN');
        err.status = 401;
        err.msg = 'Not authorized';
        throw err;
    }
    if (order.payment_method === 'Online') {
        const err = new Error('ONLINE_ESCROW');
        err.status = 403;
        err.msg =
            'Online escrow can only be released after the farmer verifies the delivery OTP with you — buyers cannot release it manually.';
        throw err;
    }
    if (order.escrowStatus !== 'held') {
        const err = new Error('BAD_ESCROW');
        err.status = 400;
        err.msg = 'Funds can only be released when payment is held in escrow';
        throw err;
    }
    order.escrowStatus = 'released';
    order.deliveryConfirmation = true;
    order.order_status = 'completed';
    order.completed_at = new Date();
    order.receiptGeneratedAt = new Date();
    await order.save();
    return order;
}

// Buyer confirms delivery — escrow released and order completed (no automatic Stripe Connect payout in this demo)
router.put('/:id/release', auth, async (req, res) => {
    try {
        const order = await releaseEscrowOrder(req.params.id, req.user.id);
        res.json(order);
    } catch (err) {
        if (err.msg) {
            return res.status(err.status || 500).json({ msg: err.msg });
        }
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

router.post('/:orderId/release-funds', auth, async (req, res) => {
    try {
        const order = await releaseEscrowOrder(req.params.orderId, req.user.id);
        res.json(order);
    } catch (err) {
        if (err.msg) {
            return res.status(err.status || 500).json({ msg: err.msg });
        }
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Digital handshake: ship online escrow order (OTP hashed in DB; plain OTP only via Socket.io to buyer)
router.post('/:id/ship', [auth, isFarmer], shipOrder);
/** @deprecated Use POST /:id/ship */
router.put('/:id/mark-shipped', [auth, isFarmer], shipOrder);

router.post('/:id/confirm-delivery', [auth, isFarmer], confirmDelivery);

// Buyer flags an issue while escrow is held (admin workflow — placeholder)
router.post('/:orderId/dispute', auth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId);
        if (!order) {
            return res.status(404).json({ msg: 'Order not found' });
        }
        if (order.consumer_id.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }
        if (order.escrowStatus !== 'held') {
            return res.status(400).json({ msg: 'A dispute can only be opened while payment is held in escrow' });
        }
        order.escrowStatus = 'disputed';
        await order.save();
        res.json({ order, msg: 'Admin has been notified.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

function partyId(ref) {
    if (!ref) return '';
    if (typeof ref === 'object' && ref._id != null) return String(ref._id);
    return String(ref);
}

// Get Order by ID (buyer or farmer on this order)
router.get('/:id', auth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('product_id')
            .populate('farmer_id', 'name email village district phone')
            .populate('consumer_id', 'name email village district phone');

        if (!order) return res.status(404).json({ msg: 'Order not found' });

        const uid = String(req.user.id);
        const isBuyer = partyId(order.consumer_id) === uid;
        const isFarmer = partyId(order.farmer_id) === uid;
        if (!isBuyer && !isFarmer) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        res.json(order);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Update Order Status (Dev/Farmer Action)
router.put('/:id/status', [auth, isFarmer], async (req, res) => {
    const { status, final_price, negotiated_price } = req.body;
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ msg: 'Order not found' });

        const previousStatus = order.order_status;
        order.order_status = status;
        if (final_price !== undefined) order.final_price = final_price;
        if (negotiated_price !== undefined && status === 'counter_offered') {
            order.negotiated_price = negotiated_price;
        }
        if (status === 'approved') order.approval_date = Date.now();
        if (status === 'completed' && !order.receiptGeneratedAt) {
            order.completed_at = order.completed_at || new Date();
            order.receiptGeneratedAt = new Date();
        }

        await order.save();

        // If rejected, restore product quantity as it was deducted upon requesting
        if (status === 'rejected' && previousStatus !== 'rejected') {
            const product = await Product.findById(order.product_id);
            if (product) {
                product.quantity += order.requested_quantity;
                product.status = 'active'; // Reactivate if it went to 0
                await product.save();
            }
        }

        res.json(order);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Update Order Status (Consumer Action, responding to counter-offer)
router.put('/:id/consumer-respond', auth, async (req, res) => {
    const { status, negotiated_price } = req.body;
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ msg: 'Order not found' });

        // Ensure user is the consumer
        if (order.consumer_id.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        // Must be in counter_offered state to respond
        if (order.order_status !== 'counter_offered') {
            return res.status(400).json({ msg: 'Order is not in a state to be responded to' });
        }

        const previousStatus = order.order_status;
        order.order_status = status;

        if (status === 'approved') {
            order.approval_date = Date.now();
            order.final_price = order.negotiated_price; // Finalize price on accept
        } else if (status === 'requested' && negotiated_price !== undefined) {
            order.negotiated_price = negotiated_price; // Consumer counter-counters
        }

        await order.save();

        if (status === 'rejected' && previousStatus !== 'rejected') {
            const product = await Product.findById(order.product_id);
            if (product) {
                product.quantity += order.requested_quantity;
                product.status = 'active';
                await product.save();
            }
        }

        res.json(order);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
