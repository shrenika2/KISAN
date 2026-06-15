import React, { useEffect, useState, useContext, useMemo } from 'react';
import axios from 'axios';
import Confetti from 'react-confetti';
import toast from 'react-hot-toast';
import { Container, Row, Col, Card, Spinner, Badge, Button, Alert, Form } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { SocketContext } from '../context/SocketContext';
import { downloadInvoice } from '../utils/generateReceipt';

const lineTotal = (o) =>
    Number(o.negotiated_price || o.original_price || 0) * Number(o.requested_quantity || 0);

const FarmerOrders = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionMsg, setActionMsg] = useState('');
    const [bargainOrderId, setBargainOrderId] = useState(null);
    const [bargainPrice, setBargainPrice] = useState('');
    const [otpByOrder, setOtpByOrder] = useState({});
    const [verifyingOtpFor, setVerifyingOtpFor] = useState(null);
    const [showConfetti, setShowConfetti] = useState(false);
    const [windowSize, setWindowSize] = useState(() => ({
        width: typeof window !== 'undefined' ? window.innerWidth : 300,
        height: typeof window !== 'undefined' ? window.innerHeight : 300
    }));
    const navigate = useNavigate();
    const { socket } = useContext(SocketContext);

    useEffect(() => {
        const onResize = () =>
            setWindowSize({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const pendingEscrowTotal = useMemo(
        () =>
            orders
                .filter((o) => o.escrowStatus === 'held' && o.paymentStatus === 'paid')
                .reduce((s, o) => s + lineTotal(o), 0),
        [orders]
    );
    const availableTotal = useMemo(
        () => orders.filter((o) => o.escrowStatus === 'released').reduce((s, o) => s + lineTotal(o), 0),
        [orders]
    );

    const fetchOrders = async () => {
        try {
            const res = await axios.get('/orders/farmer-orders');
            setOrders(res.data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    useEffect(() => {
        if (!socket) return;
        const onEscrow = (payload) => {
            setActionMsg(payload?.message || 'Payment secured in escrow — please ship.');
            fetchOrders();
            setTimeout(() => setActionMsg(''), 8000);
        };
        socket.on('escrow_payment_secured', onEscrow);
        return () => {
            socket.off('escrow_payment_secured', onEscrow);
        };
    }, [socket]);

    const downloadOrderReceipt = async (orderId) => {
        try {
            const { data } = await axios.get(`/orders/${orderId}`);
            downloadInvoice(data);
            toast.success('Official receipt downloaded.');
        } catch (e) {
            toast.error(e.response?.data?.msg || 'Could not load order for receipt.');
        }
    };

    const submitDeliveryOtp = async (orderId) => {
        const otp = String(otpByOrder[orderId] || '').replace(/\D/g, '');
        if (otp.length !== 6) {
            toast.error('Enter the 6-digit code from the buyer.');
            return;
        }
        setVerifyingOtpFor(orderId);
        try {
            const { data } = await axios.post('/payment/confirm-delivery', { orderId, otp });
            const amt =
                Number(data.final_price || data.negotiated_price || 0) *
                Number(data.requested_quantity || 0);
            setOtpByOrder((prev) => ({ ...prev, [orderId]: '' }));
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 4500);
            toast.success(`Payment Received! ₹${amt.toFixed(0)} added to your balance.`);
            await fetchOrders();
        } catch (e) {
            const msg = e.response?.data?.msg || '';
            if (
                e.response?.status === 400 &&
                (msg.includes('Invalid Delivery Code') || msg.includes('Invalid') || msg.includes('check with the Buyer'))
            ) {
                toast.error('Invalid Delivery Code. Please check with the Buyer.');
            } else {
                toast.error(msg || 'Verification failed');
            }
            setOtpByOrder((prev) => ({ ...prev, [orderId]: '' }));
        } finally {
            setVerifyingOtpFor(null);
        }
    };

    const handleStatusUpdate = async (orderId, status, negotiated_price) => {
        try {
            await axios.put(`/orders/${orderId}/status`, { status, negotiated_price });
            setActionMsg(status === 'counter_offered' ? 'Counter offer sent!' : `Order ${status} successfully!`);
            setBargainOrderId(null);
            setBargainPrice('');
            fetchOrders(); // Refresh list
            setTimeout(() => setActionMsg(''), 3000);
        } catch (err) {
            console.error(err);
            alert('Failed to update status');
        }
    };

    if (loading) return <Container className="text-center mt-5"><Spinner animation="border" variant="success" /></Container>;

    return (
        <Container className="mt-4 pb-5 position-relative">
            {showConfetti && (
                <Confetti
                    width={windowSize.width}
                    height={windowSize.height}
                    recycle={false}
                    numberPieces={320}
                    gravity={0.12}
                />
            )}
            <h2 className="mb-4 text-success fw-bold">Farmer's Order Book 📜</h2>

            {(pendingEscrowTotal > 0 || availableTotal > 0) && (
                <Row className="g-3 mb-4">
                    <Col md={6}>
                        <Card className="border-success border-2 shadow-sm h-100">
                            <Card.Body className="py-3">
                                <div className="text-muted small text-uppercase fw-semibold">Available (released)</div>
                                <div className="fs-4 fw-bold text-success">₹{availableTotal.toFixed(0)}</div>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col md={6}>
                        <Card className="border-warning border-2 shadow-sm h-100">
                            <Card.Body className="py-3">
                                <div className="text-muted small text-uppercase fw-semibold">Pending in escrow</div>
                                <div className="fs-4 fw-bold text-warning">₹{pendingEscrowTotal.toFixed(0)}</div>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            )}

            {actionMsg && <Alert variant="success" className="shadow-sm">{actionMsg}</Alert>}

            {orders.length === 0 ? (
                <div className="text-center py-5 text-muted bg-light rounded shadow-sm">
                    <h4>No active orders found.</h4>
                    <p>When consumers buy your products, they will appear here.</p>
                </div>
            ) : (
                <Row>
                    {orders.map(order => (
                        <Col key={order._id} md={6} lg={4} className="mb-4">
                            <Card className="h-100 shadow-sm border-0 border-top border-success border-4">
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-center mb-3">
                                        <div className="d-flex flex-column gap-1">
                                            <Badge bg={
                                                order.order_status === 'completed' ? 'success' :
                                                    order.order_status === 'shipped' ? 'info' :
                                                        order.order_status === 'approved' ? 'primary' :
                                                            order.order_status === 'rejected' ? 'danger' :
                                                                order.order_status === 'counter_offered' ? 'info' : 'warning'
                                            } className="p-2 align-self-start">
                                                {order.order_status === 'counter_offered'
                                                    ? 'COUNTER OFFERED'
                                                    : order.order_status === 'shipped'
                                                      ? 'SHIPPED · IN TRANSIT'
                                                      : order.order_status.toUpperCase()}
                                            </Badge>
                                            {order?.escrowStatus === 'held' && order.order_status !== 'shipped' && (
                                                <Badge bg="warning" text="dark" className="p-2 align-self-start">
                                                    Payment Held in Escrow — safe to ship
                                                </Badge>
                                            )}
                                            {order?.escrowStatus === 'held' && order.order_status === 'shipped' && (
                                                <Badge bg="info" text="dark" className="p-2 align-self-start">
                                                    Escrow held until OTP verified
                                                </Badge>
                                            )}
                                            {order?.escrowStatus === 'released' && (
                                                <Badge bg="success" className="p-2 align-self-start">
                                                    Payment Dispatched
                                                </Badge>
                                            )}
                                        </div>
                                        <small className="text-muted">{new Date(order.order_date).toLocaleDateString()}</small>
                                    </div>

                                    <div className="d-flex align-items-center mb-4">
                                        <img
                                            src={order.product_id?.image_url || 'https://via.placeholder.com/60px'}
                                            alt=""
                                            className="rounded"
                                            style={{ width: '60px', height: '60px', objectFit: 'cover', border: '1px solid #eee' }}
                                        />
                                        <div className="ms-3">
                                            <h5 className="mb-0 fw-bold text-dark">{order.product_id?.crop_name}</h5>
                                            <p className="mb-0 text-muted small">{order.requested_quantity} kg requested</p>
                                        </div>
                                    </div>

                                    <div className="bg-light p-3 rounded mb-4">
                                        <div className="d-flex justify-content-between mb-2">
                                            <span className="text-muted small">Offer Price:</span>
                                            <span className="fw-bold text-success">₹{order.negotiated_price || order.original_price}/kg</span>
                                        </div>
                                        <div className="d-flex justify-content-between">
                                            <span className="text-muted small text-uppercase fw-bold">Total Amount:</span>
                                            <span className="fw-bold fs-5 text-primary">₹{(order.negotiated_price || order.original_price) * order.requested_quantity}</span>
                                        </div>
                                    </div>

                                    <hr />

                                    <div className="mb-4">
                                        <p className="mb-1 small text-muted text-uppercase fw-bold">Buyer Details</p>
                                        <h6 className="mb-0 fw-bold">{order.consumer_id?.name || 'Valued Customer'}</h6>
                                        <p className="text-muted small mb-0">{order.consumer_id?.phone}</p>
                                    </div>

                                    <div className="d-grid gap-2">
                                        {order.order_status === 'requested' && bargainOrderId !== order._id && (
                                            <>
                                                <Row className="g-2">
                                                    <Col xs={4}>
                                                        <Button
                                                            variant="success"
                                                            className="w-100"
                                                            onClick={() => handleStatusUpdate(order._id, 'approved')}
                                                        >
                                                            Accept
                                                        </Button>
                                                    </Col>
                                                    <Col xs={4}>
                                                        <Button
                                                            variant="outline-primary"
                                                            className="w-100"
                                                            onClick={() => {
                                                                setBargainOrderId(order._id);
                                                                setBargainPrice(order.negotiated_price || order.original_price);
                                                            }}
                                                        >
                                                            Bargain
                                                        </Button>
                                                    </Col>
                                                    <Col xs={4}>
                                                        <Button
                                                            variant="outline-danger"
                                                            className="w-100"
                                                            onClick={() => handleStatusUpdate(order._id, 'rejected')}
                                                        >
                                                            Reject
                                                        </Button>
                                                    </Col>
                                                </Row>
                                            </>
                                        )}
                                        
                                        {bargainOrderId === order._id && (
                                            <div className="p-3 bg-light border rounded">
                                                <h6 className="mb-2">Counter Offer Price (₹)</h6>
                                                <Form.Control
                                                    type="number"
                                                    value={bargainPrice}
                                                    onChange={(e) => setBargainPrice(e.target.value)}
                                                    className="mb-2"
                                                />
                                                <Row className="g-2">
                                                    <Col xs={6}>
                                                        <Button
                                                            variant="primary"
                                                            className="w-100"
                                                            onClick={() => handleStatusUpdate(order._id, 'counter_offered', bargainPrice)}
                                                        >
                                                            Send
                                                        </Button>
                                                    </Col>
                                                    <Col xs={6}>
                                                        <Button
                                                            variant="secondary"
                                                            className="w-100"
                                                            onClick={() => setBargainOrderId(null)}
                                                        >
                                                            Cancel
                                                        </Button>
                                                    </Col>
                                                </Row>
                                            </div>
                                        )}

                                        {order.order_status === 'counter_offered' && (
                                            <div className="text-center p-2 text-warning fw-bold">
                                                <i className="bi bi-hourglass-split"></i> Waiting for buyer response
                                            </div>
                                        )}
                                        {order.order_status === 'paid' &&
                                            order.payment_method === 'Online' &&
                                            order?.escrowStatus === 'held' &&
                                            !order.shipped_at && (
                                            <Button
                                                variant="primary"
                                                onClick={async () => {
                                                    try {
                                                        await axios.post(`/orders/${order._id}/ship`);
                                                        fetchOrders();
                                                        setActionMsg(
                                                            'Shipped! The buyer received a delivery code. When they share it with you, enter it below to release escrow.'
                                                        );
                                                    } catch (e) {
                                                        alert(e.response?.data?.msg || 'Failed to update');
                                                    }
                                                }}
                                            >
                                                🚚 Mark as Shipped
                                            </Button>
                                        )}
                                        {order.order_status === 'shipped' &&
                                            order.payment_method === 'Online' &&
                                            order?.escrowStatus === 'held' && (
                                            <Badge bg="secondary" className="w-100 py-2 mb-0 text-wrap text-start fw-normal">
                                                🕒 In Transit — Awaiting Buyer OTP
                                            </Badge>
                                        )}
                                        {order.payment_method === 'Online' &&
                                            order.order_status === 'shipped' &&
                                            order?.escrowStatus === 'held' && (
                                                <div className="p-3 bg-light border rounded">
                                                    <p className="small mb-2 fw-semibold text-primary">
                                                        Secure delivery handshake
                                                    </p>
                                                    <p className="small text-muted mb-2">
                                                        Enter the 6-digit code the buyer shows you (PIN style — hidden as you type).
                                                    </p>
                                                    <Form.Control
                                                        type="password"
                                                        inputMode="numeric"
                                                        autoComplete="one-time-code"
                                                        maxLength={6}
                                                        placeholder="••••••"
                                                        className="mb-2 font-monospace text-center fs-4"
                                                        style={{ letterSpacing: '0.45em' }}
                                                        value={otpByOrder[order._id] || ''}
                                                        disabled={verifyingOtpFor === order._id}
                                                        onChange={(e) =>
                                                            setOtpByOrder((prev) => ({
                                                                ...prev,
                                                                [order._id]: e.target.value.replace(/\D/g, '').slice(0, 6)
                                                            }))
                                                        }
                                                    />
                                                    <Button
                                                        variant="primary"
                                                        className="w-100 d-flex align-items-center justify-content-center gap-2"
                                                        onClick={() => submitDeliveryOtp(order._id)}
                                                        disabled={
                                                            verifyingOtpFor === order._id ||
                                                            String(otpByOrder[order._id] || '').length !== 6
                                                        }
                                                    >
                                                        {verifyingOtpFor === order._id ? (
                                                            <>
                                                                <Spinner animation="border" size="sm" role="status" />
                                                                Verifying Handshake…
                                                            </>
                                                        ) : (
                                                            <>Verify OTP &amp; Release Payment</>
                                                        )}
                                                    </Button>
                                                </div>
                                            )}
                                        {order.payment_method === 'Cash' &&
                                            order.order_status === 'paid' &&
                                            order?.escrowStatus !== 'held' && (
                                            <Button
                                                variant="primary"
                                                onClick={() => handleStatusUpdate(order._id, 'completed')}
                                            >
                                                🚚 Mark as Delivered
                                            </Button>
                                        )}

                                        {order.order_status === 'completed' && (
                                            <Button
                                                variant="outline-success"
                                                className="fw-semibold"
                                                onClick={() => downloadOrderReceipt(order._id)}
                                            >
                                                📄 Download Official Receipt (PDF)
                                            </Button>
                                        )}

                                        {/* REAL-TIME CHAT BUTTON */}
                                        <Button
                                            variant="outline-primary"
                                            className="d-flex align-items-center justify-content-center"
                                            onClick={() => navigate(`/chat/${order.consumer_id?._id}`)}
                                        >
                                            <i className="bi bi-chat-dots-fill me-2"></i> Chat with Buyer
                                        </Button>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                    ))}
                </Row>
            )}
        </Container>
    );
};

export default FarmerOrders;
