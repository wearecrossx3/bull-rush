#!/usr/bin/env python3
"""Builds the Bull Rush APK without the Android SDK build tools.

Writes the binary AndroidManifest.xml and resources.arsc directly, compiles the
Java shell with javac against android.jar, dexes it with dx, zips the web game
into assets/www, then signs with apksig (v1 + v2).
"""
import os, shutil, struct, subprocess, sys, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SDK = os.environ.get("BR_SDK", "/tmp/claude-0/sdk")
ANDROID_JAR = os.path.join(SDK, "android-34.jar")
DX_JAR = os.path.join(SDK, "dx.jar")
APKSIG_JAR = os.path.join(SDK, "apksig.jar")
BUNDLETOOL_JAR = os.path.join(SDK, "bundletool.jar")  # github.com/google/bundletool releases, 1.17.2
OUT = os.path.join(HERE, "out")

PACKAGE = "com.bullrush.game"
LABEL = "Bull Rush"
VERSION_CODE = int(os.environ.get("BR_VERSION_CODE", "1"))
VERSION_NAME = os.environ.get("BR_VERSION_NAME", "1.0")
ICON_ID = 0x7F010000  # mipmap/ic_launcher (package 0x7f, type 1, entry 0)

ANDROID_NS = "http://schemas.android.com/apk/res/android"
ATTR = {
    "theme": 0x01010000, "label": 0x01010001, "icon": 0x01010002, "name": 0x01010003,
    "exported": 0x01010010, "launchMode": 0x0101001D, "screenOrientation": 0x0101001E,
    "configChanges": 0x0101001F, "minSdkVersion": 0x0101020C, "versionCode": 0x0101021B,
    "versionName": 0x0101021C, "targetSdkVersion": 0x01010270, "allowBackup": 0x01010280,
    "hardwareAccelerated": 0x010102D3, "usesCleartextTraffic": 0x010104EC,
}
THEME_FULLSCREEN = 0x0103000A  # @android:style/Theme.Black.NoTitleBar.Fullscreen

T_REF, T_STRING, T_DEC, T_HEX, T_BOOL = 0x01, 0x03, 0x10, 0x11, 0x12


# ---------------------------------------------------------------- string pool
def string_pool(strings, utf8=False):
    offsets, data = [], bytearray()
    for s in strings:
        offsets.append(len(data))
        if utf8:
            b = s.encode("utf-8")
            assert len(s) < 128 and len(b) < 128
            data += bytes([len(s), len(b)]) + b + b"\0"
        else:
            u = s.encode("utf-16-le")
            data += struct.pack("<H", len(s)) + u + b"\0\0"
    while len(data) % 4:
        data += b"\0"
    header = 28
    strings_start = header + 4 * len(strings)
    size = strings_start + len(data)
    flags = 0x100 if utf8 else 0
    return struct.pack("<HHIIIIII", 0x0001, header, size, len(strings), 0, flags, strings_start, 0) + \
        b"".join(struct.pack("<I", o) for o in offsets) + bytes(data)


# ---------------------------------------------------------------- binary XML
class Axml:
    """Minimal binary XML writer. Attribute names that map to framework ids come first in the pool."""

    def __init__(self):
        self.attr_names = []   # android attribute names, in resource-map order
        self.strings = []
        self.events = []

    def idx(self, s):
        if s not in self.strings:
            self.strings.append(s)
        return self.strings.index(s)

    def el(self, tag, attrs, children=()):
        self.events.append(("start", tag, attrs))
        for c in children:
            self.el(*c)
        self.events.append(("end", tag))

    def build(self):
        # collect attribute names first so they occupy the low indices that the resource map covers
        for ev in self.events:
            if ev[0] == "start":
                for (ns, name, _t, _v) in ev[2]:
                    if ns and name not in self.attr_names:
                        self.attr_names.append(name)
        self.attr_names.sort(key=lambda n: ATTR[n])
        self.strings = list(self.attr_names)
        self.idx("android"); self.idx(ANDROID_NS)
        body = bytearray()
        line = 1
        body += struct.pack("<HHIIiII", 0x0100, 16, 24, line, -1, self.idx("android"), self.idx(ANDROID_NS))
        for ev in self.events:
            line += 1
            if ev[0] == "start":
                _, tag, attrs = ev
                # framework attrs must be sorted by resource id; plain attrs (no namespace) go first
                attrs = sorted(attrs, key=lambda a: (1, ATTR[a[1]]) if a[0] else (0, 0))
                ab = bytearray()
                for (ns, name, t, v) in attrs:
                    ns_i = self.idx(ANDROID_NS) if ns else 0xFFFFFFFF
                    name_i = self.idx(name)
                    if t == T_STRING:
                        si = self.idx(v)
                        raw, data = si, si
                    else:
                        raw, data = 0xFFFFFFFF, v & 0xFFFFFFFF
                    ab += struct.pack("<IIIHBBI", ns_i, name_i, raw, 8, 0, t, data)
                size = 36 + len(ab)
                body += struct.pack("<HHIIiIIHHHHHH", 0x0102, 16, size, line, -1, 0xFFFFFFFF,
                                    self.idx(tag), 20, 20, len(attrs), 0, 0, 0) + ab
            else:
                body += struct.pack("<HHIIiII", 0x0103, 16, 24, line, -1, 0xFFFFFFFF, self.idx(ev[1]))
        body += struct.pack("<HHIIiII", 0x0101, 16, 24, line + 1, -1, self.idx("android"), self.idx(ANDROID_NS))
        pool = string_pool(self.strings)
        resmap = struct.pack("<HHI", 0x0180, 8, 8 + 4 * len(self.attr_names)) + \
            b"".join(struct.pack("<I", ATTR[n]) for n in self.attr_names)
        payload = pool + resmap + bytes(body)
        return struct.pack("<HHI", 0x0003, 8, 8 + len(payload)) + payload


