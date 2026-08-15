<?php

namespace App\Enums;

enum PublicationStatus: string
{
    case Requested = 'requested';
    case Published = 'published';
    case Unpublished = 'unpublished';
    case Rejected = 'rejected';
}
