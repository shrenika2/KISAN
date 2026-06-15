import React, { useEffect, useState, useMemo, useCallback, useContext } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Container, Button, Card, Spinner, Alert, Badge } from 'react-bootstrap';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import { downloadInvoice } from '../utils/generateReceipt';

const deliveryOtpKey = (orderId) => `delivery_otp_${orderId}`;

const Step = ({ label, done, active }) => (
    <div className="text-center flex-fill px-1">
        <div
            className={`rounded-circle mx-auto mb-2 d-flex align-items-center justify-content-center fw-bold ${
                done ? 'bg-success text-white' : active ? 'bg-warning text-dark' : 'bg-light text-muted border'
            }`}
            style={{ width: '36px', height: '36px', fontSize: '0.9rem' }}
        >
            {done ? '✓' : active ? '●' : ''}
        </div>
        <div className={`small ${done || active ? 'fw-semibold' : 'text-muted'}`}>{label}</div>
    </div>
);

const OrderDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { user: authUser } = useContext(AuthContext);
    const { socket } = useContext(SocketContext);
    const isConsumer = authUser?.role === 'consumer';
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [buyerDeliveryOtp, setBuyerDeliveryOtp] = useState(null);

    const fetchOrder = useCallback(async () => {
        const res = await axios.get(`/orders/${id}`);
        setOrder(res.data);
        const done =
            res.data?.order_status === 'completed' && res.data?.escrowStatus === 'released';
        if (done) {
            try {
                sessionStorage.removeItem(deliveryOtpKey(id));
                sessionStorage.removeItem(`deliveryOtp:${id}`);
            } catch {
                /* ignore */
            }
            setBuyerDeliveryOtp(null);
        }
    }, [id]);

    useEffect(() => {
        const load = async () => {
            try {
                await fetchOrder();
            } catch (err) {
                setError(err.response?.data?.msg || 'Could not load order');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [fetchOrder]);

    useEffect(() => {
        try {
            const saved =
                sessionStorage.getItem(deliveryOtpKey(id)) || sessionStorage.getItem(`deliveryOtp:${id}`);
            if (saved) setBuyerDeliveryOtp(saved);
        } catch {
            /* ignore */
        }
    }, [id]);

    useEffect(() => {
        if (!socket || !id) return;
        const onShipped = (payload) => {
            if (!payload || String(payload.orderId) !== String(id)) return;
            if (!isConsumer) {
                fetchOrder();
                return;
            }
            if (payload.otp != null) {
                const code = String(payload.otp);
                toast.success(`🚚 Order Shipped! Your Delivery Code: ${code}`, {
                    duration: Infinity,
                    id: `shipped-${id}`
                });
                setBuyerDeliveryOtp(code);
                try {
                    sessionStorage.setItem(deliveryOtpKey(id), code);
                } catch {
                    /* ignore */
                }
            } else {
                toast.success('🚚 Order Shipped! Check your delivery code below.', {
                    duration: Infinity,
                    id: `shipped-${id}`
                });
            }
            fetchOrder();
        };
        socket.on('shipped_notification', onShipped);

        const onPaymentReleased = (payload) => {
            if (!payload || String(payload.orderId) !== String(id)) return;
            if (isConsumer) {
                toast.dismiss(`shipped-${id}`);
                toast.success('✅ Delivery Confirmed! Farmer has received the payment.');
                try {
                    sessionStorage.removeItem(deliveryOtpKey(id));
                    sessionStorage.removeItem(`deliveryOtp:${id}`);
                } catch {
                    /* ignore */
                }
                setBuyerDeliveryOtp(null);
            }
            fetchOrder();
        };
        socket.on('payment_released', onPaymentReleased);

        return () => {
            socket.off('shipped_notification', onShipped);
            socket.off('payment_released', onPaymentReleased);
        };
    }, [socket, id, fetchOrder, isConsumer]);

    const stepper = useMemo(() => {
        if (!order) return null;
        const paidEscrow =
            order.paymentStatus === 'paid' ||
            order.escrowStatus === 'held' ||
            order.escrowStatus === 'released' ||
            order.order_status === 'paid' ||
            order.order_status === 'shipped';
        const shipped = Boolean(order.shipped_at) || order.order_status === 'shipped';
        const completed =
            order.order_status === 'completed' ||
            order.escrowStatus === 'released' ||
            Boolean(order.deliveryConfirmation);

        const legacyCashDone =
            order.payment_method === 'Cash' && order.order_status === 'completed';

        const useEscrowTrack =
            order.payment_method === 'Online' &&
            (paidEscrow || order.escrowStatus === 'held' || order.escrowStatus === 'released');

        if (legacyCashDone && !useEscrowTrack) {
            return { mode: 'legacy' };
        }

        if (!useEscrowTrack && order.order_status !== 'paid' && order.order_status !== 'shipped') {
            return {
                s1: true,
                s2: false,
                s3: false,
                s4: order.order_status === 'completed',
                mode: 'simple'
            };
        }

        const s3 = shipped || (completed && order.escrowStatus === 'released');
        const s4 = completed;

        return {
            s1: true,
            s2: paidEscrow,
            s3,
            s4,
            mode: 'escrow'
        };
    }, [order]);

    if (loading) {
        return (
            <Container className="text-center mt-5">
                <Spinner animation="border" />
            </Container>
        );
    }
    if (error || !order) {
        return (
            <Container className="mt-5">
                <Alert variant="danger">{error || 'Order not found'}</Alert>
                <Button
                    as={Link}
                    to={authUser?.role === 'farmer' ? '/farmer-orders' : '/my-orders'}
                    variant="outline-primary"
                >
                    {authUser?.role === 'farmer' ? 'Farmer Orders' : 'My Orders'}
                </Button>
            </Container>
        );
    }

    const product = order.product_id;
    const showBuyerOtp =
        isConsumer &&
        order.payment_method === 'Online' &&
        order.escrowStatus === 'held' &&
        (order.shipped_at || order.order_status === 'shipped') &&
        order.order_status !== 'completed';

    const showReceiptDownload = order.order_status === 'completed';

    return (
        <Container className="mt-4 pb-5" style={{ maxWidth: '720px' }}>
            <Button
                variant="outline-secondary"
                className="mb-3"
                onClick={() => navigate(authUser?.role === 'farmer' ? '/farmer-orders' : '/my-orders')}
            >
                ← {authUser?.role === 'farmer' ? "Farmer Orders" : 'My Orders'}
            </Button>

            {location.state?.mockPaid && (
                <Alert variant="success" dismissible onClose={() => navigate(location.pathname, { replace: true, state: {} })}>
                    Simulated payment succeeded — funds are held in escrow until you confirm delivery.
                </Alert>
            )}

            <Card className="shadow-sm border-0">
                <Card.Body className="p-4">
                    <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
                        <div>
                            <h4 className="mb-1">{product?.crop_name || 'Order'}</h4>
                            <small className="text-muted">
                                {new Date(order.order_date).toLocaleString()}
                            </small>
                        </div>
                        <Badge bg={order.payment_method === 'Cash' ? 'secondary' : 'info'}>
                            {order.payment_method}
                        </Badge>
                    </div>

                    <div className="mb-4 p-3 bg-light rounded">
                        <h6 className="text-uppercase text-muted small mb-3">Order progress</h6>
                        {stepper?.mode === 'legacy' ? (
                            <p className="mb-0 small text-muted">
                                This order completed under the older flow (no online escrow). Status: <strong>Completed</strong>.
                            </p>
                        ) : (
                            <div className="d-flex align-items-start justify-content-between gap-1">
                                <Step label="Ordered" done={stepper?.s1} active={stepper?.mode === 'simple' && !stepper?.s4} />
                                <div className="flex-grow-1 align-self-center pt-3 border-top border-2 mx-n1" style={{ maxWidth: '40px' }} />
                                <Step
                                    label="Paid (Escrow)"
                                    done={stepper?.s2}
                                    active={stepper?.mode === 'escrow' && !stepper?.s2}
                                />
                                <div className="flex-grow-1 align-self-center pt-3 border-top border-2 mx-n1" style={{ maxWidth: '40px' }} />
                                <Step
                                    label="In Transit"
                                    done={stepper?.s3}
                                    active={stepper?.mode === 'escrow' && stepper?.s2 && !stepper?.s3}
                                />
                                <div className="flex-grow-1 align-self-center pt-3 border-top border-2 mx-n1" style={{ maxWidth: '40px' }} />
                                <Step
                                    label="Completed"
                                    done={stepper?.s4}
                                    active={stepper?.mode === 'escrow' && stepper?.s3 && !stepper?.s4}
                                />
                            </div>
                        )}
                    </div>

                    <p className="mb-1">
                        <strong>Quantity:</strong> {order.requested_quantity} kg @ ₹{order.negotiated_price}/kg
                    </p>
                    <p className="mb-3">
                        <strong>Total:</strong> ₹{order.requested_quantity * order.negotiated_price}
                    </p>

                    {showReceiptDownload && (
                        <>
                            <Alert variant="success" className="mb-3 border-success border-2 shadow-sm">
                                {isConsumer ? (
                                    <>
                                        <strong>Transaction Complete.</strong> Your funds have been transferred to the
                                        farmer, and your receipt is ready for download.
                                    </>
                                ) : (
                                    <>
                                        <strong>Transaction complete.</strong> Escrow has been released. Download your
                                        official receipt for your records.
                                    </>
                                )}
                            </Alert>
                            <div className="d-grid mb-3">
                                <Button
                                    variant="success"
                                    size="lg"
                                    className="fw-bold py-3 shadow"
                                    onClick={() => downloadInvoice(order)}
                                >
                                    <span className="me-2" aria-hidden="true">
                                        📄
                                    </span>
                                    Download Official Receipt (PDF)
                                </Button>
                            </div>
                        </>
                    )}

                    {showBuyerOtp && (
                        <Alert variant="info" className="mb-3">
                            <strong>Your delivery code</strong> (share with the farmer when you receive the goods):
                            <div className="fs-3 fw-bold tracking-wide text-center my-2 font-monospace">
                                {buyerDeliveryOtp || order?.deliveryOTP || '••••••'}
                            </div>
                            {!buyerDeliveryOtp && (
                                <small className="text-muted">
                                    If you do not see the code, keep this page open — it was sent when the farmer shipped. You can also check notifications on My Orders.
                                </small>
                            )}
                        </Alert>
                    )}

                    {isConsumer &&
                        order?.escrowStatus === 'held' &&
                        order.payment_method === 'Online' &&
                        !order.shipped_at &&
                        order.order_status !== 'shipped' && (
                        <Alert variant="warning" className="mb-0">
                            Awaiting shipment from the farmer. After they ship, you will receive a <strong>delivery code</strong> to share with them — only the farmer can complete verification and release escrow.
                        </Alert>
                    )}
                </Card.Body>
            </Card>
        </Container>
    );
};

export default OrderDetail;
