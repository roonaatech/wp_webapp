import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setupGlobalAxiosInterceptors } from '../utils/axiosInterceptor';

/**
 * Component to setup axios interceptors with navigation
 * Must be placed inside BrowserRouter to have access to useNavigate
 */
const AxiosInterceptorSetup = ({ children }) => {
    const navigate = useNavigate();

    useEffect(() => {
        setupGlobalAxiosInterceptors(navigate);
    }, [navigate]);

    return children;
};

export default AxiosInterceptorSetup;
