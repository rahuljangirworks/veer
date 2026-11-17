import { ipcMain } from 'electron'
import type { Store } from '../../persistence'
import { VEER_VOICE_CHANNELS } from '../../../shared/personal-fork-voice'
import { resolveOmniRouteUrl } from './omniroute-client'
import {
  bargeInVeerVoiceSession,
  closeVeerVoiceSession,
  completeVeerVoicePlayback
} from './session'
import {
  clearOmniRouteKey,
  hasOmniRouteKey,
  hasSavedOmniRouteKey,
  saveOmniRouteKey
} from './omniroute-key-store'
import { installPiperModel } from './piper-model-install'
import { isPiperModelInstalled, resolvePiperModelDir } from './piper-tts'

function desktopVoiceOwner(senderId: number, sessionId: string): string {
  return `desktop:${senderId}:${sessionId}`
}

function registerVoiceConversationHandlers(): void {
  ipcMain.handle(VEER_VOICE_CHANNELS.bargeIn, (event, sessionId = 'desktop') => {
    bargeInVeerVoiceSession(desktopVoiceOwner(event.sender.id, sessionId))
  })

  ipcMain.handle(
    VEER_VOICE_CHANNELS.playbackComplete,
    (event, sessionId: string, turnId: number, played: boolean) => {
      completeVeerVoicePlayback(desktopVoiceOwner(event.sender.id, sessionId), turnId, played)
    }
  )

  ipcMain.handle(VEER_VOICE_CHANNELS.cancelConversation, (event, sessionId: string) => {
    closeVeerVoiceSession(desktopVoiceOwner(event.sender.id, sessionId))
  })
}

export function registerVoiceSetupHandlers(store: Store): void {
  registerVoiceConversationHandlers()
  ipcMain.handle('voice:get-setup-status', () => {
    const endpoint =
      store.getSettings()?.voice?.conversationEndpoint ?? process.env.OMNIROUTE_CHAT_URL ?? ''
    let endpointError: string | null = null
    try {
      resolveOmniRouteUrl(endpoint, {
        allowPrivateHttp: store.getSettings()?.voice?.conversationAllowPrivateHttp === true
      })
    } catch (error) {
      endpointError = error instanceof Error ? error.message : 'Invalid OmniRoute URL.'
    }
    return {
      voiceSetupVersion: 2,
      keyConfigured: hasOmniRouteKey(),
      savedKeyConfigured: hasSavedOmniRouteKey(),
      piperInstalled: isPiperModelInstalled(),
      piperModelDir: resolvePiperModelDir(),
      endpointError
    }
  })

  ipcMain.handle('voice:save-key', (_event, key: string) => {
    saveOmniRouteKey(key)
  })

  ipcMain.handle('voice:clear-key', () => {
    clearOmniRouteKey()
  })

  ipcMain.handle('voice:install-piper', async (event) => {
    await installPiperModel((progress) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('voice:piper-install-progress', progress)
      }
    })
  })
}
