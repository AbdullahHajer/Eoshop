<?php

namespace App\Models;

use App\Support\CanonicalDomain;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use InvalidArgumentException;
use Stancl\Tenancy\Database\Models\Domain as BaseDomain;

class Domain extends BaseDomain
{
    protected $guarded = [];

    /**
     * @return BelongsTo<Tenant, $this>
     */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    protected function domain(): Attribute
    {
        return Attribute::make(
            set: function (string $value): string {
                $domain = CanonicalDomain::normalize($value);

                if (filter_var($domain, FILTER_VALIDATE_IP) !== false
                    || in_array($domain, config('tenancy.central_domains', []), true)
                ) {
                    throw new InvalidArgumentException('A central platform domain cannot be assigned to a tenant.');
                }

                return $domain;
            },
        );
    }
}
