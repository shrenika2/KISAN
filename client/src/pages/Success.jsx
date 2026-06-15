import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Container, Card, Spinner, Button } from 'react-bootstrap';

const Success = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('Verifying Payment...');

    useEffect(() => {
        const verifyPayment = async () => {
            const sessionId = searchParams.get('session_id');
            const orderId = searchParams.get('order_id');

            if (!sessionId || !orderId) {
                setStatus('Invalid Session Data');
                setLoading(false);
                return;
            }

            try {
                await axios.post('/payments/verify-payment', {
                    order_id: orderId,
                    session_id: sessionId
                });
                setStatus('Payment Successful! Order Confirmed.');
            } catch (err) {
                console.error("Payment Verify Error:", err);
                const backendMsg = err.response?.data?.msg;
                if (backendMsg) {
                    setStatus(`Error: ${backendMsg}`);
                } else {
                    setStatus('Payment Verification Failed. Please contact support.');
                }
            } finally {
                setLoading(false);
            }
        };

        verifyPayment();
    }, [searchParams]);

    return (
        <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
            <Card className="text-center p-5 shadow border-0">
                <Card.Body>
                    {loading ? (
                        <Spinner animation="border" variant="primary" />
                    ) : (
                        <>
                            <div className="mb-3">
                                {status.toLowerCase().includes('success') ?
                                    <i className="bi bi-check-circle-fill text-success" style={{ fontSize: '4rem' }}></i> :
                                    <i className="bi bi-x-circle-fill text-danger" style={{ fontSize: '4rem' }}></i>
                                }
                            </div>
                            <h2 className="mb-3">{status}</h2>
                            <p className="text-muted">
                                {status.toLowerCase().includes('success')
                                    ? "Thank you for supporting our farmers."
                                    : "Please try again or contact support if money was deducted."}
                            </p>
                            <Button variant="primary" onClick={() => navigate('/my-orders')}>
                                Go to My Orders
                            </Button>
                        </>
                    )}
                </Card.Body>
            </Card>
        </Container>
    );
};

export default Success;
