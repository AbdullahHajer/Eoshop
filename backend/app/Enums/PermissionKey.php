<?php

namespace App\Enums;

enum PermissionKey: string
{
    case PlatformStoresView = 'platform.stores.view';
    case PlatformStoresReview = 'platform.stores.review';
    case PlatformStoresManage = 'platform.stores.manage';
    case PlatformUsersManage = 'platform.users.manage';
    case PlatformSettingsManage = 'platform.settings.manage';
    case PlatformAuditView = 'platform.audit.view';
    case TenantStoreManage = 'tenant.store.manage';
    case TenantPublicationManage = 'tenant.publication.manage';
    case TenantMembersManage = 'tenant.members.manage';
    case TenantProductsManage = 'tenant.products.manage';
    case TenantInventoryView = 'tenant.inventory.view';
    case TenantInventoryManage = 'tenant.inventory.manage';
    case TenantOrdersView = 'tenant.orders.view';
    case TenantOrdersManage = 'tenant.orders.manage';
    case TenantAnalyticsView = 'tenant.analytics.view';

    public function scope(): RoleScope
    {
        return str_starts_with($this->value, 'platform.')
            ? RoleScope::Platform
            : RoleScope::Tenant;
    }

    public function displayName(): string
    {
        return match ($this) {
            self::PlatformStoresView => 'View platform stores',
            self::PlatformStoresReview => 'Review platform stores',
            self::PlatformStoresManage => 'Manage platform stores',
            self::PlatformUsersManage => 'Manage platform users',
            self::PlatformSettingsManage => 'Manage platform settings',
            self::PlatformAuditView => 'View platform audit log',
            self::TenantStoreManage => 'Manage store settings',
            self::TenantPublicationManage => 'Publish and unpublish store',
            self::TenantMembersManage => 'Manage store members',
            self::TenantProductsManage => 'Manage products',
            self::TenantInventoryView => 'View inventory',
            self::TenantInventoryManage => 'Manage inventory',
            self::TenantOrdersView => 'View orders',
            self::TenantOrdersManage => 'Manage orders',
            self::TenantAnalyticsView => 'View store analytics',
        };
    }
}
