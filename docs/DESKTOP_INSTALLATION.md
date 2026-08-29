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

The current desktop release is distributed without paid Apple or Microsoft
code-signing certificates. Download only from the official project or your
organisation's approved GitHub repository.

### macOS

The macOS DMG is not Apple-signed or notarized. Gatekeeper may report that
**“BB App.app is damaged and can’t be opened.”** This message can appear even
when the download is intact, and **Open Anyway** may not be available.

1. Confirm that the DMG came from the official BB App GitHub release.
2. Drag **BB App** into the **Applications** folder and eject the DMG.
3. Open **Terminal** from Applications → Utilities.
4. Paste this exact command and press Return:

   ```bash
   xattr -dr com.apple.quarantine "/Applications/BB App.app"
   ```

5. Open BB App from the Applications folder.

This command removes the download quarantine only from the named BB App
installation. Do not use it on applications obtained from an untrusted source.
Apple signing and notarization are required to remove this manual step for all
users.

### Windows

If Microsoft Defender SmartScreen appears, confirm that the installer was
downloaded from the official release before choosing **More info → Run anyway**.

### Linux

For the AppImage, enable **Allow executing file as program** in the file
properties before opening it. Debian-based systems may install the `.deb`
package instead.
