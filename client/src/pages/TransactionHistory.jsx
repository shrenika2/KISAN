import React, { useEffect, useState, useContext } from 'react';
import { Container, Table, Button, Card, Badge, Spinner, Alert, Modal, Form } from 'react-bootstrap';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const TransactionHistory = () => {
    const { user } = useContext(AuthContext);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [reviewOrder, setReviewOrder] = useState(null);
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState("");

    useEffect(() => {
        const fetchTransactions = async () => {
            try {
                let endpoint = '';
                if (user.role === 'farmer') {
                    endpoint = '/orders/farmer-orders';
                } else {
                    endpoint = '/orders/my-orders';
                }

                const res = await axios.get(endpoint);
                // Filter for paid or completed orders
                const paidOrders = res.data.filter(order =>
                    order.order_status === 'paid' ||
                    order.order_status === 'shipped' ||
                    order.order_status === 'completed'
                );
                setTransactions(paidOrders);
                setLoading(false);
            } catch (err) {
                console.error("Error fetching transactions", err);
                setError('Failed to load transaction history.');
                setLoading(false);
            }
        };

        if (user) {
            fetchTransactions();
        }
    }, [user]);

    const downloadReceipt = (order) => {
        const doc = new jsPDF();

        // Header
        doc.setFillColor(22, 163, 74); // Green color
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text("KisanBajaar Receipt", 105, 25, null, null, "center");

        // Order Details
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.text(`Transaction ID: ${order._id}`, 14, 50);
        doc.text(`Date: ${new Date(order.payment_date || order.updatedAt).toLocaleDateString()}`, 14, 60);
        doc.text(`Status: ${order.order_status.toUpperCase()}`, 14, 70);

        // Buyer/Seller Info
        doc.setFontSize(14);
        doc.text(user.role === 'farmer' ? "Buyer Details:" : "Seller Details:", 14, 85);
        doc.setFontSize(12);
        const otherParty = user.role === 'farmer' ? order.consumer_id : order.farmer_id;
        doc.text(`Name: ${otherParty?.name || 'N/A'}`, 14, 95);
        doc.text(`Phone: ${otherParty?.phone || 'N/A'}`, 14, 105);

        const pricePerUnit = order.final_price || order.negotiated_price || 0;
        const totalAmount = (pricePerUnit * order.requested_quantity).toFixed(2);

        // Table
        const tableColumn = ["Item", "Quantity", "Price/Unit", "Total"];
        const tableRows = [
            [
                order.product_id?.crop_name || 'Crop',
                `${order.requested_quantity} kg`,
                `Rs. ${Number(pricePerUnit).toFixed(2)}`,
                `Rs. ${totalAmount}`
            ]
        ];

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 115,
            theme: 'grid',
            headStyles: { fillColor: [22, 163, 74] }
        });

        // Total
        const finalY = doc.lastAutoTable.finalY || 130;
        doc.setFontSize(14);
        doc.text(`Total Amount Paid: Rs. ${totalAmount}`, 14, finalY + 20);

        // Footer
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text("Thank you for using Farm2Door!", 105, 280, null, null, "center");

        doc.save(`Receipt_${order._id}.pdf`);
    };

    const handleReviewClick = (order) => {
        setReviewOrder(order);
        setRating(5);
        setComment("");
        setShowReviewModal(true);
    };

    const submitReview = async () => {
        if (!reviewOrder) return;
        try {
            await axios.post('/reviews', {
                order_id: reviewOrder._id,
                rating,
                comment
            });
            setShowReviewModal(false);
            alert("Review submitted successfully!");
        } catch (err) {
            console.error("Review failed", err);
            alert(err.response?.data?.msg || "Failed to submit review");
        }
    };

    if (loading) {
        return (
            <Container className="d-flex justify-content-center mt-5">
                <Spinner animation="border" variant="success" />
            </Container>
        );
    }

    return (
        <Container className="mt-4 mb-5">
            <h2 className="mb-4 fw-bold text-success">
                <i className="fa-solid fa-file-invoice-dollar me-2"></i>
                Transaction History
            </h2>

            {error && <Alert variant="danger">{error}</Alert>}

            {transactions.length === 0 ? (
                <div className="text-center py-5 bg-light rounded border">
                    <h4 className="text-muted">No completed transactions found.</h4>
                    <p>Orders will appear here once payment is completed.</p>
                </div>
            ) : (
                <Card className="shadow-sm border-0">
                    <Card.Body className="p-0">
                        <Table responsive hover className="mb-0">
                            <thead className="table-light">
                                <tr>
                                    <th>Date</th>
                                    <th>Item</th>
                                    <th>{user.role === 'farmer' ? 'Buyer' : 'Seller'}</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                    <th className="text-end">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map(order => (
                                    <tr key={order._id} className="align-middle">
                                        <td>{new Date(order.payment_date || order.updatedAt).toLocaleDateString()}</td>
                                        <td>
                                            <div className="d-flex align-items-center">
                                                {order.product_id?.image_url && (
                                                    <img
                                                        src={order.product_id.image_url}
                                                        alt=""
                                                        className="rounded-circle me-2"
                                                        style={{ width: '32px', height: '32px', objectFit: 'cover' }}
                                                    />
                                                )}
                                                <span className="fw-bold">{order.product_id?.crop_name || 'Item'}</span>
                                            </div>
                                        </td>
                                        <td>
                                            {user.role === 'farmer' ? order.consumer_id?.name : order.farmer_id?.name}
                                        </td>
                                        <td className="fw-bold">₹{((order.final_price || order.negotiated_price || 0) * order.requested_quantity).toFixed(2)}</td>
                                        <td>
                                            <Badge bg="success" pill>
                                                {order.order_status.toUpperCase()}
                                            </Badge>
                                        </td>
                                        <td className="text-end">
                                            <div className="d-flex gap-2 justify-content-end">
                                                <Button
                                                    variant="outline-primary"
                                                    size="sm"
                                                    className="rounded-pill"
                                                    onClick={() => downloadReceipt(order)}
                                                >
                                                    <i className="bi bi-download me-1"></i> Receipt
                                                </Button>
                                                {user.role === 'consumer' && (
                                                    <Button
                                                        variant="outline-warning"
                                                        size="sm"
                                                        className="rounded-pill"
                                                        onClick={() => handleReviewClick(order)}
                                                    >
                                                        <i className="bi bi-star-fill me-1"></i> Rate
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </Card.Body>
                </Card>
            )}

            {/* Review Modal */}
            <Modal show={showReviewModal} onHide={() => setShowReviewModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Rate Your Experience</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className="mb-3 text-center">
                        <p className="mb-2">How would you rate your purchase from <strong>{reviewOrder?.farmer_id?.name}</strong>?</p>
                        <div className="fs-1" style={{ cursor: 'pointer' }}>
                            {[1, 2, 3, 4, 5].map(star => (
                                <i
                                    key={star}
                                    className={`bi ${star <= rating ? 'bi-star-fill text-warning' : 'bi-star text-secondary'} mx-1`}
                                    onClick={() => setRating(star)}
                                />
                            ))}
                        </div>
                    </div>
                    <Form.Group className="mb-3">
                        <Form.Label>Comment (Optional)</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={3}
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Share your feedback..."
                        />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowReviewModal(false)}>Close</Button>
                    <Button variant="success" onClick={submitReview}>Submit Review</Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
};

export default TransactionHistory;