def A(name, t, v):
    return (True, name, t, v)


def manifest():
    x = Axml()
    config_changes = 0x10 | 0x20 | 0x80 | 0x100 | 0x200 | 0x400 | 0x800  # keyboard..smallestScreenSize
    x.el("manifest", [(False, "package", T_STRING, PACKAGE),
                      A("versionCode", T_DEC, VERSION_CODE), A("versionName", T_STRING, VERSION_NAME)], [
        ("uses-sdk", [A("minSdkVersion", T_DEC, 24), A("targetSdkVersion", T_DEC, 35)]),
        ("uses-permission", [A("name", T_STRING, "android.permission.INTERNET")]),
        ("uses-permission", [A("name", T_STRING, "android.permission.ACCESS_NETWORK_STATE")]),
        ("queries", [], [  # Android 11+ hides the text-to-speech engine without this
            ("intent", [], [("action", [A("name", T_STRING, "android.intent.action.TTS_SERVICE")])]),
        ]),
        ("application", [A("label", T_STRING, LABEL), A("icon", T_REF, ICON_ID),
                         A("theme", T_REF, THEME_FULLSCREEN), A("allowBackup", T_BOOL, -1),
                         A("hardwareAccelerated", T_BOOL, -1)], [
            ("activity", [A("name", T_STRING, PACKAGE + ".MainActivity"), A("exported", T_BOOL, -1),
                          A("launchMode", T_DEC, 2), A("screenOrientation", T_DEC, 4),  # singleTask, sensor (portrait or landscape)
                          A("configChanges", T_HEX, config_changes)], [
                ("intent-filter", [], [
                    ("action", [A("name", T_STRING, "android.intent.action.MAIN")]),
                    ("category", [A("name", T_STRING, "android.intent.category.LAUNCHER")]),
                ]),
            ]),
        ]),
    ])
    return x.build()


# ---------------------------------------------------------------- resources.arsc
ICON_PATH = "res/mipmap-xxxhdpi-v4/ic_launcher.png"


def resources():
    values = string_pool([ICON_PATH], utf8=True)
    type_strings = string_pool(["mipmap"], utf8=True)
    key_strings = string_pool(["ic_launcher"], utf8=True)

    spec = struct.pack("<HHIBBHI", 0x0202, 16, 16 + 4, 1, 0, 0, 1) + struct.pack("<I", 0x0100)  # varies by density

    config = bytearray(64)
    struct.pack_into("<I", config, 0, 64)
    struct.pack_into("<H", config, 14, 640)  # xxxhdpi
    struct.pack_into("<H", config, 24, 4)    # -v4
    type_header = 20 + len(config)
    entries = struct.pack("<HHI", 8, 0, 0) + struct.pack("<HBBI", 8, 0, T_STRING, 0)
    entries_start = type_header + 4
    rtype = struct.pack("<HHIBBHII", 0x0201, type_header, entries_start + len(entries), 1, 0, 0, 1, entries_start) + \
        bytes(config) + struct.pack("<I", 0) + entries

    name = PACKAGE.encode("utf-16-le").ljust(256, b"\0")
    pkg_header = 288
    type_off = pkg_header
    key_off = type_off + len(type_strings)
    pkg_body = type_strings + key_strings + spec + rtype
    pkg = struct.pack("<HHII", 0x0200, pkg_header, pkg_header + len(pkg_body), 0x7F) + name + \
        struct.pack("<IIIII", type_off, 1, key_off, 1, 0) + pkg_body
    payload = values + pkg
    return struct.pack("<HHII", 0x0002, 12, 12 + len(payload), 1) + payload


# ---------------------------------------------------------------- build steps
def run(cmd):
    print("+", " ".join(cmd))
    subprocess.check_call(cmd)


