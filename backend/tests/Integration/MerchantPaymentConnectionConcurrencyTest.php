<?php

namespace Tests\Integration;

use App\Enums\SystemRole;
use App\Enums\UserStatus;
use App\Exceptions\PaymentConnectionConflict;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Services\Payments\MerchantPaymentConnectionService;
use App\Services\RoleAssignmentService;
use Database\Seeders\IdentitySeeder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;
use Throwable;

#[Group('database')]
class MerchantPaymentConnectionConcurrencyTest extends TestCase
{
    private ?string $tenantId = null;

    private ?string $userId = null;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(IdentitySeeder::class);
        config()->set('payments.credential_vault', [
            'current_key_version' => 'test-enc-v1',
            'current_key' => 'base64:'.base64_encode(str_repeat('E', 32)),
            'previous_key_version' => null,
            'previous_key' => null,
            'fingerprint_current_key_version' => 'test-fp-v1',
            'fingerprint_current_key' => 'base64:'.base64_encode(str_repeat('F', 32)),
            'fingerprint_previous_key_version' => null,
            'fingerprint_previous_key' => null,
            'fingerprint_retained_keys' => null,
        ]);
    }

    protected function tearDown(): void
    {
        $centralName = (string) config('tenancy.database.central_connection');
        DB::purge($centralName);
        $central = DB::connection($centralName);
        if ($this->tenantId !== null) {
            $operationIds = $central->table('payment_connection_operations')
                ->where('tenant_id', $this->tenantId)
                ->pluck('id');
            $central->table('payment_connection_operation_results')
                ->whereIn('operation_id', $operationIds)
                ->delete();
            $central->table('payment_connection_operations')->where('tenant_id', $this->tenantId)->delete();
            $central->table('merchant_payment_connections')->where('tenant_id', $this->tenantId)->delete();
            $central->table('admin_audit_logs')->where('tenant_id', $this->tenantId)->delete();
            $central->table('tenant_user')->where('tenant_id', $this->tenantId)->delete();
            $central->table('tenants')->where('id', $this->tenantId)->delete();
        }
        if ($this->userId !== null) {
            $central->table('admin_audit_logs')->where(function ($query): void {
                $query->where('actor_user_id', $this->userId)
                    ->orWhere('subject_id', $this->userId);
            })->delete();
            $central->table('role_user')->where('user_id', $this->userId)->delete();
            $central->table('users')->where('id', $this->userId)->delete();
        }

        parent::tearDown();
    }

    public function test_two_first_writers_from_revision_zero_have_one_winner_and_one_conflict(): void
    {
        [$tenant, $owner] = $this->ownedTenant('payment-concurrency');

        $outcomes = $this->runConcurrent([
            fn (): array => app(MerchantPaymentConnectionService::class)->configure(
                $tenant,
                $owner,
                $this->payload('first-fake-client-secret'),
                Request::create('/api/merchant/stores/payment-concurrency/payment-connections/basgate', 'PUT'),
            ),
            fn (): array => app(MerchantPaymentConnectionService::class)->configure(
                $tenant,
                $owner,
                $this->payload('second-fake-client-secret'),
                Request::create('/api/merchant/stores/payment-concurrency/payment-connections/basgate', 'PUT'),
            ),
        ]);

        $this->assertSame(['ok', 'payment_connection_revision_conflict'], collect($outcomes)->sort()->values()->all());
        $this->assertSame(1, DB::table('merchant_payment_connections')->where('tenant_id', $tenant->getKey())->count());
        $this->assertSame(1, DB::table('payment_connection_operations')->where('tenant_id', $tenant->getKey())->count());
        $this->assertSame(1, DB::table('admin_audit_logs')
            ->where('tenant_id', $tenant->getKey())
            ->where('action', 'merchant.payment_connection.configured')
            ->count());
    }

    public function test_same_idempotency_key_and_payload_concurrently_create_once_then_replay(): void
    {
        [$tenant, $owner] = $this->ownedTenant('payment-idempotency-race');
        $idempotencyKey = (string) Str::uuid();
        $operation = function () use ($tenant, $owner, $idempotencyKey): string {
            $result = app(MerchantPaymentConnectionService::class)->configure(
                $tenant,
                $owner,
                $this->payload('shared-fake-client-secret', $idempotencyKey),
                Request::create('/api/merchant/stores/payment-idempotency-race/payment-connections/basgate', 'PUT'),
            );

            return $result['replayed'] ? 'replayed' : 'created';
        };

        $outcomes = $this->runConcurrent([$operation, $operation]);

        $this->assertSame(['created', 'replayed'], collect($outcomes)->sort()->values()->all());
        $this->assertSame(1, DB::table('merchant_payment_connections')->where('tenant_id', $tenant->getKey())->count());
        $this->assertSame(1, DB::table('payment_connection_operations')->where('tenant_id', $tenant->getKey())->count());
        $this->assertSame(1, DB::table('payment_connection_operation_results')
            ->whereIn('operation_id', DB::table('payment_connection_operations')
                ->select('id')
                ->where('tenant_id', $tenant->getKey()))
            ->count());
        $this->assertSame(1, DB::table('admin_audit_logs')
            ->where('tenant_id', $tenant->getKey())
            ->where('action', 'merchant.payment_connection.configured')
            ->count());
    }

    /**
     * @param  list<callable(): mixed>  $operations
     * @return list<string>
     */
    private function runConcurrent(array $operations): array
    {
        if (! function_exists('pcntl_fork') || ! function_exists('stream_socket_pair')) {
            $this->fail('The database gate requires pcntl and socket pairs for payment connection concurrency.');
        }

        $workers = [];
        foreach ($operations as $operation) {
            $sockets = stream_socket_pair(STREAM_PF_UNIX, STREAM_SOCK_STREAM, STREAM_IPPROTO_IP);
            if ($sockets === false) {
                $this->fail('Unable to create the payment connection concurrency barrier.');
            }
            [$parentSocket, $childSocket] = $sockets;
            $pid = pcntl_fork();
            if ($pid === -1) {
                $this->fail('Unable to fork a payment connection worker.');
            }
            if ($pid === 0) {
                fclose($parentSocket);
                fread($childSocket, 1);
                try {
                    $central = (string) config('tenancy.database.central_connection');
                    DB::purge('tenant');
                    DB::purge($central);
                    DB::setDefaultConnection($central);
                    $outcome = $operation();
                    $result = is_string($outcome) ? $outcome : 'ok';
                } catch (PaymentConnectionConflict $exception) {
                    $result = $exception->errorCode;
                } catch (Throwable $exception) {
                    $result = 'error:'.$exception::class.':'.$exception->getMessage();
                }
                fwrite($childSocket, $result);
                fclose($childSocket);
                exit(0);
            }
            fclose($childSocket);
            $workers[] = ['pid' => $pid, 'socket' => $parentSocket];
        }

        foreach ($workers as $worker) {
            fwrite($worker['socket'], '1');
        }

        $results = [];
        foreach ($workers as $worker) {
            $result = (string) stream_get_contents($worker['socket']);
            fclose($worker['socket']);
            pcntl_waitpid($worker['pid'], $status);
            $this->assertTrue(pcntl_wifexited($status) && pcntl_wexitstatus($status) === 0);
            $this->assertFalse(str_starts_with($result, 'error:'), $result);
            $results[] = $result;
        }
        DB::purge((string) config('tenancy.database.central_connection'));

        return $results;
    }

    /** @return array<string, mixed> */
    private function payload(string $clientSecret, ?string $idempotencyKey = null): array
    {
        return [
            'expectedRevision' => 0,
            'environment' => 'sandbox',
            'credentials' => [
                'appId' => '41111111-1111-4111-8111-111111111111',
                'merchantKey' => 'concurrency-fake-merchant-key',
                'clientId' => '42222222-2222-4222-8222-222222222222',
                'clientSecret' => $clientSecret,
            ],
            'idempotencyKey' => $idempotencyKey ?? (string) Str::uuid(),
            'requestId' => null,
        ];
    }

    /** @return array{Tenant, User} */
    private function ownedTenant(string $id): array
    {
        $tenant = Tenant::query()->create([
            'id' => $id,
            'store_name' => 'Payment Concurrency Store',
            'owner_name' => 'Payment Owner',
            'owner_email' => $id.'@example.test',
            'business_type' => 'retail',
        ]);
        $owner = User::query()->create([
            'name' => 'Payment Concurrency Owner',
            'email' => $id.'-owner@example.test',
            'password' => 'not-a-real-password',
            'status' => UserStatus::Active,
        ]);
        $this->tenantId = (string) $tenant->getKey();
        $this->userId = (string) $owner->getKey();
        app(RoleAssignmentService::class)->assignTenantRole(
            $tenant,
            $owner,
            Role::query()->where('key', SystemRole::MerchantOwner->value)->firstOrFail(),
            $owner,
        );

        return [$tenant, $owner];
    }
}
