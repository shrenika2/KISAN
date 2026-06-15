require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const { forwardGeocode } = require('../utils/geocoder');

const isZeroCoordinates = (coords) => {
    return !Array.isArray(coords) || coords.length !== 2 || (coords[0] === 0 && coords[1] === 0);
};

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const products = await Product.find({
        $or: [
            { 'location.coordinates': [0, 0] },
            { location: { $exists: false } }
        ]
    });

    let updated = 0;
    for (const product of products) {
        if (!isZeroCoordinates(product?.location?.coordinates)) continue;

        const query = [
            product?.address?.village,
            product?.address?.district || product?.formattedAddress?.district || product?.sell_location?.district,
            product?.address?.state || product?.formattedAddress?.state || product?.sell_location?.state,
            product?.address?.pincode,
            'India'
        ].filter(Boolean).join(', ');

        if (!query) continue;

        let geo = await forwardGeocode(query);
        if (!geo?.coordinates && product?.address?.pincode) {
            geo = await forwardGeocode(`${product.address.pincode}, India`);
        }
        if (!geo?.coordinates) continue;

        product.location = { type: 'Point', coordinates: geo.coordinates };
        product.farmLocation = { type: 'Point', coordinates: geo.coordinates };
        await product.save();
        updated += 1;
    }

    console.log(`Backfill complete. Updated products: ${updated}`);
    await mongoose.disconnect();
};

run().catch(async (err) => {
    console.error('Backfill failed:', err);
    try { await mongoose.disconnect(); } catch (_) {}
    process.exit(1);
});
