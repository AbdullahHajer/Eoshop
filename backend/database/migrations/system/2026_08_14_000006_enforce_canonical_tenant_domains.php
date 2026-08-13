<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $invalidDomainIds = DB::table('domains')
            ->whereRaw(<<<'SQL'
                NOT (
                    domain = lower(domain)
                    AND domain = btrim(domain)
                    AND char_length(domain) BETWEEN 3 AND 253
                    AND domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'
                    AND domain ~ '[a-z]'
                )
            SQL)
            ->limit(20)
            ->pluck('id');

        $duplicateDomains = DB::table('domains')
            ->selectRaw('lower(domain) AS canonical_domain')
            ->groupByRaw('lower(domain)')
            ->havingRaw('count(*) > 1')
            ->limit(20)
            ->pluck('canonical_domain');

        if ($invalidDomainIds->isNotEmpty() || $duplicateDomains->isNotEmpty()) {
            throw new RuntimeException(sprintf(
                'Canonical tenant-domain preflight failed. Invalid domain row IDs: [%s]. Duplicate canonical hosts: [%s]. Correct these central records before retrying the migration.',
                $invalidDomainIds->implode(', '),
                $duplicateDomains->implode(', '),
            ));
        }

        DB::statement(<<<'SQL'
            ALTER TABLE domains
            ADD CONSTRAINT domains_canonical_hostname_check CHECK (
                domain = lower(domain)
                AND domain = btrim(domain)
                AND char_length(domain) BETWEEN 3 AND 253
                AND domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'
                AND domain ~ '[a-z]'
            )
        SQL);
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE domains DROP CONSTRAINT IF EXISTS domains_canonical_hostname_check');
    }
};
