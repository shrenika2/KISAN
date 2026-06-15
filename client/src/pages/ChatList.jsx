import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { Container, ListGroup, Image, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { io } from 'socket.io-client';
import { getSocketURL } from '../utils/socketUrl';

const socket = io(getSocketURL());

const ChatList = () => {
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);

    useEffect(() => {
        const fetchConversations = async () => {
            try {
                const res = await axios.get('/chat/conversations');
                setConversations(res.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchConversations();

        if (user?._id) {
            socket.emit('join', user._id);
        }

        socket.on('new_message', (msg) => {
            setConversations((prev) => {
                const updated = [...prev];
                const existingIndex = updated.findIndex(c =>
                    c.participants.some(p => p._id === msg.sender_id) &&
                    c.participants.some(p => p._id === msg.receiver_id)
                );

                if (existingIndex !== -1) {
                    updated[existingIndex].last_message = msg.message;
                    updated[existingIndex].last_message_date = msg.timestamp || Date.now();
                    return [...updated].sort((a, b) => new Date(b.last_message_date) - new Date(a.last_message_date));
                } else {
                    fetchConversations();
                    return prev;
                }
            });
        });

        return () => {
            socket.off('new_message');
        };
    }, [user?._id]);

    const handleChatClick = (participants) => {
        // Find the "other" user logic
        const partner = participants.find(p => p._id !== user._id);
        if (partner) {
            navigate(`/chat/${partner._id}`);
        }
    };

    if (loading) return <Container className="text-center mt-5"><Spinner animation="border" /></Container>;

    return (
        <Container className="mt-4" style={{ maxWidth: '600px' }}>
            <h3 className="mb-4">Messages</h3>
            {conversations.length === 0 ? (
                <div className="text-center text-muted mt-5">
                    <p>No messages yet.</p>
                </div>
            ) : (
                <ListGroup variant="flush">
                    {conversations.map(conv => {
                        const partner = conv.participants.find(p => p._id !== user._id);
                        if (!partner) return null; // Should not happen

                        return (
                            <ListGroup.Item
                                key={conv._id}
                                action
                                onClick={() => handleChatClick(conv.participants)}
                                className="d-flex align-items-center p-3 border-bottom"
                                style={{ cursor: 'pointer' }}
                            >
                                {/* <Image
                                    src="https://via.placeholder.com/50"
                                    roundedCircle
                                    className="me-3"
                                    style={{ width: '50px', height: '50px', objectFit: 'cover' }}
                                /> */}
                                <div className="flex-grow-1">
                                    <div className="d-flex justify-content-between">
                                        <h5 className="mb-1">{partner.name}</h5>
                                        <small className="text-muted">
                                            {new Date(conv.last_message_date).toLocaleDateString()}
                                        </small>
                                    </div>
                                    <p className="mb-0 text-muted small text-truncate" style={{ maxWidth: '350px' }}>
                                        {conv.last_message}
                                    </p>
                                </div>
                            </ListGroup.Item>
                        );
                    })}
                </ListGroup>
            )}
        </Container>
    );
};

export default ChatList;
