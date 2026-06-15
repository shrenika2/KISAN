const express = require('express');
const axios = require('axios');

const router = express.Router();

router.get('/pincode/:pincode', async (req, res) => {
    const pincode = String(req.params.pincode || '').replace(/\D/g, '').slice(0, 6);
    if (pincode.length !== 6) {
        return res.status(400).json({ msg: 'Invalid pincode' });
    }

    try {
        const response = await axios.get(`https://api.postalpincode.in/pincode/${pincode}`, {
            timeout: 10000
        });
        const payload = Array.isArray(response.data) ? response.data[0] : null;
        const postOffice = payload?.PostOffice?.[0];

        if (!postOffice || payload?.Status === 'Error') {
            return res.status(404).json({
                msg: payload?.Message || 'No area found for this pincode.'
            });
        }

        return res.json({
            district: postOffice.District || '',
            state: postOffice.State || '',
            village: postOffice.Name || ''
        });
    } catch (error) {
        return res.status(502).json({ msg: 'Pincode lookup service unavailable' });
    }
});

module.exports = router;
