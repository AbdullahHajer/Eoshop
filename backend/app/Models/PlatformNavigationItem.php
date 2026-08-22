<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class PlatformNavigationItem extends Model
{
    use CentralConnection;

    public $timestamps = false;

    public $incrementing = false;

    protected $primaryKey = 'item_key';

    protected $keyType = 'string';

    protected $fillable = ['platform_setting_id', 'item_key', 'label', 'is_visible', 'position'];

    protected function casts(): array
    {
        return [
            'is_visible' => 'boolean',
            'position' => 'integer',
        ];
    }
}
