package com.franciscoabad.panchoos

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Parcelable
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import com.franciscoabad.panchoos.theme.PanchoOSTheme

class MainActivity : ComponentActivity() {

    companion object {
        const val EXTRA_NAV_TAB = "extra_nav_tab"
        const val ACTION_NEW_TASK = "com.franciscoabad.panchoos.ACTION_NEW_TASK"
        const val ACTION_QUICK_CAPTURE = "com.franciscoabad.panchoos.ACTION_QUICK_CAPTURE"
        const val ACTION_CAPTURE_PHOTO = "com.franciscoabad.panchoos.ACTION_CAPTURE_PHOTO"
    }

    private var initialDestinationState by mutableStateOf(AppDestination.TASKS)
    private var sharedTitleState by mutableStateOf<String?>(null)
    private var sharedUrlState by mutableStateOf<String?>(null)
    private var sharedNotesState by mutableStateOf<String?>(null)
    private var sharedImageUriState by mutableStateOf<Uri?>(null)
    private var openNewTaskDialogState by mutableStateOf(false)

    // Notification Permission Launcher (Android 13+)
    private val requestNotificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ ->
        // Notification permission handled
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Request notification permissions gracefully on Android 13+
        checkAndRequestNotificationPermission()

        // Handle initial intent
        handleIncomingIntent(intent)

        enableEdgeToEdge()
        setContent {
            PanchoOSTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    MainNavigation(
                        initialDestination = initialDestinationState,
                        sharedTitle = sharedTitleState,
                        sharedUrl = sharedUrlState,
                        sharedNotes = sharedNotesState,
                        sharedImageUri = sharedImageUriState,
                        shouldOpenNewTaskDialog = openNewTaskDialogState
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIncomingIntent(intent)
    }

    private fun checkAndRequestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                requestNotificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    private fun handleIncomingIntent(intent: Intent?) {
        if (intent == null) return

        val action = intent.action
        val type = intent.type

        when (action) {
            ACTION_NEW_TASK -> {
                initialDestinationState = AppDestination.TASKS
                openNewTaskDialogState = true
            }
            ACTION_QUICK_CAPTURE -> {
                initialDestinationState = AppDestination.CAPTURE
                openNewTaskDialogState = false
            }
            ACTION_CAPTURE_PHOTO -> {
                initialDestinationState = AppDestination.CAPTURE
                openNewTaskDialogState = false
            }
            Intent.ACTION_SEND -> {
                if (type?.startsWith("text/") == true) {
                    handleSendText(intent)
                } else if (type?.startsWith("image/") == true) {
                    handleSendImage(intent)
                }
            }
            Intent.ACTION_SEND_MULTIPLE -> {
                if (type?.startsWith("image/") == true) {
                    handleSendMultipleImages(intent)
                }
            }
            else -> {
                val tab = intent.getStringExtra(EXTRA_NAV_TAB)
                if (tab == "tasks") {
                    initialDestinationState = AppDestination.TASKS
                } else if (tab == "inbox") {
                    initialDestinationState = AppDestination.CAPTURE
                }
            }
        }
    }

    private fun handleSendText(intent: Intent) {
        val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT) ?: ""
        val sharedSubject = intent.getStringExtra(Intent.EXTRA_SUBJECT)

        // Find URL in text
        val urlRegex = "(https?://[\\w\\d:#@%/;$()~_?\\+-=\\\\\\.&]+)".toRegex()
        val match = urlRegex.find(sharedText)
        val extractedUrl = match?.value

        val cleanText = if (extractedUrl != null) {
            sharedText.replace(extractedUrl, "").trim()
        } else {
            sharedText.trim()
        }

        val title = sharedSubject ?: cleanText.lines().firstOrNull()?.take(80) ?: "Enlace compartido"
        val notes = if (cleanText.isNotBlank() && cleanText != title) cleanText else null

        sharedTitleState = title
        sharedUrlState = extractedUrl
        sharedNotesState = notes
        sharedImageUriState = null
        initialDestinationState = AppDestination.CAPTURE
    }

    private fun handleSendImage(intent: Intent) {
        val imageUri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra(Intent.EXTRA_STREAM) as? Uri
        }

        val extraText = intent.getStringExtra(Intent.EXTRA_TEXT)

        sharedTitleState = extraText ?: "Foto compartida"
        sharedUrlState = null
        sharedNotesState = null
        sharedImageUriState = imageUri
        initialDestinationState = AppDestination.CAPTURE
    }

    private fun handleSendMultipleImages(intent: Intent) {
        val imageUris = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableArrayListExtra<Parcelable>(Intent.EXTRA_STREAM)?.filterIsInstance<Uri>()
        }

        val firstImage = imageUris?.firstOrNull()
        sharedTitleState = "Fotos compartidas (${imageUris?.size ?: 1})"
        sharedUrlState = null
        sharedNotesState = null
        sharedImageUriState = firstImage
        initialDestinationState = AppDestination.CAPTURE
    }
}
