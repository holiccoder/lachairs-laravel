<?php

namespace Database\Seeders;

use App\Models\Admin;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        User::factory()->create([
            'name' => 'Test User',
            'first_name' => 'Test',
            'last_name' => 'User',
            'email' => 'test@example.com',
        ]);

        Admin::create([
            'name' => 'Admin',
            'email' => 'admin@lachairs.com',
            'password' => Hash::make('password'),
        ]);

        $this->call([
            ProductCategorySeeder::class,
            PlasticFoldingChairsSeeder::class,
            CustomerSeeder::class,
        ]);
    }
}
