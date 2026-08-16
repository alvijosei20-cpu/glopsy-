const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withMainApplication,
  withMainActivity,
  withDangerousMod,
} = require('@expo/config-plugins');

function javaDir(config) {
  const pkg = config.android?.package || 'com.mipass.app';
  return path.join('android', 'app', 'src', 'main', 'java', ...pkg.split('.'));
}

const kotlinSources = {
  'DeviceBindingModule.kt': `package %PACKAGE%

import android.provider.Settings
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.MessageDigest

/**
 * Vincula la app al hardware (Device Binding):
 *  - Genera una clave RSA no exportable en el Android Keystore.
 *  - Deriva un identificador de dispositivo estable a partir de
 *    ANDROID_ID + huella (SHA-256) de la clave pública.
 * La clave privada nunca sale del dispositivo, por lo que el
 * identificador no puede replicarse en otro hardware.
 */
class DeviceBindingModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule() {

  override fun getName(): String = "PassDeviceBinding"

  private val alias = "pass_device_key"

  private fun ensureKey(): String {
    val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    if (!ks.containsAlias(alias)) {
      val generator = KeyPairGenerator.getInstance(
        KeyProperties.KEY_ALGORITHM_RSA,
        "AndroidKeyStore"
      )
      generator.initialize(
        KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN)
          .setDigests(KeyProperties.DIGEST_SHA256, KeyProperties.DIGEST_SHA512)
          .setSignaturePaddings(KeyProperties.SIGNATURE_PADDING_RSA_PKCS1)
          .setKeySize(2048)
          .build()
      )
      generator.generateKeyPair()
    }
    val cert = (ks.getCertificate(alias)) ?: throw RuntimeException("Keystore sin certificado")
    return Base64.encodeToString(cert.publicKey.encoded, Base64.NO_WRAP)
  }

  private fun sha256(vararg parts: String): String {
    val digest = MessageDigest.getInstance("SHA-256")
    parts.forEach { digest.update(it.toByteArray(Charsets.UTF_8)) }
    return digest.digest().joinToString("") { "%02x".format(it) }
  }

  /** Identificador estable y vinculado a este hardware. */
  @ReactMethod
  fun getDeviceId(promise: Promise) {
    try {
      val androidId =
        Settings.Secure.getString(reactContext.contentResolver, Settings.Secure.ANDROID_ID) ?: ""
      val pubKeyB64 = ensureKey()
      val id = sha256("pass", androidId, pubKeyB64).take(32)
      promise.resolve(id)
    } catch (e: Exception) {
      promise.reject("device_binding_error", e.message ?: "No se pudo obtener el identificador")
    }
  }

  /** Firma un mensaje con la clave del hardware (verificación de propiedad). */
  @ReactMethod
  fun sign(data: String, promise: Promise) {
    try {
      val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
      val key = ks.getKey(alias, null) as java.security.PrivateKey
      val signer = java.security.Signature.getInstance("SHA256withRSA")
      signer.initSign(key)
      signer.update(data.toByteArray(Charsets.UTF_8))
      promise.resolve(Base64.encodeToString(signer.sign(), Base64.NO_WRAP))
    } catch (e: Exception) {
      promise.reject("device_binding_error", e.message ?: "No se pudo firmar")
    }
  }
}
`,
  'DeviceBindingPackage.kt': `package %PACKAGE%

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class DeviceBindingPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(DeviceBindingModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
`,
  'SecurityModule.kt': `package %PACKAGE%

import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

class SecurityModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule() {

  override fun getName(): String = "PassSecurity"

  private fun suPaths(): Array<String> = arrayOf(
    "/system/app/Superuser.apk",
    "/system/app/SuperSU.apk",
    "/system/app/Magisk.apk",
    "/sbin/su",
    "/system/bin/su",
    "/system/xbin/su",
    "/system/sd/xbin/su",
    "/system/bin/failsafe/su",
    "/data/local/su",
    "/data/local/bin/su",
    "/data/local/xbin/su",
    "/su/bin/su"
  )

  @ReactMethod
  fun isDeviceRooted(promise: Promise) {
    var rooted = suPaths().any { File(it).exists() }
    if (!rooted) {
      rooted = try {
        val process = Runtime.getRuntime().exec(arrayOf("which", "su"))
        val has = process.inputStream.bufferedReader().readText().isNotBlank()
        process.waitFor()
        has
      } catch (e: Exception) {
        false
      }
    }
    if (!rooted) {
      val tags = Build.TAGS
      rooted = tags != null && tags.contains("test-keys")
    }
    promise.resolve(rooted)
  }

  @ReactMethod
  fun isOverlayDanger(promise: Promise) {
    var danger = false
    try {
      val pm = reactContext.packageManager
      val apps = pm.getInstalledApplications(PackageManager.GET_PERMISSIONS)
      for (app in apps) {
        if (app.packageName == reactContext.packageName) continue
        // Ignorar apps del sistema: muchos fabricantes incluyen overlays de sistema.
        if (app.flags and android.content.pm.ApplicationInfo.FLAG_SYSTEM != 0) continue
        val granted =
          pm.checkPermission("android.permission.SYSTEM_ALERT_WINDOW", app.packageName) ==
            PackageManager.PERMISSION_GRANTED
        if (!granted) continue
        val active =
          try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
              Settings.canDrawOverlays(reactContext, app.packageName)
            } else {
              true
            }
          } catch (e: Exception) {
            true
          }
        if (active) {
          danger = true
          break
        }
      }
    } catch (e: Exception) {
      danger = true
    }
    promise.resolve(danger)
  }
}
`,
  'SecurityPackage.kt': `package %PACKAGE%

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class SecurityPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(SecurityModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
`,
  'AutofillModule.kt': `package %PACKAGE%

import android.content.Intent
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AutofillModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule() {

  override fun getName(): String = "PassAutofill"

  /** Si la app se abrió por una petición de autofill, devuelve el contexto (webDomain/package). */
  @ReactMethod
  fun getFillContext(promise: Promise) {
    val ctx = AutofillService.pendingContext
    if (ctx == null) {
      promise.resolve(null)
      return
    }
    val map = Arguments.createMap()
    map.putString("webDomain", ctx.webDomain ?: "")
    map.putString("packageName", ctx.packageName ?: "")
    promise.resolve(map)
  }

  @ReactMethod
  fun completeFill(username: String, password: String, promise: Promise) {
    promise.resolve(AutofillService.completeFill(username, password))
  }

  @ReactMethod
  fun cancelFill(promise: Promise) {
    AutofillService.cancelFill()
    promise.resolve(null)
  }

  @ReactMethod
  fun finishActivity(promise: Promise) {
    reactContext.currentActivity?.finish()
    promise.resolve(null)
  }

  /** Abre los ajustes de autofill del sistema (para activar el servicio). */
  @ReactMethod
  fun openSystemSettings(promise: Promise) {
    val ok = try {
      val intent =
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
          Intent(android.provider.Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE)
            .setData(android.net.Uri.parse("package:\${reactContext.packageName}"))
        } else {
          Intent("android.settings.AUTOFILL_SETTINGS")
        }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactContext.startActivity(intent)
      true
    } catch (e: Exception) {
      false
    }
    promise.resolve(ok)
  }
}
`,
  'AutofillPackage.kt': `package %PACKAGE%

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class AutofillPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(AutofillModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
`,
  'AutofillService.kt': `package %PACKAGE%

import android.app.assist.AssistStructure
import android.content.Intent
import android.os.Build
import android.os.CancellationSignal
import android.service.autofill.AutofillService as SystemAutofillService
import android.service.autofill.Dataset
import android.service.autofill.FillCallback
import android.service.autofill.FillRequest
import android.service.autofill.FillResponse
import android.service.autofill.SaveCallback
import android.service.autofill.SaveRequest
import android.view.autofill.AutofillId
import android.view.autofill.AutofillValue

/**
 * Servicio de Autofill de Android (API 26+).
 *
 * Detecta formularios de login en otras apps, guarda el contexto de la
 * petición y abre la app (Pass) para que el usuario elija la credencial.
 * Cuando la app responde con \`completeFill\`, se construye un FillResponse
 * y se rellenan los campos del formulario original.
 */
class AutofillService : SystemAutofillService() {

  companion object {
    const val EXTRA_AUTOFILL = "%PACKAGE%.autofill"
    const val EXTRA_WEB_DOMAIN = "%PACKAGE%.autofill_domain"
    const val EXTRA_PACKAGE_NAME = "%PACKAGE%.autofill_package"

    @Volatile
    var pendingContext: ParsedContext? = null

    @Volatile
    private var pendingCallback: FillCallback? = null

    fun clearPending() {
      pendingContext = null
      pendingCallback = null
    }

    /** Construye el FillResponse con la credencial elegida y responde al sistema. */
    fun completeFill(username: String, password: String): Boolean {
      val ctx = pendingContext ?: return false
      val callback = pendingCallback ?: return false
      val datasetBuilder = Dataset.Builder()
      ctx.usernameId?.let { id ->
        if (username.isNotEmpty()) datasetBuilder.setValue(id, AutofillValue.forText(username))
      }
      ctx.passwordId?.let { id ->
        if (password.isNotEmpty()) datasetBuilder.setValue(id, AutofillValue.forText(password))
      }
      val response = FillResponse.Builder().addDataset(datasetBuilder.build()).build()
      clearPending()
      callback.onSuccess(response)
      return true
    }

    /** Cancela la petición pendiente (el sistema no muestra sugerencias). */
    fun cancelFill() {
      pendingCallback?.onSuccess(null)
      clearPending()
    }
  }

  override fun onFillRequest(request: FillRequest, cancellationSignal: CancellationSignal, callback: FillCallback) {
    val context = request.fillContexts.lastOrNull()
    if (context == null) {
      callback.onSuccess(null)
      return
    }
    val parsed = parseStructure(context.structure)
    if (parsed == null || (parsed.usernameId == null && parsed.passwordId == null)) {
      callback.onSuccess(null)
      return
    }

    pendingContext = parsed
    pendingCallback = callback
    cancellationSignal.setOnCancelListener { clearPending() }

    try {
      val intent = Intent(this, MainActivity::class.java).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        putExtra(EXTRA_AUTOFILL, true)
        putExtra(EXTRA_WEB_DOMAIN, parsed.webDomain ?: "")
        putExtra(EXTRA_PACKAGE_NAME, parsed.packageName ?: "")
      }
      startActivity(intent)
    } catch (e: Exception) {
      clearPending()
      callback.onSuccess(null)
    }
  }

  override fun onSaveRequest(request: SaveRequest, callback: SaveCallback) {
    callback.onSuccess()
  }

  data class ParsedContext(
    val webDomain: String?,
    val packageName: String?,
    val usernameId: AutofillId?,
    val passwordId: AutofillId?
  )

  private fun parseStructure(structure: AssistStructure): ParsedContext? {
    var usernameId: AutofillId? = null
    var passwordId: AutofillId? = null
    var webDomain: String? = null
    val packageName = structure.activityComponent?.packageName

    val windowCount = structure.windowNodeCount
    for (w in 0 until windowCount) {
      val root = structure.getWindowNodeAt(w).rootViewNode
      webDomain = webDomainOf(root) ?: webDomain
      walk(root) { node ->
        if (webDomain == null) webDomain = webDomainOf(node)
        val id = node.autofillId
        val hints = node.autofillHints
        if (id != null && hints != null) {
          for (h in hints) {
            val hint = h.lowercase()
            when {
              isPasswordHint(hint) -> if (passwordId == null) passwordId = id
              isUsernameHint(hint) -> if (usernameId == null) usernameId = id
            }
          }
        }
      }
    }

    if (usernameId == null && passwordId == null) return null
    return ParsedContext(webDomain, packageName, usernameId, passwordId)
  }

  private fun walk(node: AssistStructure.ViewNode, visit: (AssistStructure.ViewNode) -> Unit) {
    visit(node)
    val count = node.childCount
    for (i in 0 until count) {
      walk(node.getChildAt(i), visit)
    }
  }

  private fun webDomainOf(node: AssistStructure.ViewNode): String? {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      return node.webDomain
    }
    return null
  }

  private fun isPasswordHint(hint: String): Boolean =
    hint == "password" || hint == "currentpassword" || hint == "newpassword" ||
      hint == "textpassword" || hint.contains("password")

  private fun isUsernameHint(hint: String): Boolean =
    hint == "username" || hint == "user" || hint == "login" ||
      hint == "email" || hint == "emailaddress" ||
      hint.contains("username") || hint.contains("email")
}
`,
  'AutofillSettingsActivity.kt': `package %PACKAGE%

import android.app.Activity
import android.content.Intent
import android.os.Bundle

/**
 * Punto de entrada desde los ajustes de Autofill del sistema.
 * Abre la app directamente en el selector de credenciales.
 */
class AutofillSettingsActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    startActivity(Intent(this, MainActivity::class.java))
    finish()
  }
}
`,
};

