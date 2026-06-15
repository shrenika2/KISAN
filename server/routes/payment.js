const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const isFarmer = require('../middleware/isFarmer');
const {
    createSession,
    confirmMockPayment,
    confirmDelivery
} = require('../controllers/paymentController');

router.post('/create-session', auth, createSession);
router.post('/confirm-mock', auth, confirmMockPayment);

function confirmDeliveryWithBodyOrderId(req, res) {
    const oid = req.body?.orderId || req.body?.order_id;
    if (!oid) {
        return res.status(400).json({ msg: 'orderId is required' });
    }
    req.params = { ...req.params, id: String(oid) };
    return confirmDelivery(req, res);
}

router.post('/confirm-delivery', [auth, isFarmer], confirmDeliveryWithBodyOrderId);

module.exports = router;
