package com.franciscoabad.panchoos

import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.FlashOn
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.franciscoabad.panchoos.theme.*
import com.franciscoabad.panchoos.ui.inbox.QuickCaptureScreen
import com.franciscoabad.panchoos.ui.inbox.QuickCaptureViewModel
import com.franciscoabad.panchoos.ui.settings.SettingsScreen
import com.franciscoabad.panchoos.ui.tasks.TasksScreen

enum class AppDestination(
    val title: String,
    val icon: ImageVector
) {
    TASKS("Tareas", Icons.Default.CheckCircle),
    CAPTURE("Capturar", Icons.Default.FlashOn),
    SETTINGS("Ajustes", Icons.Default.Settings)
}

@Composable
fun MainNavigation(
    initialDestination: AppDestination = AppDestination.TASKS,
    sharedTitle: String? = null,
    sharedUrl: String? = null,
    sharedNotes: String? = null,
    sharedImageUri: Uri? = null,
    shouldOpenNewTaskDialog: Boolean = false
) {
    var currentDestination by remember(initialDestination) { mutableStateOf(initialDestination) }
    val quickCaptureViewModel: QuickCaptureViewModel = viewModel()

    // Feed shared intent data if provided
    LaunchedEffect(sharedTitle, sharedUrl, sharedNotes, sharedImageUri) {
        if (sharedTitle != null || sharedUrl != null || sharedNotes != null || sharedImageUri != null) {
            quickCaptureViewModel.setInitialSharedData(
                title = sharedTitle,
                url = sharedUrl,
                notes = sharedNotes,
                imageUri = sharedImageUri
            )
            currentDestination = AppDestination.CAPTURE
        }
    }

    Scaffold(
        bottomBar = {
            NavigationBar(
                containerColor = Slate900,
                tonalElevation = 8.dp
            ) {
                AppDestination.entries.forEach { destination ->
                    val isSelected = currentDestination == destination
                    NavigationBarItem(
                        selected = isSelected,
                        onClick = { currentDestination = destination },
                        icon = { Icon(destination.icon, contentDescription = destination.title) },
                        label = { Text(destination.title) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = Cyan400,
                            selectedTextColor = Cyan400,
                            indicatorColor = Slate800,
                            unselectedIconColor = Slate400,
                            unselectedTextColor = Slate400
                        )
                    )
                }
            }
        },
        containerColor = Slate950
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(Slate950)
        ) {
            when (currentDestination) {
                AppDestination.TASKS -> {
                    TasksScreen(
                        onNavigateToSettings = { currentDestination = AppDestination.SETTINGS },
                        initialShowCreateDialog = shouldOpenNewTaskDialog
                    )
                }
                AppDestination.CAPTURE -> {
                    QuickCaptureScreen(
                        viewModel = quickCaptureViewModel
                    )
                }
                AppDestination.SETTINGS -> {
                    SettingsScreen()
                }
            }
        }
    }
}
