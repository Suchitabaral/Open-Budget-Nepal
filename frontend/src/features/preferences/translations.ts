import { usePreferences } from "./context";

const messages = {
  en: {
    openBudgetMap: "Open Budget Map", budgetInsights: "Budget Insights", contractors: "Contractors", watchdog: "Watchdog", api: "API", settings: "Settings",
    collapseSidebar: "Collapse sidebar", openNavigation: "Open navigation", closeNavigation: "Close navigation",
    settingsIntro: "Customize how Open Budget Nepal appears on this device.", language: "Language", languageHelp: "Choose the language used for supported interface labels.",
    appearance: "Appearance", appearanceHelp: "Use your device setting or choose a fixed appearance.", system: "System", light: "Light", dark: "Dark",
    resetPreferences: "Reset preferences", resetHelp: "Restore language and appearance to their defaults.", resetToDefaults: "Reset to defaults", english: "English", nepali: "नेपाली",
  },
  ne: {
    openBudgetMap: "खुला बजेट नक्सा", budgetInsights: "बजेट विश्लेषण", contractors: "निर्माण व्यवसायी", watchdog: "निगरानी", api: "एपीआई", settings: "सेटिङहरू",
    collapseSidebar: "साइडबार खुम्च्याउनुहोस्", openNavigation: "नेभिगेसन खोल्नुहोस्", closeNavigation: "नेभिगेसन बन्द गर्नुहोस्",
    settingsIntro: "यस उपकरणमा Open Budget Nepal कसरी देखिन्छ भन्ने रोज्नुहोस्।", language: "भाषा", languageHelp: "समर्थित इन्टरफेस लेबलहरूको भाषा रोज्नुहोस्।",
    appearance: "रूप", appearanceHelp: "उपकरणको सेटिङ प्रयोग गर्नुहोस् वा निश्चित रूप रोज्नुहोस्।", system: "प्रणाली", light: "उज्यालो", dark: "गाढा",
    resetPreferences: "प्राथमिकता रिसेट", resetHelp: "भाषा र रूपलाई पूर्वनिर्धारित अवस्थामा फर्काउनुहोस्।", resetToDefaults: "पूर्वनिर्धारितमा फर्काउनुहोस्", english: "English", nepali: "नेपाली",
  },
} as const;

export type MessageKey = keyof typeof messages.en;
export function useTranslation() {
  const { preferences } = usePreferences();
  return (key: MessageKey) => messages[preferences.language][key];
}
