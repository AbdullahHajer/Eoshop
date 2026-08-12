<?php

namespace Tests\Feature;

use Tests\TestCase;

class PlatformRoutesTest extends TestCase
{
    public function test_platform_status_route_reports_the_single_server(): void
    {
        $this->getJson('/')
            ->assertOk()
            ->assertExactJson([
                'platform' => 'Eoshop Multi-Tenant Commerce API',
                'status' => 'active',
                'framework' => 'Laravel 12',
            ]);
    }

    public function test_health_route_is_available(): void
    {
        $this->get('/up')->assertOk();
    }

    public function test_unknown_api_route_does_not_fall_back_to_the_spa(): void
    {
        $this->get('/api/does-not-exist')
            ->assertNotFound()
            ->assertHeader('Content-Type', 'application/json');
    }
}
