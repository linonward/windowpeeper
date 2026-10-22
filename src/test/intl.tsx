import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import de from "../../messages/de.json";

const messages = { en, es, de };

// Renders UI the way [locale]/layout.tsx provides it: with the locale's messages.
export function renderWithIntl(ui: ReactElement, locale: keyof typeof messages = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]} timeZone="UTC">
      {ui}
    </NextIntlClientProvider>,
  );
}
