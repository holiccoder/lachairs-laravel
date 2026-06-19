import {
    createContext,
    useContext,
    useReducer,
    useEffect,
    useState,
    useCallback,
    useMemo,
} from 'react';

function buildCartItemId(productId, options) {
    const keys = Object.keys(options).sort();
    if (keys.length === 0) return String(productId);
    const optionStr = keys.map((k) => `${k}:${options[k]}`).join('|');
    return `${productId}__${optionStr}`;
}

function cartReducer(state, action) {
    switch (action.type) {
        case 'ADD_ITEM': {
            const id = buildCartItemId(
                action.payload.productId,
                action.payload.selectedOptions,
            );
            const existing = state.items.find((item) => item.id === id);
            if (existing) {
                return {
                    ...state,
                    items: state.items.map((item) =>
                        item.id === id
                            ? { ...item, quantity: item.quantity + action.payload.quantity }
                            : item,
                    ),
                };
            }
            return { ...state, items: [...state.items, { ...action.payload, id }] };
        }
        case 'REMOVE_ITEM':
            return {
                ...state,
                items: state.items.filter((item) => item.id !== action.payload.id),
            };
        case 'UPDATE_QUANTITY': {
            if (action.payload.quantity <= 0) {
                return {
                    ...state,
                    items: state.items.filter((item) => item.id !== action.payload.id),
                };
            }
            return {
                ...state,
                items: state.items.map((item) =>
                    item.id === action.payload.id
                        ? { ...item, quantity: action.payload.quantity }
                        : item,
                ),
            };
        }
        case 'CLEAR_CART':
            return { ...state, items: [] };
        case 'SET_DRAWER_OPEN':
            return { ...state, isDrawerOpen: action.payload };
        case 'SHOW_TOAST':
            return { ...state, toastMessage: action.payload };
        case 'HIDE_TOAST':
            return { ...state, toastMessage: null };
        case 'LOAD_CART':
            return { ...state, items: action.payload };
        default:
            return state;
    }
}

const initialState = {
    items: [],
    isDrawerOpen: false,
    toastMessage: null,
};

const CartContext = createContext(null);

export function CartProvider({ children }) {
    const [state, dispatch] = useReducer(cartReducer, initialState);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        try {
            const saved = localStorage.getItem('lachairs_cart');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    dispatch({ type: 'LOAD_CART', payload: parsed });
                }
            }
        } catch {
            // Corrupt data — start fresh.
        }
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (hydrated) {
            localStorage.setItem('lachairs_cart', JSON.stringify(state.items));
        }
    }, [state.items, hydrated]);

    useEffect(() => {
        const handler = (e) => {
            if (e.key === 'lachairs_cart') {
                try {
                    const parsed = e.newValue ? JSON.parse(e.newValue) : [];
                    if (Array.isArray(parsed)) {
                        dispatch({ type: 'LOAD_CART', payload: parsed });
                    }
                } catch {
                    // ignore
                }
            }
        };
        window.addEventListener('storage', handler);
        return () => window.removeEventListener('storage', handler);
    }, []);

    useEffect(() => {
        if (!state.toastMessage) return;
        const timer = setTimeout(() => dispatch({ type: 'HIDE_TOAST' }), 3000);
        return () => clearTimeout(timer);
    }, [state.toastMessage]);

    useEffect(() => {
        const handler = (e) => {
            if (e.key === 'Escape' && state.isDrawerOpen) {
                dispatch({ type: 'SET_DRAWER_OPEN', payload: false });
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [state.isDrawerOpen]);

    const addItem = useCallback((item) => {
        dispatch({ type: 'ADD_ITEM', payload: item });
        dispatch({
            type: 'SHOW_TOAST',
            payload: { productName: item.name, image: item.image },
        });
    }, []);

    const removeItem = useCallback((id) => {
        dispatch({ type: 'REMOVE_ITEM', payload: { id } });
    }, []);

    const updateQuantity = useCallback((id, quantity) => {
        dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } });
    }, []);

    const clearCart = useCallback(() => {
        dispatch({ type: 'CLEAR_CART' });
    }, []);

    const toggleDrawer = useCallback(
        (open) => {
            if (open !== undefined) {
                dispatch({ type: 'SET_DRAWER_OPEN', payload: open });
            } else {
                dispatch({ type: 'SET_DRAWER_OPEN', payload: !state.isDrawerOpen });
            }
        },
        [state.isDrawerOpen],
    );

    const isInCart = useCallback(
        (productId, options) => {
            const id = buildCartItemId(productId, options ?? {});
            return state.items.some((item) => item.id === id);
        },
        [state.items],
    );

    const itemCount = useMemo(
        () => state.items.reduce((sum, item) => sum + item.quantity, 0),
        [state.items],
    );

    const subtotal = useMemo(
        () => state.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
        [state.items],
    );

    const value = useMemo(
        () => ({
            items: state.items,
            isDrawerOpen: state.isDrawerOpen,
            toastMessage: state.toastMessage,
            itemCount,
            subtotal,
            addItem,
            removeItem,
            updateQuantity,
            clearCart,
            toggleDrawer,
            isInCart,
        }),
        [
            state.items,
            state.isDrawerOpen,
            state.toastMessage,
            itemCount,
            subtotal,
            addItem,
            removeItem,
            updateQuantity,
            clearCart,
            toggleDrawer,
            isInCart,
        ],
    );

    return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
    const ctx = useContext(CartContext);
    if (!ctx) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return ctx;
}