const AUTHOFILL_SERVICE_CONFIG_XML = `<?xml version="1.0" encoding="utf-8"?>
<autofill-service
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:settingsActivity=".AutofillSettingsActivity" />
`;

function writeSources(config) {
  const pkg = config.android?.package || 'com.mipass.app';
  const dir = path.join('android', 'app', 'src', 'main', 'java', ...pkg.split('.'));
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, src] of Object.entries(kotlinSources)) {
    fs.writeFileSync(path.join(dir, name), src.split('%PACKAGE%').join(pkg));
  }
  const resXmlDir = path.join('android', 'app', 'src', 'main', 'res', 'xml');
  fs.mkdirSync(resXmlDir, { recursive: true });
  fs.writeFileSync(path.join(resXmlDir, 'autofill_service_config.xml'), AUTHOFILL_SERVICE_CONFIG_XML);

  const stringsPath = path.join('android', 'app', 'src', 'main', 'res', 'values', 'strings.xml');
  if (fs.existsSync(stringsPath)) {
    let strings = fs.readFileSync(stringsPath, 'utf8');
    if (!strings.includes('autofill_service_label')) {
      strings = strings.replace(
        /<\/resources>/,
        '  <string name="autofill_service_label">Pass</string>\n</resources>'
      );
      fs.writeFileSync(stringsPath, strings);
    }
  }
}

