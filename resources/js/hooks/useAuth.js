import { useState, useEffect, useCallback } from 'react';

const AUTH_KEYS = [
    'customer_token',
    'customer_email',
    'customer_firstname',
    'customer_lastname',
];

export function useAuth() {
    const [auth, setAuth] = useState({
        hydrated: false,
        isLoggedIn: false,
        token: null,
        email: null,
        firstName: null,
        lastName: null,
    });

    useEffect(() => {
        const read = () => {
            const token = localStorage.getItem('customer_token');
            const email = localStorage.getItem('customer_email');
            const firstName = localStorage.getItem('customer_firstname');
            const lastName = localStorage.getItem('customer_lastname');
            setAuth({
                hydrated: true,
                isLoggedIn: !!token,
                token,
                email,
                firstName,
                lastName,
            });
        };
        read();
        window.addEventListener('storage', read);
        return () => window.removeEventListener('storage', read);
    }, []);

    const logout = useCallback(() => {
        AUTH_KEYS.forEach((k) => localStorage.removeItem(k));
        setAuth({
            hydrated: true,
            isLoggedIn: false,
            token: null,
            email: null,
            firstName: null,
            lastName: null,
        });
    }, []);

    return { ...auth, logout };
}

export function setAuthData(token, email, firstName, lastName) {
    localStorage.setItem('customer_token', token);
    localStorage.setItem('customer_email', email);
    if (firstName) localStorage.setItem('customer_firstname', firstName);
    if (lastName) localStorage.setItem('customer_lastname', lastName);
    window.dispatchEvent(new Event('storage'));
}
