<?php

namespace App\Http\Controllers;

use App\Models\Tenant;
use App\Services\CatalogMediaService;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CatalogMediaController extends Controller
{
    public function show(Request $request, Tenant $tenant, string $media, CatalogMediaService $service): StreamedResponse
    {
        return $service->response($tenant, $media, $request);
    }
}
