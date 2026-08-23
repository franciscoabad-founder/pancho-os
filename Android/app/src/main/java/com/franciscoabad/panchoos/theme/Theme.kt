package com.franciscoabad.panchoos.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val PanchoDarkColorScheme = darkColorScheme(
    primary = PanchoCyan,
    onPrimary = Color.Black,
    primaryContainer = DarkSlate700,
    onPrimaryContainer = PanchoCyanLight,
    secondary = PanchoEmerald,
    onSecondary = Color.Black,
    secondaryContainer = DarkSlate700,
    onSecondaryContainer = PanchoEmeraldLight,
    tertiary = PriorityHigh,
    background = DarkSlate950,
    onBackground = TextPrimary,
    surface = DarkSlate900,
    onSurface = TextPrimary,
    surfaceVariant = DarkSlate800,
    onSurfaceVariant = TextSecondary,
    outline = DarkSlate600
)

@Composable
fun PanchoOSTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = PanchoDarkColorScheme,
        typography = Typography,
        content = content
    )
}
