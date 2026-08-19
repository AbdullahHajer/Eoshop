<?php

namespace App\Enums;

enum SystemRole: string
{
    case PlatformSuperAdmin = 'platform_super_admin';
    case PlatformReviewer = 'platform_reviewer';
    case MerchantOwner = 'merchant_owner';
    case MerchantStaff = 'merchant_staff';

    public function displayName(): string
    {
        return match ($this) {
            self::PlatformSuperAdmin => 'Platform Super Admin',
            self::PlatformReviewer => 'Platform Reviewer',
            self::MerchantOwner => 'Merchant Owner',
            self::MerchantStaff => 'Merchant Staff',
        };
    }

    public function scope(): RoleScope
    {
        return match ($this) {
            self::PlatformSuperAdmin, self::PlatformReviewer => RoleScope::Platform,
            self::MerchantOwner, self::MerchantStaff => RoleScope::Tenant,
        };
    }

    /**
     * @return list<PermissionKey>
     */
    public function permissions(): array
    {
        return match ($this) {
            self::PlatformSuperAdmin => [
                PermissionKey::PlatformStoresView,
                PermissionKey::PlatformStoresReview,
                PermissionKey::PlatformStoresManage,
                PermissionKey::PlatformUsersManage,
                PermissionKey::PlatformAuditView,
            ],
            self::PlatformReviewer => [
                PermissionKey::PlatformStoresView,
                PermissionKey::PlatformStoresReview,
                PermissionKey::PlatformAuditView,
            ],
            self::MerchantOwner => [
                PermissionKey::TenantStoreManage,
                PermissionKey::TenantPublicationManage,
                PermissionKey::TenantMembersManage,
                PermissionKey::TenantProductsManage,
                PermissionKey::TenantInventoryView,
                PermissionKey::TenantInventoryManage,
                PermissionKey::TenantOrdersView,
                PermissionKey::TenantOrdersManage,
                PermissionKey::TenantAnalyticsView,
            ],
            self::MerchantStaff => [
                PermissionKey::TenantProductsManage,
                PermissionKey::TenantInventoryView,
                PermissionKey::TenantInventoryManage,
                PermissionKey::TenantOrdersView,
                PermissionKey::TenantOrdersManage,
                PermissionKey::TenantAnalyticsView,
            ],
        };
    }
}
