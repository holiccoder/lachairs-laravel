<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\User;
use Illuminate\Database\Seeder;

class CustomerSeeder extends Seeder
{
    /**
     * Seed a handful of customer accounts so the storefront has realistic
     * users to log in as during local development.
     *
     * Layout:
     *   - "Acme Event Rentals" (approved) — owner + a team member
     *   - "Cypress Catering Co" (approved) — single admin
     *   - "Plaza Productions" (pending) — admin awaiting review
     *   - One standalone user with no company (direct signup path)
     *
     * Every user is created with password = "password" so any of them can be
     * used interchangeably while testing. Emails use the .test TLD so they
     * never collide with real domains and won't trigger outbound mail in dev.
     *
     * The User model hashes password via its $casts and its saving() hook
     * fills the legacy `name` column from first_name + last_name.
     */
    public function run(): void
    {
        $acme = Company::create([
            'name' => 'Acme Event Rentals',
            'legal_name' => 'Acme Event Rentals, LLC',
            'business_type' => 'Event Rental Company',
            'vat_tax_id' => '12-3456789',
            'reseller_id' => 'RS-AC1138',
            'street_address' => '450 Sunset Blvd',
            'city' => 'Los Angeles',
            'state' => 'CA',
            'zip' => '90028',
            'country' => 'United States',
            'phone' => '+1-323-555-0148',
            'status' => 'approved',
        ]);

        User::create([
            'company_id' => $acme->id,
            'first_name' => 'Riley',
            'last_name' => 'Carter',
            'job_title' => 'Owner',
            'phone' => '+1-323-555-0148',
            'email' => 'riley@acme-events.test',
            'password' => 'password',
        ]);

        User::create([
            'company_id' => $acme->id,
            'first_name' => 'Jordan',
            'last_name' => 'Vega',
            'job_title' => 'Operations Manager',
            'phone' => '+1-323-555-0149',
            'email' => 'jordan@acme-events.test',
            'password' => 'password',
        ]);

        $cypress = Company::create([
            'name' => 'Cypress Catering Co',
            'legal_name' => 'Cypress Catering Company, Inc.',
            'business_type' => 'Catering',
            'vat_tax_id' => '98-7654321',
            'street_address' => '88 Magnolia Ave',
            'city' => 'Houston',
            'state' => 'TX',
            'zip' => '77002',
            'country' => 'United States',
            'phone' => '+1-713-555-0162',
            'status' => 'approved',
        ]);

        User::create([
            'company_id' => $cypress->id,
            'first_name' => 'Morgan',
            'last_name' => 'Lee',
            'job_title' => 'Director of Events',
            'phone' => '+1-713-555-0162',
            'email' => 'morgan@cypress-catering.test',
            'password' => 'password',
        ]);

        $plaza = Company::create([
            'name' => 'Plaza Productions',
            'legal_name' => 'Plaza Productions LLC',
            'business_type' => 'Event Planning',
            'street_address' => '17 Bleecker St',
            'city' => 'New York',
            'state' => 'NY',
            'zip' => '10012',
            'country' => 'United States',
            'phone' => '+1-212-555-0179',
            'status' => 'pending',
        ]);

        User::create([
            'company_id' => $plaza->id,
            'first_name' => 'Sasha',
            'last_name' => 'Romero',
            'job_title' => 'Founder',
            'phone' => '+1-212-555-0179',
            'email' => 'sasha@plaza-productions.test',
            'password' => 'password',
        ]);

        // Standalone customer — no company attached. Mimics a direct signup
        // before B2B onboarding completes (or a personal-use buyer).
        User::create([
            'first_name' => 'Casey',
            'last_name' => 'Nguyen',
            'phone' => '+1-415-555-0103',
            'email' => 'casey@example.test',
            'password' => 'password',
        ]);
    }
}
