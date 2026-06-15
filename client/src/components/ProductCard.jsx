import React from 'react';
import { Card, Badge, Button } from 'react-bootstrap';

const ProductCard = ({ product, nearMe, hasUserLocation = true, dist, distanceLabel, isClosest, onView }) => {
    const village = product?.locationName?.village
        || product?.formattedAddress?.village
        || product?.address?.village
        || product?.sell_location?.village
        || '—';
    const district = product?.locationName?.district
        || product?.formattedAddress?.district
        || product?.address?.district
        || product?.sell_location?.district
        || '—';
    const isManualAddress = Boolean(product?.address?.isManual);
    const showDistance = nearMe && hasUserLocation && dist !== null && Number.isFinite(dist);

    return (
        <Card className="h-100 shadow border-0 overflow-hidden">
            <div className="position-relative">
                <Card.Img
                    variant="top"
                    src={product.image_url || 'https://via.placeholder.com/300x200?text=Farm+Produce'}
                    style={{ height: '200px', objectFit: 'cover' }}
                />
                {showDistance && (
                    <Badge
                        bg="dark"
                        className="position-absolute top-0 end-0 m-2 px-2 py-1"
                        style={{ opacity: 0.92 }}
                    >
                        {distanceLabel || `${dist.toFixed(1)} km`}
                    </Badge>
                )}
            </div>
            <Card.Body className="d-flex flex-column">
                <div className="d-flex justify-content-between align-items-start mb-2 gap-2">
                    <Card.Title className="mb-0 fs-5 fw-bold">{product.crop_name}</Card.Title>
                    <Badge bg="success" className="flex-shrink-0">₹{product.price}/kg</Badge>
                </div>

                <Card.Text className="text-muted small mb-2 d-flex justify-content-between align-items-center">
                    <span>{product.farmer_id?.name || 'Farmer'}</span>
                    {product.rating?.count > 0 && (
                        <span className="text-warning fw-bold text-nowrap">
                            {product.rating.average} <i className="bi bi-star-fill small" aria-hidden="true" />
                        </span>
                    )}
                </Card.Text>

                <div className="small mb-2 py-2 px-2 rounded bg-light border">
                    <span className="me-1" title={isManualAddress ? 'Manual address' : 'GPS at listing'}>
                        {isManualAddress ? '🏠' : '📍'}
                    </span>
                    <span className="fw-semibold text-body">{village}</span>
                    <span className="text-muted">, {district}</span>
                </div>

                {showDistance && (
                    <div className="mb-2 d-flex flex-wrap gap-2 align-items-center">
                        <Badge bg="success" className="fw-normal">
                            📍 {distanceLabel || `${dist.toFixed(1)} km away`}
                        </Badge>
                        {dist > 0 && dist < 1 && (
                            <Badge bg="info" text="dark">Very close (&lt; 1 km)</Badge>
                        )}
                        {dist > 120 && <Badge bg="warning" text="dark">Long haul</Badge>}
                        {isClosest && <Badge bg="primary">Closest pick</Badge>}
                    </div>
                )}

                <Card.Text className="small text-secondary mt-auto pt-1 mb-3">
                    <strong className="text-body">Stock:</strong> {product.quantity} kg
                </Card.Text>

                <Button variant="outline-primary" className="w-100 fw-semibold" onClick={onView}>
                    View listing
                </Button>
            </Card.Body>
        </Card>
    );
};

export default ProductCard;
