<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable([
    'company_id',
    'name',
    'first_name',
    'last_name',
    'job_title',
    'phone',
    'email',
    'password',
])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    protected static function booted(): void
    {
        // Keep the legacy `name` column populated from first + last name.
        // Existing rows that already set `name` directly continue to work.
        static::saving(function (User $user): void {
            $first = $user->first_name ?? '';
            $last = $user->last_name ?? '';
            $combined = trim($first.' '.$last);

            if ($combined !== '') {
                $user->attributes['name'] = $combined;

                return;
            }

            // No first/last given but `name` is also blank — fall back so the
            // NOT NULL constraint doesn't fire. Prefer the email local-part.
            if (blank($user->attributes['name'] ?? null)) {
                $user->attributes['name'] = $user->email
                    ? strstr($user->email.'@', '@', true)
                    : 'User';
            }
        });
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
