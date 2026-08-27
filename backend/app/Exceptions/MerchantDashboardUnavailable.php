<?php

namespace App\Exceptions;

use RuntimeException;

class MerchantDashboardUnavailable extends RuntimeException
{
    public function __construct(
        string $message = 'The merchant dashboard is not ready for this store.',
        public readonly string $errorCode = 'merchant_dashboard_not_ready',
    ) {
        parent::__construct($message);
    }
}
