package com.franciscoabad.panchoos

import android.annotation.SuppressLint
import android.graphics.Color
import android.webkit.WebResourceRequest
import android.webkit.WebChromeClient
import android.webkit.PermissionRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView

private const val OS_URL = "https://next.os.franciscoabad.com"

/** Pantalla única: el mismo OS web, no una réplica nativa divergente. */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun PanchoWebApp(activity: MainActivity) {
    AndroidView(
        modifier = Modifier
            .systemBarsPadding()
            .fillMaxSize(),
        factory = { context ->
            WebView(context).apply {
                setBackgroundColor(Color.rgb(8, 12, 22))
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.databaseEnabled = true
                settings.mediaPlaybackRequiresUserGesture = true
                settings.userAgentString = "${settings.userAgentString} PanchoOSAndroid/1.0"
                webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                        val host = request.url.host ?: return true
                        return host != "next.os.franciscoabad.com"
                    }
                }
                webChromeClient = object : WebChromeClient() {
                    override fun onPermissionRequest(request: android.webkit.PermissionRequest) {
                        android.util.Log.d("PanchoMic", "onPermissionRequest fired: ${request.resources.joinToString()} origin=${request.origin}")
                        activity.runOnUiThread {
                            when {
                                request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE) ->
                                    activity.requestCameraPermission(request)
                                request.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE) ->
                                    activity.requestMicrophonePermission(request)
                                else -> request.deny()
                            }
                        }
                    }
                    override fun onConsoleMessage(message: android.webkit.ConsoleMessage): Boolean {
                        android.util.Log.d("PanchoConsole", "${message.messageLevel()} ${message.message()} [${message.sourceId()}:${message.lineNumber()}]")
                        return true
                    }
                }
                activity.attachWebView(this)
                loadUrl(OS_URL)
            }
        },
    )
}
