<?php

namespace App\Support;

final class CheckoutPresentation
{
    public const DEFAULT_TITLE = 'تم استلام طلبك';

    public const DEFAULT_MESSAGE = 'احتفظ برقم الطلب للمتابعة مع المتجر.';

    /** @param array<string, mixed> $config
     * @return array{title: string, message: string, whatsappTarget: ?string}
     */
    public static function fromConfig(array $config): array
    {
        $title = trim((string) ($config['thankYouTitle'] ?? ''));
        $message = trim((string) ($config['thankYouMessage'] ?? ''));

        return [
            'title' => $title !== '' ? mb_substr($title, 0, 500) : self::DEFAULT_TITLE,
            'message' => $message !== '' ? mb_substr($message, 0, 20000) : self::DEFAULT_MESSAGE,
            'whatsappTarget' => ($config['enableWhatsAppNotification'] ?? false) === true
                ? StoreContactTarget::preferred($config)
                : null,
        ];
    }

    /** @return array{title: string, message: string, whatsappTarget: null} */
    public static function fallback(): array
    {
        return [
            'title' => self::DEFAULT_TITLE,
            'message' => self::DEFAULT_MESSAGE,
            'whatsappTarget' => null,
        ];
    }
}
