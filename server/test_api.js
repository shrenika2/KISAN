const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config();

const Product = require('./models/Product');
const Review = require('./models/Review');
const User = require('./models/User');

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/kisan').then(async () => {
    try {
        const products = await Product.find({ status: 'active' })
            .populate('farmer_id', 'name village district state')
            .sort({ created_at: -1 });

        const enrichedProducts = await Promise.all(products.map(async (p) => {
            if (!p.farmer_id) return null; // Prevent crash if farmer user was deleted
            const stats = await Review.aggregate([
                { $match: { farmer_id: p.farmer_id._id } },
                { $group: { _id: '$farmer_id', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
            ]);

            const plainProduct = p.toObject();
            plainProduct.rating = stats.length > 0 ? {
                average: Math.round(stats[0].avg * 10) / 10,
                count: stats[0].count
            } : { average: 0, count: 0 };

            return plainProduct;
        }));

        const final = enrichedProducts.filter(Boolean);
        fs.writeFileSync('api_out.json', JSON.stringify({ success: true, count: final.length, data: final }, null, 2));
    } catch (err) {
        fs.writeFileSync('api_out.json', JSON.stringify({ success: false, error: err.message, stack: err.stack }, null, 2));
    } finally {
        mongoose.connection.close();
    }
});
