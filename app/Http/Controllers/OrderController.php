<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class OrderController extends Controller
{
    /**
     * Persist a customer order from the React Checkout page.
     *
     * Auth in the frontend is currently localStorage-only (no real session yet
     * — see RegistrationController), so we trust the client-supplied email to
     * link the order to a User when it matches an existing account; otherwise
     * the order is recorded as a guest checkout (`user_id = null`).
     *
     * Prices are recomputed server-side from the DB to keep the client honest.
     * Line items go to the dedicated `order_items` table so they can be queried
     * properly later (admin views, analytics, "reorder" flows).
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.sku' => ['required', 'string'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
            'items.*.selectedOptions' => ['nullable', 'array'],

            'shippingAddress' => ['required', 'array'],
            'shippingAddress.firstname' => ['required', 'string', 'max:100'],
            'shippingAddress.lastname' => ['required', 'string', 'max:100'],
            'shippingAddress.street' => ['required'],
            'shippingAddress.city' => ['required', 'string', 'max:120'],
            'shippingAddress.region_code' => ['required', 'string', 'max:10'],
            'shippingAddress.postcode' => ['required', 'string', 'max:20'],
            'shippingAddress.country_id' => ['nullable', 'string', 'max:10'],
            'shippingAddress.telephone' => ['nullable', 'string', 'max:30'],

            'customerEmail' => ['required', 'email:rfc', 'max:255'],
            'customerFirstName' => ['nullable', 'string', 'max:100'],
            'customerLastName' => ['nullable', 'string', 'max:100'],
        ]);

        // Pull every requested SKU in a single query and key them for lookup.
        $skus = collect($data['items'])->pluck('sku')->unique()->values()->all();
        $products = Product::whereIn('sku', $skus)->get()->keyBy('sku');

        $missing = array_values(array_diff($skus, $products->keys()->all()));
        if (! empty($missing)) {
            return response()->json([
                'success' => false,
                'error' => 'Unknown product(s): '.implode(', ', $missing),
            ], 422);
        }

        $lineItems = [];
        $subtotal = 0.0;
        foreach ($data['items'] as $row) {
            /** @var Product $product */
            $product = $products->get($row['sku']);
            $price = (float) $product->price;
            $qty = (int) $row['qty'];
            $line = round($price * $qty, 2);
            $subtotal += $line;
            $lineItems[] = [
                'product_id' => $product->id,
                'sku' => $product->sku,
                'name' => $product->name,
                'price' => $price,
                'qty' => $qty,
                'line_total' => $line,
                'selected_options' => $row['selectedOptions'] ?? [],
            ];
        }

        $subtotal = round($subtotal, 2);
        // Keep tax + shipping at zero for now — the Checkout summary only shows
        // a subtotal ("Shipping & taxes calculated at checkout") so anything
        // we'd compute here would be made up.
        $tax = 0.0;
        $shippingFee = 0.0;
        $total = round($subtotal + $tax + $shippingFee, 2);

        $addr = $data['shippingAddress'];
        $streetLines = is_array($addr['street']) ? $addr['street'] : [$addr['street']];

        $email = strtolower(trim($data['customerEmail']));
        $userId = User::where('email', $email)->value('id');

        $firstName = $data['customerFirstName'] ?? $addr['firstname'];
        $lastName = $data['customerLastName'] ?? $addr['lastname'];

        $order = DB::transaction(function () use ($userId, $email, $firstName, $lastName, $addr, $streetLines, $subtotal, $tax, $shippingFee, $total, $lineItems) {
            $order = Order::create([
                'user_id' => $userId,
                'order_number' => $this->generateOrderNumber(),
                'customer_name' => trim($firstName.' '.$lastName),
                'customer_email' => $email,
                'customer_phone' => $addr['telephone'] ?? null,
                'shipping_address' => json_encode([
                    'firstname' => $addr['firstname'],
                    'lastname' => $addr['lastname'],
                    'street' => $streetLines,
                    'city' => $addr['city'],
                    'region_code' => $addr['region_code'],
                    'postcode' => $addr['postcode'],
                    'country_id' => $addr['country_id'] ?? 'US',
                    'telephone' => $addr['telephone'] ?? null,
                ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                'subtotal' => $subtotal,
                'tax' => $tax,
                'shipping_fee' => $shippingFee,
                'total' => $total,
                'status' => 'pending',
                'payment_status' => 'unpaid',
            ]);

            $order->items()->createMany($lineItems);

            return $order;
        });

        return response()->json([
            'success' => true,
            'orderId' => $order->order_number,
        ], 201);
    }

    /**
     * Return the order history for the supplied customer email.
     *
     * Used by the React Dashboard "My Orders" tab. Auth is localStorage-only
     * for now (see RegistrationController), so the email is trusted from the
     * client — swap this for `Auth::id()` when a real session lands.
     *
     * Response is shaped to match the Magento-style fields the existing
     * dashboard renderer reads (entity_id / increment_id / created_at /
     * total_item_count / grand_total / order_currency_code / status) so we
     * don't have to touch the table markup.
     */
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email:rfc', 'max:255'],
        ]);

        $email = strtolower(trim($data['email']));

        $orders = Order::with('items')
            ->where('customer_email', $email)
            ->latest()
            ->get()
            ->map(fn (Order $o) => [
                'entity_id' => $o->id,
                'increment_id' => $o->order_number,
                'created_at' => $o->created_at?->toDateTimeString(),
                'total_item_count' => (int) $o->items->sum('qty'),
                'grand_total' => (float) $o->total,
                'order_currency_code' => 'USD',
                'status' => $o->status,
            ]);

        return response()->json($orders);
    }

    protected function generateOrderNumber(): string
    {
        // ORD-XXXXXXXXXX with collision retry; the column is unique so a dup
        // would otherwise blow up the insert.
        do {
            $candidate = 'ORD-'.strtoupper(Str::random(10));
        } while (Order::where('order_number', $candidate)->exists());

        return $candidate;
    }
}
