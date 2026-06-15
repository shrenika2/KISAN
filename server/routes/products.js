const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const User = require('../models/User');
const auth = require('../middleware/auth');
const isFarmer = require('../middleware/isFarmer');
const { reverseGeocode, forwardGeocode } = require('../utils/geocoder');

const parseLocation = (rawLocation) => {
    if (!rawLocation || !Array.isArray(rawLocation.coordinates) || rawLocation.coordinates.length !== 2) {
        return {
            type: 'Point',
            coordinates: [0, 0]
        };
    }

    const lng = Number(rawLocation.coordinates[0]);
    const lat = Number(rawLocation.coordinates[1]);
    if (Number.isNaN(lng) || Number.isNaN(lat)) {
        return {
            type: 'Point',
            coordinates: [0, 0]
        };
    }

    return {
        type: 'Point',
        coordinates: [lng, lat]
    };
};

// Get all active products
router.get('/', async (req, res) => {
    try {
        const { lat, lng, radius } = req.query;
        const parsedLat = lat !== undefined ? Number(lat) : null;
        const parsedLng = lng !== undefined ? Number(lng) : null;
        const parsedRadiusKm = radius !== undefined ? Number(radius) : null;
        const hasGeoFilter = Number.isFinite(parsedLat) && Number.isFinite(parsedLng);
        const maxDistanceMeters = Number.isFinite(parsedRadiusKm) && parsedRadiusKm > 0
            ? parsedRadiusKm * 1000
            : 50000;

        const query = { status: 'active' };
        if (hasGeoFilter) {
            query.location = {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [parsedLng, parsedLat]
                    },
                    $maxDistance: maxDistanceMeters
                }
            };
        }

        const productsQuery = Product.find(query)
            .populate('farmer_id', 'name village district state')
        if (!hasGeoFilter) {
            productsQuery.sort({ created_at: -1 });
        }
        const products = await productsQuery;

        // Enrich with average rating
        const Review = require('../models/Review');
        const enrichedProducts = await Promise.all(products.map(async (p) => {
            if (!p || !p.farmer_id) return null;
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

        res.json(enrichedProducts.filter(Boolean));
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Get My Products (Farmer)
router.get('/my-products', [auth, isFarmer], async (req, res) => {
    try {
        const products = await Product.find({ farmer_id: req.user.id }).sort({ created_at: -1 });
        res.json(products);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Get single product
router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate('farmer_id', 'name village district state phone');
        if (!product) return res.status(404).json({ msg: 'Product not found' });
        res.json(product);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Add New Product
router.post('/', [auth, isFarmer], async (req, res) => {
    const { crop_name, quantity, price, image_url, sell_date, sell_location, location, manual_address, address, category } = req.body;
    try {
        const farmer = await User.findById(req.user.id).select('village district state');
        let parsedLocation = parseLocation(location);
        let [lng, lat] = parsedLocation.coordinates;
        let geoName = null;
        const isManualAddress = Boolean(address?.isManual);
        const manualFullAddress = address?.fullAddress || manual_address;

        if (isManualAddress) {
            const manualQuery = [
                manualFullAddress,
                address?.village || sell_location?.village,
                address?.district || sell_location?.district,
                address?.state || sell_location?.state,
                address?.pincode,
                'India'
            ].filter(Boolean).join(', ');

            let manualGeo = null;
            if (manualQuery) {
                manualGeo = await forwardGeocode(manualQuery);
            }
            if (!manualGeo && address?.pincode) {
                // Fallback to pincode center when village-level matching fails.
                manualGeo = await forwardGeocode(`${address.pincode}, India`);
            }

            if (manualGeo?.coordinates) {
                parsedLocation = {
                    type: 'Point',
                    coordinates: manualGeo.coordinates
                };
                [lng, lat] = parsedLocation.coordinates;
            }
            geoName = manualGeo || null;
        }

        if (!geoName) {
            geoName = await reverseGeocode(lat, lng);
        }

        const fallbackVillage = sell_location?.village || geoName?.village || farmer?.village || 'Unknown';
        const fallbackDistrict = sell_location?.district || geoName?.district || farmer?.district || 'Unknown';
        const fallbackState = sell_location?.state || geoName?.state || farmer?.state || 'Unknown';
        const fallbackPincode = address?.pincode || '';
        const resolvedVillage = address?.village || geoName?.village || fallbackVillage;
        const resolvedDistrict = address?.district || geoName?.district || fallbackDistrict;
        const resolvedState = address?.state || geoName?.state || fallbackState;

        const product = new Product({
            farmer_id: req.user.id,
            crop_name,
            category: category || 'Vegetables',
            quantity,
            price,
            image_url,
            sell_date: sell_date || Date.now(),
            sell_location: sell_location || {
                village: fallbackVillage,
                district: fallbackDistrict,
                state: fallbackState
            },
            location: parsedLocation,
            farmLocation: parsedLocation,
            locationName: {
                village: resolvedVillage,
                district: resolvedDistrict
            },
            formattedAddress: {
                village: resolvedVillage,
                district: resolvedDistrict,
                state: resolvedState
            },
            address: {
                fullAddress: manualFullAddress || [resolvedVillage, resolvedDistrict, resolvedState].filter(Boolean).join(', '),
                village: resolvedVillage,
                district: resolvedDistrict,
                state: resolvedState,
                pincode: fallbackPincode,
                isManual: isManualAddress
            }
        });
        await product.save();
        res.json(product);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});



// Update Product
router.put('/:id', [auth, isFarmer], async (req, res) => {
    try {
        let product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ msg: 'Product not found' });

        // Ensure user owns product
        if (product.farmer_id.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        const { crop_name, quantity, price, image_url, status } = req.body;
        if (crop_name) product.crop_name = crop_name;
        if (quantity) product.quantity = quantity;
        if (price) product.price = price;
        if (image_url) product.image_url = image_url;
        if (status) product.status = status;

        await product.save();
        res.json(product);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Delete Product
router.delete('/:id', [auth, isFarmer], async (req, res) => {
    try {
        let product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ msg: 'Product not found' });

        // Ensure user owns product
        if (product.farmer_id.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        await product.deleteOne();
        res.json({ msg: 'Product removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
