# Security boundaries

The public repository contains the app, local video worker, Android wrapper and build definitions. It contains no account credential, private-repository token, signing key, remote administration endpoint, upload API or channel that controls the owner’s device. The compiled processing code is downloaded by visitors and can be inspected.

## Website

Video input is read from File objects and browser blob URLs. Rendering occurs in a worker on the visitor’s device. App files, the engine and optional demo clips are the only downloads; no analytics or third-party runtime CDN is used. The content security policy limits scripts, workers and connections to this app’s own origin. No cookies or access keys authorize control of any system.

The app does not need a credential to read the private authoring repository. Reviewed compiled artifacts are committed to the public repository. The archived server prototype stays private and is neither deployed nor linked from the app.

## Android

The APK loads bundled files under Android’s local appassets HTTPS origin. Remote HTTP/HTTPS resource loads inside the WebView are blocked; external links open in the system browser. Files are selected through Android’s system document picker. The only JavaScript bridge creates, writes, completes or aborts one pending MP4 in Downloads, with a random per-save token. It exposes no shell execution, broad filesystem access or remote-control operation. No Internet, storage, camera or microphone permission is requested. The APK bundles all runtime assets, so even a network request cannot leave this app. External browser intents use the browser’s own permission. Unknown local-asset paths fail closed with a 404.

## Builds and signing

Signing material is kept in encrypted repository Actions secrets and an owner-private local backup, outside both Git repositories. The public workflow contains only secret names. Its normal token has read-only repository permission; Pages and explicit release jobs receive only their required publication permissions. Signing runs only for main-branch pushes or an owner-authorized manual run. There is no pull-request workflow with access to secrets.

Forking or copying this repository does not grant access to the owner’s Actions secrets, private engine repository, signing identity or deployment permissions. Only trusted maintainers should have write access: a maintainer able to edit and run a signing workflow must be trusted with that workflow’s secrets.

Source/compiled code and public download URLs are deliberately public. Private authoring source is not a substitute for an authorization boundary.
