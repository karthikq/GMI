const PATTERN = /\b(porn|porno|pornography|nsfw|xxx|nude|nudity|fuck|fucking|shit|bitch|bastard|asshole|dick|pussy|cock|slut|whore|cum)\b/i;

export const ADULT_WORDS_MESSAGE = "This story contains words that aren't allowed. Remove them before publishing.";

// True when the text has an adult word. HTML tags are ignored, so markup can't hide a word.
export const hasAdultWords = (text: string) => PATTERN.test(text.replace(/<[^>]*>/g, " "));
