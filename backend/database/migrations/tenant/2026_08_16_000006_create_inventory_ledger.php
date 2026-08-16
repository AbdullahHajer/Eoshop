<?php

use App\Enums\InventoryActorType;
use App\Enums\InventoryMovementKind;
use App\Enums\InventoryOperationKind;
use App\Support\InventoryIdentity;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public $withinTransaction = true;

    public function up(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            $table->unsignedInteger('reserved_quantity')->default(0);
            $table->unsignedBigInteger('inventory_revision')->default(1);
        });

        Schema::create('inventory_operations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('kind', 40);
            $table->string('idempotency_scope', 100);
            $table->uuid('idempotency_key');
            $table->char('request_fingerprint', 64);
            $table->string('actor_type', 10);
            $table->char('actor_user_id', 26)->nullable();
            $table->string('source', 50);
            $table->string('reason_code', 64);
            $table->string('note', 500)->nullable();
            $table->uuid('request_id')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->unique(['kind', 'idempotency_scope', 'idempotency_key'], 'inventory_operations_idempotency_unique');
        });

        Schema::create('inventory_reservations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('status', 16);
            $table->string('reference_type', 50);
            $table->string('reference_id', 100);
            $table->timestampTz('expires_at');
            $table->uuid('created_by_operation_id')->unique();
            $table->uuid('terminal_operation_id')->nullable()->unique();
            $table->timestampTz('terminal_at')->nullable();
            $table->timestampsTz();
            $table->foreign('created_by_operation_id')->references('id')->on('inventory_operations')->restrictOnDelete();
            $table->foreign('terminal_operation_id')->references('id')->on('inventory_operations')->restrictOnDelete();
            $table->unique(['reference_type', 'reference_id'], 'inventory_reservations_reference_unique');
            $table->index(['status', 'expires_at']);
        });

        Schema::create('inventory_reservation_items', function (Blueprint $table): void {
            $table->uuid('reservation_id');
            $table->uuid('product_id');
            $table->unsignedInteger('quantity');
            $table->primary(['reservation_id', 'product_id']);
            $table->foreign('reservation_id')->references('id')->on('inventory_reservations')->restrictOnDelete();
            $table->foreign('product_id')->references('id')->on('products')->restrictOnDelete();
        });

        Schema::create('inventory_movements', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('operation_id');
            $table->uuid('product_id');
            $table->uuid('reservation_id')->nullable();
            $table->string('kind', 20);
            $table->integer('before_on_hand');
            $table->integer('before_reserved');
            $table->integer('on_hand_delta');
            $table->integer('reserved_delta');
            $table->integer('after_on_hand');
            $table->integer('after_reserved');
            $table->unsignedBigInteger('before_inventory_revision');
            $table->unsignedBigInteger('after_inventory_revision');
            $table->timestampTz('created_at')->useCurrent();
            $table->foreign('operation_id')->references('id')->on('inventory_operations')->restrictOnDelete();
            $table->foreign('product_id')->references('id')->on('products')->restrictOnDelete();
            $table->foreign(['reservation_id', 'product_id'], 'inventory_movements_reservation_item_foreign')
                ->references(['reservation_id', 'product_id'])->on('inventory_reservation_items')->restrictOnDelete();
            $table->unique(['operation_id', 'product_id'], 'inventory_movements_operation_product_unique');
            $table->index(['product_id', 'created_at']);
            $table->index(['reservation_id', 'created_at']);
        });

        Schema::create('inventory_policy_changes', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('operation_id');
            $table->uuid('product_id');
            $table->boolean('before_manage_stock');
            $table->boolean('after_manage_stock');
            $table->unsignedInteger('before_low_stock_threshold');
            $table->unsignedInteger('after_low_stock_threshold');
            $table->unsignedBigInteger('before_inventory_revision');
            $table->unsignedBigInteger('after_inventory_revision');
            $table->timestampTz('created_at')->useCurrent();
            $table->foreign('operation_id')->references('id')->on('inventory_operations')->restrictOnDelete();
            $table->foreign('product_id')->references('id')->on('products')->restrictOnDelete();
            $table->unique(['operation_id', 'product_id'], 'inventory_policy_operation_product_unique');
        });

        Schema::create('inventory_application_receipts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('operation_id');
            $table->uuid('product_id');
            $table->uuid('movement_id')->nullable()->unique();
            $table->uuid('policy_change_id')->nullable()->unique();
            $table->timestampTz('created_at')->useCurrent();
            $table->foreign('operation_id')->references('id')->on('inventory_operations')->restrictOnDelete();
            $table->foreign('product_id')->references('id')->on('products')->restrictOnDelete();
            $table->foreign('movement_id')->references('id')->on('inventory_movements')->restrictOnDelete();
            $table->foreign('policy_change_id')->references('id')->on('inventory_policy_changes')->restrictOnDelete();
            $table->unique(['operation_id', 'product_id'], 'inventory_receipts_operation_product_unique');
        });

        Schema::create('inventory_operation_results', function (Blueprint $table): void {
            $table->uuid('operation_id')->primary();
            $table->jsonb('response_json');
            $table->timestampTz('created_at')->useCurrent();
            $table->foreign('operation_id')->references('id')->on('inventory_operations')->restrictOnDelete();
        });

        DB::statement('ALTER TABLE products ADD CONSTRAINT products_inventory_revision_positive CHECK (inventory_revision > 0)');
        DB::statement('ALTER TABLE products ADD CONSTRAINT products_inventory_balances_valid CHECK (stock_quantity >= 0 AND reserved_quantity >= 0 AND reserved_quantity <= stock_quantity)');
        DB::statement("ALTER TABLE inventory_operations ADD CONSTRAINT inventory_operations_kind_valid CHECK (kind IN ('opening','manual_adjustment','policy_update','reservation_create','reservation_release','reservation_commit','reservation_expire'))");
        DB::statement("ALTER TABLE inventory_operations ADD CONSTRAINT inventory_operations_actor_valid CHECK ((actor_type = 'user' AND actor_user_id IS NOT NULL) OR (actor_type = 'system' AND actor_user_id IS NULL))");
        DB::statement("ALTER TABLE inventory_operations ADD CONSTRAINT inventory_operations_fingerprint_valid CHECK (request_fingerprint ~ '^[0-9a-f]{64}$')");
        DB::statement("ALTER TABLE inventory_reservations ADD CONSTRAINT inventory_reservations_status_valid CHECK (status IN ('active','committed','released','expired'))");
        DB::statement("ALTER TABLE inventory_reservations ADD CONSTRAINT inventory_reservations_terminal_valid CHECK ((status = 'active' AND terminal_operation_id IS NULL AND terminal_at IS NULL) OR (status IN ('committed','released','expired') AND terminal_operation_id IS NOT NULL AND terminal_at IS NOT NULL))");
        DB::statement("ALTER TABLE inventory_reservations ADD CONSTRAINT inventory_reservations_ttl_valid CHECK (expires_at >= created_at + interval '1 minute' AND expires_at <= created_at + interval '30 minutes')");
        DB::statement('ALTER TABLE inventory_reservation_items ADD CONSTRAINT inventory_reservation_items_quantity_positive CHECK (quantity > 0)');
        DB::statement('ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_balances_valid CHECK (before_on_hand >= 0 AND before_reserved >= 0 AND before_reserved <= before_on_hand AND after_on_hand >= 0 AND after_reserved >= 0 AND after_reserved <= after_on_hand)');
        DB::statement('ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_equation_valid CHECK (after_on_hand = before_on_hand + on_hand_delta AND after_reserved = before_reserved + reserved_delta)');
        DB::statement('ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_revision_valid CHECK (before_inventory_revision > 0 AND after_inventory_revision >= before_inventory_revision AND after_inventory_revision <= before_inventory_revision + 1)');
        DB::statement(<<<'SQL'
            ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_kind_delta_valid CHECK (
                (kind = 'opening' AND before_on_hand = 0 AND before_reserved = 0 AND on_hand_delta >= 0 AND reserved_delta = 0 AND after_inventory_revision = before_inventory_revision)
                OR (kind IN ('receive','return') AND on_hand_delta > 0 AND reserved_delta = 0 AND after_inventory_revision = before_inventory_revision + 1)
                OR (kind = 'issue' AND on_hand_delta < 0 AND reserved_delta = 0 AND after_inventory_revision = before_inventory_revision + 1)
                OR (kind = 'correction' AND on_hand_delta <> 0 AND reserved_delta = 0 AND after_inventory_revision = before_inventory_revision + 1)
                OR (kind = 'reserve' AND on_hand_delta = 0 AND reserved_delta > 0 AND after_inventory_revision = before_inventory_revision + 1)
                OR (kind IN ('release','expire') AND on_hand_delta = 0 AND reserved_delta < 0 AND after_inventory_revision = before_inventory_revision + 1)
                OR (kind = 'commit' AND on_hand_delta < 0 AND reserved_delta = on_hand_delta AND after_inventory_revision = before_inventory_revision + 1)
            )
            SQL);
        DB::statement("ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_reservation_valid CHECK ((kind IN ('reserve','release','commit','expire') AND reservation_id IS NOT NULL) OR (kind IN ('opening','receive','issue','return','correction') AND reservation_id IS NULL))");
        DB::statement('ALTER TABLE inventory_policy_changes ADD CONSTRAINT inventory_policy_revision_valid CHECK (after_inventory_revision = before_inventory_revision + 1)');
        DB::statement('ALTER TABLE inventory_policy_changes ADD CONSTRAINT inventory_policy_changed CHECK (before_manage_stock <> after_manage_stock OR before_low_stock_threshold <> after_low_stock_threshold)');
        DB::statement('ALTER TABLE inventory_application_receipts ADD CONSTRAINT inventory_receipts_subject_valid CHECK ((movement_id IS NOT NULL)::int + (policy_change_id IS NOT NULL)::int = 1)');
        DB::statement("CREATE UNIQUE INDEX inventory_movements_one_opening_per_product ON inventory_movements (product_id) WHERE kind = 'opening'");

        $this->createGuardFunctions();
        $this->adoptOpeningBalances();
        $this->createGuardTriggers();
    }

    public function down(): void
    {
        if (Schema::hasTable('inventory_operations') && DB::table('inventory_operations')->exists()) {
            throw new RuntimeException('Refusing to erase authoritative inventory operations, movements or opening provenance.');
        }

        DB::unprepared('DROP TRIGGER IF EXISTS inventory_products_opening_required ON products');
        DB::unprepared('DROP TRIGGER IF EXISTS inventory_products_guarded_update ON products');
        DB::unprepared('DROP TRIGGER IF EXISTS inventory_reservations_guarded_update ON inventory_reservations');
        DB::unprepared('DROP TRIGGER IF EXISTS inventory_reservations_items_required ON inventory_reservations');
        DB::unprepared('DROP TRIGGER IF EXISTS inventory_reservations_consistent ON inventory_reservations');
        DB::unprepared('DROP TRIGGER IF EXISTS inventory_movements_kind_consistent ON inventory_movements');
        DB::unprepared('DROP TRIGGER IF EXISTS inventory_reservation_items_guarded_insert ON inventory_reservation_items');
        DB::unprepared('DROP TRIGGER IF EXISTS inventory_policy_changes_consistent ON inventory_policy_changes');
        DB::unprepared('DROP TRIGGER IF EXISTS inventory_reservation_items_consistent ON inventory_reservation_items');
        DB::unprepared('DROP TRIGGER IF EXISTS inventory_receipts_trigger_only_insert ON inventory_application_receipts');
        foreach (['inventory_operations', 'inventory_movements', 'inventory_reservation_items', 'inventory_policy_changes', 'inventory_application_receipts', 'inventory_operation_results'] as $table) {
            DB::unprepared("DROP TRIGGER IF EXISTS inventory_{$table}_immutable ON {$table}");
        }
        DB::unprepared('DROP FUNCTION IF EXISTS inventory_require_opening_movement()');
        DB::unprepared('DROP FUNCTION IF EXISTS inventory_guard_product_update()');
        DB::unprepared('DROP FUNCTION IF EXISTS inventory_guard_reservation_update()');
        DB::unprepared('DROP FUNCTION IF EXISTS inventory_require_reservation_items()');
        DB::unprepared('DROP FUNCTION IF EXISTS inventory_validate_reservation()');
        DB::unprepared('DROP FUNCTION IF EXISTS inventory_validate_movement_kind()');
        DB::unprepared('DROP FUNCTION IF EXISTS inventory_guard_reservation_item_insert()');
        DB::unprepared('DROP FUNCTION IF EXISTS inventory_validate_policy_change()');
        DB::unprepared('DROP FUNCTION IF EXISTS inventory_validate_reservation_item()');
        DB::unprepared('DROP FUNCTION IF EXISTS inventory_guard_receipt_insert()');
        DB::unprepared('DROP FUNCTION IF EXISTS inventory_prevent_immutable_mutation()');

        Schema::dropIfExists('inventory_operation_results');
        Schema::dropIfExists('inventory_application_receipts');
        Schema::dropIfExists('inventory_policy_changes');
        Schema::dropIfExists('inventory_movements');
        Schema::dropIfExists('inventory_reservation_items');
        Schema::dropIfExists('inventory_reservations');
        Schema::dropIfExists('inventory_operations');
        DB::statement('ALTER TABLE products DROP CONSTRAINT IF EXISTS products_inventory_balances_valid');
        DB::statement('ALTER TABLE products DROP CONSTRAINT IF EXISTS products_inventory_revision_positive');
        Schema::table('products', function (Blueprint $table): void {
            $table->dropColumn(['reserved_quantity', 'inventory_revision']);
        });
    }

    private function adoptOpeningBalances(): void
    {
        $schema = (string) DB::selectOne('SELECT current_schema() AS name')->name;
        foreach (DB::table('products')->orderBy('id')->get() as $product) {
            $operationId = InventoryIdentity::opening($schema, (string) $product->id);
            $movementId = (string) Str::uuid();
            DB::table('inventory_operations')->insert([
                'id' => $operationId,
                'kind' => InventoryOperationKind::Opening->value,
                'idempotency_scope' => 'system:catalog-opening',
                'idempotency_key' => $operationId,
                'request_fingerprint' => hash('sha256', json_encode([
                    'productId' => (string) $product->id,
                    'openingOnHand' => (int) $product->stock_quantity,
                ], JSON_THROW_ON_ERROR)),
                'actor_type' => InventoryActorType::System->value,
                'source' => 'wp42_migration',
                'reason_code' => 'catalog_adoption',
                'created_at' => now(),
            ]);
            DB::table('inventory_movements')->insert([
                'id' => $movementId,
                'operation_id' => $operationId,
                'product_id' => $product->id,
                'kind' => InventoryMovementKind::Opening->value,
                'before_on_hand' => 0,
                'before_reserved' => 0,
                'on_hand_delta' => (int) $product->stock_quantity,
                'reserved_delta' => 0,
                'after_on_hand' => (int) $product->stock_quantity,
                'after_reserved' => 0,
                'before_inventory_revision' => 1,
                'after_inventory_revision' => 1,
                'created_at' => now(),
            ]);
            DB::table('inventory_application_receipts')->insert([
                'id' => (string) Str::uuid(),
                'operation_id' => $operationId,
                'product_id' => $product->id,
                'movement_id' => $movementId,
                'created_at' => now(),
            ]);
        }
    }

    private function createGuardFunctions(): void
    {
        DB::unprepared(<<<'SQL'
            CREATE FUNCTION inventory_prevent_immutable_mutation() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'inventory history is append-only';
            END;
            $$ LANGUAGE plpgsql;
            SQL);

        DB::unprepared(<<<'SQL'
            CREATE FUNCTION inventory_guard_product_update() RETURNS trigger AS $$
            DECLARE
                bound_operation_id uuid;
                matches integer;
                subject_id uuid;
                balance_changed boolean;
                policy_changed boolean;
            BEGIN
                balance_changed := NEW.stock_quantity IS DISTINCT FROM OLD.stock_quantity
                    OR NEW.reserved_quantity IS DISTINCT FROM OLD.reserved_quantity;
                policy_changed := NEW.manage_stock IS DISTINCT FROM OLD.manage_stock
                    OR NEW.low_stock_threshold IS DISTINCT FROM OLD.low_stock_threshold;

                IF NOT balance_changed AND NOT policy_changed AND NEW.inventory_revision IS NOT DISTINCT FROM OLD.inventory_revision THEN
                    RETURN NEW;
                END IF;
                IF balance_changed AND policy_changed THEN
                    RAISE EXCEPTION 'inventory balance and policy must use separate operations';
                END IF;

                bound_operation_id := nullif(current_setting('eoshop.inventory_operation_id', true), '')::uuid;
                IF bound_operation_id IS NULL THEN
                    RAISE EXCEPTION 'inventory snapshot update requires an operation';
                END IF;

                IF balance_changed THEN
                    SELECT id INTO subject_id FROM inventory_movements
                    WHERE inventory_movements.operation_id = bound_operation_id
                      AND product_id = NEW.id
                      AND before_on_hand = OLD.stock_quantity
                      AND before_reserved = OLD.reserved_quantity
                      AND on_hand_delta = NEW.stock_quantity - OLD.stock_quantity
                      AND reserved_delta = NEW.reserved_quantity - OLD.reserved_quantity
                      AND after_on_hand = NEW.stock_quantity
                      AND after_reserved = NEW.reserved_quantity
                      AND before_inventory_revision = OLD.inventory_revision
                      AND after_inventory_revision = NEW.inventory_revision;
                    matches := CASE WHEN subject_id IS NULL THEN 0 ELSE 1 END;
                ELSIF policy_changed THEN
                    SELECT id INTO subject_id FROM inventory_policy_changes
                    WHERE inventory_policy_changes.operation_id = bound_operation_id
                      AND product_id = NEW.id
                      AND before_manage_stock = OLD.manage_stock
                      AND after_manage_stock = NEW.manage_stock
                      AND before_low_stock_threshold = OLD.low_stock_threshold
                      AND after_low_stock_threshold = NEW.low_stock_threshold
                      AND before_inventory_revision = OLD.inventory_revision
                      AND after_inventory_revision = NEW.inventory_revision;
                    matches := CASE WHEN subject_id IS NULL THEN 0 ELSE 1 END;
                ELSE
                    matches := 0;
                END IF;

                IF matches <> 1 THEN
                    RAISE EXCEPTION 'inventory snapshot does not match its immutable ledger record';
                END IF;
                INSERT INTO inventory_application_receipts (
                    id, operation_id, product_id, movement_id, policy_change_id, created_at
                ) VALUES (
                    gen_random_uuid(), bound_operation_id, NEW.id,
                    CASE WHEN balance_changed THEN subject_id ELSE NULL END,
                    CASE WHEN policy_changed THEN subject_id ELSE NULL END,
                    clock_timestamp()
                );
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
            SQL);

        DB::unprepared(<<<'SQL'
            CREATE FUNCTION inventory_require_opening_movement() RETURNS trigger AS $$
            DECLARE
                opening_movement_id uuid;
                opening_operation_id uuid;
                current_on_hand integer;
                current_reserved integer;
                current_revision bigint;
            BEGIN
                SELECT stock_quantity, reserved_quantity, inventory_revision
                    INTO current_on_hand, current_reserved, current_revision
                    FROM products WHERE id = NEW.id;
                SELECT id, inventory_movements.operation_id INTO opening_movement_id, opening_operation_id
                    FROM inventory_movements
                    WHERE product_id = NEW.id
                      AND kind = 'opening'
                      AND before_on_hand = 0
                      AND before_reserved = 0
                      AND after_on_hand = current_on_hand
                      AND after_reserved = current_reserved
                      AND after_inventory_revision = current_revision;
                IF opening_movement_id IS NULL THEN
                    RAISE EXCEPTION 'new product requires an opening inventory movement';
                END IF;
                INSERT INTO inventory_application_receipts (
                    id, operation_id, product_id, movement_id, created_at
                ) VALUES (
                    gen_random_uuid(), opening_operation_id, NEW.id, opening_movement_id, clock_timestamp()
                ) ON CONFLICT (movement_id) DO NOTHING;
                RETURN NULL;
            END;
            $$ LANGUAGE plpgsql;
            SQL);

        DB::unprepared(<<<'SQL'
            CREATE FUNCTION inventory_guard_receipt_insert() RETURNS trigger AS $$
            BEGIN
                IF pg_trigger_depth() <= 1 THEN
                    RAISE EXCEPTION 'inventory application receipts are trigger-owned';
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
            SQL);

        DB::unprepared(<<<'SQL'
            CREATE FUNCTION inventory_guard_reservation_update() RETURNS trigger AS $$
            BEGIN
                IF NEW.id IS DISTINCT FROM OLD.id
                    OR NEW.reference_type IS DISTINCT FROM OLD.reference_type
                    OR NEW.reference_id IS DISTINCT FROM OLD.reference_id
                    OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
                    OR NEW.created_by_operation_id IS DISTINCT FROM OLD.created_by_operation_id
                    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
                    RAISE EXCEPTION 'reservation identity and items are immutable';
                END IF;
                IF OLD.status <> 'active' OR NEW.status NOT IN ('committed','released','expired')
                    OR NEW.terminal_operation_id IS NULL OR NEW.terminal_at IS NULL THEN
                    RAISE EXCEPTION 'invalid inventory reservation transition';
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
            SQL);

        DB::unprepared(<<<'SQL'
            CREATE FUNCTION inventory_require_reservation_items() RETURNS trigger AS $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM inventory_reservation_items
                    WHERE reservation_id = NEW.id
                ) THEN
                    RAISE EXCEPTION 'inventory reservation requires at least one item';
                END IF;
                RETURN NULL;
            END;
            $$ LANGUAGE plpgsql;
            SQL);

        DB::unprepared(<<<'SQL'
            CREATE FUNCTION inventory_validate_movement_kind() RETURNS trigger AS $$
            DECLARE
                operation_kind text;
                snapshot_matches integer;
            BEGIN
                SELECT kind INTO operation_kind FROM inventory_operations WHERE id = NEW.operation_id;
                IF NOT (
                    (operation_kind = 'opening' AND NEW.kind = 'opening')
                    OR (operation_kind = 'manual_adjustment' AND NEW.kind IN ('receive','issue','return','correction'))
                    OR (operation_kind = 'reservation_create' AND NEW.kind = 'reserve')
                    OR (operation_kind = 'reservation_release' AND NEW.kind = 'release')
                    OR (operation_kind = 'reservation_commit' AND NEW.kind = 'commit')
                    OR (operation_kind = 'reservation_expire' AND NEW.kind = 'expire')
                ) THEN
                    RAISE EXCEPTION 'inventory movement kind does not match its operation';
                END IF;
                SELECT count(*) INTO snapshot_matches FROM products
                    WHERE id = NEW.product_id
                      AND stock_quantity = NEW.after_on_hand
                      AND reserved_quantity = NEW.after_reserved
                      AND inventory_revision = NEW.after_inventory_revision;
                IF snapshot_matches <> 1 THEN
                    RAISE EXCEPTION 'inventory movement does not converge with its product snapshot';
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM inventory_application_receipts
                    WHERE movement_id = NEW.id AND operation_id = NEW.operation_id AND product_id = NEW.product_id
                ) THEN
                    RAISE EXCEPTION 'inventory movement was not applied by the guarded snapshot transition';
                END IF;
                RETURN NULL;
            END;
            $$ LANGUAGE plpgsql;
            SQL);

        DB::unprepared(<<<'SQL'
            CREATE FUNCTION inventory_guard_reservation_item_insert() RETURNS trigger AS $$
            DECLARE
                reservation_status text;
                create_operation uuid;
                bound_operation uuid;
                created_in_current_transaction boolean;
            BEGIN
                SELECT status, created_by_operation_id, xmin::text = pg_current_xact_id()::text
                    INTO reservation_status, create_operation, created_in_current_transaction
                    FROM inventory_reservations WHERE id = NEW.reservation_id;
                bound_operation := nullif(current_setting('eoshop.inventory_operation_id', true), '')::uuid;
                IF reservation_status <> 'active'
                    OR NOT created_in_current_transaction
                    OR create_operation IS DISTINCT FROM bound_operation THEN
                    RAISE EXCEPTION 'reservation items may only be inserted by their creation operation';
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
            SQL);

        DB::unprepared(<<<'SQL'
            CREATE FUNCTION inventory_validate_policy_change() RETURNS trigger AS $$
            DECLARE
                operation_kind text;
            BEGIN
                SELECT kind INTO operation_kind FROM inventory_operations WHERE id = NEW.operation_id;
                IF operation_kind <> 'policy_update' THEN
                    RAISE EXCEPTION 'inventory policy change requires a policy operation';
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM products
                    WHERE id = NEW.product_id
                      AND manage_stock = NEW.after_manage_stock
                      AND low_stock_threshold = NEW.after_low_stock_threshold
                      AND inventory_revision = NEW.after_inventory_revision
                ) THEN
                    RAISE EXCEPTION 'inventory policy history does not converge with its product snapshot';
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM inventory_application_receipts
                    WHERE policy_change_id = NEW.id AND operation_id = NEW.operation_id AND product_id = NEW.product_id
                ) THEN
                    RAISE EXCEPTION 'inventory policy history was not applied by the guarded snapshot transition';
                END IF;
                RETURN NULL;
            END;
            $$ LANGUAGE plpgsql;
            SQL);

        DB::unprepared(<<<'SQL'
            CREATE FUNCTION inventory_validate_reservation_item() RETURNS trigger AS $$
            DECLARE
                create_operation uuid;
            BEGIN
                SELECT created_by_operation_id INTO create_operation
                    FROM inventory_reservations WHERE id = NEW.reservation_id;
                IF NOT EXISTS (
                    SELECT 1 FROM inventory_movements
                    WHERE operation_id = create_operation
                      AND reservation_id = NEW.reservation_id
                      AND product_id = NEW.product_id
                      AND kind = 'reserve'
                      AND reserved_delta = NEW.quantity
                ) THEN
                    RAISE EXCEPTION 'reservation item lacks its creation movement';
                END IF;
                RETURN NULL;
            END;
            $$ LANGUAGE plpgsql;
            SQL);

        DB::unprepared(<<<'SQL'
            CREATE FUNCTION inventory_validate_reservation() RETURNS trigger AS $$
            DECLARE
                create_kind text;
                terminal_kind text;
                expected_terminal_kind text;
                item_count integer;
                create_movement_count integer;
                terminal_movement_count integer;
            BEGIN
                SELECT kind INTO create_kind FROM inventory_operations WHERE id = NEW.created_by_operation_id;
                SELECT count(*) INTO item_count FROM inventory_reservation_items WHERE reservation_id = NEW.id;
                SELECT count(*) INTO create_movement_count FROM inventory_movements
                    WHERE reservation_id = NEW.id AND operation_id = NEW.created_by_operation_id AND kind = 'reserve';
                IF create_kind <> 'reservation_create' OR item_count = 0 OR create_movement_count <> item_count THEN
                    RAISE EXCEPTION 'inventory reservation creation ledger is incomplete';
                END IF;

                IF NEW.status <> 'active' THEN
                    expected_terminal_kind := CASE NEW.status
                        WHEN 'committed' THEN 'reservation_commit'
                        WHEN 'released' THEN 'reservation_release'
                        WHEN 'expired' THEN 'reservation_expire'
                    END;
                    SELECT kind INTO terminal_kind FROM inventory_operations WHERE id = NEW.terminal_operation_id;
                    SELECT count(*) INTO terminal_movement_count FROM inventory_movements
                        WHERE reservation_id = NEW.id AND operation_id = NEW.terminal_operation_id;
                    IF terminal_kind <> expected_terminal_kind OR terminal_movement_count <> item_count THEN
                        RAISE EXCEPTION 'inventory reservation terminal ledger is incomplete';
                    END IF;
                END IF;
                RETURN NULL;
            END;
            $$ LANGUAGE plpgsql;
            SQL);
    }

    private function createGuardTriggers(): void
    {
        foreach (['inventory_operations', 'inventory_movements', 'inventory_reservation_items', 'inventory_policy_changes', 'inventory_application_receipts', 'inventory_operation_results'] as $table) {
            DB::unprepared("CREATE TRIGGER inventory_{$table}_immutable BEFORE UPDATE OR DELETE ON {$table} FOR EACH ROW EXECUTE FUNCTION inventory_prevent_immutable_mutation()");
        }
        DB::unprepared('CREATE TRIGGER inventory_products_guarded_update BEFORE UPDATE OF stock_quantity, reserved_quantity, manage_stock, low_stock_threshold, inventory_revision ON products FOR EACH ROW EXECUTE FUNCTION inventory_guard_product_update()');
        DB::unprepared('CREATE CONSTRAINT TRIGGER inventory_products_opening_required AFTER INSERT ON products DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_require_opening_movement()');
        DB::unprepared('CREATE CONSTRAINT TRIGGER inventory_reservations_items_required AFTER INSERT ON inventory_reservations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_require_reservation_items()');
        DB::unprepared('CREATE CONSTRAINT TRIGGER inventory_movements_kind_consistent AFTER INSERT ON inventory_movements DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_validate_movement_kind()');
        DB::unprepared('CREATE TRIGGER inventory_reservation_items_guarded_insert BEFORE INSERT ON inventory_reservation_items FOR EACH ROW EXECUTE FUNCTION inventory_guard_reservation_item_insert()');
        DB::unprepared('CREATE CONSTRAINT TRIGGER inventory_reservation_items_consistent AFTER INSERT ON inventory_reservation_items DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_validate_reservation_item()');
        DB::unprepared('CREATE TRIGGER inventory_receipts_trigger_only_insert BEFORE INSERT ON inventory_application_receipts FOR EACH ROW EXECUTE FUNCTION inventory_guard_receipt_insert()');
        DB::unprepared('CREATE CONSTRAINT TRIGGER inventory_policy_changes_consistent AFTER INSERT ON inventory_policy_changes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_validate_policy_change()');
        DB::unprepared('CREATE CONSTRAINT TRIGGER inventory_reservations_consistent AFTER INSERT OR UPDATE ON inventory_reservations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_validate_reservation()');
        DB::unprepared('CREATE TRIGGER inventory_reservations_guarded_update BEFORE UPDATE ON inventory_reservations FOR EACH ROW EXECUTE FUNCTION inventory_guard_reservation_update()');
    }
};