function withKotlinSources(config) {
  return withDangerousMod(config, [
    'android',
    (c) => {
      writeSources(c);
      return c;
    },
  ]);
}

function withAutofillManifest(config) {
  return withAndroidManifest(config, (c) => {
    const manifest = c.modResults.manifest;
    const app = manifest.application?.[0];
    if (!app) return c;
    const pkg = config.android?.package || 'com.mipass.app';

    const services = app.service || [];
    if (!services.some((s) => s.$['android:name'] === '.AutofillService')) {
      app.service = [
        ...services,
        {
          $: {
            'android:name': '.AutofillService',
            'android:label': '@string/autofill_service_label',
            'android:permission': 'android.permission.BIND_AUTOFILL_SERVICE',
            'android:exported': 'true',
          },
          'intent-filter': [
            {
              action: [{ $: { 'android:name': 'android.service.autofill.AutofillService' } }],
            },
          ],
          'meta-data': [
            { $: { 'android:name': 'android.autofill', 'android:resource': '@xml/autofill_service_config' } },
          ],
        },
      ];
    }

    const activities = app.activity || [];
    if (!activities.some((a) => a.$['android:name'] === '.AutofillSettingsActivity')) {
      app.activity = [
        ...activities,
        {
          $: {
            'android:name': '.AutofillSettingsActivity',
            'android:exported': 'true',
            'android:theme': '@style/Theme.App.SplashScreen',
          },
        },
      ];
    }
    return c;
  });
}

