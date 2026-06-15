import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Container, Row, Col, Image, Button, Card, Badge, Spinner, Form, Modal, Placeholder } from 'react-bootstrap';
import { AuthContext } from '../context/AuthContext';
import { useContext } from 'react';

const ProductDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [product, setProduct] = useState(null);
    const [loadingProduct, setLoadingProduct] = useState(true);
    const [loadingReviews, setLoadingReviews] = useState(true);
    const [error, setError] = useState(null);
    const [reviews, setReviews] = useState([]); // Farmer reviews
    const [productReviews, setProductReviews] = useState([]); // Product reviews
    const [ratingStats, setRatingStats] = useState({ average: 0, count: 0 });
    const [canReview, setCanReview] = useState({ canReview: false, orderId: null });
    const { user } = useContext(AuthContext);

    // Review Form State
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewComment, setReviewComment] = useState('');
    const [reviewImages, setReviewImages] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showImageModal, setShowImageModal] = useState(null);

    useEffect(() => {
        const fetchProductData = async () => {
            try {
                const res = await axios.get(`/products/${id}`);
                setProduct(res.data);
                setLoadingProduct(false);

                // Fetch reviews asynchronously without blocking render
                fetchReviewsAndRatings(res.data.farmer_id?._id);
            } catch (err) {
                console.error(err);
                setError('Failed to load product details.');
                setLoadingProduct(false);
                setLoadingReviews(false);
            }
        };

        const fetchReviewsAndRatings = async (farmerId) => {
            if (farmerId) {
                try {
                    const [rateRes, farmerReviewRes, prodReviewRes] = await Promise.all([
                        axios.get(`/reviews/stats/${farmerId}`),
                        axios.get(`/reviews/farmer/${farmerId}`),
                        axios.get(`/reviews/product/${id}`)
                    ]);
                    setRatingStats(rateRes.data);
                    setReviews(farmerReviewRes.data);
                    setProductReviews(prodReviewRes.data);
                } catch (ignore) {}
            }

            if (user && user.role === 'consumer') {
                try {
                    const canRes = await axios.get(`/reviews/can-review/${id}`);
                    setCanReview(canRes.data);
                } catch (ignore) { }
            }
            
            setLoadingReviews(false);
        };

        fetchProductData();
    }, [id, user]);

    const handleReviewSubmit = async (e) => {
        e.preventDefault();
        if (!canReview.orderId) return;

        setIsSubmitting(true);
        const formData = new FormData();
        formData.append('order_id', canReview.orderId);
        formData.append('rating', reviewRating);
        formData.append('comment', reviewComment);
        reviewImages.forEach(img => formData.append('images', img));

        try {
            await axios.post('/reviews', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            // Refresh reviews
            const [prodReviewRes, rateRes] = await Promise.all([
                axios.get(`/reviews/product/${id}`),
                axios.get(`/reviews/stats/${product.farmer_id._id}`)
            ]);
            setProductReviews(prodReviewRes.data);
            setRatingStats(rateRes.data);
            setCanReview({ canReview: false, orderId: null });
            setReviewComment('');
            setReviewImages([]);
        } catch (err) {
            console.error("Submission error", err);
            alert("Failed to submit review");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loadingProduct) return <Container className="text-center mt-5"><Spinner animation="border" /></Container>;
    if (error) return <Container className="text-center mt-5 text-danger">{error}</Container>;
    if (!product) return <Container className="text-center mt-5">Product not found.</Container>;
    const farmCoords = product?.farmLocation?.coordinates;
    const locCoords = product?.location?.coordinates;
    const navCoords = Array.isArray(farmCoords) && farmCoords.length === 2 && farmCoords[0] !== 0 && farmCoords[1] !== 0
        ? farmCoords
        : (Array.isArray(locCoords) && locCoords.length === 2 && locCoords[0] !== 0 && locCoords[1] !== 0 ? locCoords : null);
    const hasCoordinates = Boolean(navCoords);
    const [navLng, navLat] = navCoords || [0, 0];

    const openFarmDirections = () => {
        if (!hasCoordinates) return;
        const url = `https://www.google.com/maps/dir/?api=1&destination=${navLat},${navLng}&travelmode=driving`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    return (
        <Container className="mt-5">
            <Button variant="outline-secondary" onClick={() => navigate(-1)} className="mb-3">
                &larr; Back
            </Button>
            <Card className="shadow-lg border-0">
                <Row className="g-0">
                    <Col md={6}>
                        <Image
                            src={product.image_url || 'https://via.placeholder.com/600x400?text=Farm+Produce'}
                            fluid
                            roundedStart
                            style={{ width: '100%', height: '100%', objectFit: 'cover', minHeight: '400px' }}
                        />
                    </Col>
                    <Col md={6}>
                        <Card.Body className="p-4 d-flex flex-column h-100">
                            <div className="d-flex justify-content-between align-items-start">
                                <Card.Title as="h2" className="display-6 fw-bold">{product.crop_name}</Card.Title>
                                <Badge bg="success" className="fs-5">₹{product.price}/kg</Badge>
                            </div>

                            <hr />

                            <div className="mb-4">
                                <h5 className="text-muted mb-3">Farmer Details</h5>
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <p className="mb-0 fs-5"><strong>{product.farmer_id?.name || 'Unknown'}</strong></p>
                                    <div className="text-warning">
                                        <span className="fw-bold me-1">{ratingStats.average}</span>
                                        <i className="bi bi-star-fill"></i>
                                        <span className="text-muted small ms-1">({ratingStats.count} reviews)</span>
                                    </div>
                                </div>
                                <p className="mb-1">
                                    <strong>Location:</strong> {product.address?.district || product.formattedAddress?.district || product.sell_location?.district || product.farmer_id?.district || 'Unknown District'}, {product.address?.state || product.formattedAddress?.state || product.sell_location?.state || product.farmer_id?.state || 'Unknown State'}
                                </p>
                                {hasCoordinates && (
                                    <p className="mb-1 text-muted small">
                                        <strong>Farm pin:</strong> {navLat.toFixed(5)}, {navLng.toFixed(5)}
                                    </p>
                                )}
                                <div className="mt-3 p-3 bg-light rounded border">
                                    <h6 className="text-muted mb-2 small text-uppercase fw-bold">Contact Farmer</h6>
                                    {!user ? (
                                        <div className="text-center py-2">
                                            <p className="mb-2 small text-muted">Please login to view contact details</p>
                                            <Button variant="outline-primary" size="sm" onClick={() => navigate('/login')}>Login to Contact</Button>
                                        </div>
                                    ) : (
                                        <>
                                            {product.farmer_id?.phone ? (
                                                <div className="d-flex align-items-center justify-content-between">
                                                    <div>
                                                        <p className="mb-0 fw-bold">{product.farmer_id.phone}</p>
                                                        <small className="text-muted">Direct Mobile Number</small>
                                                    </div>
                                                    <Button
                                                        variant="success"
                                                        size="sm"
                                                        href={`tel:${product.farmer_id.phone}`}
                                                        className="d-flex align-items-center"
                                                    >
                                                        <i className="bi bi-telephone-fill me-2"></i>
                                                        Call Farmer
                                                    </Button>
                                                </div>
                                            ) : (
                                                <p className="mb-0 text-muted small">Contact details not available</p>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="mb-4">
                                <h5 className="text-muted mb-3">Product Info</h5>
                                <p className="mb-1"><strong>Available Quantity:</strong> {product.quantity} kg</p>
                                {/* Description could be added here if it existed in the schema */}
                            </div>

                            <div className="mt-auto">
                                {hasCoordinates && (
                                    <Button
                                        variant="success"
                                        className="w-100 mb-2"
                                        type="button"
                                        onClick={openFarmDirections}
                                    >
                                        🚚 Track / Navigate to Farm
                                    </Button>
                                )}
                                <Button
                                    variant="primary"
                                    size="lg"
                                    className="w-100"
                                    onClick={() => navigate(`/buy/${product._id}`)}
                                >
                                    Buy Now
                                </Button>
                            </div>
                        </Card.Body>
                    </Col>
                </Row>
            </Card>

            {/* Reviews Section */}
            <div className="mt-5">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h3>Product Reviews</h3>
                    {!loadingReviews && (
                        <div className="text-warning">
                            <span className="fw-bold fs-4 me-2">{ratingStats.average}</span>
                            <i className="bi bi-star-fill fs-4"></i>
                            <span className="text-muted ms-2">({productReviews.length} reviews)</span>
                        </div>
                    )}
                </div>

                {loadingReviews ? (
                    <Row>
                        <Col md={8}>
                            {[1, 2].map((n) => (
                                <Card key={n} className="mb-3 border-0 shadow-sm bg-light">
                                    <Card.Body>
                                        <Placeholder as={Card.Title} animation="glow">
                                            <Placeholder xs={3} bg="secondary" />
                                        </Placeholder>
                                        <Placeholder as={Card.Text} animation="glow">
                                            <Placeholder xs={7} bg="secondary" /> <Placeholder xs={4} bg="secondary" />
                                            <Placeholder xs={5} bg="secondary" />
                                        </Placeholder>
                                    </Card.Body>
                                </Card>
                            ))}
                        </Col>
                        <Col md={4}>
                            <Card className="border-0 shadow-sm bg-light mb-4">
                                <Card.Body className="text-center py-4">
                                    <Placeholder as="h1" animation="glow"><Placeholder xs={4} bg="success" /></Placeholder>
                                    <Placeholder as="p" animation="glow"><Placeholder xs={8} bg="success" /></Placeholder>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                ) : (
                    <Row>
                        <Col md={8}>
                        {/* Write a Review Section */}
                        {canReview.canReview && (
                            <Card className="mb-4 border-0 shadow-sm bg-light">
                                <Card.Body>
                                    <h5>Write a Review</h5>
                                    <Form onSubmit={handleReviewSubmit}>
                                        <Form.Group className="mb-3">
                                            <Form.Label>Rating</Form.Label>
                                            <div className="d-flex gap-2">
                                                {[1, 2, 3, 4, 5].map(star => (
                                                    <i
                                                        key={star}
                                                        className={`bi bi-star${reviewRating >= star ? '-fill' : ''} fs-4 text-warning cursor-pointer`}
                                                        style={{ cursor: 'pointer' }}
                                                        onClick={() => setReviewRating(star)}
                                                    ></i>
                                                ))}
                                            </div>
                                        </Form.Group>
                                        <Form.Group className="mb-3">
                                            <Form.Label>Comment</Form.Label>
                                            <Form.Control
                                                as="textarea"
                                                rows={3}
                                                placeholder="Share your experience with this product..."
                                                value={reviewComment}
                                                onChange={(e) => setReviewComment(e.target.value)}
                                                required
                                            />
                                        </Form.Group>
                                        <Form.Group className="mb-3">
                                            <Form.Label>Photos (Max 3)</Form.Label>
                                            <Form.Control
                                                type="file"
                                                multiple
                                                accept="image/*"
                                                onChange={(e) => setReviewImages(Array.from(e.target.files).slice(0, 3))}
                                            />
                                            <small className="text-muted">Show others what you received!</small>
                                        </Form.Group>
                                        <Button variant="primary" type="submit" disabled={isSubmitting}>
                                            {isSubmitting ? 'Submitting...' : 'Submit Review'}
                                        </Button>
                                    </Form>
                                </Card.Body>
                            </Card>
                        )}

                        {productReviews.length > 0 ? (
                            productReviews.map(review => (
                                <Card key={review._id} className="mb-3 border-0 shadow-sm">
                                    <Card.Body>
                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                            <h6 className="mb-0 fw-bold">{review.consumer_id?.name}</h6>
                                            <div className="text-warning">
                                                {Array(review.rating).fill().map((_, i) => <i key={i} className="bi bi-star-fill small"></i>)}
                                            </div>
                                        </div>
                                        <p className="text-muted mb-2 small">
                                            {new Date(review.created_at).toLocaleDateString()}
                                        </p>
                                        <p className="mb-3 text-dark">{review.comment}</p>

                                        {review.images && review.images.length > 0 && (
                                            <div className="d-flex gap-2">
                                                {review.images.map((img, idx) => (
                                                    <Image
                                                        key={idx}
                                                        src={img}
                                                        width={80}
                                                        height={80}
                                                        thumbnail
                                                        style={{ objectFit: 'cover', cursor: 'pointer' }}
                                                        onClick={() => setShowImageModal(img)}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </Card.Body>
                                </Card>
                            ))
                        ) : (
                            <Card className="p-5 text-center text-muted border-0 bg-light">
                                <p className="mb-0">
                                    {user ? (
                                        canReview.canReview ? "No reviews yet. Be the first to share your experience!" : "You can review this product after completing the order."
                                    ) : (
                                        "No reviews yet. Login and buy this product to leave a review!"
                                    )}
                                </p>
                            </Card>
                        )}
                    </Col>
                    <Col md={4}>
                        <Card className="border-0 shadow-sm bg-success text-white mb-4">
                            <Card.Body className="text-center py-4">
                                <h1>{ratingStats.average}</h1>
                                <div>
                                    {Array(Math.round(ratingStats.average)).fill().map((_, i) => <i key={i} className="bi bi-star-fill fs-5"></i>)}
                                </div>
                                <p className="mb-0 mt-2">Overall Farmer Rating</p>
                                <small className="opacity-75">Based on {ratingStats.count} total reviews</small>
                            </Card.Body>
                        </Card>

                        {/* Farmer specific reviews (sidebar style or optional) */}
                        <div className="d-none d-md-block">
                            <h6 className="mb-3 text-muted">Other Farmer Reviews</h6>
                            {reviews.filter(r => r.product_id?._id !== id).slice(0, 3).map(review => (
                                <div key={review._id} className="mb-2 p-2 border-bottom small">
                                    <div className="d-flex justify-content-between">
                                        <span className="fw-bold">{review.consumer_id?.name}</span>
                                        <span className="text-warning">{review.rating} ⭐</span>
                                    </div>
                                    <p className="mb-0 text-muted">{review.comment.substring(0, 50)}...</p>
                                </div>
                            ))}
                        </div>
                    </Col>
                </Row>
                )}
            </div>

            {/* Image Preview Modal */}
            <Modal show={!!showImageModal} onHide={() => setShowImageModal(null)} centered size="lg">
                <Modal.Header closeButton></Modal.Header>
                <Modal.Body className="text-center">
                    <Image src={showImageModal} fluid />
                </Modal.Body>
            </Modal>
        </Container>
    );
};

export default ProductDetail;
