<?php

namespace App\Services;

use App\Enums\StoreDraftStatus;
use App\Enums\StoreOnboardingStage;
use App\Enums\UserStatus;
use App\Exceptions\StoreDraftConflict;
use App\Exceptions\StoreOnboardingFailure;
use App\Exceptions\StoreSubmissionConflict;
use App\Models\Plan;
use App\Models\StoreDraft;
use App\Models\StoreSubmission;
use App\Models\Tenant;
use App\Models\User;
use App\Support\PublicStoreHandle;
use App\Support\StoreOnboardingAppearance;
use App\Support\StoreOnboardingBaseline;
use App\Support\StoreWorkspaceContract;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class StoreDraftService
{
    public function __construct(
        private readonly AdminAuditService $audit,
        private readonly MerchantMembershipService $memberships,
        private readonly DomainReservationService $domains,
    ) {}

    public function current(User $actor): ?StoreDraft
    {
        return StoreDraft::query()
            ->where('owner_user_id', $actor->getKey())
            ->whereNull('tenant_id')
            ->where('status', StoreDraftStatus::Draft)
            ->first();
    }

    public function correction(Tenant $tenant, User $actor): StoreDraft
    {
        Gate::forUser($actor)->authorize('editStoreDraft', $tenant);

        $draft = StoreDraft::query()->where('tenant_id', $tenant->getKey())->firstOrFail();
        if ($draft->getAttribute('status') !== StoreDraftStatus::CorrectionRequired) {
            throw StoreDraftConflict::state();
        }

        return $draft;
    }

    /** @param array{expectedRevision: int, storeName: string, businessType: string} $input */
    public function saveBusiness(array $input, User $actor, Request $request): StoreDraft
    {
        return DB::connection((string) config('tenancy.database.central_connection'))
            ->transaction(function () use ($input, $actor, $request): StoreDraft {
                $lockedActor = $this->lockActiveActor($actor);
                $draft = $this->lockUnboundDraft($lockedActor);
                $this->assertExpectedRevision($draft, (int) $input['expectedRevision']);

                $name = trim($input['storeName']);
                $businessType = trim($input['businessType']);
                if ($draft === null) {
                    $config = StoreOnboardingBaseline::make($name);
                    $validator = StoreWorkspaceContract::validator($config, null);
                    if ($validator->fails()) {
                        throw ValidationException::withMessages($validator->errors()->toArray());
                    }
                    $draft = StoreDraft::query()->create([
                        'owner_user_id' => $lockedActor->getKey(),
                        'tenant_id' => null,
                        'status' => StoreDraftStatus::Draft,
                        'revision' => 1,
                        'onboarding_stage' => StoreOnboardingStage::Business,
                        'onboarding_stage_baseline' => StoreOnboardingStage::Business,
                        'store_name' => $name,
                        'business_type' => $businessType,
                        'theme_style' => 'elegant',
                        'handle' => null,
                        'plan_key' => null,
                        'config' => $config,
                        'saved_at' => now(),
                        'submitted_at' => null,
                    ]);
                    $this->auditOnboarding($request, $lockedActor, $draft, null, ['storeName', 'businessType', 'onboardingStage']);

                    return $draft->refresh();
                }

                $config = (array) $draft->getAttribute('config');
                $config['storeName'] = $name;
                $changes = [];
                if ($draft->getAttribute('store_name') !== $name) {
                    $changes[] = 'storeName';
                }
                if ($draft->getAttribute('business_type') !== $businessType) {
                    $changes[] = 'businessType';
                }
                if ($draft->getAttribute('config') !== $config) {
                    $changes[] = 'config.storeName';
                }
                if ($changes === []) {
                    return $draft;
                }

                $oldRevision = (int) $draft->getAttribute('revision');
                $draft->forceFill([
                    'store_name' => $name,
                    'business_type' => $businessType,
                    'config' => $config,
                    'revision' => $oldRevision + 1,
                    'saved_at' => now(),
                ])->save();
                $this->auditOnboarding($request, $lockedActor, $draft, $oldRevision, $changes);

                return $draft->refresh();
            });
    }

    /** @param array{expectedRevision: int, themeStyle: string, config: array<string, mixed>} $input */
    public function saveDesign(array $input, User $actor, Request $request): StoreDraft
    {
        return DB::connection((string) config('tenancy.database.central_connection'))
            ->transaction(function () use ($input, $actor, $request): StoreDraft {
                $lockedActor = $this->lockActiveActor($actor);
                $draft = $this->lockUnboundDraft($lockedActor);
                if ($draft === null) {
                    throw StoreOnboardingFailure::prerequisite();
                }
                $this->assertExpectedRevision($draft, (int) $input['expectedRevision']);

                $config = StoreOnboardingAppearance::merge(
                    (array) $draft->getAttribute('config'),
                    (string) $draft->getAttribute('store_name'),
                    $input['themeStyle'],
                    $input['config'],
                );
                $validator = StoreWorkspaceContract::validator($config, null);
                if ($validator->fails()) {
                    throw ValidationException::withMessages($validator->errors()->toArray());
                }
                $currentStage = $draft->getAttribute('onboarding_stage');
                if (! $currentStage instanceof StoreOnboardingStage) {
                    throw StoreOnboardingFailure::prerequisite();
                }
                $nextStage = $currentStage->rank() < StoreOnboardingStage::Design->rank()
                    ? StoreOnboardingStage::Design
                    : $currentStage;
                $changes = [];
                if ($draft->getAttribute('theme_style') !== $input['themeStyle']) {
                    $changes[] = 'themeStyle';
                }
                if ($draft->getAttribute('config') !== $config) {
                    $changes[] = 'config';
                }
                if ($currentStage !== $nextStage) {
                    $changes[] = 'onboardingStage';
                }
                if ($changes === []) {
                    return $draft;
                }

                $oldRevision = (int) $draft->getAttribute('revision');
                $draft->forceFill([
                    'theme_style' => $input['themeStyle'],
                    'config' => $config,
                    'onboarding_stage' => $nextStage,
                    'revision' => $oldRevision + 1,
                    'saved_at' => now(),
                ])->save();
                $this->auditOnboarding($request, $lockedActor, $draft, $oldRevision, $changes);

                return $draft->refresh();
            });
    }

    /** @param array{expectedRevision: int, handle: string, planKey: string} $input */
    public function saveReview(array $input, User $actor, Request $request): StoreDraft
    {
        return DB::connection((string) config('tenancy.database.central_connection'))
            ->transaction(function () use ($input, $actor, $request): StoreDraft {
                $lockedActor = $this->lockActiveActor($actor);
                $draft = $this->lockUnboundDraft($lockedActor);
                if ($draft === null || ! $draft->getAttribute('onboarding_stage') instanceof StoreOnboardingStage
                    || $draft->getAttribute('onboarding_stage')->rank() < StoreOnboardingStage::Design->rank()
                ) {
                    throw StoreOnboardingFailure::prerequisite();
                }
                $this->assertExpectedRevision($draft, (int) $input['expectedRevision']);

                $plan = Plan::query()->whereKey($input['planKey'])->where('is_active', true)->lockForUpdate()->first();
                if (! $plan instanceof Plan) {
                    throw ValidationException::withMessages(['planKey' => ['الباقة المحددة غير متاحة.']]);
                }
                $config = (array) $draft->getAttribute('config');
                $validator = StoreWorkspaceContract::validator(
                    $config,
                    $plan->getAttribute('max_products') === null ? null : (int) $plan->getAttribute('max_products'),
                );
                if ($validator->fails()) {
                    throw ValidationException::withMessages($validator->errors()->toArray());
                }
                $handle = PublicStoreHandle::normalize($input['handle']);
                try {
                    $this->domains->assertAvailable($handle);
                } catch (StoreSubmissionConflict) {
                    throw StoreOnboardingFailure::domainUnavailable();
                }

                $changes = [];
                if ($draft->getAttribute('handle') !== $handle) {
                    $changes[] = 'handle';
                }
                if ($draft->getAttribute('plan_key') !== $plan->getKey()) {
                    $changes[] = 'planKey';
                }
                if ($draft->getAttribute('onboarding_stage') !== StoreOnboardingStage::Review) {
                    $changes[] = 'onboardingStage';
                }
                if ($changes === []) {
                    return $draft;
                }

                $oldRevision = (int) $draft->getAttribute('revision');
                $draft->forceFill([
                    'handle' => $handle,
                    'plan_key' => $plan->getKey(),
                    'onboarding_stage' => StoreOnboardingStage::Review,
                    'revision' => $oldRevision + 1,
                    'saved_at' => now(),
                ])->save();
                $this->auditOnboarding($request, $lockedActor, $draft, $oldRevision, $changes);

                return $draft->refresh();
            });
    }

    /** @param array<string, mixed> $input */
    public function saveUnbound(array $input, User $actor, Request $request): StoreDraft
    {
        return DB::connection((string) config('tenancy.database.central_connection'))
            ->transaction(function () use ($input, $actor, $request): StoreDraft {
                $lockedActor = $this->lockActiveActor($actor);
                $draft = StoreDraft::query()
                    ->where('owner_user_id', $lockedActor->getKey())
                    ->whereNull('tenant_id')
                    ->where('status', StoreDraftStatus::Draft)
                    ->lockForUpdate()
                    ->first();
                $expected = (int) $input['expectedRevision'];
                if (($draft === null && $expected !== 0)
                    || ($draft !== null && (int) $draft->getAttribute('revision') !== $expected)
                ) {
                    throw StoreDraftConflict::revision();
                }

                $values = $this->validatedValues($input);
                $legacyTargetStage = $values['handle'] !== null && $values['plan_key'] !== null
                    ? StoreOnboardingStage::Review
                    : StoreOnboardingStage::Design;
                $oldRevision = $draft === null ? 0 : (int) $draft->getAttribute('revision');
                $oldValues = $draft === null ? null : $this->auditSummary($draft);
                if ($draft === null) {
                    $draft = StoreDraft::query()->create($values + [
                        'owner_user_id' => $lockedActor->getKey(),
                        'tenant_id' => null,
                        'status' => StoreDraftStatus::Draft,
                        'revision' => 1,
                        'onboarding_stage' => $legacyTargetStage,
                        'onboarding_stage_baseline' => $legacyTargetStage,
                        'saved_at' => now(),
                        'submitted_at' => null,
                    ]);
                } else {
                    $currentStage = $draft->getAttribute('onboarding_stage');
                    $nextStage = $currentStage instanceof StoreOnboardingStage && $currentStage->rank() > $legacyTargetStage->rank()
                        ? $currentStage
                        : $legacyTargetStage;
                    $draft->forceFill($values + [
                        'onboarding_stage' => $nextStage,
                        'revision' => $oldRevision + 1,
                        'saved_at' => now(),
                    ])->save();
                }
                $this->audit->record(
                    request: $request,
                    actor: $lockedActor,
                    action: 'merchant.store_draft.saved',
                    subject: $draft,
                    tenant: null,
                    oldValues: $oldValues,
                    newValues: $this->auditSummary($draft),
                );

                return $draft->refresh();
            });
    }

    /** @param array<string, mixed> $input */
    public function saveCorrection(Tenant $tenant, array $input, User $actor, Request $request): StoreDraft
    {
        return DB::connection((string) config('tenancy.database.central_connection'))
            ->transaction(function () use ($tenant, $input, $actor, $request): StoreDraft {
                $lockedActor = $this->lockActiveActor($actor);
                $lockedTenant = Tenant::query()->whereKey($tenant->getKey())->lockForUpdate()->firstOrFail();
                $this->memberships->lockActiveOwner($lockedTenant, $lockedActor);
                StoreSubmission::query()->where('tenant_id', $lockedTenant->getKey())->lockForUpdate()->firstOrFail();
                $draft = StoreDraft::query()->where('tenant_id', $lockedTenant->getKey())->lockForUpdate()->firstOrFail();
                Gate::forUser($lockedActor)->authorize('editStoreDraft', $lockedTenant);
                if ($draft->getAttribute('status') !== StoreDraftStatus::CorrectionRequired) {
                    throw StoreDraftConflict::state();
                }
                if ((int) $draft->getAttribute('revision') !== (int) $input['expectedRevision']) {
                    throw StoreDraftConflict::revision();
                }

                $oldValues = $this->auditSummary($draft);
                $draft->forceFill($this->validatedValues($input) + [
                    'revision' => ((int) $draft->getAttribute('revision')) + 1,
                    'saved_at' => now(),
                ])->save();
                $this->audit->record(
                    request: $request,
                    actor: $lockedActor,
                    action: 'merchant.store_correction.saved',
                    subject: $draft,
                    tenant: $lockedTenant,
                    oldValues: $oldValues,
                    newValues: $this->auditSummary($draft),
                );

                return $draft->refresh();
            });
    }

    public function markCorrectionRequired(Tenant $lockedTenant): StoreDraft
    {
        StoreSubmission::query()->where('tenant_id', $lockedTenant->getKey())->lockForUpdate()->firstOrFail();
        $draft = StoreDraft::query()->where('tenant_id', $lockedTenant->getKey())->lockForUpdate()->firstOrFail();
        if ($draft->getAttribute('status') === StoreDraftStatus::CorrectionRequired) {
            return $draft;
        }
        if ($draft->getAttribute('status') !== StoreDraftStatus::Submitted) {
            throw StoreDraftConflict::state();
        }

        $draft->forceFill([
            'status' => StoreDraftStatus::CorrectionRequired,
            'revision' => ((int) $draft->getAttribute('revision')) + 1,
            'saved_at' => now(),
        ])->save();

        return $draft;
    }

    private function lockUnboundDraft(User $actor): ?StoreDraft
    {
        return StoreDraft::query()
            ->where('owner_user_id', $actor->getKey())
            ->whereNull('tenant_id')
            ->where('status', StoreDraftStatus::Draft)
            ->lockForUpdate()
            ->first();
    }

    private function assertExpectedRevision(?StoreDraft $draft, int $expected): void
    {
        if (($draft === null && $expected !== 0)
            || ($draft !== null && (int) $draft->getAttribute('revision') !== $expected)
        ) {
            throw StoreDraftConflict::revision();
        }
    }

    /** @param list<string> $changedFields */
    private function auditOnboarding(
        Request $request,
        User $actor,
        StoreDraft $draft,
        ?int $oldRevision,
        array $changedFields,
    ): void {
        $stage = $draft->getAttribute('onboarding_stage');
        $this->audit->record(
            request: $request,
            actor: $actor,
            action: 'merchant.store_onboarding.saved',
            subject: $draft,
            tenant: null,
            oldValues: $oldRevision === null ? null : ['revision' => $oldRevision],
            newValues: [
                'revision' => (int) $draft->getAttribute('revision'),
                'onboarding_stage' => $stage instanceof StoreOnboardingStage ? $stage->value : null,
                'changed_fields' => $changedFields,
            ],
        );
    }

    private function lockActiveActor(User $actor): User
    {
        $locked = User::withTrashed()->whereKey($actor->getKey())->lockForUpdate()->firstOrFail();
        if ($locked->trashed() || $locked->getAttribute('status') !== UserStatus::Active) {
            throw new AuthorizationException('The merchant account is not active.');
        }

        return $locked;
    }

    /** @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    private function validatedValues(array $input): array
    {
        $plan = null;
        if (is_string($input['planKey'] ?? null) && $input['planKey'] !== '') {
            $plan = Plan::query()->whereKey($input['planKey'])->where('is_active', true)->lockForUpdate()->firstOrFail();
        }
        $config = $input['config'];
        $validator = StoreWorkspaceContract::validator(
            $config,
            $plan?->getAttribute('max_products') === null ? null : (int) $plan->getAttribute('max_products'),
        );
        if ($validator->fails()) {
            throw ValidationException::withMessages($validator->errors()->toArray());
        }

        return [
            'store_name' => trim((string) $input['storeName']),
            'business_type' => trim((string) $input['businessType']),
            'theme_style' => $input['themeStyle'],
            'handle' => isset($input['handle']) && $input['handle'] !== ''
                ? PublicStoreHandle::normalize((string) $input['handle'])
                : null,
            'plan_key' => $plan?->getKey(),
            'config' => $config,
        ];
    }

    /** @return array<string, mixed> */
    private function auditSummary(StoreDraft $draft): array
    {
        return [
            'revision' => (int) $draft->getAttribute('revision'),
            'status' => $draft->getAttribute('status')->value,
            'store_name' => $draft->getAttribute('store_name'),
            'business_type' => $draft->getAttribute('business_type'),
            'theme_style' => $draft->getAttribute('theme_style'),
            'handle' => $draft->getAttribute('handle'),
            'plan_key' => $draft->getAttribute('plan_key'),
            'changed_fields' => ['storeName', 'businessType', 'themeStyle', 'handle', 'planKey', 'config'],
        ];
    }
}
