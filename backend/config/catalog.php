<?php

return [
    'media_disk' => env('CATALOG_MEDIA_DISK', 'local'),
    'max_media_bytes' => (int) env('CATALOG_MEDIA_MAX_BYTES', 5 * 1024 * 1024),
    'max_media_pixels' => (int) env('CATALOG_MEDIA_MAX_PIXELS', 25_000_000),
    'orphan_retention_hours' => (int) env('CATALOG_MEDIA_ORPHAN_HOURS', 24),
];
