import type {
  ArtifactCloudOperation,
  ArtifactCloudOptions,
  ArtifactListItem,
  ArtifactListOptions,
  ArtifactListPage,
  ArtifactPlatformShareRequest,
  ArtifactPublishedLink,
  ArtifactPublishResult,
  ArtifactWriteRequest
} from '../../shared/artifacts'
import type { ArtifactCloudService } from '../artifacts/artifact-cloud-service'

export class RuntimeArtifactController {
  private service: ArtifactCloudService | null = null

  setService(service: ArtifactCloudService): void {
    this.service = service
  }

  list(options: ArtifactListOptions): Promise<ArtifactCloudOperation<ArtifactListPage>> {
    return this.requireService().list(options)
  }

  getPublishedLink(
    request: ArtifactCloudOptions & { sourceKey: string }
  ): Promise<ArtifactCloudOperation<ArtifactPublishedLink | null>> {
    return this.requireService().getPublishedLink(request)
  }

  share(request: ArtifactWriteRequest): Promise<ArtifactCloudOperation<ArtifactListItem>> {
    return this.requireService().shareLegacy(request)
  }

  publish(request: ArtifactWriteRequest): Promise<ArtifactCloudOperation<ArtifactPublishResult>> {
    return this.requireService().publish(request)
  }

  update(request: ArtifactWriteRequest): Promise<ArtifactCloudOperation<ArtifactListItem>> {
    return this.requireService().update(request)
  }

  unshare(
    request: ArtifactCloudOptions & { sourceKey: string }
  ): Promise<ArtifactCloudOperation<void>> {
    return this.requireService().unshareLegacy(request)
  }

  delete(id: string, options: ArtifactCloudOptions): Promise<ArtifactCloudOperation<void>> {
    return this.requireService().delete(id, options)
  }

  publishArtifactShare(id: string, options: ArtifactCloudOptions) {
    return this.requireService().publishArtifact(id, options)
  }

  unpublishArtifactShare(id: string, options: ArtifactCloudOptions) {
    return this.requireService().unpublishArtifact(id, options)
  }

  shareArtifactWith(
    id: string,
    request: ArtifactPlatformShareRequest,
    options: ArtifactCloudOptions
  ) {
    return this.requireService().share(id, request, options)
  }

  shareArtifactLink(
    id: string,
    request: ArtifactPlatformShareRequest,
    options: ArtifactCloudOptions
  ) {
    return this.requireService().shareArtifact(id, request, options)
  }

  revokeArtifactShare(id: string, shareId: string, options: ArtifactCloudOptions) {
    return this.requireService().unshare(id, shareId, options)
  }

  listArtifactShares(id: string, options: ArtifactCloudOptions) {
    return this.requireService().listShares(id, options)
  }

  listSharedWithMeArtifacts(options: ArtifactCloudOptions) {
    return this.requireService().listSharedWithMe(options)
  }

  private requireService(): ArtifactCloudService {
    if (!this.service) {
      throw new Error("Artifact sharing isn't available on this Orca server.")
    }
    return this.service
  }
}
