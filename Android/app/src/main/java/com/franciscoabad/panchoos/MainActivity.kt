package com.franciscoabad.panchoos

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.health.connect.client.PermissionController
import androidx.lifecycle.lifecycleScope
import com.franciscoabad.panchoos.data.health.HealthConnectSync
import com.franciscoabad.panchoos.theme.PanchoOSTheme
import kotlinx.coroutines.launch
import org.json.JSONObject

/**
 * La app Android es el mismo Pancho OS web dentro de un contenedor nativo.
 * Android solo agrega permisos y datos que el navegador no puede ofrecer,
 * especialmente Health Connect y notificaciones.
 */
class MainActivity : ComponentActivity() {
    companion object {
        const val EXTRA_NAV_TAB = "extra_nav_tab"
    }

    private val healthConnect by lazy { HealthConnectSync(applicationContext) }
    private var webView: WebView? = null
    private var pendingWebPermission: PermissionRequest? = null

    private val requestNotificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { }

    private val requestMicrophonePermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        pendingWebPermission?.let { request ->
            if (granted) request.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) else request.deny()
        }
        pendingWebPermission = null
    }

    private val requestHealthPermissionsLauncher = registerForActivityResult(
        PermissionController.createRequestPermissionResultContract()
    ) { granted ->
        val state = if (granted.containsAll(healthConnect.permissions)) "ready" else "needs_permission"
        publishHealthEvent(JSONObject().put("type", "state").put("state", state))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestNotificationPermissionIfNeeded()
        enableEdgeToEdge()
        setContent {
            PanchoOSTheme {
                PanchoWebApp(this)
            }
        }
    }

    override fun onResume() {
        super.onResume()
        publishHealthState()
    }

    fun attachWebView(view: WebView) {
        webView = view
        view.addJavascriptInterface(NativeBridge(this), "PanchoNative")
        publishHealthState()
    }

    fun requestHealthPermissions() {
        if (!healthConnect.isAvailable()) {
            publishHealthEvent(JSONObject().put("type", "state").put("state", "unavailable"))
            return
        }
        requestHealthPermissionsLauncher.launch(healthConnect.permissions)
    }

    /** Entrega el micrófono al grabador del OS solo después de que el usuario lo solicita. */
    fun requestMicrophonePermission(request: PermissionRequest) {
        if (!request.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
            request.deny()
            return
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            request.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
            return
        }
        pendingWebPermission?.deny()
        pendingWebPermission = request
        requestMicrophonePermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
    }

    fun syncHealth() {
        lifecycleScope.launch {
            try {
                if (!healthConnect.isAvailable()) {
                    publishHealthEvent(JSONObject().put("type", "state").put("state", "unavailable"))
                    return@launch
                }
                if (!healthConnect.hasPermissions()) {
                    publishHealthEvent(JSONObject().put("type", "state").put("state", "needs_permission"))
                    return@launch
                }
                val snapshot = healthConnect.readToday()
                if (!snapshot.hasMetrics()) {
                    publishHealthEvent(JSONObject().put("type", "error").put("message", "Health Connect no tiene pasos, sueño ni peso para hoy."))
                    return@launch
                }
                publishHealthEvent(
                    JSONObject()
                        .put("type", "snapshot")
                        .put("payload", healthConnect.payload(snapshot).toString())
                )
            } catch (error: Exception) {
                publishHealthEvent(JSONObject().put("type", "error").put("message", error.message ?: "No se pudo leer Health Connect."))
            }
        }
    }

    fun publishHealthState() {
        lifecycleScope.launch {
            val state = try {
                when {
                    !healthConnect.isAvailable() -> "unavailable"
                    healthConnect.hasPermissions() -> "ready"
                    else -> "needs_permission"
                }
            } catch (_: Exception) {
                "error"
            }
            publishHealthEvent(JSONObject().put("type", "state").put("state", state))
        }
    }

    private fun publishHealthEvent(event: JSONObject) {
        runOnUiThread {
            webView?.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('pancho-native-health', { detail: ${event} }));",
                null,
            )
        }
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            requestNotificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }
}

private class NativeBridge(private val activity: MainActivity) {
    @JavascriptInterface fun isAndroidApp(): Boolean = true
    @JavascriptInterface fun healthStatus() = activity.runOnUiThread { activity.publishHealthState() }
    @JavascriptInterface fun requestHealthPermissions() = activity.runOnUiThread { activity.requestHealthPermissions() }
    @JavascriptInterface fun syncHealth() = activity.runOnUiThread { activity.syncHealth() }
}
