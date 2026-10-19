import type { ArtifactCloudOptions, ArtifactPlatformShareRequest } from '../../../shared/artifacts'
import type { RuntimeArtifactController } from '../../runtime/runtime-artifact-controller'

type ArtifactShareHost = {
  artifacts: RuntimeArtifactController
}

export function installVeerArtifactShareDelegates(prototype: object): void {
  const host = prototype as ArtifactShareHost & Record<string, unknown>
  host.publishArtifactShare = function (
    this: ArtifactShareHost,
    id: string,
    options: ArtifactCloudOptions
  ) {
    return this.artifacts.publishArtifactShare(id, options)
  }
  host.unpublishArtifactShare = function (
    this: ArtifactShareHost,
    id: string,
    options: ArtifactCloudOptions
  ) {
    return this.artifacts.unpublishArtifactShare(id, options)
  }
  host.shareArtifactWith = function (
    this: ArtifactShareHost,
    id: string,
    request: ArtifactPlatformShareRequest,
    options: ArtifactCloudOptions
  ) {
    return this.artifacts.shareArtifactWith(id, request, options)
  }
  host.shareArtifactLink = function (
    this: ArtifactShareHost,
    id: string,
    request: ArtifactPlatformShareRequest,
    options: ArtifactCloudOptions
  ) {
    return this.artifacts.shareArtifactLink(id, request, options)
  }
  host.revokeArtifactShare = function (
    this: ArtifactShareHost,
    id: string,
    shareId: string,
    options: ArtifactCloudOptions
  ) {
    return this.artifacts.revokeArtifactShare(id, shareId, options)
  }
  host.listArtifactShares = function (
    this: ArtifactShareHost,
    id: string,
    options: ArtifactCloudOptions
  ) {
    return this.artifacts.listArtifactShares(id, options)
  }
  host.listSharedWithMeArtifacts = function (
    this: ArtifactShareHost,
    options: ArtifactCloudOptions
  ) {
    return this.artifacts.listSharedWithMeArtifacts(options)
  }
}
