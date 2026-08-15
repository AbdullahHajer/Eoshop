<?php

namespace App\Enums;

enum PublicationRequestOrigin: string
{
    case UserSelected = 'user_selected';
    case Wp23Adopted = 'wp23_adopted';
}
