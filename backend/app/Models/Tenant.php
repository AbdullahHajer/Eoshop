<?php

namespace App\Models;

use Stancl\Tenancy\Database\Models\Tenant as BaseTenant;
use Stancl\Tenancy\Contracts\TenantWithDatabase;
use Stancl\Tenancy\Database\Concerns\HasDatabase;
use Stancl\Tenancy\Database\Concerns\HasDomains;

class Tenant extends BaseTenant implements TenantWithDatabase
{
    use HasDatabase, HasDomains;

    protected $guarded = [];

    public static function getCustomColumns(): array
    {
        return [
            'id',
            'store_name',
            'owner_name',
            'owner_email',
            'owner_phone',
            'business_type',
            'verification_status',
            'rejection_reason',
            'theme_style',
            'created_at',
            'updated_at',
        ];
    }
}
