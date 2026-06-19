<?php

namespace App\Http\Controllers;

use App\Models\NewsletterSubscriber;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NewsletterController extends Controller
{
    /**
     * Persist a newsletter subscription. Idempotent on duplicate emails so
     * re-subscribing still reports success without flooding the table.
     */
    public function subscribe(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email:rfc', 'max:255'],
        ]);

        $email = strtolower(trim($data['email']));

        $subscriber = NewsletterSubscriber::firstOrCreate(
            ['email' => $email],
            ['subscribed_at' => now()],
        );

        return response()->json([
            'success' => true,
            'already_subscribed' => ! $subscriber->wasRecentlyCreated,
        ]);
    }
}
