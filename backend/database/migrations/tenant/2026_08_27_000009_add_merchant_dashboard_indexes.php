<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public $withinTransaction = true;

    public function up(): void
    {
        DB::statement('CREATE INDEX orders_created_at_id_index ON orders (created_at DESC, id DESC)');
        DB::statement('CREATE INDEX orders_status_completed_at_index ON orders (status, completed_at) WHERE completed_at IS NOT NULL');
        DB::statement('CREATE INDEX products_status_index ON products (status)');
        DB::statement("CREATE INDEX products_managed_active_inventory_index ON products (status) WHERE manage_stock = true AND status <> 'archived'");
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS products_managed_active_inventory_index');
        DB::statement('DROP INDEX IF EXISTS products_status_index');
        DB::statement('DROP INDEX IF EXISTS orders_status_completed_at_index');
        DB::statement('DROP INDEX IF EXISTS orders_created_at_id_index');
    }
};