function withAutofillString(config) {
  return config;
}

function withMainApplicationRegistration(config) {
  return withMainApplication(config, (c) => {
    const pkg = config.android?.package || 'com.mipass.app';
    let src = c.modResults.contents;
    const imports = [
      `import ${pkg}.AutofillPackage`,
      `import ${pkg}.DeviceBindingPackage`,
      `import ${pkg}.SecurityPackage`,
    ];
    for (const imp of imports) {
      if (!src.includes(imp)) {
        src = src.replace(
          /import expo\.modules\.ReactNativeHostWrapper/,
          `import expo.modules.ReactNativeHostWrapper\n${imp}`
        );
      }
    }
    const marker = '// Packages that cannot be autolinked yet can be added manually here, for example:';
    if (!src.includes('add(AutofillPackage())') || !src.includes('add(DeviceBindingPackage())')) {
      const injection = `add(AutofillPackage())
              add(DeviceBindingPackage())
              add(SecurityPackage())`;
      src = src.replace(marker, `${marker}\n              ${injection}`);
    }
    c.modResults.contents = src;
    return c;
  });
}

function withMainActivitySecureFlag(config) {
  return withMainActivity(config, (c) => {
    let src = c.modResults.contents;
    if (src.includes('applySecureFlag')) return c;

    if (!src.includes('import android.view.WindowManager')) {
      src = src.replace(
        /import android\.os\.Build[^\n]*\n/,
        'import android.os.Build\nimport android.view.WindowManager\n'
      );
    }

    src = src.replace(
      /super\.onCreate\(null\)/,
      `super.onCreate(null)
    applySecureFlag()`
    );

    src = src.replace(
      /class MainActivity : ReactActivity\(\) \{/,
      `class MainActivity : ReactActivity() {

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) applySecureFlag()
  }`
    );

    const secureMethod = `
  // Evita capturas de pantalla, grabación y vista previa en el recents.
  private fun applySecureFlag() {
    window.setFlags(
      WindowManager.LayoutParams.FLAG_SECURE,
      WindowManager.LayoutParams.FLAG_SECURE
    )
  }
}`;

    const closeIdx = src.lastIndexOf('}');
    src = src.slice(0, closeIdx) + secureMethod + src.slice(closeIdx + 1);

    c.modResults.contents = src;
    return c;
  });
}

module.exports = function withPassNativeModules(config) {
  config = withAutofillManifest(config);
  config = withMainApplicationRegistration(config);
  config = withMainActivitySecureFlag(config);
  config = withKotlinSources(config);
  return config;
};
