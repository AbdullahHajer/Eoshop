<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class MerchantPaymentConnection extends Model
{
    use CentralConnection, HasUuids;

    public const PROVIDER_BASGATE = 'basgate';

    protected $guarded = ['*'];

    protected $visible = [
        'provider',
        'environment',
        'state',
        'revision',
        'last_verification_code',
        'last_verified_at',
        'updated_at',
    ];

    protected $hidden = [
        'id',
        'tenant_id',
        'credential_ciphertext',
        'credential_key_version',
        'credential_fingerprint',
        'fingerprint_key_version',
        'created_by_user_id',
        'updated_by_user_id',
        'verified_credential_revision',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'revision' => 'integer',
            'credential_revision' => 'integer',
            'verified_credential_revision' => 'integer',
            'last_verification_attempt_at' => 'immutable_datetime',
            'last_verified_at' => 'immutable_datetime',
            'disabled_at' => 'immutable_datetime',
        ];
    }

    /** @return BelongsTo<Tenant, $this> */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
