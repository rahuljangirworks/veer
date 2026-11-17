import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { VoiceSettings } from '../../../../shared/speech-types'
import { isPrivateHttpVoiceEndpoint } from '../../../../shared/voice-chat-endpoint'
import { translate } from '@/i18n/i18n'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useVoiceLoopSnapshot } from './session-store'
import type { VoiceLoopState } from './types'

type VoiceConversationSwitchProps = {
  voiceSettings: VoiceSettings
  onUpdateVoiceSettings: (updates: Partial<VoiceSettings>) => void
}

function voiceLoopLabel(state: VoiceLoopState): string {
  switch (state) {
    case 'listening':
      return translate('veer.voice.state.listening', 'Listening')
    case 'thinking':
      return translate('veer.voice.state.thinking', 'Thinking')
    case 'speaking':
      return translate('veer.voice.state.speaking', 'Speaking')
    default:
      return ''
  }
}

export function VoiceConversationSwitch({
  voiceSettings,
  onUpdateVoiceSettings
}: VoiceConversationSwitchProps): React.JSX.Element {
  const loop = useVoiceLoopSnapshot()
  const checked = voiceSettings.conversation === true
  const stateLabel = checked ? voiceLoopLabel(loop.state) : ''
  const [endpoint, setEndpoint] = useState(voiceSettings.conversationEndpoint ?? '')
  const [key, setKey] = useState('')
  const [status, setStatus] = useState<{
    voiceSetupVersion?: number
    keyConfigured: boolean
    savedKeyConfigured: boolean
    piperInstalled: boolean
    piperModelDir: string
    endpointError: string | null
  } | null>(null)
  const [savingKey, setSavingKey] = useState(false)
  const [installingPiper, setInstallingPiper] = useState(false)
  const [piperProgress, setPiperProgress] = useState(0)
  const [setupError, setSetupError] = useState<string | null>(null)
  const voiceBridgeReady =
    typeof window.api.speech.getVoiceSetupStatus === 'function' &&
    typeof window.api.speech.installPiperModel === 'function' &&
    typeof window.api.speech.onPiperInstallProgress === 'function'
  const restartRequired = !voiceBridgeReady || (status !== null && status.voiceSetupVersion !== 2)

  useEffect(() => {
    setEndpoint(voiceSettings.conversationEndpoint ?? '')
    setStatus(null)
    setSetupError(null)
    let active = true
    if (typeof window.api.speech.getVoiceSetupStatus !== 'function') {
      setSetupError('Restart Veer to load the updated voice settings.')
      return
    }
    void window.api.speech
      .getVoiceSetupStatus()
      .then((next) => {
        if (active) {
          setStatus(next)
        }
      })
      .catch((error) => {
        if (active) {
          setSetupError(error instanceof Error ? error.message : 'Voice setup check failed.')
        }
      })
    return () => {
      active = false
    }
  }, [voiceSettings.conversationEndpoint, voiceSettings.conversationAllowPrivateHttp])

  useEffect(() => {
    if (typeof window.api.speech.onPiperInstallProgress !== 'function') {
      return
    }
    return window.api.speech.onPiperInstallProgress(setPiperProgress)
  }, [])

  const refreshStatus = (): void => {
    if (typeof window.api.speech.getVoiceSetupStatus !== 'function') {
      setSetupError('Restart Veer to load the updated voice settings.')
      return
    }
    void window.api.speech
      .getVoiceSetupStatus()
      .then(setStatus)
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Voice setup check failed.'
        setSetupError(message)
        toast.error(message)
      })
  }

  const saveKey = async (): Promise<void> => {
    setSavingKey(true)
    try {
      await window.api.speech.saveVoiceKey(key)
      setKey('')
      refreshStatus()
      toast.success('OmniRoute key saved securely.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save OmniRoute key.')
    } finally {
      setSavingKey(false)
    }
  }

  const clearKey = async (): Promise<void> => {
    setSavingKey(true)
    try {
      await window.api.speech.clearVoiceKey()
      refreshStatus()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not clear OmniRoute key.')
    } finally {
      setSavingKey(false)
    }
  }

  const installPiper = async (): Promise<void> => {
    if (restartRequired) {
      toast.error('Restart Veer to load the updated voice installer.')
      return
    }
    setInstallingPiper(true)
    setPiperProgress(0)
    try {
      await window.api.speech.installPiperModel()
      refreshStatus()
      toast.success('Piper voice model is ready.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not install the Piper model.')
    } finally {
      setInstallingPiper(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4 py-2">
        <div className="space-y-0.5">
          <Label>{translate('veer.voice.conversation.title', 'Voice conversation')}</Label>
          <p className="text-xs text-muted-foreground">
            {translate(
              'veer.voice.conversation.description',
              'Talk with Veer instead of inserting dictated text.'
            )}
          </p>
          {stateLabel ? (
            <p className="text-xs font-medium text-muted-foreground" aria-live="polite">
              {stateLabel}
              {loop.text ? `: ${loop.text}` : ''}
            </p>
          ) : null}
          {loop.error ? (
            <p className="text-xs text-destructive" role="alert">
              {loop.error}
            </p>
          ) : null}
          {setupError ? (
            <p className="text-xs text-destructive" role="alert">
              {setupError}
            </p>
          ) : null}
          {restartRequired ? (
            <p className="text-xs text-muted-foreground" role="status">
              Restart Veer to load the updated voice settings.
            </p>
          ) : null}
        </div>
        <Switch
          checked={checked}
          disabled={!voiceSettings.enabled}
          aria-label={translate('veer.voice.conversation.title', 'Voice conversation')}
          onCheckedChange={(conversation) => {
            if (conversation && restartRequired) {
              toast.error('Restart Veer to load the updated voice settings.')
              return
            }
            if (
              conversation &&
              (!status || !status.keyConfigured || !status.piperInstalled || status.endpointError)
            ) {
              toast.error(
                status?.endpointError ??
                  (!status
                    ? 'Checking voice setup. Try again in a moment.'
                    : !status.keyConfigured
                      ? 'Add an OmniRoute key.'
                      : 'Install the Piper voice model.')
              )
              return
            }
            onUpdateVoiceSettings({ conversation })
          }}
        />
      </div>
      <div className="space-y-2 pb-3">
        <Label htmlFor="voice-conversation-endpoint">OmniRoute chat URL</Label>
        <Input
          id="voice-conversation-endpoint"
          type="url"
          value={endpoint}
          placeholder="https://gateway.example/v1/chat/completions"
          onChange={(event) => setEndpoint(event.target.value)}
          onBlur={() => {
            if (endpoint !== (voiceSettings.conversationEndpoint ?? '')) {
              onUpdateVoiceSettings({ conversationEndpoint: endpoint.trim() })
            }
          }}
        />
        <p className="text-xs text-muted-foreground">
          Use HTTPS, or HTTP on localhost. Enter the gateway’s /v1 URL or its full
          /v1/chat/completions URL.
        </p>
        {isPrivateHttpVoiceEndpoint(endpoint) ? (
          <div className="flex items-start justify-between gap-4 py-1">
            <div className="space-y-0.5">
              <Label htmlFor="voice-private-http">Allow HTTP to this private network gateway</Label>
              <p className="text-xs text-muted-foreground">
                Your API key and speech will travel unencrypted on this network.
              </p>
            </div>
            <Switch
              id="voice-private-http"
              checked={voiceSettings.conversationAllowPrivateHttp === true}
              onCheckedChange={(conversationAllowPrivateHttp) =>
                onUpdateVoiceSettings({ conversationAllowPrivateHttp })
              }
            />
          </div>
        ) : null}
        {status?.endpointError && !restartRequired ? (
          <p className="text-xs text-destructive">{status.endpointError}</p>
        ) : null}
        <div className="flex items-center gap-2">
          <Input
            type="password"
            aria-label="OmniRoute API key"
            autoComplete="off"
            value={key}
            placeholder={
              status?.savedKeyConfigured
                ? 'Key saved'
                : status?.keyConfigured
                  ? 'Using environment key'
                  : 'OmniRoute API key'
            }
            onChange={(event) => setKey(event.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!key.trim() || savingKey}
            onClick={() => void saveKey()}
          >
            Save
          </Button>
          {status?.savedKeyConfigured ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={savingKey}
              onClick={() => void clearKey()}
            >
              Clear
            </Button>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 space-y-0.5">
            <p className="text-xs text-muted-foreground" aria-live="polite">
              Piper model:{' '}
              {!status
                ? 'Checking...'
                : status.piperInstalled
                  ? 'Ready'
                  : installingPiper
                    ? `Installing… ${Math.round(piperProgress * 100)}%`
                    : 'Not installed'}
            </p>
            {status && !status.piperInstalled ? (
              <p className="break-all text-xs text-muted-foreground">
                Installs to {status.piperModelDir}
              </p>
            ) : null}
          </div>
          {status && !status.piperInstalled ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={installingPiper || restartRequired}
              onClick={() => void installPiper()}
            >
              {installingPiper ? 'Installing…' : 'Install Piper'}
            </Button>
          ) : null}
        </div>
      </div>
      <Separator />
    </>
  )
}
