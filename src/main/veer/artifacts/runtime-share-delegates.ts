import type { ArtifactCloudOptions, ArtifactPlatformShareRequest } from '../../../shared/artifacts'
import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import type { RuntimeArtifactController } from '../../runtime/runtime-artifact-controller'

type ArtifactShareHost = {
  artifacts: RuntimeArtifactController
}

export function installVeerArtifactShareDelegates(prototype: OrcaRuntimeService): void {
  Object.assign(prototype, {
    publishArtifactShare: function (
      this: ArtifactShareHost,
      id: string,
      options: ArtifactCloudOptions
    ) {
      return this.artifacts.publishArtifactShare(id, options)
    },
    unpublishArtifactShare: function (
      this: ArtifactShareHost,
      id: string,
      options: ArtifactCloudOptions
    ) {
      return this.artifacts.unpublishArtifactShare(id, options)
    },
    shareArtifactWith: function (
      this: ArtifactShareHost,
      id: string,
      request: ArtifactPlatformShareRequest,
      options: ArtifactCloudOptions
    ) {
      return this.artifacts.shareArtifactWith(id, request, options)
    },
    shareArtifactLink: function (
      this: ArtifactShareHost,
      id: string,
      request: ArtifactPlatformShareRequest,
      options: ArtifactCloudOptions
    ) {
      return this.artifacts.shareArtifactLink(id, request, options)
    },
    revokeArtifactShare: function (
      this: ArtifactShareHost,
      id: string,
      shareId: string,
      options: ArtifactCloudOptions
    ) {
      return this.artifacts.revokeArtifactShare(id, shareId, options)
    },
    listArtifactShares: function (
      this: ArtifactShareHost,
      id: string,
      options: ArtifactCloudOptions
    ) {
      return this.artifacts.listArtifactShares(id, options)
    },
    listSharedWithMeArtifacts: function (this: ArtifactShareHost, options: ArtifactCloudOptions) {
      return this.artifacts.listSharedWithMeArtifacts(options)
    }
  })
}
