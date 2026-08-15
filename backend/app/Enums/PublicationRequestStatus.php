<?php

namespace App\Enums;

enum PublicationRequestStatus: string
{
    case Requested = 'requested';
    case Published = 'published';
    case Rejected = 'rejected';
    case Cancelled = 'cancelled';
}
