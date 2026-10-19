import { PERSONAL_FORK_POLICY } from '../../shared/personal-fork-policy'

export type FirstPartyStartupFeature =
  | 'updater'
  | 'remote-updater'
  | 'marketplace'
  | 'kill-list'
  | 'star-prompt'
  | 'diagnostics-upload'

/**
 * `src/main/index.ts` is the composition root that arms these features.
 * Until that root runs, unit tests fall back to the policy constant.
 * After it runs, only features it explicitly allowed may start.
 */
let compositionRootDecided = false
const allowed = new Set<FirstPartyStartupFeature>()

export function allowFirstPartyStartup(feature: FirstPartyStartupFeature): void {
  compositionRootDecided = true
  allowed.add(feature)
}

export function markFirstPartyCompositionRootFinished(): void {
  compositionRootDecided = true
}

export function isFirstPartyStartupAllowed(feature: FirstPartyStartupFeature): boolean {
  if (!compositionRootDecided) {
    return PERSONAL_FORK_POLICY.firstPartyNetworkEnabled
  }
  return allowed.has(feature)
}
