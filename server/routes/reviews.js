const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Review = require('../models/Review');
const Order = require('../models/Order');
const auth = require('../middleware/auth');

// Multer Config for Reviews
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './public/uploads/reviews';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `review-${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage });

// @route   POST api/reviews
// @desc    Add a Review with images
// @access  Private
router.post('/', [auth, upload.array('images', 3)], async (req, res) => {
    const { order_id, rating, comment } = req.body;

    try {
        const order = await Order.findById(order_id);
        if (!order) return res.status(404).json({ msg: 'Order not found' });

        if (order.order_status !== 'completed') {
            return res.status(400).json({ msg: 'You can only review completed orders' });
        }

        if (order.consumer_id.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        const existingReview = await Review.findOne({ order_id, consumer_id: req.user.id });
        if (existingReview) return res.status(400).json({ msg: 'Already reviewed' });

        const images = req.files ? req.files.map(file => `/uploads/reviews/${file.filename}`) : [];

        const review = new Review({
            order_id,
            consumer_id: req.user.id,
            farmer_id: order.farmer_id,
            product_id: order.product_id,
            rating,
            comment,
            images
        });

        await review.save();
        res.json(review);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/reviews/product/:productId
// @desc    Get reviews for a product
// @access  Public
router.get('/product/:productId', async (req, res) => {
    try {
        const reviews = await Review.find({ product_id: req.params.productId })
            .populate('consumer_id', 'name')
            .sort({ created_at: -1 });
        res.json(reviews);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// @route   GET api/reviews/can-review/:productId
// @desc    Check if consumer can review product
// @access  Private
router.get('/can-review/:productId', auth, async (req, res) => {
    try {
        const order = await Order.findOne({
            product_id: req.params.productId,
            consumer_id: req.user.id,
            order_status: 'completed'
        });

        const existingReview = await Review.findOne({
            product_id: req.params.productId,
            consumer_id: req.user.id
        });

        res.json({
            canReview: !!order && !existingReview,
            orderId: order ? order._id : null
        });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// Existing Farmer stats & reviews
router.get('/farmer/:farmerId', async (req, res) => {
    try {
        const reviews = await Review.find({ farmer_id: req.params.farmerId })
            .populate('consumer_id', 'name')
            .populate('product_id', 'crop_name')
            .sort({ created_at: -1 });
        res.json(reviews);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

router.get('/stats/:farmerId', async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const stats = await Review.aggregate([
            { $match: { farmer_id: new mongoose.Types.ObjectId(req.params.farmerId) } },
            { $group: { _id: '$farmer_id', average: { $avg: '$rating' }, count: { $sum: 1 } } }
        ]);
        res.json(stats[0] || { average: 0, count: 0 });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

module.exports = router;

