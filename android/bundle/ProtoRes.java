package com.bullrush.game;

// Build-time helper (not packaged): writes the proto-format AndroidManifest.xml and resources.pb
// that an Android App Bundle module needs, using the aapt2 proto classes shipped inside bundletool.
import com.android.aapt.ConfigurationOuterClass.Configuration;
import com.android.aapt.Resources.*;
import java.lang.String;
import java.io.FileOutputStream;

public class ProtoRes {
    static final String NS = "http://schemas.android.com/apk/res/android";

    static XmlAttribute attr(String name, int id, Item item, String raw) {
        return XmlAttribute.newBuilder().setNamespaceUri(NS).setName(name).setResourceId(id).setValue(raw).setCompiledItem(item).build();
    }
    static XmlAttribute str(String name, int id, String v) { return attr(name, id, Item.newBuilder().setStr(com.android.aapt.Resources.String.newBuilder().setValue(v)).build(), v); }
    static XmlAttribute dec(String name, int id, int v) { return attr(name, id, Item.newBuilder().setPrim(Primitive.newBuilder().setIntDecimalValue(v)).build(), "" + v); }
    static XmlAttribute hex(String name, int id, int v) { return attr(name, id, Item.newBuilder().setPrim(Primitive.newBuilder().setIntHexadecimalValue(v)).build(), "0x" + Integer.toHexString(v)); }
    static XmlAttribute bool(String name, int id, boolean v) { return attr(name, id, Item.newBuilder().setPrim(Primitive.newBuilder().setBooleanValue(v)).build(), "" + v); }
    static XmlAttribute ref(String name, int id, int target, String raw) { return attr(name, id, Item.newBuilder().setRef(Reference.newBuilder().setId(target)).build(), raw); }

    static XmlNode el(String tag, XmlAttribute[] attrs, XmlNode... kids) {
        XmlElement.Builder e = XmlElement.newBuilder().setName(tag);
        for (XmlAttribute a : attrs) e.addAttribute(a);
        for (XmlNode k : kids) e.addChild(k);
        return XmlNode.newBuilder().setElement(e).build();
    }
    static XmlAttribute[] a(XmlAttribute... x) { return x; }

    public static void main(String[] args) throws Exception {
        String pkg = args[0], label = args[1];
        int versionCode = Integer.parseInt(args[2]);
        String versionName = args[3], out = args[4];
        int configChanges = 0x10 | 0x20 | 0x80 | 0x100 | 0x200 | 0x400 | 0x800;

        XmlNode activity = el("activity", a(str("name", 0x01010003, pkg + ".MainActivity"), bool("exported", 0x01010010, true),
                dec("launchMode", 0x0101001D, 2), dec("screenOrientation", 0x0101001E, 4), hex("configChanges", 0x0101001F, configChanges)),
            el("intent-filter", a(),
                el("action", a(str("name", 0x01010003, "android.intent.action.MAIN"))),
                el("category", a(str("name", 0x01010003, "android.intent.category.LAUNCHER")))));
        XmlNode app = el("application", a(str("label", 0x01010001, label), ref("icon", 0x01010002, 0x7F010000, "@mipmap/ic_launcher"),
                ref("theme", 0x01010000, 0x0103000A, "@android:style/Theme.Black.NoTitleBar.Fullscreen"),
                bool("allowBackup", 0x01010280, true), bool("hardwareAccelerated", 0x010102D3, true)), activity);
        XmlElement.Builder man = XmlElement.newBuilder().setName("manifest")
            .addNamespaceDeclaration(XmlNamespace.newBuilder().setPrefix("android").setUri(NS))
            .addAttribute(XmlAttribute.newBuilder().setName("package").setValue(pkg))
            .addAttribute(dec("versionCode", 0x0101021B, versionCode))
            .addAttribute(str("versionName", 0x0101021C, versionName))
            .addChild(el("uses-sdk", a(dec("minSdkVersion", 0x0101020C, 24), dec("targetSdkVersion", 0x01010270, 35))))
            .addChild(el("uses-permission", a(str("name", 0x01010003, "android.permission.INTERNET"))))
            .addChild(el("uses-permission", a(str("name", 0x01010003, "android.permission.ACCESS_NETWORK_STATE"))))
            .addChild(el("queries", a(), el("intent", a(), el("action", a(str("name", 0x01010003, "android.intent.action.TTS_SERVICE"))))))
            .addChild(app);
        try (FileOutputStream f = new FileOutputStream(out + "/AndroidManifest.xml")) { XmlNode.newBuilder().setElement(man).build().writeTo(f); }

        ConfigValue icon = ConfigValue.newBuilder()
            .setConfig(Configuration.newBuilder().setDensity(640).setSdkVersion(4))
            .setValue(Value.newBuilder().setItem(Item.newBuilder().setFile(FileReference.newBuilder()
                .setPath("res/mipmap-xxxhdpi-v4/ic_launcher.png").setType(FileReference.Type.PNG)))).build();
        ResourceTable table = ResourceTable.newBuilder().addPackage(com.android.aapt.Resources.Package.newBuilder()
            .setPackageId(PackageId.newBuilder().setId(0x7F)).setPackageName(pkg)
            .addType(Type.newBuilder().setTypeId(TypeId.newBuilder().setId(1)).setName("mipmap")
                .addEntry(Entry.newBuilder().setEntryId(EntryId.newBuilder().setId(0)).setName("ic_launcher")
                    .setVisibility(Visibility.newBuilder().setLevel(Visibility.Level.PUBLIC)).addConfigValue(icon)))).build();
        try (FileOutputStream f = new FileOutputStream(out + "/resources.pb")) { table.writeTo(f); }
        System.out.println("proto manifest + resources.pb written");
    }
}
