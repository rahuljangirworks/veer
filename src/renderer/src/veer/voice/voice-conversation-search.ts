import { translate } from '@/i18n/i18n'
import type { SettingsSearchEntry } from '@/components/settings/settings-search'
import { translateSearchKeyword } from '@/components/settings/settings-search-keywords'

export function getVoiceConversationSearchEntry(): SettingsSearchEntry {
  return {
    title: translate('veer.voice.conversation.title', 'Voice conversation'),
    description: translate(
      'veer.voice.conversation.description',
      'Talk with Veer instead of inserting dictated text.'
    ),
    keywords: [
      ...translateSearchKeyword('veer.voice.conversation.keyword.voice', 'voice'),
      ...translateSearchKeyword('veer.voice.conversation.keyword.conversation', 'conversation'),
      ...translateSearchKeyword('veer.voice.conversation.keyword.speak', 'speak'),
      ...translateSearchKeyword('veer.voice.conversation.keyword.omniroute', 'OmniRoute'),
      ...translateSearchKeyword('veer.voice.conversation.keyword.piper', 'Piper'),
      ...translateSearchKeyword('veer.voice.conversation.keyword.endpoint', 'endpoint')
    ]
  }
}
