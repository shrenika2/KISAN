const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    consumer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    farmer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true },
    images: [{ type: String }],
    created_at: { type: Date, default: Date.now }
});

// Compound index to ensure one review per order by a consumer (though logic also handles this)
reviewSchema.index({ order_id: 1, consumer_id: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
