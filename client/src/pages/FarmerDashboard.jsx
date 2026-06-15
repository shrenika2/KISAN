import React, { useEffect, useState, useContext, useCallback } from 'react';
import axios from 'axios';
import { Container, Row, Col, Card, Table, Spinner, Button, Alert, Badge } from 'react-bootstrap';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

const lineTotal = (o) =>
    Number(o.negotiated_price || o.original_price || 0) * Number(o.requested_quantity || 0);

const FarmerDashboard = () => {
    const { user } = useContext(AuthContext);
    const [stats, setStats] = useState(null);
    const [recentSales, setRecentSales] = useState([]);
    const [availableReleased, setAvailableReleased] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const location = useLocation();

    const loadDashboard = useCallback(async () => {
        try {
            const [statsRes, ordersRes] = await Promise.all([
                axios.get('/stats/farmer-dashboard'),
                axios.get('/orders/farmer-orders')
            ]);
            setStats(statsRes.data);
            const list = Array.isArray(ordersRes.data) ? ordersRes.data : [];
            setRecentSales(list.slice(0, 5));
            const releasedSum = list
                .filter((o) => o.escrowStatus === 'released')
                .reduce((s, o) => s + lineTotal(o), 0);
            setAvailableReleased(releasedSum);
            setError('');
        } catch (err) {
            console.error('Error loading farmer dashboard', err);
            setError('Failed to load dashboard statistics.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!user) return;
        if (user.role !== 'farmer') {
            setLoading(false);
            return;
        }
        if (location.pathname !== '/farmer-dashboard') return;
        setLoading(true);
        loadDashboard();
    }, [user, location.pathname, loadDashboard]);

    if (loading) {
        return (
            <Container className="d-flex justify-content-center mt-5">
                <Spinner animation="border" variant="success" />
            </Container>
        );
    }

    if (error) {
        return (
            <Container className="mt-5">
                <Alert variant="danger">{error}</Alert>
            </Container>
        );
    }

    return (
        <Container className="mt-4">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mb-4 gap-3">
                <h2 className="text-success fw-bold mb-0">Farmer Dashboard 🌾</h2>
                <div className="d-flex gap-2 w-100 w-md-auto">
                    <Button variant="primary" className="flex-grow-1 flex-md-grow-0" onClick={() => navigate('/add-product')}>
                        + Add New Product
                    </Button>
                    <Button variant="outline-success" className="flex-grow-1 flex-md-grow-0" onClick={() => navigate('/farmer-orders')}>
                        Manage Orders
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <Row className="mb-4 g-3">
                <Col xs={6} md={3} className="mb-3 mb-md-0">
                    <Card className="shadow-sm border-0 h-100 bg-success text-white">
                        <Card.Body className="text-center p-3">
                            <h6 className="text-uppercase small" style={{ opacity: 0.9 }}>Total Earnings</h6>
                            <h2 className="display-6 fw-bold mb-0">₹{stats?.totalEarnings || 0}</h2>
                            <small className="d-block mt-2" style={{ opacity: 0.9 }}>
                                Available (released escrow): ₹{availableReleased.toFixed(0)}
                            </small>
                        </Card.Body>
                    </Card>
                </Col>
                <Col xs={6} md={3} className="mb-3 mb-md-0">
                    <Card className="shadow-sm border-0 h-100 bg-light">
                        <Card.Body className="text-center p-3">
                            <h6 className="text-muted text-uppercase small">Pending Orders</h6>
                            <h2 className="display-6 fw-bold text-warning mb-0">{stats?.pendingOrders || 0}</h2>
                        </Card.Body>
                    </Card>
                </Col>
                <Col xs={6} md={3} className="mb-3 mb-md-0">
                    <Card className="shadow-sm border-0 h-100 bg-light">
                        <Card.Body className="text-center p-3">
                            <h6 className="text-muted text-uppercase small">Active Listings</h6>
                            <h2 className="display-6 fw-bold text-primary mb-0">{stats?.activeListings || 0}</h2>
                        </Card.Body>
                    </Card>
                </Col>
                <Col xs={6} md={3}>
                    <Card className="shadow-sm border-0 h-100 bg-light">
                        <Card.Body className="text-center p-3">
                            <h6 className="text-muted text-uppercase small">Avg Rating</h6>
                            <h2 className="display-6 fw-bold text-warning mb-0">
                                {stats?.rating?.average || 0} <i className="bi bi-star-fill fs-5"></i>
                            </h2>
                            <small className="text-muted d-block mt-1">{stats?.rating?.count || 0} reviews</small>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {recentSales.length > 0 && (
                <Card className="shadow-sm border-0 mb-4">
                    <Card.Header className="bg-white border-bottom-0 pt-4 pb-0 d-flex justify-content-between align-items-center">
                        <h4 className="mb-0 fw-bold">Recent sales &amp; payments</h4>
                        <Button variant="link" size="sm" onClick={() => navigate('/farmer-orders')}>View all</Button>
                    </Card.Header>
                    <Card.Body>
                        <div className="table-responsive">
                            <Table hover className="align-middle mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th>Crop</th>
                                        <th>Buyer</th>
                                        <th>Payment</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentSales.map((order) => (
                                        <tr key={order._id}>
                                            <td>{order.product_id?.crop_name || '—'}</td>
                                            <td>{order.consumer_id?.name || '—'}</td>
                                            <td>
                                                {order?.escrowStatus === 'held' && (
                                                    <Badge bg="warning" text="dark">Payment Held in Escrow</Badge>
                                                )}
                                                {order?.escrowStatus === 'released' && (
                                                    <Badge bg="success">Payment Dispatched</Badge>
                                                )}
                                                {order?.escrowStatus !== 'held' && order?.escrowStatus !== 'released' && (
                                                    <span className="text-muted small">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    </Card.Body>
                </Card>
            )}

            <Row>
                <Col md={8}>
                    {/* Recent Products */}
                    <Card className="shadow-sm border-0 mb-4">
                        <Card.Header className="bg-white border-bottom-0 pt-4 pb-0 d-flex justify-content-between">
                            <h4 className="mb-0 fw-bold">Recent Listings</h4>
                            <Button variant="link" size="sm" onClick={() => navigate('/my-products')}>View All</Button>
                        </Card.Header>
                        <Card.Body>
                            {stats?.recentProducts && stats.recentProducts.length > 0 ? (
                                <div className="table-responsive">
                                    <Table hover className="align-middle">
                                        <thead className="table-light">
                                            <tr>
                                                <th>Crop</th>
                                                <th>Price</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {stats.recentProducts.map(product => (
                                                <tr key={product._id}>
                                                    <td>{product.crop_name}</td>
                                                    <td>₹{product.price}</td>
                                                    <td>
                                                        <Badge bg={product.status === 'active' ? 'success' : 'secondary'}>
                                                            {product.status.toUpperCase()}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="text-center py-4 text-muted">No products yet.</div>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={4}>
                    {/* Recent Reviews */}
                    <Card className="shadow-sm border-0 mb-4">
                        <Card.Header className="bg-white border-bottom-0 pt-4 pb-0">
                            <h4 className="mb-0 fw-bold">Recent Reviews</h4>
                        </Card.Header>
                        <Card.Body>
                            {stats?.latestReviews && stats.latestReviews.length > 0 ? (
                                stats.latestReviews.map(review => (
                                    <div key={review._id} className="mb-3 pb-3 border-bottom last-child-border-0">
                                        <div className="d-flex justify-content-between mb-1">
                                            <span className="fw-bold">{review.consumer_id?.name}</span>
                                            <span className="text-warning">
                                                {Array(review.rating).fill().map((_, i) => <i key={i} className="bi bi-star-fill"></i>)}
                                            </span>
                                        </div>
                                        <p className="small text-muted mb-0">"{review.comment}"</p>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-4 text-muted">No reviews yet.</div>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
};

export default FarmerDashboard;
