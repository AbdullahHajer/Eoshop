<?php

namespace App\Enums;

enum OrderPaymentState: string
{
    case DueOnDelivery = 'due_on_delivery';
    case TransferSubmittedUnverified = 'transfer_submitted_unverified';
}
