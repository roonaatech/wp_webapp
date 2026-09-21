import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const RegisterFaceId = () => {
    const navigate = useNavigate();
    useEffect(() => {
        navigate('/attendance', { replace: true });
    }, [navigate]);
    return null;
};

export default RegisterFaceId;
