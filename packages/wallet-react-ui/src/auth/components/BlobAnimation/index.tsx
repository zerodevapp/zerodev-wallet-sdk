// ?no-inline forces Vite to emit blob.webm as a separate file (dist/blob.webm)
// instead of base64-inlining ~700KB into the JS bundle. Requires base:'./' in
// vite.config.ts so the emitted URL is package-relative, not root-absolute.
import blobWebm from '../../assets/blob.webm?no-inline'

// VP9-alpha WebM. Renders the animated blob on browsers that support WebM with
// an alpha channel (Chrome, Firefox, Edge). Safari plays the WebM container but
// not VP9 alpha, so the blob is simply not shown there — an acceptable
// degradation for a decorative element.
export function BlobAnimation({ className }: { className?: string }) {
  return (
    <video
      className={className}
      style={{ aspectRatio: '1 / 1' }}
      src={blobWebm}
      autoPlay
      loop
      muted
      playsInline
      aria-hidden="true"
      tabIndex={-1}
    />
  )
}
