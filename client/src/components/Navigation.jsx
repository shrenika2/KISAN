
import React, { useContext, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar, Nav, Container, Button, Badge } from 'react-bootstrap';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import axios from 'axios';

import GoogleTranslate from './GoogleTranslate';

const Navigation = () => {
    const { user, logout } = useContext(AuthContext);
    const { socket } = useContext(SocketContext); // Use shared socket
    const navigate = useNavigate();
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!user) return;

        const fetchUnread = async () => {
            try {
                const res = await axios.get('/chat/unread/count');
                setUnreadCount(res.data.count);
            } catch (err) {
                console.error("Error fetching unread count", err);
            }
        };

        fetchUnread();

        // Polling fallback
        const interval = setInterval(fetchUnread, 10000);

        if (socket) {
            const handleRefresh = () => {
                fetchUnread();
            };

            socket.on('new_message', handleRefresh);
            socket.on('messages_read', handleRefresh);

            return () => {
                clearInterval(interval);
                socket.off('new_message', handleRefresh);
                socket.off('messages_read', handleRefresh);
            };
        }

        return () => clearInterval(interval);
    }, [user, socket]);

    const handleLogout = () => {
        logout();
        navigate('/home');
    };

    return (
        <Navbar expand="lg" className="bg-white shadow-sm glass py-2 mb-4" sticky="top">
            <Container>
                <Navbar.Brand as={Link} to={user?.role === 'farmer' ? '/farmer-dashboard' : user?.role === 'consumer' ? '/dashboard' : '/'} className="d-flex align-items-center">
                    <i className="fa-solid fa-leaf text-success fs-4 me-2"></i>
                    <span className="fw-bold fs-4 text-dark">
                        Krushi<span className="text-success">Bajaar</span>
                    </span>
                </Navbar.Brand>

                <Navbar.Toggle aria-controls="basic-navbar-nav" className="border-0 shadow-none">
                    <span className="navbar-toggler-icon"></span>
                </Navbar.Toggle>

                <Navbar.Collapse id="basic-navbar-nav">
                    <Nav className="ms-auto align-items-center fw-medium pb-3 pb-md-0">

                        {/* Translate Widget */}
                        <div className="mx-2 my-3 my-md-0 text-center text-md-start">
                            <GoogleTranslate />
                        </div>

                        {user ? (
                            <div className="d-flex flex-column flex-md-row align-items-center w-100 w-md-auto gap-2 gap-md-0">
                                {user.role === 'farmer' ? (
                                    <>
                                        <Nav.Link as={Link} to="/farmer-dashboard" className="mx-2 text-secondary w-100 w-md-auto text-center text-md-start">Dashboard</Nav.Link>
                                        <Nav.Link as={Link} to="/my-products" className="mx-2 text-secondary w-100 w-md-auto text-center text-md-start">My Listings</Nav.Link>
                                        <Nav.Link as={Link} to="/farmer-orders" className="mx-2 text-secondary w-100 w-md-auto text-center text-md-start">Orders</Nav.Link>
                                        <Nav.Link as={Link} to="/demand-forecast" className="mx-2 text-secondary w-100 w-md-auto text-center text-md-start">Demand Forecast</Nav.Link>
                                    </>
                                ) : (
                                    <>
                                        <Nav.Link as={Link} to="/dashboard" className="mx-2 text-secondary w-100 w-md-auto text-center text-md-start">Dashboard</Nav.Link>
                                        <Nav.Link as={Link} to="/marketplace" className="mx-2 text-secondary w-100 w-md-auto text-center text-md-start">Marketplace</Nav.Link>
                                        <Nav.Link as={Link} to="/demand-forecast" className="mx-2 text-secondary w-100 w-md-auto text-center text-md-start">Demand Forecast</Nav.Link>
                                        <Nav.Link as={Link} to="/my-orders" className="mx-2 text-secondary w-100 w-md-auto text-center text-md-start">My Orders</Nav.Link>
                                    </>
                                )}

                                <Nav.Link as={Link} to="/transactions" className="mx-2 text-secondary w-100 w-md-auto text-center text-md-start">Transactions</Nav.Link>
                                <Nav.Link as={Link} to="/chats" className="mx-2 text-secondary w-100 w-md-auto text-center text-md-start position-relative">
                                    Chats
                                    {unreadCount > 0 && (
                                        <Badge pill bg="danger" className="ms-1">
                                            {unreadCount}
                                        </Badge>
                                    )}
                                </Nav.Link>

                                <div className="vr mx-3 d-none d-md-block text-muted"></div>
                                <hr className="d-md-none w-100 my-2 text-muted" />

                                <Nav.Link as={Link} to="/profile" className="me-3 text-dark fw-bold mb-3 mb-md-0">
                                    Hi, {user.name}
                                </Nav.Link>

                                <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={handleLogout}
                                    className="rounded-pill px-4 fw-semibold shadow-sm w-100 w-md-auto"
                                >
                                    Logout
                                </Button>
                            </div>
                        ) : (
                            <div className="d-flex flex-column flex-md-row align-items-center w-100 w-md-auto mt-3 mt-md-0 gap-2 gap-md-0">
                                <Nav.Link as={Link} to="/login" className="text-secondary mx-2 fw-medium w-100 w-md-auto text-center text-md-start">Login</Nav.Link>
                                <Button
                                    as={Link}
                                    to="/register"
                                    variant="success"
                                    className="ms-md-2 rounded-pill px-4 fw-semibold shadow-sm w-100 w-md-auto"
                                >
                                    Get Started
                                </Button>
                            </div>
                        )}
                    </Nav>
                </Navbar.Collapse>
            </Container>
        </Navbar>
    );
};

export default Navigation;
