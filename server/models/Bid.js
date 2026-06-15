const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema({
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    farmer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    consumer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    bid_price: { type: Number, required: true },
    requested_quantity: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Bid', bidSchema);
