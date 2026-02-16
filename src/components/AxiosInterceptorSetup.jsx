import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { setupGlobalAxiosInterceptors } from '../utils/axiosInterceptor';

/**
 * Component to setup axios interceptors with navigation
 * Must be placed inside BrowserRouter to have access to useNavigate
 */
const AxiosInterceptorSetup = ({ children }) => {
    const navigate = useNavigate();
    const isSetup = useRef(false);

    useEffect(() => {
        if (!isSetup.current) {
            setupGlobalAxiosInterceptors(navigate);
            isSetup.current = true;
        }
    }, [navigate]);

    return children;
};

export default AxiosInterceptorSetup;
