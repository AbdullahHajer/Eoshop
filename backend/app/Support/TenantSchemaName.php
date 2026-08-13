<?php

namespace App\Support;

final class TenantSchemaName
{
    public static function for(string $tenantId): string
    {
        $slug = strtolower((string) preg_replace('/[^a-zA-Z0-9]+/', '_', $tenantId));
        $slug = trim($slug, '_');
        $slug = substr($slug !== '' ? $slug : 'tenant', 0, 30);
        $hash = substr(hash('sha256', $tenantId), 0, 16);

        return 'tenant_'.$slug.'_'.$hash;
    }
}
