const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withMainActivity,
  withMainApplication,
  withDangerousMod,
  withGradleProperties,
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

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.view.WindowManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

class SecurityModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule() {

  override fun getName(): String = "PassSecurity"

  /**
   * Activa/desactiva FLAG_SECURE en la ventana actual. Se aplica solo en las
   * pantallas sensibles (bóveda, detalle, edición) para no bloquear el overlay
   * de gestores de contraseñas externos sobre login/registro/autofill.
   */
  @ReactMethod
  fun setSecureFlag(enabled: Boolean, promise: Promise) {
    try {
      val activity = reactContext.currentActivity
      if (activity != null) {
        val window = activity.window
        if (enabled) {
          window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        } else {
          window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
      }
      promise.resolve(true)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

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
              val appOps =
                reactContext.getSystemService(Context.APP_OPS_SERVICE) as android.app.AppOpsManager
              appOps.checkOpNoThrow(
                "SYSTEM_ALERT_WINDOW",
                app.uid,
                app.packageName,
              ) == android.app.AppOpsManager.MODE_ALLOWED
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

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.view.autofill.AutofillId
import android.view.autofill.AutofillManager
import android.view.autofill.AutofillValue
import android.service.autofill.Dataset
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AutofillModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule() {

  override fun getName(): String = "PassAutofill"

  private fun resolveContext(): AutofillService.ParsedContext? {
    val pending = AutofillService.pendingContext
    if (pending != null) return pending

    val act = reactContext.currentActivity ?: return null
    val intent = act.intent ?: return null
    val isAutofill = intent.getBooleanExtra(AutofillService.EXTRA_AUTOFILL, false)
    if (!isAutofill) return null

    val domain = intent.getStringExtra(AutofillService.EXTRA_WEB_DOMAIN)
    val pkg = intent.getStringExtra(AutofillService.EXTRA_PACKAGE_NAME)

    val usernameId: AutofillId? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      intent.getParcelableExtra(AutofillService.EXTRA_USERNAME_ID, AutofillId::class.java)
    } else {
      @Suppress("DEPRECATION")
      intent.getParcelableExtra(AutofillService.EXTRA_USERNAME_ID)
    }
    val passwordId: AutofillId? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      intent.getParcelableExtra(AutofillService.EXTRA_PASSWORD_ID, AutofillId::class.java)
    } else {
      @Suppress("DEPRECATION")
      intent.getParcelableExtra(AutofillService.EXTRA_PASSWORD_ID)
    }
    val focusedId: AutofillId? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      intent.getParcelableExtra(AutofillService.EXTRA_FOCUSED_ID, AutofillId::class.java)
    } else {
      @Suppress("DEPRECATION")
      intent.getParcelableExtra(AutofillService.EXTRA_FOCUSED_ID)
    }

    if (domain.isNullOrEmpty() && pkg.isNullOrEmpty() && usernameId == null && passwordId == null && focusedId == null) {
      return null
    }

    val ctx = AutofillService.ParsedContext(
      webDomain = domain,
      packageName = pkg,
      focusedId = focusedId,
      usernameId = usernameId,
      passwordId = passwordId
    )
    AutofillService.pendingContext = ctx
    return ctx
  }

  /** Si la app se abrió por una petición de autofill, devuelve el contexto (webDomain/package). */
  @ReactMethod
  fun getFillContext(promise: Promise) {
    try {
      val ctx = resolveContext()
      if (ctx == null) {
        promise.resolve(null)
        return
      }
      val map = Arguments.createMap()
      map.putString("webDomain", ctx.webDomain ?: "")
      map.putString("packageName", ctx.packageName ?: "")
      promise.resolve(map)
    } catch (e: Exception) {
      promise.resolve(null)
    }
  }

  @ReactMethod
  fun completeFill(username: String, password: String, promise: Promise) {
    try {
      val ctx = resolveContext()
      if (ctx == null) {
        promise.resolve(false)
        return
      }

      val datasetBuilder = Dataset.Builder()
      val presentation = AutofillService.createPresentation(
        reactContext,
        if (username.isNotBlank()) username else "Pass",
        "Autorellenado por Pass"
      )

      var hasFields = false
      if (ctx.usernameId != null && username.isNotEmpty()) {
        datasetBuilder.setValue(ctx.usernameId, AutofillValue.forText(username), presentation)
        hasFields = true
      }
      if (ctx.passwordId != null && password.isNotEmpty()) {
        datasetBuilder.setValue(ctx.passwordId, AutofillValue.forText(password), presentation)
        hasFields = true
      }

      if (!hasFields && ctx.focusedId != null) {
        val valToUse = if (password.isNotEmpty()) password else username
        if (valToUse.isNotEmpty()) {
          datasetBuilder.setValue(ctx.focusedId, AutofillValue.forText(valToUse), presentation)
          hasFields = true
        }
      }

      if (!hasFields) {
        promise.resolve(false)
        return
      }

      val dataset = datasetBuilder.build()

      val replyIntent = Intent().apply {
        putExtra(AutofillManager.EXTRA_AUTHENTICATION_RESULT, dataset)
      }

      val activity = reactContext.currentActivity
      if (activity != null) {
        activity.setResult(Activity.RESULT_OK, replyIntent)
      }

      AutofillService.completeFillWithDataset(dataset)
      AutofillService.clearPending()
      activity?.intent?.removeExtra(AutofillService.EXTRA_AUTOFILL)

      promise.resolve(true)
    } catch (e: Exception) {
      AutofillService.clearPending()
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun cancelFill(promise: Promise) {
    try {
      val activity = reactContext.currentActivity
      if (activity != null) {
        activity.setResult(Activity.RESULT_CANCELED)
        activity.intent?.removeExtra(AutofillService.EXTRA_AUTOFILL)
      }
      AutofillService.cancelFill()
    } catch (e: Exception) {}
    promise.resolve(null)
  }

  @ReactMethod
  fun finishActivity(promise: Promise) {
    try {
      val act = reactContext.currentActivity
      act?.finish()
    } catch (e: Exception) {}
    promise.resolve(null)
  }

  /** Abre los ajustes de autofill del sistema (para activar el servicio). */
  @ReactMethod
  fun openSystemSettings(promise: Promise) {
    val ok = try {
      val intent =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
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

import android.app.PendingIntent
import android.app.assist.AssistStructure
import android.content.Context
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
import android.text.InputType
import android.view.autofill.AutofillId
import android.view.autofill.AutofillValue
import android.widget.RemoteViews

/**
 * Servicio de Autofill de Android (API 26+).
 *
 * Compatible con navegadores (Chrome, Firefox, Edge, Brave, Opera, etc.)
 * y aplicaciones nativas de Android.
 */
class AutofillService : SystemAutofillService() {

  companion object {
    const val EXTRA_AUTOFILL = "%PACKAGE%.autofill"
    const val EXTRA_WEB_DOMAIN = "%PACKAGE%.autofill_domain"
    const val EXTRA_PACKAGE_NAME = "%PACKAGE%.autofill_package"
    const val EXTRA_USERNAME_ID = "%PACKAGE%.autofill_username_id"
    const val EXTRA_PASSWORD_ID = "%PACKAGE%.autofill_password_id"
    const val EXTRA_FOCUSED_ID = "%PACKAGE%.autofill_focused_id"

    @Volatile
    var pendingContext: ParsedContext? = null

    @Volatile
    private var pendingCallback: FillCallback? = null

    fun clearPending() {
      pendingContext = null
      pendingCallback = null
    }

    fun completeFillWithDataset(dataset: Dataset): Boolean {
      val callback = pendingCallback
      pendingCallback = null
      if (callback != null) {
        return try {
          val response = FillResponse.Builder().addDataset(dataset).build()
          callback.onSuccess(response)
          true
        } catch (e: Exception) {
          false
        }
      }
      return false
    }

    fun cancelFill() {
      try {
        pendingCallback?.onSuccess(null)
      } catch (e: Exception) {}
      clearPending()
    }

    fun createPresentation(context: Context, title: String, subtitle: String = "Autorellenar con Pass"): RemoteViews {
      return RemoteViews(context.packageName, R.layout.autofill_dropdown_item).apply {
        setTextViewText(R.id.autofill_title, title)
        setTextViewText(R.id.autofill_subtitle, subtitle)
        setImageViewResource(R.id.autofill_icon, R.mipmap.ic_launcher_round)
      }
    }
  }

  data class ParsedContext(
    val webDomain: String?,
    val packageName: String?,
    val focusedId: AutofillId?,
    val usernameId: AutofillId?,
    val passwordId: AutofillId?
  )

  override fun onFillRequest(request: FillRequest, cancellationSignal: CancellationSignal, callback: FillCallback) {
    try {
      val context = request.fillContexts.lastOrNull()
      if (context == null) {
        callback.onSuccess(null)
        return
      }

      val parsed = parseStructure(context.structure)
      // No autofill sobre la propia app
      if (parsed == null || parsed.packageName == packageName) {
        callback.onSuccess(null)
        return
      }

      val targetIds = listOfNotNull(parsed.focusedId, parsed.usernameId, parsed.passwordId).distinct()
      if (targetIds.isEmpty()) {
        callback.onSuccess(null)
        return
      }

      pendingContext = parsed
      pendingCallback = callback
      cancellationSignal.setOnCancelListener { clearPending() }

      val authIntent = Intent(this, MainActivity::class.java).apply {
        action = Intent.ACTION_VIEW
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        putExtra(EXTRA_AUTOFILL, true)
        putExtra(EXTRA_WEB_DOMAIN, parsed.webDomain ?: "")
        putExtra(EXTRA_PACKAGE_NAME, parsed.packageName ?: "")
        putExtra(EXTRA_USERNAME_ID, parsed.usernameId)
        putExtra(EXTRA_PASSWORD_ID, parsed.passwordId)
        putExtra(EXTRA_FOCUSED_ID, parsed.focusedId)
      }

      val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        PendingIntent.FLAG_CANCEL_CURRENT or PendingIntent.FLAG_MUTABLE
      } else {
        PendingIntent.FLAG_CANCEL_CURRENT
      }

      val pendingIntent = PendingIntent.getActivity(
        this,
        1001,
        authIntent,
        flags
      )

      val domainOrApp = parsed.webDomain?.ifBlank { null } ?: parsed.packageName ?: "Pass"
      val presentation = createPresentation(this, "Pass", "Rellenar credencial ($domainOrApp)")

      val responseBuilder = FillResponse.Builder()
      responseBuilder.setAuthentication(
        targetIds.toTypedArray(),
        pendingIntent.intentSender,
        presentation
      )

      callback.onSuccess(responseBuilder.build())
    } catch (e: Exception) {
      clearPending()
      try {
        callback.onSuccess(null)
      } catch (e2: Exception) {}
    }
  }

  override fun onSaveRequest(request: SaveRequest, callback: SaveCallback) {
    try {
      callback.onSuccess()
    } catch (e: Exception) {}
  }

  private fun parseStructure(structure: AssistStructure): ParsedContext? {
    var usernameId: AutofillId? = null
    var passwordId: AutofillId? = null
    var focusedId: AutofillId? = null
    var webDomain: String? = null
    val packageName = structure.activityComponent?.packageName

    val windowCount = structure.windowNodeCount
    for (w in 0 until windowCount) {
      val root = structure.getWindowNodeAt(w).rootViewNode
      webDomain = cleanWebDomain(webDomainOf(root)) ?: webDomain
      walk(root) { node ->
        if (webDomain == null) {
          webDomain = cleanWebDomain(webDomainOf(node))
        }

        val id = node.autofillId
        if (id != null) {
          if (node.isFocused) {
            focusedId = id
          }

          if (isPasswordField(node)) {
            if (passwordId == null || node.isFocused) {
              passwordId = id
            }
          } else if (isUsernameField(node)) {
            if (usernameId == null || (node.isFocused && passwordId == null)) {
              usernameId = id
            }
          }
        }
      }
    }

    if (usernameId == null && passwordId == null && focusedId == null) {
      return null
    }

    return ParsedContext(webDomain, packageName, focusedId, usernameId, passwordId)
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
      val domain = node.webDomain
      if (!domain.isNullOrBlank()) return domain
    }
    return null
  }

  private fun cleanWebDomain(raw: String?): String? {
    if (raw.isNullOrBlank()) return null
    var d = raw.trim().lowercase()
    if (d.startsWith("http://")) d = d.substring(7)
    if (d.startsWith("https://")) d = d.substring(8)
    if (d.startsWith("www.")) d = d.substring(4)
    val slashIdx = d.indexOf('/')
    if (slashIdx != -1) d = d.substring(0, slashIdx)
    val colonIdx = d.indexOf(':')
    if (colonIdx != -1) d = d.substring(0, colonIdx)
    return if (d.isNotBlank()) d else null
  }

  private fun isPasswordField(node: AssistStructure.ViewNode): Boolean {
    node.autofillHints?.forEach { hint ->
      val h = hint.lowercase()
      if (h == "password" || h == "current-password" || h == "new-password" ||
        h == "textpassword" || h.contains("password") || h.contains("pwd") || h.contains("pass") ||
        h.contains("contrasena") || h.contains("contraseña") || h.contains("clave") || h.contains("pin")) {
        return true
      }
    }

    val inputType = node.inputType
    val variation = inputType and InputType.TYPE_MASK_VARIATION
    if (variation == InputType.TYPE_TEXT_VARIATION_PASSWORD ||
      variation == InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD ||
      variation == InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD ||
      variation == InputType.TYPE_NUMBER_VARIATION_PASSWORD) {
      return true
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val htmlInfo = node.htmlInfo
      if (htmlInfo != null) {
        val attrs = htmlInfo.attributes
        if (attrs != null) {
          for (pair in attrs) {
            val k = pair.first.lowercase()
            val v = pair.second.lowercase()
            if (k == "type" && v == "password") return true
            if (k == "autocomplete" && (v.contains("password") || v.contains("current-password") || v.contains("new-password"))) return true
            if ((k == "name" || k == "id" || k == "placeholder" || k == "aria-label" || k == "title") &&
              (v.contains("pass") || v.contains("pwd") || v.contains("contras") || v.contains("clave"))) {
              return true
            }
          }
        }
      }
    }

    val hint = node.hint?.toString()?.lowercase() ?: ""
    if (hint.contains("password") || hint.contains("contraseña") || hint.contains("contrasena") ||
      hint.contains("clave") || hint.contains("passwort") || hint.contains("mot de passe")) {
      return true
    }

    val idEntry = node.idEntry?.lowercase() ?: ""
    if (idEntry.contains("password") || idEntry.contains("passwd") || idEntry.contains("pwd") ||
      idEntry.contains("contras") || idEntry.contains("pass_field")) {
      return true
    }

    return false
  }

  private fun isUsernameField(node: AssistStructure.ViewNode): Boolean {
    if (isPasswordField(node)) return false

    node.autofillHints?.forEach { hint ->
      val h = hint.lowercase()
      if (h == "username" || h == "user" || h == "login" || h == "email" ||
        h == "emailaddress" || h == "phone" || h.contains("username") || h.contains("email") ||
        h.contains("usuario") || h.contains("correo") || h.contains("login")) {
        return true
      }
    }

    val inputType = node.inputType
    val variation = inputType and InputType.TYPE_MASK_VARIATION
    if (variation == InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS ||
      variation == InputType.TYPE_TEXT_VARIATION_WEB_EMAIL_ADDRESS) {
      return true
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val htmlInfo = node.htmlInfo
      if (htmlInfo != null) {
        val attrs = htmlInfo.attributes
        if (attrs != null) {
          for (pair in attrs) {
            val k = pair.first.lowercase()
            val v = pair.second.lowercase()
            if (k == "type" && (v == "email" || v == "tel")) return true
            if (k == "autocomplete" && (v.contains("username") || v.contains("email") || v.contains("account"))) return true
            if ((k == "name" || k == "id" || k == "placeholder" || k == "aria-label" || k == "title") &&
              (v.contains("user") || v.contains("email") || v.contains("login") ||
                v.contains("correo") || v.contains("usuario") || v.contains("account") ||
                v.contains("identifier") || v.contains("identificador") || v.contains("phone"))) {
              return true
            }
          }
        }
      }
    }

    val hint = node.hint?.toString()?.lowercase() ?: ""
    if (hint.contains("username") || hint.contains("usuario") || hint.contains("email") ||
      hint.contains("correo") || hint.contains("login") || hint.contains("cuenta") ||
      hint.contains("identificador") || hint.contains("teléfono") || hint.contains("telefono") ||
      hint.contains("phone")) {
      return true
    }

    val idEntry = node.idEntry?.lowercase() ?: ""
    if (idEntry.contains("username") || idEntry.contains("user") || idEntry.contains("email") ||
      idEntry.contains("login") || idEntry.contains("mail") || idEntry.contains("usuario") ||
      idEntry.contains("cuenta") || idEntry.contains("identifier")) {
      return true
    }

    return false
  }
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

const AUTOFILL_SERVICE_CONFIG_XML = `<?xml version="1.0" encoding="utf-8"?>
<autofill-service
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:settingsActivity=".AutofillSettingsActivity">
    <compatibility-package android:name="com.android.chrome" android:maxLongVersionCode="10000000000"/>
    <compatibility-package android:name="com.chrome.beta" android:maxLongVersionCode="10000000000"/>
    <compatibility-package android:name="com.chrome.dev" android:maxLongVersionCode="10000000000"/>
    <compatibility-package android:name="com.chrome.canary" android:maxLongVersionCode="10000000000"/>
    <compatibility-package android:name="org.chromium.chrome" android:maxLongVersionCode="10000000000"/>
    <compatibility-package android:name="org.mozilla.firefox" android:maxLongVersionCode="10000000000"/>
    <compatibility-package android:name="org.mozilla.firefox_beta" android:maxLongVersionCode="10000000000"/>
    <compatibility-package android:name="org.mozilla.fenix" android:maxLongVersionCode="10000000000"/>
    <compatibility-package android:name="org.mozilla.focus" android:maxLongVersionCode="10000000000"/>
    <compatibility-package android:name="com.microsoft.emmx" android:maxLongVersionCode="10000000000"/>
    <compatibility-package android:name="com.brave.browser" android:maxLongVersionCode="10000000000"/>
    <compatibility-package android:name="com.opera.browser" android:maxLongVersionCode="10000000000"/>
    <compatibility-package android:name="com.opera.mini.native" android:maxLongVersionCode="10000000000"/>
    <compatibility-package android:name="com.opera.gx" android:maxLongVersionCode="10000000000"/>
    <compatibility-package android:name="com.duckduckgo.mobile.android" android:maxLongVersionCode="10000000000"/>
    <compatibility-package android:name="com.sec.android.app.sbrowser" android:maxLongVersionCode="10000000000"/>
    <compatibility-package android:name="com.vivaldi.browser" android:maxLongVersionCode="10000000000"/>
    <compatibility-package android:name="com.kiwibrowser.browser" android:maxLongVersionCode="10000000000"/>
</autofill-service>
`;

const AUTOFILL_DROPDOWN_ITEM_XML = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:orientation="horizontal"
    android:gravity="center_vertical"
    android:paddingStart="14dp"
    android:paddingEnd="14dp"
    android:paddingTop="10dp"
    android:paddingBottom="10dp"
    android:background="@android:color/white">

    <ImageView
        android:id="@+id/autofill_icon"
        android:layout_width="24dp"
        android:layout_height="24dp"
        android:layout_marginEnd="12dp"
        android:src="@mipmap/ic_launcher_round"
        android:contentDescription="Pass" />

    <LinearLayout
        android:layout_width="0dp"
        android:layout_height="wrap_content"
        android:layout_weight="1"
        android:orientation="vertical">

        <TextView
            android:id="@+id/autofill_title"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="Pass"
            android:textStyle="bold"
            android:textSize="14sp"
            android:textColor="#111827" />

        <TextView
            android:id="@+id/autofill_subtitle"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="Autorellenar credenciales"
            android:textSize="12sp"
            android:textColor="#6B7280" />
    </LinearLayout>
</LinearLayout>
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
  fs.writeFileSync(path.join(resXmlDir, 'autofill_service_config.xml'), AUTOFILL_SERVICE_CONFIG_XML);

  const resLayoutDir = path.join('android', 'app', 'src', 'main', 'res', 'layout');
  fs.mkdirSync(resLayoutDir, { recursive: true });
  fs.writeFileSync(path.join(resLayoutDir, 'autofill_dropdown_item.xml'), AUTOFILL_DROPDOWN_ITEM_XML);

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

function withMainActivityOnNewIntent(config) {
  return withMainActivity(config, (c) => {
    let src = c.modResults.contents;
    if (!src.includes('onNewIntent')) {
      const injection = `
  override fun onNewIntent(intent: android.content.Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
  }
`;
      src = src.replace(/class MainActivity : ReactActivity\(\) \{/, `class MainActivity : ReactActivity() {${injection}`);
      c.modResults.contents = src;
    }
    return c;
  });
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

function isTermux() {
  return (
    process.env.PREFIX != null &&
    process.env.PREFIX.includes('com.termux')
  );
}

// En Termux (aarch64) los binarios aapt2 de Maven y del SDK son x86_64 y no
// pueden ejecutarse. Si el aapt2 nativo de Termux existe, usamos ese.
function withTermuxAapt2(config) {
  if (!isTermux()) return config;
  const aapt2 = path.join(process.env.PREFIX, 'bin', 'aapt2');
  if (!fs.existsSync(aapt2)) return config;
  return withGradleProperties(config, (c) => {
    if (!c.modResults.some((p) => p.key === 'android.aapt2FromMavenOverride')) {
      c.modResults.push({ type: 'property', key: 'android.aapt2FromMavenOverride', value: aapt2 });
    }
    return c;
  });
}

module.exports = function withPassNativeModules(config) {
  config = withAutofillManifest(config);
  config = withMainActivityOnNewIntent(config);
  config = withMainApplicationRegistration(config);
  config = withKotlinSources(config);
  config = withTermuxAapt2(config);
  return config;
};
