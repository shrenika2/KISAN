import { useCallback, useEffect, useRef, useState } from 'react';

const useLocation = () => {
    const [latitude, setLatitude] = useState(null);
    const [longitude, setLongitude] = useState(null);
    const [error, setError] = useState('');
    const [isTracking, setIsTracking] = useState(false);
    const watchIdRef = useRef(null);

    const updateLocation = useCallback((position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setError('');
    }, []);

    const getLocation = useCallback(() => {
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by this browser.');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            updateLocation,
            (geoError) => {
                setError(geoError?.message || 'Unable to fetch your location.');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    }, [updateLocation]);

    const startTracking = useCallback(() => {
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by this browser.');
            return;
        }

        if (watchIdRef.current !== null) return;

        watchIdRef.current = navigator.geolocation.watchPosition(
            updateLocation,
            (geoError) => {
                setError(geoError?.message || 'Unable to track your location.');
                setIsTracking(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
        setIsTracking(true);
    }, [updateLocation]);

    const stopTracking = useCallback(() => {
        if (watchIdRef.current !== null && navigator.geolocation) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        setIsTracking(false);
    }, []);

    useEffect(() => {
        return () => {
            if (watchIdRef.current !== null && navigator.geolocation) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
        };
    }, []);

    return { latitude, longitude, error, getLocation, isTracking, startTracking, stopTracking };
};

export default useLocation;
