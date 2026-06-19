<?php

namespace App\Http\Controllers;

use App\Models\Company;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RegistrationController extends Controller
{
    /**
     * Persist a B2B "Apply for a Wholesale Account" submission.
     *
     * Creates a Company (status=pending) plus the administrator User in a
     * single transaction, returning a JSON envelope the React Register page
     * already understands. The frontend then auto-logs the user in via the
     * existing stub login flow.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            // Company
            'companyName' => ['required', 'string', 'max:255'],
            'companyLegalName' => ['nullable', 'string', 'max:255'],
            'businessType' => ['required', 'string', 'max:100'],
            'vatTaxId' => ['nullable', 'string', 'max:100'],
            'resellerId' => ['nullable', 'string', 'max:100'],

            // Legal address
            'streetAddress' => ['required', 'string', 'max:255'],
            'streetAddress2' => ['nullable', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:100'],
            'state' => ['required', 'string', 'max:64'],
            'zip' => ['required', 'string', 'max:32'],
            'country' => ['required', 'string', 'max:64'],
            'phone' => ['required', 'string', 'max:32'],

            // Administrator
            'jobTitle' => ['nullable', 'string', 'max:120'],
            'adminEmail' => ['required', 'email:rfc', 'max:255', 'unique:users,email'],
            'firstName' => ['required', 'string', 'max:100'],
            'lastName' => ['required', 'string', 'max:100'],
            'password' => ['required', 'string', 'min:8', 'max:255'],
            'passwordConfirm' => ['required', 'same:password'],
        ]);

        $email = strtolower(trim($data['adminEmail']));

        $user = DB::transaction(function () use ($data, $email) {
            $company = Company::create([
                'name' => $data['companyName'],
                'legal_name' => $data['companyLegalName'] ?? null,
                'business_type' => $data['businessType'],
                'vat_tax_id' => $data['vatTaxId'] ?? null,
                'reseller_id' => $data['resellerId'] ?? null,
                'street_address' => $data['streetAddress'],
                'street_address_2' => $data['streetAddress2'] ?? null,
                'city' => $data['city'],
                'state' => $data['state'],
                'zip' => $data['zip'],
                'country' => $data['country'],
                'phone' => $data['phone'],
                'status' => 'pending',
            ]);

            // The User model hashes `password` via its $casts, and its saving()
            // hook keeps the legacy `name` column populated from first/last.
            return User::create([
                'company_id' => $company->id,
                'first_name' => $data['firstName'],
                'last_name' => $data['lastName'],
                'job_title' => $data['jobTitle'] ?? null,
                'phone' => $data['phone'],
                'email' => $email,
                'password' => $data['password'],
            ]);
        });

        return response()->json([
            'success' => true,
            'customerId' => $user->id,
            // Opaque token the React useAuth() hook stores in localStorage. Not
            // a real session/Sanctum token yet — the existing auth layer is
            // localStorage-only — but a stable per-registration value lets the
            // page transition straight to the dashboard.
            'token' => Str::random(40),
        ]);
    }
}
