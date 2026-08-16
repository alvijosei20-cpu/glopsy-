import { t } from '../i18n';

export interface TermsSection {
  title: string;
  body: string;
}

export const TERMS_SECTIONS: TermsSection[] = Array.from({ length: 12 }, (_, i) => ({
  title: t(`terms.${i}.title`),
  body: t(`terms.${i}.body`),
}));

export const TERMS_FULL = TERMS_SECTIONS.map((s) => `${s.title}\n\n${s.body}`).join('\n\n');
