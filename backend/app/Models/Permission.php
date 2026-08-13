<?php

namespace App\Models;

use App\Enums\RoleScope;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class Permission extends Model
{
    use CentralConnection, HasFactory;

    protected $fillable = [
        'key',
        'name',
        'scope',
        'description',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'scope' => RoleScope::class,
        ];
    }

    /**
     * @return BelongsToMany<Role, $this>
     */
    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class)->withPivot('scope');
    }
}
