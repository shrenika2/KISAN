/**
 * Maharashtra Farm2Door seed — 500+ products, precise hubs (Walwa, Pimpalgaon, Junnar, Rahuri).
 * Run: node seedData.js  (from server/, with MONGO_URI in .env)
 * WARNING: Clears users, products, orders, reviews, payments, bids, chat.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('./models/User');
const Product = require('./models/Product');
const Order = require('./models/Order');
const Review = require('./models/Review');
const Payment = require('./models/Payment');
const Bid = require('./models/Bid');
const ChatMessage = require('./models/ChatMessage');
const Conversation = require('./models/Conversation');

/** Real village anchors — jitter around these for spread, not district centers */
const HUBS = [
    {
        key: 'walwa',
        locationName: { village: 'Walwa', district: 'Sangli' },
        formattedAddress: { village: 'Walwa', district: 'Sangli', state: 'Maharashtra' },
        pincode: '416313',
        lat: 16.1476,
        lng: 74.2325
    },
    {
        key: 'pimpalgaon',
        locationName: { village: 'Pimpalgaon Baswant', district: 'Nashik' },
        formattedAddress: { village: 'Pimpalgaon Baswant', district: 'Nashik', state: 'Maharashtra' },
        pincode: '422209',
        lat: 20.1653,
        lng: 73.9794
    },
    {
        key: 'junnar',
        locationName: { village: 'Junnar', district: 'Pune' },
        formattedAddress: { village: 'Junnar', district: 'Pune', state: 'Maharashtra' },
        pincode: '410502',
        lat: 19.2091,
        lng: 73.8759
    },
    {
        key: 'rahuri',
        locationName: { village: 'Rahuri', district: 'Ahmednagar' },
        formattedAddress: { village: 'Rahuri', district: 'Ahmednagar', state: 'Maharashtra' },
        pincode: '413705',
        lat: 19.3902,
        lng: 74.4826
    }
];

const CATEGORY_CROPS = {
    Vegetables: ['Tomato', 'Onion', 'Potato', 'Brinjal', 'Okra', 'Bitter Gourd', 'Cabbage', 'Cauliflower', 'Chilli', 'Bottle Gourd'],
    Fruits: ['Grapes', 'Pomegranate', 'Banana', 'Mango', 'Orange'],
    Grains: ['Wheat', 'Jowar', 'Bajra', 'Soybean', 'Tur Dal', 'Rice'],
    Others: ['Sugarcane', 'Cotton', 'Groundnut', 'Sunflower']
};

const CATEGORIES = Object.keys(CATEGORY_CROPS);

function jitterCoord(base, spread = 0.06) {
    return base + (Math.random() - 0.5) * spread;
}

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

async function run() {
    const mongo = process.env.MONGO_URI;
    if (!mongo) {
        console.error('MONGO_URI missing in .env');
        process.exit(1);
    }

    await mongoose.connect(mongo);
    console.log('MongoDB connected. Clearing data…');

    await Promise.all([
        Order.deleteMany({}),
        Review.deleteMany({}),
        Payment.deleteMany({}),
        Bid.deleteMany({}),
        Product.deleteMany({}),
        Conversation.deleteMany({}),
        ChatMessage.deleteMany({}),
        User.deleteMany({})
    ]);

    const passwordHash = await bcrypt.hash('demo123', 10);
    const consumer = await User.create({
        name: 'Demo Buyer',
        phone: '9000000001',
        email: 'buyer@farm2door.demo',
        password: passwordHash,
        role: 'consumer',
        village: 'Pune City',
        district: 'Pune',
        state: 'Maharashtra',
        location: { type: 'Point', coordinates: [73.8567, 18.5204] }
    });

    const farmers = [];
    let phoneSeq = 7000000000;
    for (const hub of HUBS) {
        for (let i = 0; i < 2; i++) {
            phoneSeq += 1;
            const f = await User.create({
                name: `Kisan ${hub.locationName.village} ${i + 1}`,
                phone: String(phoneSeq),
                email: `farmer_${hub.key}_${i}@farm2door.demo`,
                password: passwordHash,
                role: 'farmer',
                village: hub.locationName.village,
                district: hub.locationName.district,
                state: 'Maharashtra',
                location: {
                    type: 'Point',
                    coordinates: [hub.lng, hub.lat]
                }
            });
            farmers.push({ user: f, hub });
        }
    }

    const TOTAL = 520;
    const products = [];

    for (let i = 0; i < TOTAL; i++) {
        const { user: farmer, hub } = pick(farmers);
        const category = pick(CATEGORIES);
        const crop_name = pick(CATEGORY_CROPS[category]);
        const lng = jitterCoord(hub.lng);
        const lat = jitterCoord(hub.lat);
        const qty = 20 + Math.floor(Math.random() * 480);
        const price = 12 + Math.floor(Math.random() * 95);
        const sellDate = new Date();
        sellDate.setDate(sellDate.getDate() + Math.floor(Math.random() * 30));

        const isManual = Math.random() < 0.35;
        products.push({
            farmer_id: farmer._id,
            crop_name,
            category,
            quantity: qty,
            price,
            sell_date: sellDate,
            sell_location: {
                village: hub.locationName.village,
                district: hub.locationName.district,
                state: 'Maharashtra'
            },
            location: { type: 'Point', coordinates: [lng, lat] },
            farmLocation: { type: 'Point', coordinates: [lng, lat] },
            locationName: { ...hub.locationName },
            formattedAddress: { ...hub.formattedAddress },
            address: {
                fullAddress: `${hub.locationName.village}, Tal. ${hub.locationName.district}, MH ${hub.pincode}`,
                village: hub.locationName.village,
                district: hub.locationName.district,
                state: 'Maharashtra',
                pincode: hub.pincode,
                isManual
            },
            image_url: `https://picsum.photos/seed/kisan${i}/${480 + (i % 40)}/${320 + (i % 30)}`,
            status: 'active'
        });
    }

    await Product.insertMany(products);

    console.log(`Seeded ${farmers.length} farmers, 1 consumer, ${TOTAL} products.`);
    console.log('Login: buyer@farm2door.demo / demo123  |  any farmer_*@farm2door.demo / demo123');
    await mongoose.disconnect();
    process.exit(0);
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
