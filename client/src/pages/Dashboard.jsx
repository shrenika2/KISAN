import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { Container, Row, Col, Card, Table, Spinner, Button, Alert } from 'react-bootstrap';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
    const { user } = useContext(AuthContext);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await axios.get('/stats/dashboard');
                setStats(res.data);
                setLoading(false);
            } catch (err) {
                console.error("Error fetching stats", err);
                setError('Failed to load dashboard statistics.');
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

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
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="text-success fw-bold">Welcome Back, {user?.name}!</h2>
                <Button variant="outline-primary" onClick={() => navigate('/marketplace')}>
                    Browse Marketplace
                </Button>
            </div>

            {/* Stats Cards */}
            <Row className="mb-5">
                <Col md={4} className="mb-3">
                    <Card className="shadow-sm border-0 h-100 bg-light">
                        <Card.Body className="text-center">
                            <h6 className="text-muted text-uppercase">Total Orders</h6>
                            <h2 className="display-4 fw-bold text-primary">{stats?.totalOrders || 0}</h2>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={4} className="mb-3">
                    <Card className="shadow-sm border-0 h-100 bg-light">
                        <Card.Body className="text-center">
                            <h6 className="text-muted text-uppercase">Pending Orders</h6>
                            <h2 className="display-4 fw-bold text-warning">{stats?.pendingOrders || 0}</h2>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={4} className="mb-3">
                    <Card className="shadow-sm border-0 h-100 bg-success text-white">
                        <Card.Body className="text-center">
                            <h6 className="text-uppercase" style={{ opacity: 0.9 }}>Farmer Impact</h6>
                            <h2 className="display-4 fw-bold">₹{stats?.totalImpact || 0}</h2>
                            <small>Directly contributed to farmers</small>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* Recent Activity */}
            <Card className="shadow-sm border-0">
                <Card.Header className="bg-white border-bottom-0 pt-4 pb-0">
                    <h4 className="mb-0 fw-bold">Recent Activity</h4>
                </Card.Header>
                <Card.Body>
                    {stats?.recentOrders && stats.recentOrders.length > 0 ? (
                        <div className="table-responsive">
                            <Table hover className="align-middle">
                                <thead className="table-light">
                                    <tr>
                                        <th>Date</th>
                                        <th>Product</th>
                                        <th>Farmer</th>
                                        <th>Price</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.recentOrders.map(order => (
                                        <tr key={order._id}>
                                            <td>{new Date(order.order_date).toLocaleDateString()}</td>
                                            <td>{order.product_id?.crop_name || 'Unknown Crop'}</td>
                                            <td>{order.farmer_id?.name || 'Unknown Farmer'}</td>
                                            <td>₹{order.final_price || order.negotiated_price || order.original_price}</td>
                                            <td>
                                                <span className={`badge rounded-pill ${order.order_status === 'paid' || order.order_status === 'shipped' || order.order_status === 'completed' ? 'bg-success' :
                                                        order.order_status === 'rejected' ? 'bg-danger' : 'bg-warning text-dark'
                                                    }`}>
                                                    {order.order_status.replace('_', ' ')}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    ) : (
                        <div className="text-center py-5 text-muted">
                            <p>No recent orders found.</p>
                            <Button variant="link" onClick={() => navigate('/marketplace')}>Start Shopping</Button>
                        </div>
                    )}
                </Card.Body>
            </Card>
        </Container>
    );
};

export default Dashboard;
