<?php

use App\Enums\OrderFulfillmentStatus;
use App\Enums\OrderStatus;
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
        Schema::create('order_fulfillments', function (Blueprint $table): void {
            $table->uuid('order_id')->primary();
            $table->string('status', 24);
            $table->unsignedBigInteger('revision')->default(1);
            $table->timestampTz('preparing_at')->nullable();
            $table->timestampTz('dispatched_at')->nullable();
            $table->timestampTz('delivered_at')->nullable();
            $table->timestampTz('created_at');
            $table->timestampTz('updated_at');
            $table->foreign('order_id')->references('id')->on('orders')->restrictOnDelete();
            $table->index(['status', 'order_id'], 'order_fulfillments_status_order_index');
        });

        Schema::create('order_fulfillment_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('order_id');
            $table->uuid('operation_id')->unique('order_fulfillment_events_operation_unique');
            $table->unsignedBigInteger('sequence');
            $table->string('from_status', 24)->nullable();
            $table->string('to_status', 24);
            $table->string('actor_type', 10);
            $table->char('actor_user_id', 26)->nullable();
            $table->string('reason_code', 64);
            $table->uuid('request_id')->nullable();
            $table->timestampTz('created_at');
            $table->foreign('order_id')->references('id')->on('orders')->restrictOnDelete();
            $table->foreign('operation_id')->references('id')->on('order_operations')->restrictOnDelete();
            $table->unique(['order_id', 'sequence'], 'order_fulfillment_events_order_sequence_unique');
        });

        Schema::create('order_guest_access', function (Blueprint $table): void {
            $table->uuid('order_id')->primary();
            $table->unsignedSmallInteger('token_version')->default(1);
            $table->char('token_digest', 64)->unique('order_guest_access_token_digest_unique');
            $table->text('token_ciphertext');
            $table->timestampTz('issued_at');
            $table->foreign('order_id')->references('id')->on('orders')->restrictOnDelete();
        });

        $this->backfillExistingOrders();
        $this->addChecks();
        $this->createFunctions();
        $this->createTriggers();
    }

    public function down(): void
    {
        if ((Schema::hasTable('order_fulfillments') && DB::table('order_fulfillments')->exists())
            || (Schema::hasTable('order_fulfillment_events') && DB::table('order_fulfillment_events')->exists())
            || (Schema::hasTable('order_guest_access') && DB::table('order_guest_access')->exists())) {
            throw new RuntimeException('Refusing to erase order fulfillment, delivery or guest-access evidence.');
        }

        DB::unprepared('DROP TRIGGER IF EXISTS orders_fulfillment_consistent ON orders');
        DB::unprepared('DROP TRIGGER IF EXISTS order_fulfillments_guarded_update ON order_fulfillments');
        DB::unprepared('DROP TRIGGER IF EXISTS order_fulfillments_order_consistent ON order_fulfillments');
        DB::unprepared('DROP TRIGGER IF EXISTS order_fulfillment_events_immutable ON order_fulfillment_events');
        DB::unprepared('DROP TRIGGER IF EXISTS order_fulfillment_events_order_consistent ON order_fulfillment_events');
        DB::unprepared('DROP TRIGGER IF EXISTS order_guest_access_immutable ON order_guest_access');
        DB::unprepared('DROP TRIGGER IF EXISTS order_guest_access_order_consistent ON order_guest_access');
        DB::unprepared('DROP FUNCTION IF EXISTS order_fulfillment_validate_child()');
        DB::unprepared('DROP FUNCTION IF EXISTS order_fulfillment_validate_order()');
        DB::unprepared('DROP FUNCTION IF EXISTS order_fulfillment_assert_consistency(uuid)');
        DB::unprepared('DROP FUNCTION IF EXISTS order_fulfillment_guard_update()');

        Schema::dropIfExists('order_guest_access');
        Schema::dropIfExists('order_fulfillment_events');
        Schema::dropIfExists('order_fulfillments');
    }

    private function backfillExistingOrders(): void
    {
        DB::table('orders')->orderBy('id')->chunk(200, function ($orders): void {
            foreach ($orders as $order) {
                [$fulfillmentStatus, $reasonCode, $preparingAt] = match ((string) $order->status) {
                    OrderStatus::Processing->value => [
                        OrderFulfillmentStatus::Preparing,
                        'migration_processing_adopted',
                        $order->processing_at,
                    ],
                    OrderStatus::Completed->value => [
                        OrderFulfillmentStatus::LegacyCompleted,
                        'migration_legacy_completed_adopted',
                        null,
                    ],
                    OrderStatus::Submitted->value,
                    OrderStatus::Accepted->value,
                    OrderStatus::Cancelled->value,
                    OrderStatus::Expired->value => [
                        OrderFulfillmentStatus::Unfulfilled,
                        'migration_unfulfilled_adopted',
                        null,
                    ],
                    default => throw new RuntimeException('Cannot adopt an unknown authoritative order status.'),
                };

                $clock = DB::selectOne('SELECT clock_timestamp() AS current_time')->current_time;
                $operationId = (string) Str::uuid();
                $idempotencyKey = (string) Str::uuid();
                $operationPayload = [
                    'axis' => 'fulfillment',
                    'origin' => 'migration',
                    'orderId' => (string) $order->id,
                    'to' => $fulfillmentStatus->value,
                ];

                DB::table('order_operations')->insert([
                    'id' => $operationId,
                    'kind' => 'transition',
                    'idempotency_scope' => 'migration:order-fulfillment:'.(string) $order->id,
                    'idempotency_key' => $idempotencyKey,
                    'request_fingerprint' => hash('sha256', json_encode($operationPayload, JSON_THROW_ON_ERROR)),
                    'actor_type' => 'system',
                    'actor_user_id' => null,
                    'request_id' => null,
                    'created_at' => $clock,
                ]);

                DB::table('order_fulfillments')->insert([
                    'order_id' => (string) $order->id,
                    'status' => $fulfillmentStatus->value,
                    'revision' => 1,
                    'preparing_at' => $preparingAt,
                    'dispatched_at' => null,
                    'delivered_at' => null,
                    'created_at' => $clock,
                    'updated_at' => $clock,
                ]);

                DB::table('order_fulfillment_events')->insert([
                    'id' => (string) Str::uuid(),
                    'order_id' => (string) $order->id,
                    'operation_id' => $operationId,
                    'sequence' => 1,
                    'from_status' => null,
                    'to_status' => $fulfillmentStatus->value,
                    'actor_type' => 'system',
                    'actor_user_id' => null,
                    'reason_code' => $reasonCode,
                    'request_id' => null,
                    'created_at' => $clock,
                ]);
            }
        });
    }

    private function addChecks(): void
    {
        DB::statement("ALTER TABLE order_fulfillments ADD CONSTRAINT order_fulfillments_status_valid CHECK (status IN ('unfulfilled','preparing','dispatched','delivered','legacy_completed'))");
        DB::statement('ALTER TABLE order_fulfillments ADD CONSTRAINT order_fulfillments_revision_positive CHECK (revision > 0)');
        DB::statement(<<<'SQL'
            ALTER TABLE order_fulfillments ADD CONSTRAINT order_fulfillments_timestamps_valid CHECK (
                (status = 'unfulfilled' AND preparing_at IS NULL AND dispatched_at IS NULL AND delivered_at IS NULL)
                OR (status = 'preparing' AND preparing_at IS NOT NULL AND dispatched_at IS NULL AND delivered_at IS NULL)
                OR (status = 'dispatched' AND preparing_at IS NOT NULL AND dispatched_at IS NOT NULL AND delivered_at IS NULL AND dispatched_at >= preparing_at)
                OR (status = 'delivered' AND preparing_at IS NOT NULL AND dispatched_at IS NOT NULL AND delivered_at IS NOT NULL AND dispatched_at >= preparing_at AND delivered_at >= dispatched_at)
                OR (status = 'legacy_completed' AND preparing_at IS NULL AND dispatched_at IS NULL AND delivered_at IS NULL)
            )
            SQL);
        DB::statement(<<<'SQL'
            ALTER TABLE order_fulfillment_events ADD CONSTRAINT order_fulfillment_events_state_valid CHECK (
                (from_status IS NULL AND to_status IN ('unfulfilled','preparing','legacy_completed'))
                OR (from_status = 'unfulfilled' AND to_status = 'preparing')
                OR (from_status = 'preparing' AND to_status = 'dispatched')
                OR (from_status = 'dispatched' AND to_status = 'delivered')
            )
            SQL);
        DB::statement('ALTER TABLE order_fulfillment_events ADD CONSTRAINT order_fulfillment_events_sequence_positive CHECK (sequence > 0)');
        DB::statement("ALTER TABLE order_fulfillment_events ADD CONSTRAINT order_fulfillment_events_actor_valid CHECK ((actor_type = 'guest' AND actor_user_id IS NULL) OR (actor_type = 'user' AND actor_user_id IS NOT NULL) OR (actor_type = 'system' AND actor_user_id IS NULL))");
        DB::statement('ALTER TABLE order_guest_access ADD CONSTRAINT order_guest_access_token_version_valid CHECK (token_version = 1)');
        DB::statement("ALTER TABLE order_guest_access ADD CONSTRAINT order_guest_access_digest_valid CHECK (token_digest ~ '^[0-9a-f]{64}$')");
        DB::statement("ALTER TABLE order_guest_access ADD CONSTRAINT order_guest_access_ciphertext_valid CHECK (btrim(token_ciphertext) <> '')");
    }

    private function createFunctions(): void
    {
        DB::unprepared(<<<'SQL'
            CREATE FUNCTION order_fulfillment_guard_update() RETURNS trigger AS $$
            DECLARE bound_operation uuid;
            BEGIN
                IF TG_OP = 'DELETE' THEN
                    RAISE EXCEPTION 'order fulfillment state cannot be deleted';
                END IF;

                IF NEW.order_id IS DISTINCT FROM OLD.order_id
                    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
                    RAISE EXCEPTION 'order fulfillment identity is immutable';
                END IF;

                IF NOT ((OLD.status = 'unfulfilled' AND NEW.status = 'preparing')
                    OR (OLD.status = 'preparing' AND NEW.status = 'dispatched')
                    OR (OLD.status = 'dispatched' AND NEW.status = 'delivered')) THEN
                    RAISE EXCEPTION 'invalid order fulfillment transition';
                END IF;

                IF NEW.revision <> OLD.revision + 1
                    OR NEW.updated_at < OLD.updated_at
                    OR (OLD.status IN ('preparing','dispatched') AND NEW.preparing_at IS DISTINCT FROM OLD.preparing_at)
                    OR (OLD.status = 'dispatched' AND NEW.dispatched_at IS DISTINCT FROM OLD.dispatched_at) THEN
                    RAISE EXCEPTION 'invalid order fulfillment revision';
                END IF;

                bound_operation := nullif(current_setting('eoshop.order_fulfillment_operation_id', true), '')::uuid;
                IF bound_operation IS NULL OR NOT EXISTS (
                    SELECT 1 FROM order_fulfillment_events
                    WHERE operation_id = bound_operation
                      AND order_id = NEW.order_id
                      AND sequence = NEW.revision
                      AND from_status = OLD.status
                      AND to_status = NEW.status
                      AND created_at = NEW.updated_at
                ) THEN
                    RAISE EXCEPTION 'order fulfillment transition requires matching immutable history';
                END IF;

                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
            SQL);

        DB::unprepared(<<<'SQL'
            CREATE FUNCTION order_fulfillment_assert_consistency(target_order_id uuid) RETURNS void AS $$
            DECLARE
                target_order orders%ROWTYPE;
                fulfillment order_fulfillments%ROWTYPE;
                first_event record;
                event_count bigint;
                mismatch_count bigint;
                credential_count bigint;
                latest_status text;
                latest_created_at timestamptz;
            BEGIN
                SELECT * INTO target_order FROM orders WHERE id = target_order_id;
                IF NOT FOUND THEN
                    RAISE EXCEPTION 'order parent is missing';
                END IF;

                SELECT * INTO fulfillment FROM order_fulfillments WHERE order_id = target_order.id;
                IF NOT FOUND THEN
                    RAISE EXCEPTION 'order fulfillment state is missing';
                END IF;

                SELECT count(*) INTO credential_count FROM order_guest_access WHERE order_id = target_order.id;

                SELECT count(*), max(sequence) INTO event_count, mismatch_count
                FROM order_fulfillment_events WHERE order_id = target_order.id;
                IF event_count < 1 OR event_count <> fulfillment.revision OR mismatch_count <> fulfillment.revision THEN
                    RAISE EXCEPTION 'order fulfillment history is incomplete';
                END IF;

                SELECT event.*, operation.kind AS operation_kind,
                    operation.idempotency_scope AS operation_scope,
                    operation.actor_type AS operation_actor_type,
                    operation.actor_user_id AS operation_actor_user_id
                INTO first_event
                FROM order_fulfillment_events event
                JOIN order_operations operation ON operation.id = event.operation_id
                WHERE event.order_id = target_order.id
                ORDER BY event.sequence
                LIMIT 1;

                IF first_event.sequence <> 1 OR first_event.from_status IS NOT NULL THEN
                    RAISE EXCEPTION 'order fulfillment history has an invalid origin';
                END IF;

                IF first_event.operation_kind = 'create' THEN
                    IF first_event.operation_id IS DISTINCT FROM target_order.create_operation_id
                        OR first_event.to_status <> 'unfulfilled'
                        OR first_event.actor_type <> 'guest'
                        OR first_event.operation_actor_type <> 'guest'
                        OR first_event.actor_user_id IS NOT NULL
                        OR first_event.operation_actor_user_id IS NOT NULL
                        OR first_event.reason_code <> 'checkout_submitted'
                        OR credential_count <> 1 THEN
                        RAISE EXCEPTION 'order fulfillment checkout origin is inconsistent';
                    END IF;
                ELSIF first_event.operation_kind = 'transition' THEN
                    IF first_event.operation_scope IS DISTINCT FROM ('migration:order-fulfillment:' || target_order.id::text)
                        OR first_event.actor_type <> 'system'
                        OR first_event.operation_actor_type <> 'system'
                        OR first_event.actor_user_id IS NOT NULL
                        OR first_event.operation_actor_user_id IS NOT NULL
                        OR NOT (
                            (first_event.to_status = 'unfulfilled' AND first_event.reason_code = 'migration_unfulfilled_adopted')
                            OR (first_event.to_status = 'preparing' AND first_event.reason_code = 'migration_processing_adopted')
                            OR (first_event.to_status = 'legacy_completed' AND first_event.reason_code = 'migration_legacy_completed_adopted')
                        )
                        OR credential_count <> 0 THEN
                        RAISE EXCEPTION 'order fulfillment migration origin is inconsistent';
                    END IF;
                ELSE
                    RAISE EXCEPTION 'order fulfillment origin operation is invalid';
                END IF;

                SELECT count(*) INTO mismatch_count FROM (
                    SELECT event.*,
                        row_number() OVER (ORDER BY event.sequence) AS row_position,
                        lag(event.to_status) OVER (ORDER BY event.sequence) AS prior_status,
                        operation.kind AS operation_kind,
                        operation.actor_type AS operation_actor_type,
                        operation.actor_user_id AS operation_actor_user_id
                    FROM order_fulfillment_events event
                    JOIN order_operations operation ON operation.id = event.operation_id
                    WHERE event.order_id = target_order.id
                ) sequenced
                WHERE sequence <> row_position
                    OR operation_actor_type IS DISTINCT FROM actor_type
                    OR operation_actor_user_id IS DISTINCT FROM actor_user_id
                    OR (row_position > 1 AND (
                        from_status IS DISTINCT FROM prior_status
                        OR operation_kind <> 'transition'
                        OR actor_type <> 'user'
                    ));
                IF mismatch_count <> 0 THEN
                    RAISE EXCEPTION 'order fulfillment history is inconsistent';
                END IF;

                SELECT count(*) INTO mismatch_count
                FROM order_fulfillment_events event
                WHERE event.order_id = target_order.id
                  AND event.sequence > 1
                  AND (
                    (event.to_status = 'preparing' AND NOT EXISTS (
                        SELECT 1 FROM order_status_history history
                        WHERE history.operation_id = event.operation_id
                          AND history.order_id = event.order_id
                          AND history.from_status = 'accepted'
                          AND history.to_status = 'processing'
                    ))
                    OR (event.to_status = 'dispatched' AND EXISTS (
                        SELECT 1 FROM order_status_history history
                        WHERE history.operation_id = event.operation_id
                    ))
                    OR (event.to_status = 'delivered' AND NOT EXISTS (
                        SELECT 1 FROM order_status_history history
                        WHERE history.operation_id = event.operation_id
                          AND history.order_id = event.order_id
                          AND history.from_status = 'processing'
                          AND history.to_status = 'completed'
                    ))
                  );
                IF mismatch_count <> 0 THEN
                    RAISE EXCEPTION 'order and fulfillment transitions are not atomically coupled';
                END IF;

                SELECT to_status, created_at INTO latest_status, latest_created_at
                FROM order_fulfillment_events
                WHERE order_id = target_order.id
                ORDER BY sequence DESC
                LIMIT 1;
                IF latest_status IS DISTINCT FROM fulfillment.status
                    OR latest_created_at IS DISTINCT FROM fulfillment.updated_at THEN
                    RAISE EXCEPTION 'order fulfillment current state is inconsistent';
                END IF;

                IF NOT (
                    (target_order.status IN ('submitted','accepted','cancelled','expired') AND fulfillment.status = 'unfulfilled')
                    OR (target_order.status = 'processing' AND fulfillment.status IN ('preparing','dispatched'))
                    OR (target_order.status = 'completed' AND fulfillment.status IN ('delivered','legacy_completed'))
                ) THEN
                    RAISE EXCEPTION 'order and fulfillment states are inconsistent';
                END IF;
            END;
            $$ LANGUAGE plpgsql;
            SQL);

        DB::unprepared(<<<'SQL'
            CREATE FUNCTION order_fulfillment_validate_order() RETURNS trigger AS $$
            BEGIN
                PERFORM order_fulfillment_assert_consistency(NEW.id);
                RETURN NULL;
            END;
            $$ LANGUAGE plpgsql;

            CREATE FUNCTION order_fulfillment_validate_child() RETURNS trigger AS $$
            BEGIN
                PERFORM order_fulfillment_assert_consistency(NEW.order_id);
                RETURN NULL;
            END;
            $$ LANGUAGE plpgsql;
            SQL);
    }

    private function createTriggers(): void
    {
        DB::unprepared('CREATE TRIGGER order_fulfillments_guarded_update BEFORE UPDATE OR DELETE ON order_fulfillments FOR EACH ROW EXECUTE FUNCTION order_fulfillment_guard_update()');
        DB::unprepared('CREATE TRIGGER order_fulfillment_events_immutable BEFORE UPDATE OR DELETE ON order_fulfillment_events FOR EACH ROW EXECUTE FUNCTION order_prevent_immutable_mutation()');
        DB::unprepared('CREATE TRIGGER order_guest_access_immutable BEFORE UPDATE OR DELETE ON order_guest_access FOR EACH ROW EXECUTE FUNCTION order_prevent_immutable_mutation()');

        DB::unprepared('CREATE CONSTRAINT TRIGGER orders_fulfillment_consistent AFTER INSERT OR UPDATE ON orders DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION order_fulfillment_validate_order()');
        DB::unprepared('CREATE CONSTRAINT TRIGGER order_fulfillments_order_consistent AFTER INSERT OR UPDATE ON order_fulfillments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION order_fulfillment_validate_child()');
        DB::unprepared('CREATE CONSTRAINT TRIGGER order_fulfillment_events_order_consistent AFTER INSERT ON order_fulfillment_events DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION order_fulfillment_validate_child()');
        DB::unprepared('CREATE CONSTRAINT TRIGGER order_guest_access_order_consistent AFTER INSERT ON order_guest_access DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION order_fulfillment_validate_child()');
    }
};