def main():
    shutil.rmtree(OUT, ignore_errors=True)
    classes = os.path.join(OUT, "classes")
    os.makedirs(classes)
    run(["javac", "-nowarn", "-source", "8", "-target", "8", "-bootclasspath", ANDROID_JAR, "-d", classes,
         os.path.join(HERE, "src/com/bullrush/game/MainActivity.java")])
    dex = os.path.join(OUT, "classes.dex")
    run(["java", "-cp", DX_JAR, "com.android.dx.command.Main", "--dex", "--min-sdk-version=24", "--output=" + dex, classes])

    unsigned = os.path.join(OUT, "unsigned.apk")
    with zipfile.ZipFile(unsigned, "w") as z:
        # resources.arsc first, stored, so its data starts 4-byte aligned (30 + 14 = 44)
        z.writestr(zipfile.ZipInfo("resources.arsc", (2026, 1, 1, 0, 0, 0)), resources(), zipfile.ZIP_STORED)
        z.writestr("AndroidManifest.xml", manifest(), zipfile.ZIP_DEFLATED)
        z.write(dex, "classes.dex", zipfile.ZIP_DEFLATED)
        z.write(os.path.join(HERE, "icon.png"), ICON_PATH, zipfile.ZIP_STORED)
        www = os.path.join(ROOT, "www")
        for base, _dirs, files in os.walk(www):
            for f in sorted(files):
                p = os.path.join(base, f)
                z.write(p, "assets/www/" + os.path.relpath(p, www).replace(os.sep, "/"), zipfile.ZIP_DEFLATED)

    with zipfile.ZipFile(unsigned) as z:
        info = z.getinfo("resources.arsc")
        assert (info.header_offset + 30 + len(info.filename) + len(info.extra)) % 4 == 0

    signer = os.path.join(OUT, "signer")
    os.makedirs(signer)
    run(["javac", "-nowarn", "-cp", APKSIG_JAR, "-d", signer, os.path.join(HERE, "src/com/bullrush/game/Sign.java")])
    keystore = os.environ.get("BR_KEYSTORE", os.path.join(HERE, "bullrush.p12"))
    if not os.path.exists(keystore):
        run(["keytool", "-genkeypair", "-storetype", "PKCS12", "-keystore", keystore, "-storepass", "bullrush",
             "-alias", "bullrush", "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000",
             "-dname", "CN=Bull Rush, O=Bull Rush Games, C=IN"])
    apk = os.path.join(OUT, "BullRush.apk")
    run(["java", "--add-exports", "java.base/sun.security.x509=ALL-UNNAMED", "--add-exports", "java.base/sun.security.pkcs=ALL-UNNAMED", "--add-exports", "java.base/sun.security.util=ALL-UNNAMED", "-cp", APKSIG_JAR + os.pathsep + signer, "com.bullrush.game.Sign", keystore, "bullrush", unsigned, apk])
    print("APK:", apk, os.path.getsize(apk), "bytes")
    if os.path.exists(BUNDLETOOL_JAR):
        bundle(dex, keystore)


def bundle(dex, keystore):
    """Google Play wants an Android App Bundle: a base module with a proto-format manifest and resource table."""
    mod = os.path.join(OUT, "module")
    os.makedirs(mod)
    proto = os.path.join(OUT, "proto")
    os.makedirs(proto)
    run(["javac", "-nowarn", "-cp", BUNDLETOOL_JAR, "-d", proto, os.path.join(HERE, "bundle/ProtoRes.java")])
    run(["java", "-cp", BUNDLETOOL_JAR + os.pathsep + proto, "com.bullrush.game.ProtoRes", PACKAGE, LABEL, str(VERSION_CODE), VERSION_NAME, mod])
    base = os.path.join(OUT, "base.zip")
    with zipfile.ZipFile(base, "w", zipfile.ZIP_DEFLATED) as z:
        z.write(os.path.join(mod, "AndroidManifest.xml"), "manifest/AndroidManifest.xml")
        z.write(os.path.join(mod, "resources.pb"), "resources.pb")
        z.write(dex, "dex/classes.dex")
        z.write(os.path.join(HERE, "icon.png"), ICON_PATH)
        www = os.path.join(ROOT, "www")
        for b, _dirs, files in os.walk(www):
            for f in sorted(files):
                p = os.path.join(b, f)
                z.write(p, "assets/www/" + os.path.relpath(p, www).replace(os.sep, "/"))
    aab = os.path.join(OUT, "BullRush.aab")
    run(["java", "-jar", BUNDLETOOL_JAR, "build-bundle", "--modules=" + base, "--output=" + aab])
    run(["jarsigner", "-keystore", keystore, "-storetype", "PKCS12", "-storepass", "bullrush", "-sigalg", "SHA256withRSA", "-digestalg", "SHA-256", aab, "bullrush"])
    run(["java", "-jar", BUNDLETOOL_JAR, "validate", "--bundle=" + aab])
    print("AAB:", aab, os.path.getsize(aab), "bytes")


if __name__ == "__main__":
    main()
