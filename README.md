# Crux Ghost

Compare two climbing attempts with cyan/coral ghost overlays, line them up in time and space, and export one MP4. **Videos stay on the visitor’s device.**

**Use the app:** https://bucho2398.github.io/crux-ghost/

**Android:** download the signed [APK from Releases](https://github.com/bucho2398/crux-ghost/releases/latest). Android 10+ with an updated Android System WebView. The APK bundles the engine and works offline.

**iPhone / iPad:** open the app in Safari → Share → Add to Home Screen. The shell is cached after the first visit; the engine is cached after its first successful load. Keep the app open while exporting.

## Compare

1. Choose two original videos, or try the illustrated demo.
2. Scrub each source to a matching movement, then use **Use frame** to set each sync start. Adjust balance, highlight color, and Take B’s position/scale if needed.
3. Play the ghost view, scrub, or step at your chosen frame interval.
4. Export and save the MP4. Preview speed affects playback only; export keeps source timing.

## Export quality

The canvas keeps the larger oriented width and height, with at most one pixel of even padding. Smaller sources remain at native size unless you explicitly scale Take B. The export uses the higher source frame rate, including rational rates; variable frame rate is resampled to that average. Different aspect ratios produce a padded canvas.

- **High quality:** H.264 CRF 10. Preserves dimensions and frame rate, but re-encoding introduces some codec loss.
- **RGB lossless:** H.264 RGB CRF 0. Avoids further codec loss after compositing/color conversion. Files are larger and may need VLC or another compatible player.
- Optional audio from one synchronized source is encoded as AAC 320 kb/s.
- This release supports browser-playable **8-bit SDR** originals. It rejects HDR, Dolby Vision, higher bit depth, non-square pixels and conflicting color spaces rather than silently reducing quality.
- Browser memory limits still apply. Each input must be below 2 GB; phones can run out of memory far earlier. Start with short clips, keep the page foregrounded, and use a more capable device for large originals. Rendering may take longer than the clip.

A color overlay necessarily changes pixels: “quality in = quality out” means retaining source dimensions/timing and providing a codec-lossless option, not bit-identical copies of the originals.

## Public app / private engine

This repository contains the website/PWA, Android wrapper, tests and downloadable engine artifacts. The private `bucho2398/crux-ghost-engine` repository owns the comparison source and build. Its compiled worker is distributed in `web/engine/`; the public app invokes that worker on each visitor’s device. There is no processing API, upload, account, analytics or secret in the app.

Client-delivered code is inspectable even when its authoring repository is private. The FFmpeg core is an unmodified, SHA-256-locked `@ffmpeg/core` 0.12.10 single-thread build. See [engine notices](web/third-party.html) and [upstream manifest](web/engine/upstream.json).

## Develop and publish

```sh
npm ci
npm run serve
# Visit http://localhost:8080
npx playwright install --with-deps chromium
npm test
```

A push to `main` runs real browser MP4 export tests, deploys `web/` to GitHub Pages after those pass, and builds a signed Android APK. Browser artifacts include desktop and phone screenshots. To make a new APK release, run **Check, build and publish** manually with a new `release_tag`. Set Android versionCode/versionName in `android/app/build.gradle` before shipping an update. Persistent signing material lives in GitHub Actions secrets (`ANDROID_KEYSTORE_BASE64`, `ANDROID_SIGNING_PASSWORD`), never in this repository. Keep a private backup; updates must use the same key.

Engine maintainers: build with `node tools/build.mjs ../crux-ghost/web/engine` from the private repository, review the resulting artifacts, then commit them here. The public website does not need access to the private repository.

## Security

See [security boundaries](docs/SECURITY.md) for the local-only data flow, Android file-saving bridge and publication permissions. No remote administration API is exposed.

## License

App/wrapper and compiled comparison worker: MIT. FFmpeg and its linked codecs retain their own GPL/LGPL and dependency licenses. AndroidX WebKit: Apache 2.0. See [third-party notices](web/third-party.html).
