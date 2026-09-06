<?php

namespace App\Http\Middleware;

use App\Support\OrderTrackingToken;
use Closure;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Symfony\Component\HttpFoundation\Response;

final class ThrottleOrderTrackingRequest
{
    public function __construct(private readonly ThrottleRequests $throttle) {}

    public function handle(Request $request, Closure $next): mixed
    {
        try {
            $response = $this->throttle->handle(
                $request,
                function (Request $request) use ($next): mixed {
                    if (OrderTrackingToken::digest((string) ($request->bearerToken() ?? '')) === null) {
                        return $this->notFound();
                    }

                    return $next($request);
                },
                'store.order-tracking',
            );
        } catch (ThrottleRequestsException $exception) {
            $response = response()->json([
                'message' => 'Too many order tracking attempts.',
                'code' => 'order_tracking_rate_limited',
            ], 429, $exception->getHeaders());
        }

        return $this->protect($response);
    }

    private function notFound(): JsonResponse
    {
        return response()->json([
            'message' => 'The order tracking link is invalid or unavailable.',
            'code' => 'order_tracking_not_found',
        ], 404);
    }

    private function protect(Response $response): Response
    {
        $response->headers->set('Cache-Control', 'private, no-store, max-age=0');
        $response->headers->set('Pragma', 'no-cache');
        $response->headers->set('Vary', 'Authorization');
        $response->headers->set('Referrer-Policy', 'no-referrer');
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Robots-Tag', 'noindex, nofollow, noarchive');

        return $response;
    }
}
