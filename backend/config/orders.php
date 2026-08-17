<?php

return [
    'checkout_enabled' => (bool) env('ORDER_CHECKOUT_ENABLED', false),
    'reservation_ttl_seconds' => (int) env('ORDER_RESERVATION_TTL_SECONDS', 900),
    'max_lines' => 50,
    'max_quantity_per_line' => 99,
    'max_total_minor' => 100_000_000_000_000,
];
