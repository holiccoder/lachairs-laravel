<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // The original migration used `notes` to stash line-item JSON before
            // the dedicated `order_items` table existed. That data was backfilled
            // into order_items, so the column has no remaining purpose.
            $table->dropColumn('notes');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->text('notes')->nullable();
        });
    }
};
