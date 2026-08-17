<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public $withinTransaction = true;

    public function up(): void
    {
        if (Schema::hasTable('orders') && ! Schema::hasTable('legacy_orders_wp43')) {
            Schema::rename('orders', 'legacy_orders_wp43');
            Schema::table('legacy_orders_wp43', function (Blueprint $table): void {
                $table->string('origin', 32)->default('legacy_unverified');
                $table->bigInteger('total_amount_minor_projection')->nullable();
            });
            DB::statement('UPDATE legacy_orders_wp43 SET total_amount_minor_projection = round(total_amount * 100)::bigint');
            DB::statement("ALTER TABLE legacy_orders_wp43 ADD CONSTRAINT legacy_orders_wp43_origin CHECK (origin = 'legacy_unverified')");
        }

        Schema::create('order_operations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('kind', 20);
            $table->string('idempotency_scope', 100);
            $table->uuid('idempotency_key');
            $table->char('request_fingerprint', 64);
            $table->string('actor_type', 10);
            $table->char('actor_user_id', 26)->nullable();
            $table->uuid('request_id')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->unique(['kind', 'idempotency_scope', 'idempotency_key'], 'order_operations_idempotency_unique');
        });

        Schema::create('orders', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('order_number', 32)->unique();
            $table->string('status', 20);
            $table->string('payment_state', 40);
            $table->char('currency_code', 3);
            $table->unsignedBigInteger('workspace_revision');
            $table->unsignedBigInteger('catalog_revision');
            $table->bigInteger('items_subtotal_minor');
            $table->bigInteger('discount_minor')->default(0);
            $table->bigInteger('shipping_minor')->default(0);
            $table->bigInteger('tax_minor')->default(0);
            $table->bigInteger('payment_fee_minor')->default(0);
            $table->bigInteger('grand_total_minor');
            $table->string('coupon_code', 50)->nullable();
            $table->unsignedInteger('coupon_basis_points')->default(0);
            $table->string('payment_method', 30);
            $table->string('payment_channel_id', 100)->nullable();
            $table->text('customer_encrypted');
            $table->uuid('reservation_id')->nullable()->unique();
            $table->uuid('create_operation_id')->unique();
            $table->timestampTz('expires_at')->nullable();
            $table->timestampTz('accepted_at')->nullable();
            $table->timestampTz('processing_at')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->timestampTz('cancelled_at')->nullable();
            $table->timestampTz('expired_at')->nullable();
            $table->timestampsTz();
            $table->foreign('reservation_id')->references('id')->on('inventory_reservations')->restrictOnDelete();
            $table->foreign('create_operation_id')->references('id')->on('order_operations')->restrictOnDelete();
            $table->index(['status', 'created_at']);
        });

        Schema::create('order_items', function (Blueprint $table): void {
            $table->uuid('order_id');
            $table->uuid('product_id');
            $table->string('product_name', 255);
            $table->string('sku', 100);
            $table->bigInteger('unit_price_minor');
            $table->unsignedInteger('quantity');
            $table->bigInteger('line_total_minor');
            $table->boolean('tracked_at_submission');
            $table->timestampTz('created_at')->useCurrent();
            $table->primary(['order_id', 'product_id']);
            $table->foreign('order_id')->references('id')->on('orders')->restrictOnDelete();
            $table->foreign('product_id')->references('id')->on('products')->restrictOnDelete();
        });

        Schema::create('order_addresses', function (Blueprint $table): void {
            $table->uuid('order_id')->primary();
            $table->text('encrypted_payload');
            $table->timestampTz('created_at')->useCurrent();
            $table->foreign('order_id')->references('id')->on('orders')->restrictOnDelete();
        });

        Schema::create('payment_attempts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('order_id')->unique();
            $table->string('method', 30);
            $table->string('state', 40);
            $table->string('channel_id', 100)->nullable();
            $table->string('channel_label', 255)->nullable();
            $table->text('encrypted_reference')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->foreign('order_id')->references('id')->on('orders')->restrictOnDelete();
        });

        Schema::create('order_status_history', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('order_id');
            $table->uuid('operation_id')->unique();
            $table->string('from_status', 20)->nullable();
            $table->string('to_status', 20);
            $table->string('actor_type', 10);
            $table->char('actor_user_id', 26)->nullable();
            $table->string('reason_code', 64);
            $table->uuid('request_id')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->foreign('order_id')->references('id')->on('orders')->restrictOnDelete();
            $table->foreign('operation_id')->references('id')->on('order_operations')->restrictOnDelete();
            $table->index(['order_id', 'created_at']);
        });

        Schema::create('order_operation_results', function (Blueprint $table): void {
            $table->uuid('operation_id')->primary();
            $table->jsonb('response_json');
            $table->timestampTz('created_at')->useCurrent();
            $table->foreign('operation_id')->references('id')->on('order_operations')->restrictOnDelete();
        });

        $this->addChecks();
        $this->createFunctions();
        $this->createTriggers();
    }

    public function down(): void
    {
        if (Schema::hasTable('order_operations') && DB::table('order_operations')->exists()) {
            throw new RuntimeException('Refusing to erase authoritative order, pricing and inventory history.');
        }

        DB::unprepared('DROP TRIGGER IF EXISTS orders_guarded_update ON orders');
        DB::unprepared('DROP TRIGGER IF EXISTS orders_consistent ON orders');
        foreach (['order_items', 'order_addresses', 'payment_attempts', 'order_status_history'] as $table) {
            DB::unprepared("DROP TRIGGER IF EXISTS {$table}_order_consistent ON {$table}");
        }
        foreach (['order_items', 'order_addresses', 'payment_attempts'] as $table) {
            DB::unprepared("DROP TRIGGER IF EXISTS {$table}_guarded_insert ON {$table}");
        }
        DB::unprepared('DROP TRIGGER IF EXISTS inventory_reservations_order_consistent ON inventory_reservations');
        DB::unprepared('DROP TRIGGER IF EXISTS inventory_reservation_items_order_consistent ON inventory_reservation_items');
        foreach (['order_operations', 'order_items', 'order_addresses', 'payment_attempts', 'order_status_history', 'order_operation_results'] as $table) {
            DB::unprepared("DROP TRIGGER IF EXISTS {$table}_immutable ON {$table}");
        }
        if (Schema::hasTable('legacy_orders_wp43')) {
            DB::unprepared('DROP TRIGGER IF EXISTS legacy_orders_wp43_immutable ON legacy_orders_wp43');
        }
        DB::unprepared('DROP FUNCTION IF EXISTS order_validate_consistency()');
        DB::unprepared('DROP FUNCTION IF EXISTS order_revalidate_reservation_item()');
        DB::unprepared('DROP FUNCTION IF EXISTS order_revalidate_reservation()');
        DB::unprepared('DROP FUNCTION IF EXISTS order_revalidate_child()');
        DB::unprepared('DROP FUNCTION IF EXISTS order_assert_consistency(uuid)');
        DB::unprepared('DROP FUNCTION IF EXISTS order_guard_update()');
        DB::unprepared('DROP FUNCTION IF EXISTS order_guard_snapshot_insert()');
        DB::unprepared('DROP FUNCTION IF EXISTS order_prevent_immutable_mutation()');

        Schema::dropIfExists('order_operation_results');
        Schema::dropIfExists('order_status_history');
        Schema::dropIfExists('payment_attempts');
        Schema::dropIfExists('order_addresses');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('order_operations');

        if (Schema::hasTable('legacy_orders_wp43') && ! Schema::hasTable('orders')) {
            DB::statement('ALTER TABLE legacy_orders_wp43 DROP CONSTRAINT IF EXISTS legacy_orders_wp43_origin');
            Schema::table('legacy_orders_wp43', function (Blueprint $table): void {
                $table->dropColumn(['origin', 'total_amount_minor_projection']);
            });
            Schema::rename('legacy_orders_wp43', 'orders');
        }
    }

    private function addChecks(): void
    {
        DB::statement("ALTER TABLE order_operations ADD CONSTRAINT order_operations_kind_valid CHECK (kind IN ('create','transition','expire'))");
        DB::statement("ALTER TABLE order_operations ADD CONSTRAINT order_operations_actor_valid CHECK ((actor_type = 'guest' AND actor_user_id IS NULL) OR (actor_type = 'user' AND actor_user_id IS NOT NULL) OR (actor_type = 'system' AND actor_user_id IS NULL))");
        DB::statement("ALTER TABLE order_operations ADD CONSTRAINT order_operations_fingerprint_valid CHECK (request_fingerprint ~ '^[0-9a-f]{64}$')");
        DB::statement("ALTER TABLE orders ADD CONSTRAINT orders_status_valid CHECK (status IN ('submitted','accepted','processing','completed','cancelled','expired'))");
        DB::statement("ALTER TABLE orders ADD CONSTRAINT orders_payment_state_valid CHECK (payment_state IN ('due_on_delivery','transfer_submitted_unverified'))");
        DB::statement("ALTER TABLE orders ADD CONSTRAINT orders_currency_valid CHECK (currency_code IN ('YER','SAR','USD'))");
        DB::statement("ALTER TABLE orders ADD CONSTRAINT orders_payment_method_valid CHECK (payment_method IN ('cod','bank_transfer','wallet'))");
        DB::statement('ALTER TABLE orders ADD CONSTRAINT orders_amounts_valid CHECK (items_subtotal_minor >= 0 AND items_subtotal_minor <= 100000000000000 AND discount_minor >= 0 AND discount_minor <= items_subtotal_minor AND shipping_minor >= 0 AND tax_minor >= 0 AND payment_fee_minor >= 0 AND grand_total_minor >= 0 AND grand_total_minor <= 100000000000000 AND grand_total_minor = items_subtotal_minor - discount_minor + shipping_minor + tax_minor + payment_fee_minor)');
        DB::statement('ALTER TABLE orders ADD CONSTRAINT orders_revisions_positive CHECK (workspace_revision > 0 AND catalog_revision > 0)');
        DB::statement('ALTER TABLE orders ADD CONSTRAINT orders_coupon_valid CHECK (coupon_basis_points <= 10000 AND ((coupon_code IS NULL AND coupon_basis_points = 0) OR (coupon_code IS NOT NULL AND coupon_code = upper(coupon_code) AND coupon_basis_points > 0)))');
        DB::statement("ALTER TABLE orders ADD CONSTRAINT orders_payment_channel_valid CHECK ((payment_method = 'cod' AND payment_channel_id IS NULL AND payment_state = 'due_on_delivery') OR (payment_method IN ('bank_transfer','wallet') AND payment_channel_id IS NOT NULL AND payment_state = 'transfer_submitted_unverified'))");
        DB::statement("ALTER TABLE orders ADD CONSTRAINT orders_status_timestamps_valid CHECK ((status = 'submitted' AND accepted_at IS NULL AND processing_at IS NULL AND completed_at IS NULL AND cancelled_at IS NULL AND expired_at IS NULL) OR (status = 'accepted' AND accepted_at IS NOT NULL AND processing_at IS NULL AND completed_at IS NULL AND cancelled_at IS NULL AND expired_at IS NULL) OR (status = 'processing' AND accepted_at IS NOT NULL AND processing_at IS NOT NULL AND completed_at IS NULL AND cancelled_at IS NULL AND expired_at IS NULL) OR (status = 'completed' AND accepted_at IS NOT NULL AND completed_at IS NOT NULL AND cancelled_at IS NULL AND expired_at IS NULL) OR (status = 'cancelled' AND accepted_at IS NULL AND processing_at IS NULL AND completed_at IS NULL AND cancelled_at IS NOT NULL AND expired_at IS NULL) OR (status = 'expired' AND accepted_at IS NULL AND processing_at IS NULL AND completed_at IS NULL AND cancelled_at IS NULL AND expired_at IS NOT NULL))");
        DB::statement('ALTER TABLE order_items ADD CONSTRAINT order_items_quantity_valid CHECK (quantity BETWEEN 1 AND 99)');
        DB::statement('ALTER TABLE order_items ADD CONSTRAINT order_items_amount_valid CHECK (unit_price_minor >= 0 AND unit_price_minor <= 9999999999 AND line_total_minor = unit_price_minor * quantity AND line_total_minor <= 100000000000000)');
        DB::statement("ALTER TABLE payment_attempts ADD CONSTRAINT payment_attempts_state_valid CHECK (state IN ('due_on_delivery','transfer_submitted_unverified'))");
        DB::statement("ALTER TABLE payment_attempts ADD CONSTRAINT payment_attempts_channel_valid CHECK ((method = 'cod' AND state = 'due_on_delivery' AND channel_id IS NULL AND encrypted_reference IS NULL) OR (method IN ('bank_transfer','wallet') AND state = 'transfer_submitted_unverified' AND channel_id IS NOT NULL))");
        DB::statement("ALTER TABLE order_status_history ADD CONSTRAINT order_history_status_valid CHECK ((from_status IS NULL AND to_status = 'submitted') OR (from_status = 'submitted' AND to_status IN ('accepted','cancelled','expired')) OR (from_status = 'accepted' AND to_status IN ('processing','completed')) OR (from_status = 'processing' AND to_status = 'completed'))");
        DB::statement("ALTER TABLE order_status_history ADD CONSTRAINT order_history_actor_valid CHECK ((actor_type = 'guest' AND actor_user_id IS NULL) OR (actor_type = 'user' AND actor_user_id IS NOT NULL) OR (actor_type = 'system' AND actor_user_id IS NULL))");
        DB::statement("ALTER TABLE order_status_history ADD CONSTRAINT order_history_actor_transition_valid CHECK ((from_status IS NULL AND to_status = 'submitted' AND actor_type = 'guest') OR (to_status = 'expired' AND actor_type = 'system') OR (from_status IS NOT NULL AND to_status <> 'expired' AND actor_type = 'user'))");
    }

    private function createFunctions(): void
    {
        DB::unprepared(<<<'SQL'
            CREATE FUNCTION order_prevent_immutable_mutation() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'order history and snapshots are immutable';
            END;
            $$ LANGUAGE plpgsql;
            SQL);

        DB::unprepared(<<<'SQL'
            CREATE FUNCTION order_guard_snapshot_insert() RETURNS trigger AS $$
            DECLARE bound_operation uuid; parent_operation uuid;
            BEGIN
                bound_operation := nullif(current_setting('eoshop.order_create_operation_id', true), '')::uuid;
                SELECT create_operation_id INTO parent_operation FROM orders WHERE id = NEW.order_id;
                IF parent_operation IS NULL OR bound_operation IS NULL OR parent_operation IS DISTINCT FROM bound_operation
                    OR NOT EXISTS (
                        SELECT 1 FROM order_operations
                        WHERE id = parent_operation AND kind = 'create' AND actor_type = 'guest'
                    ) THEN
                    RAISE EXCEPTION 'order snapshots may only be inserted by their bound create operation';
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
            SQL);

        DB::unprepared(<<<'SQL'
            CREATE FUNCTION order_guard_update() RETURNS trigger AS $$
            DECLARE bound_operation uuid;
            BEGIN
                IF NEW.id IS DISTINCT FROM OLD.id OR NEW.order_number IS DISTINCT FROM OLD.order_number
                    OR NEW.payment_state IS DISTINCT FROM OLD.payment_state OR NEW.currency_code IS DISTINCT FROM OLD.currency_code
                    OR NEW.workspace_revision IS DISTINCT FROM OLD.workspace_revision OR NEW.catalog_revision IS DISTINCT FROM OLD.catalog_revision
                    OR NEW.items_subtotal_minor IS DISTINCT FROM OLD.items_subtotal_minor OR NEW.discount_minor IS DISTINCT FROM OLD.discount_minor
                    OR NEW.shipping_minor IS DISTINCT FROM OLD.shipping_minor OR NEW.tax_minor IS DISTINCT FROM OLD.tax_minor
                    OR NEW.payment_fee_minor IS DISTINCT FROM OLD.payment_fee_minor OR NEW.grand_total_minor IS DISTINCT FROM OLD.grand_total_minor
                    OR NEW.coupon_code IS DISTINCT FROM OLD.coupon_code OR NEW.coupon_basis_points IS DISTINCT FROM OLD.coupon_basis_points
                    OR NEW.payment_method IS DISTINCT FROM OLD.payment_method OR NEW.payment_channel_id IS DISTINCT FROM OLD.payment_channel_id
                    OR NEW.customer_encrypted IS DISTINCT FROM OLD.customer_encrypted OR NEW.reservation_id IS DISTINCT FROM OLD.reservation_id
                    OR NEW.create_operation_id IS DISTINCT FROM OLD.create_operation_id OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
                    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
                    RAISE EXCEPTION 'order snapshots are immutable';
                END IF;
                IF NOT ((OLD.status = 'submitted' AND NEW.status IN ('accepted','cancelled','expired'))
                    OR (OLD.status = 'accepted' AND NEW.status IN ('processing','completed'))
                    OR (OLD.status = 'processing' AND NEW.status = 'completed')) THEN
                    RAISE EXCEPTION 'invalid order status transition';
                END IF;
                bound_operation := nullif(current_setting('eoshop.order_operation_id', true), '')::uuid;
                IF bound_operation IS NULL OR NOT EXISTS (
                    SELECT 1 FROM order_status_history
                    WHERE operation_id = bound_operation AND order_id = NEW.id
                      AND from_status = OLD.status AND to_status = NEW.status
                ) THEN
                    RAISE EXCEPTION 'order transition requires matching immutable history';
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
            SQL);

        DB::unprepared(<<<'SQL'
            CREATE FUNCTION order_assert_consistency(target_order_id uuid) RETURNS void AS $$
            DECLARE target_order orders%ROWTYPE; tracked_count integer; mismatches integer; item_count integer; item_sum bigint; reservation_status text; reservation_reference_type text; reservation_reference_id text; history_count integer; history_mismatches integer; latest_status text;
            BEGIN
                SELECT * INTO target_order FROM orders WHERE id = target_order_id;
                IF NOT FOUND THEN RAISE EXCEPTION 'order parent is missing'; END IF;

                SELECT count(*), coalesce(sum(line_total_minor), 0), count(*) FILTER (WHERE tracked_at_submission)
                    INTO item_count, item_sum, tracked_count FROM order_items WHERE order_id = target_order.id;
                IF item_count < 1 OR item_count > 50 OR item_sum <> target_order.items_subtotal_minor THEN
                    RAISE EXCEPTION 'order item snapshot is inconsistent';
                END IF;
                IF NOT EXISTS (SELECT 1 FROM order_addresses WHERE order_id = target_order.id)
                    OR NOT EXISTS (SELECT 1 FROM payment_attempts WHERE order_id = target_order.id AND method = target_order.payment_method AND state = target_order.payment_state AND channel_id IS NOT DISTINCT FROM target_order.payment_channel_id)
                    OR NOT EXISTS (SELECT 1 FROM order_operations WHERE id = target_order.create_operation_id AND kind = 'create' AND actor_type = 'guest') THEN
                    RAISE EXCEPTION 'order required snapshots are incomplete';
                END IF;
                SELECT count(*) INTO history_count FROM order_status_history
                    WHERE order_id = target_order.id AND from_status IS NULL AND to_status = 'submitted' AND operation_id = target_order.create_operation_id;
                IF history_count <> 1 THEN RAISE EXCEPTION 'order creation history is incomplete'; END IF;

                SELECT count(*) INTO history_mismatches FROM (
                    SELECT history.*, row_number() OVER (ORDER BY history.created_at, history.id) AS sequence,
                        lag(history.to_status) OVER (ORDER BY history.created_at, history.id) AS prior_status,
                        operation.kind AS operation_kind, operation.actor_type AS operation_actor_type,
                        operation.actor_user_id AS operation_actor_user_id
                    FROM order_status_history history
                    JOIN order_operations operation ON operation.id = history.operation_id
                    WHERE history.order_id = target_order.id
                ) sequenced
                WHERE (sequence = 1 AND (from_status IS NOT NULL OR to_status <> 'submitted'))
                    OR (sequence > 1 AND from_status IS DISTINCT FROM prior_status)
                    OR operation_actor_type IS DISTINCT FROM actor_type
                    OR operation_actor_user_id IS DISTINCT FROM actor_user_id
                    OR (from_status IS NULL AND operation_kind <> 'create')
                    OR (to_status = 'expired' AND operation_kind <> 'expire')
                    OR (from_status IS NOT NULL AND to_status <> 'expired' AND operation_kind <> 'transition');
                SELECT to_status INTO latest_status FROM order_status_history WHERE order_id = target_order.id ORDER BY created_at DESC, id DESC LIMIT 1;
                IF history_mismatches <> 0 OR latest_status IS DISTINCT FROM target_order.status THEN
                    RAISE EXCEPTION 'order status history is inconsistent';
                END IF;

                IF tracked_count = 0 THEN
                    IF target_order.reservation_id IS NOT NULL THEN RAISE EXCEPTION 'untracked order must not own a reservation'; END IF;
                ELSE
                    SELECT status, reference_type, reference_id INTO reservation_status, reservation_reference_type, reservation_reference_id
                        FROM inventory_reservations WHERE id = target_order.reservation_id;
                    IF reservation_reference_type IS DISTINCT FROM 'order' OR reservation_reference_id IS DISTINCT FROM target_order.id::text THEN
                        RAISE EXCEPTION 'order reservation reference is inconsistent';
                    END IF;
                    SELECT count(*) INTO mismatches FROM (
                        (SELECT product_id, quantity FROM inventory_reservation_items WHERE reservation_id = target_order.reservation_id)
                        EXCEPT
                        (SELECT product_id, quantity FROM order_items WHERE order_id = target_order.id AND tracked_at_submission)
                    ) difference;
                    IF mismatches <> 0 OR (SELECT count(*) FROM inventory_reservation_items WHERE reservation_id = target_order.reservation_id) <> tracked_count THEN
                        RAISE EXCEPTION 'order reservation items are inconsistent';
                    END IF;
                    IF NOT ((target_order.status = 'submitted' AND reservation_status = 'active')
                        OR (target_order.status IN ('accepted','processing','completed') AND reservation_status = 'committed')
                        OR (target_order.status = 'cancelled' AND reservation_status = 'released')
                        OR (target_order.status = 'expired' AND reservation_status = 'expired')) THEN
                        RAISE EXCEPTION 'order and reservation states are inconsistent';
                    END IF;
                END IF;
            END;
            $$ LANGUAGE plpgsql;

            CREATE FUNCTION order_validate_consistency() RETURNS trigger AS $$
            BEGIN
                PERFORM order_assert_consistency(NEW.id);
                RETURN NULL;
            END;
            $$ LANGUAGE plpgsql;

            CREATE FUNCTION order_revalidate_child() RETURNS trigger AS $$
            BEGIN
                PERFORM order_assert_consistency(NEW.order_id);
                RETURN NULL;
            END;
            $$ LANGUAGE plpgsql;

            CREATE FUNCTION order_revalidate_reservation() RETURNS trigger AS $$
            DECLARE target_order_id uuid;
            BEGIN
                SELECT id INTO target_order_id FROM orders WHERE reservation_id = NEW.id;
                IF target_order_id IS NOT NULL THEN PERFORM order_assert_consistency(target_order_id); END IF;
                RETURN NULL;
            END;
            $$ LANGUAGE plpgsql;

            CREATE FUNCTION order_revalidate_reservation_item() RETURNS trigger AS $$
            DECLARE target_order_id uuid;
            BEGIN
                SELECT id INTO target_order_id FROM orders WHERE reservation_id = NEW.reservation_id;
                IF target_order_id IS NOT NULL THEN PERFORM order_assert_consistency(target_order_id); END IF;
                RETURN NULL;
            END;
            $$ LANGUAGE plpgsql;
            SQL);
    }

    private function createTriggers(): void
    {
        foreach (['order_operations', 'order_items', 'order_addresses', 'payment_attempts', 'order_status_history', 'order_operation_results'] as $table) {
            DB::unprepared("CREATE TRIGGER {$table}_immutable BEFORE UPDATE OR DELETE ON {$table} FOR EACH ROW EXECUTE FUNCTION order_prevent_immutable_mutation()");
        }
        if (Schema::hasTable('legacy_orders_wp43')) {
            DB::unprepared('CREATE TRIGGER legacy_orders_wp43_immutable BEFORE UPDATE OR DELETE ON legacy_orders_wp43 FOR EACH ROW EXECUTE FUNCTION order_prevent_immutable_mutation()');
        }
        DB::unprepared('CREATE TRIGGER orders_guarded_update BEFORE UPDATE OR DELETE ON orders FOR EACH ROW EXECUTE FUNCTION order_guard_update()');
        foreach (['order_items', 'order_addresses', 'payment_attempts'] as $table) {
            DB::unprepared("CREATE TRIGGER {$table}_guarded_insert BEFORE INSERT ON {$table} FOR EACH ROW EXECUTE FUNCTION order_guard_snapshot_insert()");
        }
        DB::unprepared('CREATE CONSTRAINT TRIGGER orders_consistent AFTER INSERT OR UPDATE ON orders DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION order_validate_consistency()');
        foreach (['order_items', 'order_addresses', 'payment_attempts', 'order_status_history'] as $table) {
            DB::unprepared("CREATE CONSTRAINT TRIGGER {$table}_order_consistent AFTER INSERT ON {$table} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION order_revalidate_child()");
        }
        DB::unprepared('CREATE CONSTRAINT TRIGGER inventory_reservations_order_consistent AFTER INSERT OR UPDATE ON inventory_reservations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION order_revalidate_reservation()');
        DB::unprepared('CREATE CONSTRAINT TRIGGER inventory_reservation_items_order_consistent AFTER INSERT ON inventory_reservation_items DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION order_revalidate_reservation_item()');
    }
};
