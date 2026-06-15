import { useCallback, useState } from 'react';
import axios from 'axios';

const usePincode = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const lookupPincode = useCallback(async (rawPincode) => {
        const pincode = String(rawPincode || '').replace(/\D/g, '').slice(0, 6);
        if (pincode.length !== 6) return null;

        setLoading(true);
        setError('');
        try {
            const response = await axios.get(`/geo/pincode/${pincode}`);
            return {
                district: response.data?.district || '',
                state: response.data?.state || '',
                fallbackQuery: `${pincode}, India`
            };
        } catch (lookupError) {
            const serverMessage = lookupError?.response?.data?.msg;
            setError(serverMessage || 'Pincode lookup failed.');
            return { district: '', state: '', fallbackQuery: `${pincode}, India` };
        } finally {
            setLoading(false);
        }
    }, []);

    return { lookupPincode, loading, error };
};

export default usePincode;
