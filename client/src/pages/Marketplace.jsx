import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Container, Row, Col, Spinner, Form, Button } from 'react-bootstrap';
import OrderModal from '../components/OrderModal';
import useLocation from '../hooks/useLocation';
import ProductCard from '../components/ProductCard';
import calculateDistance from '../utils/haversine';

const Marketplace = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const navigate = useNavigate();

    // Search and Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [maxPrice, setMaxPrice] = useState('');
    const [category, setCategory] = useState('');
    const [nearMe, setNearMe] = useState(false);
    const [radiusKm, setRadiusKm] = useState(50);
    const {
        latitude,
        longitude,
        error: locationError,
        getLocation,
        isTracking,
        startTracking,
        stopTracking
    } = useLocation();
    const hasUserLocation = Number.isFinite(latitude) && Number.isFinite(longitude);

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const params = {};
                if (nearMe && hasUserLocation) {
                    params.lat = latitude;
                    params.lng = longitude;
                    params.radius = radiusKm;
                }

                const res = await axios.get('/products', { params });
                setProducts(res.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchProducts();
    }, [nearMe, latitude, longitude, radiusKm, hasUserLocation]);

    useEffect(() => {
        if (nearMe) {
            getLocation();
        }
    }, [nearMe, getLocation]);

    const filteredProducts = useMemo(() => {
        let result = products;

        if (searchTerm) {
            result = result.filter((product) => {
                const searchLower = searchTerm.toLowerCase();
                const matchCrop = product.crop_name?.toLowerCase().includes(searchLower);
                const matchDistrict = product.sell_location?.district?.toLowerCase().includes(searchLower)
                    || product.locationName?.district?.toLowerCase().includes(searchLower)
                    || product.formattedAddress?.district?.toLowerCase().includes(searchLower);
                const matchVillage = product.locationName?.village?.toLowerCase().includes(searchLower)
                    || product.formattedAddress?.village?.toLowerCase().includes(searchLower);
                return matchCrop || matchDistrict || matchVillage;
            });
        }

        if (maxPrice) {
            result = result.filter((product) => product.price <= parseFloat(maxPrice));
        }

        if (category) {
            result = result.filter((product) => product.category === category);
        }

        return result;
    }, [products, searchTerm, maxPrice, category]);

    const memoizedProducts = useMemo(() => {
        return filteredProducts.map((product) => {
            const fc = product?.farmLocation?.coordinates;
            const lc = product?.location?.coordinates;
            const hasFarm = Array.isArray(fc) && fc.length === 2 && (fc[0] !== 0 || fc[1] !== 0);
            const coords = hasFarm ? fc : lc;
            const hasCoords = Array.isArray(coords) && coords.length === 2
                && (coords[0] !== 0 || coords[1] !== 0);
            const rawDist = hasCoords && hasUserLocation
                ? calculateDistance(latitude, longitude, coords[1], coords[0])
                : null;
            const areIdenticalCoords = hasCoords
                && hasUserLocation
                && Math.abs(coords[1] - latitude) < 0.000001
                && Math.abs(coords[0] - longitude) < 0.000001;
            const dist = rawDist === 0 && areIdenticalCoords ? 0 : rawDist;
            const distanceLabel = dist === 0 && areIdenticalCoords ? 'At your location' : null;

            return { ...product, dist, distanceLabel };
        });
    }, [filteredProducts, latitude, longitude, hasUserLocation]);

    const sortedForDisplay = useMemo(() => {
        if (!nearMe || !hasUserLocation) return memoizedProducts;
        return [...memoizedProducts].sort((a, b) => {
            if (a.dist == null && b.dist == null) return 0;
            if (a.dist == null) return 1;
            if (b.dist == null) return -1;
            return a.dist - b.dist;
        });
    }, [memoizedProducts, nearMe, hasUserLocation]);

    if (loading) return <Container className="text-center mt-5"><Spinner animation="border" /></Container>;

    return (
        <Container className="pb-5">
            <h2 className="mb-2 text-center fw-bold text-success">KrushiBazaar — Farm2Door</h2>
            <p className="text-center text-muted mb-4 small">Direct from Maharashtra farms · GPS-verified pins · Escrow-safe payments</p>
            {nearMe && (
                <p className="text-center text-success mb-3">
                    Showing products near you (Sorted by distance)
                </p>
            )}
            <div className="d-flex justify-content-center mb-3">
                <Button
                    variant={isTracking ? 'danger' : 'outline-success'}
                    size="sm"
                    onClick={isTracking ? stopTracking : startTracking}
                >
                    {isTracking ? 'Stop Live Tracking' : 'Live Track Me'}
                </Button>
            </div>

            {/* Search and Filter Section */}
            <Row className="mb-4 d-flex justify-content-center">
                <Col md={5} className="mb-2">
                    <Form.Control
                        type="text"
                        placeholder="Search crops or district..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </Col>
                <Col md={3} className="mb-2">
                    <Form.Control
                        type="number"
                        placeholder="Max Price (₹)"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                    />
                </Col>
                <Col md={3} className="mb-2">
                    <Form.Select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                    >
                        <option value="">All Categories</option>
                        <option value="Vegetables">Vegetables</option>
                        <option value="Fruits">Fruits</option>
                        <option value="Grains">Grains</option>
                        <option value="Others">Others</option>
                    </Form.Select>
                </Col>
                <Col md={4} className="mb-2 d-flex align-items-center gap-2">
                    <Form.Check
                        type="switch"
                        id="near-me-switch"
                        label="Near Me"
                        checked={nearMe}
                        onChange={(e) => setNearMe(e.target.checked)}
                    />
                    {nearMe && (
                        <Form.Control
                            type="number"
                            min="1"
                            max="500"
                            value={radiusKm}
                            onChange={(e) => setRadiusKm(Number(e.target.value) || 50)}
                            placeholder="Radius (km)"
                        />
                    )}
                </Col>
            </Row>
            {nearMe && locationError && (
                <p className="text-warning small mb-3">
                    Could not access your location: {locationError}
                </p>
            )}

            <Row className="g-4">
                {sortedForDisplay.length > 0 ? (
                    sortedForDisplay.map((product, index) => (
                        <Col md={4} sm={6} key={product._id}>
                            <ProductCard
                                product={product}
                                nearMe={nearMe}
                                hasUserLocation={hasUserLocation}
                                dist={product.dist}
                                distanceLabel={product.distanceLabel}
                                isClosest={nearMe && index === 0 && product.dist != null && product.dist === sortedForDisplay[0]?.dist}
                                onView={() => navigate(`/product/${product._id}`)}
                            />
                        </Col>
                    ))
                ) : (
                    <div className="text-center w-100 mt-5">
                        <h5 className="text-muted">No products found matching your search.</h5>
                    </div>
                )}
            </Row>

            <OrderModal
                show={showModal}
                handleClose={() => setShowModal(false)}
                product={selectedProduct}
            />
        </Container>
    );
};

export default Marketplace;
