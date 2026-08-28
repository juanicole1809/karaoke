'use client';

import { LanguageSwitcher } from '@/components/language-switcher';
import { SettingsRow } from '@/components/settings/settings-row';
import { useScopedI18n } from '@/locales/client';

// Tema forzado a oscuro en el layout (karaoke) → ya no hay selector de tema.
export function AppearanceSettingsInline() {
    const t = useScopedI18n('appearance');

    return (
        <SettingsRow label={t('language')} control={<LanguageSwitcher variant="inline" />} />
    );
}
