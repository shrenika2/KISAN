const reverseGeocode = async (lat, lng) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat === 0 && lng === 0) return null;

    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Kisan-Farm2Door/1.0 (geospatial reverse geocoding)'
            }
        });

        if (!response.ok) return null;
        const data = await response.json();
        const address = data?.address || {};

        return {
            village: address.village || address.suburb || address.town || address.hamlet || null,
            district: address.city || address.county || address.state_district || address.district || null,
            state: address.state || null
        };
    } catch (error) {
        console.error('Reverse geocoding failed:', error.message);
        return null;
    }
};

const forwardGeocode = async (query) => {
    if (!query || typeof query !== 'string' || !query.trim()) return null;
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(query.trim())}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Kisan-Farm2Door/1.0 (geospatial geocoding)'
            }
        });
        if (!response.ok) return null;

        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0) return null;
        const preferred = data.find((item) => {
            const a = item?.address || {};
            return Boolean(a.village || a.town || a.hamlet || a.suburb);
        }) || data[0];
        const first = preferred;
        const lat = Number(first.lat);
        const lng = Number(first.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

        const address = await reverseGeocode(lat, lng);
        return {
            coordinates: [lng, lat],
            ...address
        };
    } catch (error) {
        console.error('Forward geocoding failed:', error.message);
        return null;
    }
};

module.exports = { reverseGeocode, forwardGeocode };
