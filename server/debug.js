const mongoose = require('mongoose');
require('dotenv').config();

const Product = require('./models/Product');
const User = require('./models/User');

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/kisan').then(async () => {
    try {
        console.log("Connected to MongoDB");
        
        const products = await Product.find({}).populate('farmer_id');
        console.log(`Found ${products.length} products`);
        
        products.forEach(p => {
            console.log(`- ID: ${p._id}`);
            console.log(`  Crop: ${p.crop_name}`);
            console.log(`  Status: ${p.status}`);
            console.log(`  Category: ${p.category}`);
            console.log(`  Farmer: ${p.farmer_id ? p.farmer_id.name + " (Valid)" : 'NULL (Missing)'}`);
            console.log(`  Quantity: ${p.quantity}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        mongoose.connection.close();
    }
});
