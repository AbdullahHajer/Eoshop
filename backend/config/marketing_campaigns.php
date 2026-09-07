<?php

return [
    'max_campaigns' => 20,
    'max_links_per_campaign' => 8,
    'link_token' => [
        'current_key_id' => env('MARKETING_LINK_TOKEN_KEY_CURRENT_ID', 'app-v1'),
        'current_key' => env('MARKETING_LINK_TOKEN_KEY_CURRENT', env('APP_KEY')),
        'previous_key_id' => env('MARKETING_LINK_TOKEN_KEY_PREVIOUS_ID'),
        'previous_key' => env('MARKETING_LINK_TOKEN_KEY_PREVIOUS'),
    ],
];
