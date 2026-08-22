# Desktop installation

The desktop release is a generic base application. On first launch, enter the
company app address supplied by an administrator. The installer contains no
company database, member records, credentials or company-specific branding.

After connection, authorised users see the same synchronised members,
attendance, awards, submissions, stock and account data as the web app.

## Downloads

Download the installer for your computer from the latest GitHub release:

- **Apple Silicon Mac (M1 or newer):** macOS `aarch64` DMG
- **Intel Mac:** macOS `x86_64` DMG
- **Windows:** NSIS EXE or MSI installer
- **Linux:** AppImage or Debian package

If the wrong company address was saved, reopen the desktop app and choose
**Change address** before the automatic connection completes.

## Unsigned-app notice

Version 1.1.0 is distributed without paid Apple or Microsoft code-signing
certificates. Download only from the official project or your organisation's
approved GitHub repository.

### macOS

If macOS blocks the first launch, open **System Settings → Privacy & Security**,
confirm that the app came from the official release, then choose **Open Anyway**.

### Windows

If Microsoft Defender SmartScreen appears, confirm that the installer was
downloaded from the official release before choosing **More info → Run anyway**.

### Linux

For the AppImage, enable **Allow executing file as program** in the file
properties before opening it. Debian-based systems may install the `.deb`
package instead.
