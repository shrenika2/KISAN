import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Container, Table, Badge, Button, Spinner, Form, Modal, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const MyOrders = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const res = await axios.get('/orders/my-orders');
                setOrders(res.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchOrders();
    }, []);

    const [bargainOrderId, setBargainOrderId] = useState(null);
    const [bargainPrice, setBargainPrice] = useState('');
    const [releaseConfirmOrder, setReleaseConfirmOrder] = useState(null);
    const [disputeNotice, setDisputeNotice] = useState('');

    const handleComplete = async (orderId) => {
        try {
            await axios.put(`/orders/${orderId}/complete`);
            const updatedOrders = orders.map(o => {
                if (o._id === orderId) return { ...o, order_status: 'completed' };
                return o;
            });
            setOrders(updatedOrders);
            alert("Order completed successfully");
        } catch (err) {
            alert("Failed to complete order: " + (err.response?.data?.msg || err.message));
        }
    };

    const handlePayOnline = async (order) => {
        const amount = order.requested_quantity * (order.negotiated_price || 0);
        if (!amount || amount <= 0) {
            alert('Invalid order amount.');
            return;
        }
        try {
            const { data } = await axios.post('/payment/create-session', {
                orderId: order._id,
                product_name: order.product_id?.crop_name || 'Farm order',
                amount
            });
            if (data.url) {
                window.location.href = data.url;
            } else if (data.mockUrl) {
                window.location.href = data.mockUrl;
            } else {
                alert('No checkout URL returned');
            }
        } catch (err) {
            alert(err.response?.data?.msg || err.message || 'Could not start payment');
        }
    };

    const handleReleaseFunds = async (orderId) => {
        const target = orders.find((o) => o._id === orderId);
        if (target?.payment_method === 'Online') {
            setReleaseConfirmOrder(null);
            alert('Online orders cannot be released from your side. The farmer releases escrow after you share your delivery code.');
            return;
        }
        try {
            await axios.put(`/orders/${orderId}/release`);
            const res = await axios.get('/orders/my-orders');
            setOrders(res.data);
            setReleaseConfirmOrder(null);
            alert('Escrow released — order marked completed.');
        } catch (err) {
            alert('Failed to confirm: ' + (err.response?.data?.msg || err.message));
        }
    };

    const handleDispute = async (orderId) => {
        try {
            await axios.post(`/orders/${orderId}/dispute`);
            await axios.get('/orders/my-orders').then((res) => setOrders(res.data));
            setDisputeNotice('Admin has been notified.');
            setTimeout(() => setDisputeNotice(''), 5000);
        } catch (err) {
            alert('Failed to report issue: ' + (err.response?.data?.msg || err.message));
        }
    };

    const handleConsumerRespond = async (orderId, status, negotiated_price) => {
        try {
            await axios.put(`/orders/${orderId}/consumer-respond`, { status, negotiated_price });
            setBargainOrderId(null);
            setBargainPrice('');
            // Refresh order list by refetching
            const res = await axios.get('/orders/my-orders');
            setOrders(res.data);
            alert(status === 'requested' ? "Counter offer sent back!" : `Order ${status}!`);
        } catch (err) {
            alert("Failed to respond to order: " + (err.response?.data?.msg || err.message));
        }
    };

    if (loading) return <Container className="text-center mt-5"><Spinner animation="border" /></Container>;

    return (
        <Container className="mt-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2>My Orders</h2>

            </div>
            {disputeNotice && <Alert variant="info" className="mb-3 mb-md-4" onClose={() => setDisputeNotice('')} dismissible>{disputeNotice}</Alert>}
            <Table striped bordered hover responsive className="align-middle">
                <thead className="bg-light">
                    <tr>
                        <th>Product</th>
                        <th>Farmer</th>
                        <th>Qty</th>
                        <th>Price/kg</th>
                        <th>Total</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {orders.map(order => (
                        <tr key={order._id}>
                            <td>
                                <div className="d-flex align-items-center">
                                    <img
                                        src={order.product_id?.image_url || 'https://via.placeholder.com/50'}
                                        alt={order.product_id?.crop_name || 'Product'}
                                        style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '8px', marginRight: '15px' }}
                                    />
                                    <div>
                                        <div className="fw-bold">{order.product_id?.crop_name || 'Unknown'}</div>
                                        <small className="text-muted">{new Date(order.order_date).toLocaleDateString()}</small>
                                    </div>
                                </div>
                            </td>
                            <td>{order.farmer_id?.name || 'Unknown Farmer'}</td>
                            <td>{order.requested_quantity} kg</td>
                            <td>₹{order.negotiated_price}</td>
                            <td className="fw-bold">₹{order.requested_quantity * order.negotiated_price}</td>
                            <td>
                                <Badge bg={order.payment_method === 'Cash' ? 'secondary' : 'info'}>
                                    {order.payment_method.toUpperCase()}
                                </Badge>
                            </td>
                            <td>
                                <div className="d-flex flex-column gap-1">
                                    <Badge bg={
                                        order.order_status === 'completed' ? 'success' :
                                            order.order_status === 'shipped' ? 'info' :
                                                order.order_status === 'approved' ? 'primary' :
                                                    order.order_status === 'rejected' ? 'danger' :
                                                        order.order_status === 'counter_offered' ? 'info' :
                                                            order.order_status === 'paid' ? 'info' : 'warning'
                                    }>
                                        {order.order_status === 'counter_offered'
                                            ? 'FARMER COUNTERED'
                                            : order.order_status === 'shipped'
                                              ? 'SHIPPED · IN TRANSIT'
                                              : String(order.order_status || '').toUpperCase()}
                                    </Badge>
                                    {order?.escrowStatus === 'held' && (
                                        <Badge bg="warning" text="dark" className="small">Escrow: held</Badge>
                                    )}
                                    {order?.escrowStatus === 'released' && (
                                        <Badge bg="success" className="small">Escrow: released</Badge>
                                    )}
                                    {order?.escrowStatus === 'disputed' && (
                                        <Badge bg="danger" className="small">Escrow: disputed</Badge>
                                    )}
                                </div>
                            </td>
                            <td>
                                <div className="d-flex gap-2 flex-wrap align-items-center">
                                    <Link to={`/chat/${order.farmer_id?._id}`} className="btn btn-sm btn-outline-primary">
                                        <i className="bi bi-chat-dots"></i> Chat
                                    </Link>

                                    <Link to={`/orders/${order._id}`} className="btn btn-sm btn-outline-secondary">
                                        Progress
                                    </Link>

                                    {order.payment_method === 'Online' &&
                                        order.order_status === 'approved' &&
                                        order.paymentStatus !== 'paid' &&
                                        order.escrowStatus !== 'held' && (
                                            <Button
                                                size="sm"
                                                variant="primary"
                                                onClick={() => handlePayOnline(order)}
                                            >
                                                Pay securely (Escrow)
                                            </Button>
                                        )}

                                    {order?.escrowStatus === 'held' && order.payment_method === 'Online' && (
                                        <div className="w-100 mt-2 small text-muted border rounded p-2 bg-light">
                                            <strong>Online escrow:</strong> share the delivery code from the order page with your farmer after you receive the goods. They verify it to release funds — you cannot release escrow manually.
                                            <div className="mt-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline-danger"
                                                    className="w-100"
                                                    onClick={() => handleDispute(order._id)}
                                                >
                                                    Report Issue
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {order?.escrowStatus === 'held' && order.payment_method !== 'Online' && (
                                        <div className="w-100 mt-2">
                                            <Button
                                                size="lg"
                                                variant="success"
                                                className="w-100 fw-semibold shadow-sm"
                                                onClick={() => setReleaseConfirmOrder(order)}
                                            >
                                                ✅ Confirm Goods Received &amp; Release Funds
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline-danger"
                                                className="w-100 mt-2"
                                                onClick={() => handleDispute(order._id)}
                                            >
                                                Report Issue
                                            </Button>
                                        </div>
                                    )}

                                    {order.order_status === 'approved' && order.payment_method === 'Cash' && (
                                        <Button
                                            size="sm"
                                            variant="success"
                                            onClick={() => handleComplete(order._id)}
                                        >
                                            <i className="bi bi-check-circle-fill"></i> Mark Completed
                                        </Button>
                                    )}

                                    {order.order_status === 'counter_offered' && bargainOrderId !== order._id && (
                                        <>
                                            <Button size="sm" variant="success" onClick={() => handleConsumerRespond(order._id, 'approved')}>
                                                Accept
                                            </Button>
                                            <Button size="sm" variant="outline-primary" onClick={() => {
                                                setBargainOrderId(order._id);
                                                setBargainPrice(order.negotiated_price);
                                            }}>
                                                Bargain
                                            </Button>
                                            <Button size="sm" variant="danger" onClick={() => handleConsumerRespond(order._id, 'rejected')}>
                                                Reject
                                            </Button>
                                        </>
                                    )}

                                    {order.order_status === 'completed' && order.product_id && (
                                        <Link
                                            to={`/product/${order.product_id._id}`}
                                            className="btn btn-sm btn-warning text-dark"
                                        >
                                            <i className="bi bi-star-fill"></i> Add Review
                                        </Link>
                                    )}
                                </div>
                                {bargainOrderId === order._id && (
                                    <div className="mt-2 p-2 bg-light border rounded">
                                        <Form.Control
                                            type="number"
                                            size="sm"
                                            value={bargainPrice}
                                            onChange={(e) => setBargainPrice(e.target.value)}
                                            className="mb-2"
                                        />
                                        <div className="d-flex gap-2">
                                            <Button size="sm" variant="primary" onClick={() => handleConsumerRespond(order._id, 'requested', bargainPrice)}>
                                                Send Offer
                                            </Button>
                                            <Button size="sm" variant="secondary" onClick={() => setBargainOrderId(null)}>
                                                Cancel
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </td>
                        </tr>
                    ))}
                    {orders.length === 0 && (
                        <tr>
                            <td colSpan="8" className="text-center py-5 text-muted">No orders found.</td>
                        </tr>
                    )}
                </tbody>
            </Table>

            <Modal show={!!releaseConfirmOrder} onHide={() => setReleaseConfirmOrder(null)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Release escrow</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    Confirm you received the goods. This will mark the order completed and release funds to the farmer (settlement rules apply on the platform).
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setReleaseConfirmOrder(null)}>Cancel</Button>
                    <Button
                        variant="success"
                        onClick={() => releaseConfirmOrder && handleReleaseFunds(releaseConfirmOrder._id)}
                    >
                        ✅ Yes, release funds
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
};

export default MyOrders;
