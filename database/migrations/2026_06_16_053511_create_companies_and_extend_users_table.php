<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->id();
            $table->string('name');                    // Company name (display)
            $table->string('legal_name')->nullable();  // Company legal name
            $table->string('business_type')->nullable();
            $table->string('vat_tax_id')->nullable();
            $table->string('reseller_id')->nullable();

            // Legal address
            $table->string('street_address');
            $table->string('street_address_2')->nullable();
            $table->string('city');
            $table->string('state', 64);
            $table->string('zip', 32);
            $table->string('country', 64)->default('United States');
            $table->string('phone', 32);

            $table->string('status')->default('pending'); // pending | approved | rejected
            $table->timestamps();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('company_id')
                ->nullable()
                ->after('id')
                ->constrained('companies')
                ->nullOnDelete();

            $table->string('first_name')->nullable()->after('name');
            $table->string('last_name')->nullable()->after('first_name');
            $table->string('job_title')->nullable()->after('last_name');
            $table->string('phone', 32)->nullable()->after('job_title');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('company_id');
            $table->dropColumn(['first_name', 'last_name', 'job_title', 'phone']);
        });

        Schema::dropIfExists('companies');
    }
};
