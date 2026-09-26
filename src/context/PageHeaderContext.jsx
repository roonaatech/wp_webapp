import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const PageHeaderContext = createContext({
    customHeader: null,
    setCustomHeader: () => {},
    setHeaderInfo: () => {},
});

export const PageHeaderProvider = ({ children }) => {
    const [customHeader, setCustomHeader] = useState(null);
    const location = useLocation();

    // Automatically reset custom header on route change
    useEffect(() => {
        setCustomHeader(null);
    }, [location.pathname]);

    const setHeaderInfo = setCustomHeader;

    return (
        <PageHeaderContext.Provider value={{ customHeader, setCustomHeader, setHeaderInfo }}>
            {children}
        </PageHeaderContext.Provider>
    );
};

export const usePageHeader = () => useContext(PageHeaderContext);
