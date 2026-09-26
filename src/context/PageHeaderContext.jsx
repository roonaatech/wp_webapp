import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const PageHeaderContext = createContext({
    customHeader: null,
    setCustomHeader: () => {},
});

export const PageHeaderProvider = ({ children }) => {
    const [customHeader, setCustomHeader] = useState(null);
    const location = useLocation();

    // Automatically reset custom header on route change
    useEffect(() => {
        setCustomHeader(null);
    }, [location.pathname]);

    return (
        <PageHeaderContext.Provider value={{ customHeader, setCustomHeader }}>
            {children}
        </PageHeaderContext.Provider>
    );
};

export const usePageHeader = () => useContext(PageHeaderContext);
