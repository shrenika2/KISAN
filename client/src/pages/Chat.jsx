import React, { useState, useEffect, useRef, useContext } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { Container, Card, Form, Button } from 'react-bootstrap';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';

const Chat = () => {
    const { userId: receiverId } = useParams();
    const { user } = useContext(AuthContext);
    const { socket } = useContext(SocketContext); // Use shared socket
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        const fetchMessages = async () => {
            try {
                const res = await axios.get(`/chat/${receiverId}`);
                setMessages(res.data);
            } catch (err) {
                console.error(err);
            }
        };
        fetchMessages();

        if (socket) {
            socket.on('new_message', (msg) => {
                // Only add message if it belongs to the current conversation
                if (msg.sender_id === receiverId || msg.receiver_id === receiverId) {
                    setMessages((prev) => [...prev, msg]);
                    // Mark as read immediately if chat is open
                    axios.put(`/chat/read/${receiverId}`);
                }
            });
        }

        // Initial mark as read
        if (receiverId) {
            axios.put(`/chat/read/${receiverId}`);
        }

        return () => {
            if (socket) socket.off('new_message');
        };
    }, [receiverId, user?._id, socket]);

    useEffect(scrollToBottom, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        try {
            const res = await axios.post('/chat', {
                receiver_id: receiverId,
                message: newMessage
            });
            setMessages([...messages, res.data]);
            setNewMessage("");
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <Container className="mt-4">
            <h3 className="mb-3">Chat </h3>
            <Card style={{ height: '70vh' }}>
                <Card.Body style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                    {messages.length === 0 && <p className="text-center text-muted mt-5">No messages yet. Start negotiation!</p>}
                    {messages.map((msg, index) => (
                        <div
                            key={index}
                            className={`d-flex mb-2 ${msg.sender_id === user._id ? 'justify-content-end' : 'justify-content-start'}`}
                        >
                            <div
                                className={`p-2 rounded text-white ${msg.sender_id === user._id ? 'bg-primary' : 'bg-secondary'}`}
                                style={{ maxWidth: '70%' }}
                            >
                                {msg.message}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </Card.Body>
                <Card.Footer>
                    <Form onSubmit={handleSend} className="d-flex">
                        <Form.Control
                            type="text"
                            placeholder="Type a message..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                        />
                        <Button type="submit" variant="primary" className="ms-2">Send</Button>
                    </Form>
                </Card.Footer>
            </Card>
        </Container>
    );
};

export default Chat;
