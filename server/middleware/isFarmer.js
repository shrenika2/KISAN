module.exports = function (req, res, next) {
    if (!req.user || req.user.role !== 'farmer') {
        return res.status(403).json({ msg: 'Access denied. Farmer privileges required.' });
    }
    next();
};
