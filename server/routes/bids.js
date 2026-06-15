const express = require('express');
const router = express.Router();
const Bid = require('../models/Bid');
const Product = require('../models/Product');
const Order = require('../models/Order');
const auth = require('../middleware/auth');
const isFarmer = require('../middleware/isFarmer');

// POST /api/bids - Create a new bid (Consumer)
router.post('/', auth, async (req, res) => {
    const { product_id, farmer_id, bid_price, requested_quantity } = req.body;

    try {
        const product = await Product.findById(product_id);
        if (!product) return res.status(404).json({ msg: 'Product not found' });
        
        if (product.quantity < requested_quantity) {
            return res.status(400).json({ msg: 'Not enough quantity available for this bid' });
        }

        const bid = new Bid({
            product_id,
            farmer_id,
            consumer_id: req.user.id,
            bid_price,
            requested_quantity
        });

        await bid.save();
        res.json(bid);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// PUT /api/bids/accept/:id - Accept a bid and create Order (Farmer)
router.put('/accept/:id', [auth, isFarmer], async (req, res) => {
    try {
        const bid = await Bid.findById(req.params.id);
        if (!bid) return res.status(404).json({ msg: 'Bid not found' });

        if (bid.farmer_id.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized to accept this bid' });
        }

        if (bid.status !== 'pending') {
            return res.status(400).json({ msg: `Bid is already ${bid.status}` });
        }

        // Atomically lock and decrement product quantity avoiding race conditions
        const updatedProduct = await Product.findOneAndUpdate(
            { _id: bid.product_id, quantity: { $gte: bid.requested_quantity }, status: 'active' },
            { $inc: { quantity: -bid.requested_quantity } },
            { new: true }
        );

        if (!updatedProduct) {
            // Auto-reject if the product sold out concurrently
            bid.status = 'rejected';
            await bid.save();
            return res.status(400).json({ msg: 'Product not found or not enough quantity available anymore. Bid automatically rejected.' });
        }

        if (updatedProduct.quantity === 0) {
            updatedProduct.status = 'inactive';
            await updatedProduct.save();

            // Automatically reject all other pending bids since the product is completely out of stock
            await Bid.updateMany(
                { product_id: bid.product_id, status: 'pending', _id: { $ne: bid._id } },
                { $set: { status: 'rejected' } }
            );
        } else {
            // Proactively reject any bids that now exceed the remaining fragmented inventory
            await Bid.updateMany(
                { product_id: bid.product_id, status: 'pending', requested_quantity: { $gt: updatedProduct.quantity } },
                { $set: { status: 'rejected' } }
            );
        }

        // Update bid status
        bid.status = 'accepted';
        await bid.save();

        // 3. Automatically create the final Order fulfilling the workflow
        const order = new Order({
            product_id: bid.product_id,
            farmer_id: bid.farmer_id,
            consumer_id: bid.consumer_id,
            requested_quantity: bid.requested_quantity,
            original_price: updatedProduct.price, // original requested baseline
            negotiated_price: bid.bid_price, // The formally accepted bid value
            payment_method: 'Card', 
            final_price: bid.bid_price,
            order_status: 'approved',
            order_date: Date.now(),
            approval_date: Date.now()
        });

        await order.save();

        res.json({ msg: 'Bid accepted and Order automatically forged.', bid, order });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// PUT /api/bids/reject/:id - Reject a bid (Farmer)
router.put('/reject/:id', [auth, isFarmer], async (req, res) => {
    try {
        const bid = await Bid.findById(req.params.id);
        if (!bid) return res.status(404).json({ msg: 'Bid not found' });

        if (bid.farmer_id.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized to reject this bid' });
        }

        bid.status = 'rejected';
        await bid.save();

        res.json({ msg: 'Bid rejected', bid });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// GET /api/bids/farmer - Get all bids mapped to a single farmer
router.get('/farmer', [auth, isFarmer], async (req, res) => {
    try {
        const bids = await Bid.find({ farmer_id: req.user.id })
            .populate('product_id', 'crop_name price image_url')
            .populate('consumer_id', 'name phone')
            .sort({ created_at: -1 });
        res.json(bids);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// GET /api/bids/consumer - Get all active placed bids by a single consumer
router.get('/consumer', auth, async (req, res) => {
    try {
        const bids = await Bid.find({ consumer_id: req.user.id })
            .populate('product_id', 'crop_name price image_url')
            .populate('farmer_id', 'name phone')
            .sort({ created_at: -1 });
        res.json(bids);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
