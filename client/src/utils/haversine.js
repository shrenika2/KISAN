export const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const values = [lat1, lon1, lat2, lon2];
    const hasInvalid = values.some((value) => !Number.isFinite(value));
    if (hasInvalid) return null;

    // Ignore missing/default coordinates to avoid misleading UI.
    if (
        (lat1 === 0 && lon1 === 0) ||
        (lat2 === 0 && lon2 === 0)
    ) {
        return null;
    }

    const toRadians = (deg) => (deg * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRadians(lat1))
        * Math.cos(toRadians(lat2))
        * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
};

export default calculateDistance;
