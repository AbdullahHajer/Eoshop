<?php

namespace App\Services;

use App\Enums\PermissionKey;
use App\Enums\ProductMediaSource;
use App\Enums\ProductStatus;
use App\Enums\TenantMembershipStatus;
use App\Exceptions\ProductCatalogConflict;
use App\Models\Tenant;
use App\Models\User;
use App\Support\CanonicalDomain;
use App\Support\TenantRuntimeReadiness;
use App\Support\TenantWorkspaceReadiness;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CatalogMediaService
{
    /** @return array{id: string, url: string, mimeType: string, byteSize: int} */
    public function upload(Tenant $tenant, User $actor, UploadedFile $file, string $idempotencyKey): array
    {
        return $this->withLockedMembership($tenant, $actor, function (Tenant $lockedTenant) use ($actor, $file, $idempotencyKey): array {
            $realPath = $file->getRealPath();
            if (! is_string($realPath) || ! is_file($realPath)) {
                throw new RuntimeException('The uploaded image is unavailable.');
            }
            $byteSize = filesize($realPath);
            $dimensions = @getimagesize($realPath);
            $mime = is_array($dimensions) ? $dimensions['mime'] : null;
            $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
            if (! is_int($byteSize) || $byteSize <= 0 || $byteSize > (int) config('catalog.max_media_bytes')
                || ! is_array($dimensions) || ! is_string($mime) || ! isset($allowed[$mime])
                || (int) $dimensions[0] <= 0 || (int) $dimensions[1] <= 0
                || ((int) $dimensions[0] * (int) $dimensions[1]) > (int) config('catalog.max_media_pixels')) {
                throw new ProductCatalogConflict('The image type, size or dimensions are not allowed.', 'catalog_media_invalid');
            }
            $checksum = hash_file('sha256', $realPath);
            if (! is_string($checksum)) {
                throw new RuntimeException('The uploaded image checksum could not be calculated.');
            }

            return $lockedTenant->run(function () use ($lockedTenant, $actor, $realPath, $idempotencyKey, $byteSize, $mime, $allowed, $checksum): array {
                $existing = DB::table('product_media')->where('uploaded_by_user_id', $actor->getKey())
                    ->where('upload_idempotency_key', $idempotencyKey)->first();
                if ($existing !== null) {
                    return $this->replay($lockedTenant, $existing, $checksum);
                }

                $id = (string) Str::uuid();
                $disk = (string) config('catalog.media_disk');
                $path = $this->managedPath($lockedTenant, $id, $allowed[$mime]);
                $stream = fopen($realPath, 'rb');
                if ($stream === false) {
                    throw new RuntimeException('The uploaded image could not be opened.');
                }
                try {
                    $stored = Storage::disk($disk)->put($path, $stream);
                } finally {
                    fclose($stream);
                }
                if (! $stored) {
                    throw new RuntimeException('The uploaded image could not be stored.');
                }

                try {
                    DB::transaction(function () use ($id, $actor, $idempotencyKey, $disk, $path, $mime, $byteSize, $checksum): void {
                        DB::table('product_media')->insert([
                            'id' => $id,
                            'source_type' => ProductMediaSource::Managed->value,
                            'disk' => $disk,
                            'path' => $path,
                            'mime_type' => $mime,
                            'byte_size' => $byteSize,
                            'checksum_sha256' => $checksum,
                            'uploaded_by_user_id' => $actor->getKey(),
                            'upload_idempotency_key' => $idempotencyKey,
                            'position' => 0,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    });
                } catch (QueryException $exception) {
                    Storage::disk($disk)->delete($path);
                    $winner = DB::table('product_media')->where('uploaded_by_user_id', $actor->getKey())
                        ->where('upload_idempotency_key', $idempotencyKey)->first();
                    if ($winner !== null) {
                        return $this->replay($lockedTenant, $winner, $checksum);
                    }
                    throw $exception;
                } catch (\Throwable $exception) {
                    Storage::disk($disk)->delete($path);
                    throw $exception;
                }

                return $this->resource($lockedTenant, (object) [
                    'id' => $id, 'mime_type' => $mime, 'byte_size' => $byteSize,
                ]);
            });
        });
    }

    public function response(Tenant $tenant, string $mediaId, Request $request): StreamedResponse
    {
        $host = CanonicalDomain::normalize($request->getHost());
        $central = in_array($host, config('tenancy.central_domains', []), true);
        $actor = $request->user();
        $authorizedPreview = $central && $actor instanceof User
            && $actor->hasTenantPermission($tenant, PermissionKey::TenantProductsManage);

        if (($central && ! $authorizedPreview)
            || (! $central && (! TenantRuntimeReadiness::check($tenant, $host)
                || ! TenantWorkspaceReadiness::isMaterialized($tenant)))) {
            abort(404);
        }

        $media = $tenant->run(fn (): ?object => DB::table('product_media')
            ->leftJoin('products', 'products.id', '=', 'product_media.product_id')
            ->where('product_media.id', $mediaId)
            ->where('product_media.source_type', ProductMediaSource::Managed->value)
            ->select(['product_media.*', 'products.status as product_status'])
            ->first());
        if ($media === null || (! $authorizedPreview && $media->product_status !== ProductStatus::Published->value)) {
            abort(404);
        }

        $disk = (string) $media->disk;
        $path = (string) $media->path;
        $prefix = $this->tenantPrefix($tenant);
        if ($disk !== (string) config('catalog.media_disk') || ! str_starts_with($path, $prefix)
            || str_contains($path, '..') || str_contains($path, '\\') || ! Storage::disk($disk)->exists($path)) {
            abort(404);
        }

        return Storage::disk($disk)->response($path, null, [
            'Content-Type' => (string) $media->mime_type,
            'Cache-Control' => $authorizedPreview ? 'private, no-store' : 'public, max-age=31536000, immutable',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function pruneOrphans(Tenant $tenant): int
    {
        if (! TenantWorkspaceReadiness::maintenanceCheck($tenant)) {
            return 0;
        }

        return $tenant->run(function () use ($tenant): int {
            $cutoff = now()->subHours((int) config('catalog.orphan_retention_hours'));
            $ids = DB::table('product_media')
                ->whereNull('product_id')->where('source_type', ProductMediaSource::Managed->value)
                ->where(function ($query) use ($cutoff): void {
                    $query->where('created_at', '<=', $cutoff)->orWhereNotNull('cleanup_started_at');
                })->pluck('id');
            $deleted = 0;
            foreach ($ids as $id) {
                $claimed = DB::transaction(function () use ($tenant, $id): ?object {
                    $row = DB::table('product_media')->where('id', $id)
                        ->whereNull('product_id')->where('source_type', ProductMediaSource::Managed->value)
                        ->lockForUpdate()->first();
                    if ($row === null) {
                        return null;
                    }

                    $disk = (string) $row->disk;
                    $path = (string) $row->path;
                    if ($disk !== (string) config('catalog.media_disk') || ! str_starts_with($path, $this->tenantPrefix($tenant))
                        || str_contains($path, '..') || str_contains($path, '\\')) {
                        return null;
                    }

                    DB::table('product_media')->where('id', $row->id)->update([
                        'cleanup_started_at' => $row->cleanup_started_at ?? now(),
                        'updated_at' => now(),
                    ]);

                    return $row;
                });
                if ($claimed === null) {
                    continue;
                }

                $disk = (string) $claimed->disk;
                $path = (string) $claimed->path;
                if (Storage::disk($disk)->exists($path) && ! Storage::disk($disk)->delete($path)) {
                    continue;
                }

                $deleted += DB::transaction(function () use ($id, $disk, $path): int {
                    $row = DB::table('product_media')->where('id', $id)->lockForUpdate()->first();
                    if ($row === null) {
                        return 0;
                    }
                    if ($row->product_id !== null || $row->source_type !== ProductMediaSource::Managed->value
                        || $row->cleanup_started_at === null || $row->disk !== $disk || $row->path !== $path) {
                        return 0;
                    }

                    return DB::table('product_media')->where('id', $row->id)->whereNull('product_id')->delete();
                });
            }

            return $deleted;
        });
    }

    private function replay(Tenant $tenant, object $media, string $checksum): array
    {
        if (! hash_equals((string) $media->checksum_sha256, $checksum)) {
            throw new ProductCatalogConflict('The media idempotency key was reused for different content.', 'media_idempotency_conflict');
        }

        return $this->resource($tenant, $media);
    }

    private function resource(Tenant $tenant, object $media): array
    {
        return [
            'id' => (string) $media->id,
            'url' => '/api/catalog-media/'.$tenant->getKey().'/'.$media->id,
            'mimeType' => (string) $media->mime_type,
            'byteSize' => (int) $media->byte_size,
        ];
    }

    private function tenantPrefix(Tenant $tenant): string
    {
        return 'catalog/'.preg_replace('/[^a-z0-9-]/', '', mb_strtolower((string) $tenant->getKey())).'/';
    }

    private function managedPath(Tenant $tenant, string $id, string $extension): string
    {
        return $this->tenantPrefix($tenant).substr($id, 0, 2).'/'.$id.'.'.$extension;
    }

    /**
     * @template T
     *
     * @param  callable(Tenant): T  $operation
     * @return T
     */
    private function withLockedMembership(Tenant $tenant, User $actor, callable $operation): mixed
    {
        $central = DB::connection((string) config('tenancy.database.central_connection'));

        return $central->transaction(function () use ($central, $tenant, $actor, $operation): mixed {
            $lockedTenant = Tenant::query()->whereKey($tenant->getKey())->lockForUpdate()->firstOrFail();
            $membership = $central->table('tenant_user')->where('tenant_id', $lockedTenant->getKey())
                ->where('user_id', $actor->getKey())->lockForUpdate()->first();
            if ($membership === null || $membership->status !== TenantMembershipStatus::Active->value
                || ! $actor->hasTenantPermission($lockedTenant, PermissionKey::TenantProductsManage)) {
                throw new AuthorizationException('Product management permission is required.');
            }

            return $operation($lockedTenant);
        });
    }
}
