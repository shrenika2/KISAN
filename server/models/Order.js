const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    farmer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    consumer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    requested_quantity: { type: Number, required: true },
    original_price: { type: Number, required: true },
    negotiated_price: { type: Number }, // Price offered by consumer
    final_price: { type: Number }, // Filled after farmer approval
    payment_method: { type: String, enum: ['Online', 'Cash'], required: true },
    order_status: {
        type: String,
        enum: ['pending', 'approved', 'completed', 'rejected', 'requested', 'counter_offered', 'paid', 'shipped', 'payment_pending'],
        default: 'approved'
    },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
    escrowStatus: { type: String, enum: ['none', 'held', 'released', 'refunded', 'disputed'], default: 'none' },
    deliveryConfirmation: { type: Boolean, default: false },
    order_date: { type: Date, default: Date.now },
    approval_date: Date,
    payment_date: Date,
    shipped_at: { type: Date },
    completed_at: Date,
    receiptGeneratedAt: { type: Date },
    deliveryOTP: { type: String },
    /** Bcrypt hash of 6-digit delivery OTP (online escrow); cleared after successful verify */
    deliveryOTPHash: { type: String, select: false }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
