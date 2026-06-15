import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Container, Card, Spinner, Alert, Button } from 'react-bootstrap';

const PaymentMock = () => {
    const { orderId } = useParams();
    const navigate = useNavigate();
    const [phase, setPhase] = useState('processing'); // processing | done | error
    const [message, setMessage] = useState('');

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            await new Promise((r) => setTimeout(r, 2000));
            if (cancelled) return;
            try {
                await axios.post('/payment/confirm-mock', { order_id: orderId });
                if (cancelled) return;
                setPhase('done');
                navigate(`/orders/${orderId}`, { replace: true, state: { mockPaid: true } });
            } catch (err) {
                if (cancelled) return;
                setPhase('error');
                setMessage(err.response?.data?.msg || err.message || 'Could not confirm payment');
            }
        };

        if (orderId) run();
        else {
            setPhase('error');
            setMessage('Missing order id');
        }

        return () => { cancelled = true; };
    }, [orderId, navigate]);

    return (
        <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '50vh' }}>
            <Card className="shadow border-0" style={{ maxWidth: '420px', width: '100%' }}>
                <Card.Body className="text-center py-5">
                    {phase === 'processing' && (
                        <>
                            <Spinner animation="border" variant="success" className="mb-3" />
                            <h5>Processing payment…</h5>
                            <p className="text-muted small mb-0">Simulated checkout — safe for demos when Stripe is unavailable.</p>
                        </>
                    )}
                    {phase === 'error' && (
                        <>
                            <Alert variant="danger">{message}</Alert>
                            <Button variant="outline-primary" onClick={() => navigate('/my-orders')}>
                                Back to My Orders
                            </Button>
                        </>
                    )}
                </Card.Body>
            </Card>
        </Container>
    );
};

export default PaymentMock;
