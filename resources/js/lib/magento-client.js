/* -------------------------------------------------------------------------- */
/*  Stub Customer Client                                                       */
/*                                                                             */
/*  Replaces the live Magento REST calls with a fake in-memory implementation  */
/*  so the front-end can run without a backend. Customer login/registration/   */
/*  orders/profile are all simulated.                                          */
/* -------------------------------------------------------------------------- */

const FAKE_CUSTOMER = {
    id: 1,
    firstname: 'Demo',
    lastname: 'User',
    email: 'demo@example.com',
    addresses: [
        {
            id: 1,
            firstname: 'Demo',
            lastname: 'User',
            street: ['628 Shoppers Ln'],
            city: 'Covina',
            region: { region_code: 'CA', region: 'California' },
            postcode: '91723',
            country_id: 'US',
            telephone: '972-835-1856',
            default_billing: true,
            default_shipping: true,
        },
    ],
};

const FAKE_ORDERS = [
    {
        entity_id: 1001,
        increment_id: '000000123',
        created_at: '2026-05-20 10:24:00',
        total_item_count: 4,
        grand_total: 248.5,
        order_currency_code: 'USD',
        status: 'complete',
    },
    {
        entity_id: 1002,
        increment_id: '000000124',
        created_at: '2026-06-05 14:11:00',
        total_item_count: 2,
        grand_total: 89.0,
        order_currency_code: 'USD',
        status: 'processing',
    },
];

const FAKE_TOKEN = 'fake-demo-token';

export async function loginCustomer(email, password) {
    // Accept any non-empty pair in stub mode.
    await new Promise((r) => setTimeout(r, 200));
    if (!email || !password) {
        return { success: false, error: 'Please enter email and password.' };
    }
    return { success: true, token: FAKE_TOKEN };
}

export async function registerCompany(form) {
    try {
        const csrf = document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute('content');

        const res = await fetch('/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                ...(csrf ? { 'X-CSRF-TOKEN': csrf } : {}),
            },
            credentials: 'same-origin',
            body: JSON.stringify(form),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data.success) {
            // Laravel ValidationException returns { message, errors: { field: [..] } }.
            const firstFieldError = data?.errors
                ? Object.values(data.errors)[0]?.[0]
                : null;
            return {
                success: false,
                error:
                    firstFieldError ||
                    data?.message ||
                    'Registration failed. Please try again.',
            };
        }

        return {
            success: true,
            customerId: data.customerId,
            token: data.token,
        };
    } catch (err) {
        return {
            success: false,
            error: 'Network error. Please try again in a moment.',
        };
    }
}

export async function getCustomerProfile(token) {
    await new Promise((r) => setTimeout(r, 100));
    if (!token) return null;
    return FAKE_CUSTOMER;
}

export async function updateCustomerProfile(token, payload) {
    await new Promise((r) => setTimeout(r, 200));
    if (!token) return false;
    // Pretend we saved it.
    Object.assign(FAKE_CUSTOMER, payload);
    return true;
}

export async function updateCustomerAddress(token, addressId, payload) {
    await new Promise((r) => setTimeout(r, 200));
    if (!token) return false;
    const addr = FAKE_CUSTOMER.addresses.find((a) => a.id === addressId);
    if (!addr) return false;
    Object.assign(addr, {
        firstname: payload.firstname ?? addr.firstname,
        lastname: payload.lastname ?? addr.lastname,
        street: payload.street ? [payload.street] : addr.street,
        city: payload.city ?? addr.city,
        region: {
            ...addr.region,
            region_code: payload.region_code ?? addr.region.region_code,
            region: payload.region ?? addr.region.region,
        },
        postcode: payload.postcode ?? addr.postcode,
        country_id: payload.country_id ?? addr.country_id,
        telephone: payload.telephone ?? addr.telephone,
    });
    return true;
}

export async function getCustomerOrders(token, email) {
    if (!token || !email) return [];

    try {
        const res = await fetch(
            `/customer/orders?email=${encodeURIComponent(email)}`,
            {
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
            },
        );
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

export async function placeOrder(token, payload) {
    if (!token) return { success: false, error: 'Not logged in.' };
    if (!payload?.items?.length) {
        return { success: false, error: 'Cart is empty.' };
    }

    try {
        const csrf = document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute('content');

        const res = await fetch('/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                ...(csrf ? { 'X-CSRF-TOKEN': csrf } : {}),
            },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data.success) {
            // Laravel validation: { message, errors: { field: [..] } }
            const firstFieldError = data?.errors
                ? Object.values(data.errors)[0]?.[0]
                : null;
            return {
                success: false,
                error:
                    firstFieldError ||
                    data?.error ||
                    data?.message ||
                    'Failed to place order. Please try again.',
            };
        }

        return { success: true, orderId: data.orderId };
    } catch (err) {
        return {
            success: false,
            error: 'Network error. Please try again in a moment.',
        };
    }
}
