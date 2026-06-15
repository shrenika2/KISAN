import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';
import { getSocketURL } from '../utils/socketUrl';

export const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
    const { user } = useContext(AuthContext);
    const [socket, setSocket] = useState(null);
    const socketRef = useRef(null);

    useEffect(() => {
        if (user) {
            const url = getSocketURL();
            const newSocket = io(url, {
                transports: ['websocket', 'polling'],
                autoConnect: true,
            });

            newSocket.on('connect', () => {
                if (user._id || user.id) {
                    newSocket.emit('join', user._id || user.id);
                }
            });

            socketRef.current = newSocket;
            setSocket(newSocket);

            return () => {
                newSocket.disconnect();
                socketRef.current = null;
                setSocket(null);
            };
        }

        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
            setSocket(null);
        }
    }, [user]);

    return (
        <SocketContext.Provider value={{ socket }}>
            {children}
        </SocketContext.Provider>
    );
};
