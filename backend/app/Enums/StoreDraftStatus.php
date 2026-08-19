<?php

namespace App\Enums;

enum StoreDraftStatus: string
{
    case Draft = 'draft';
    case Submitted = 'submitted';
    case CorrectionRequired = 'correction_required';
}
