package com.franciscoabad.panchoos.ui.inbox

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.franciscoabad.panchoos.data.PanchoRepository
import com.franciscoabad.panchoos.data.model.OsInboxItem
import com.franciscoabad.panchoos.data.model.OsResult
import com.franciscoabad.panchoos.notifications.NotificationHelper
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class QuickCaptureUiState(
    val titulo: String = "",
    val url: String = "",
    val descripcion: String = "",
    val categoria: String = "idea",
    val imageUri: Uri? = null,
    val isLoading: Boolean = false,
    val successMessage: String? = null,
    val errorMessage: String? = null
)

class QuickCaptureViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = PanchoRepository.getInstance(application)

    private val _uiState = MutableStateFlow(QuickCaptureUiState())
    val uiState: StateFlow<QuickCaptureUiState> = _uiState.asStateFlow()

    fun setInitialSharedData(
        title: String? = null,
        url: String? = null,
        notes: String? = null,
        imageUri: Uri? = null,
        category: String? = null
    ) {
        _uiState.update { current ->
            current.copy(
                titulo = title ?: current.titulo,
                url = url ?: current.url,
                descripcion = notes ?: current.descripcion,
                imageUri = imageUri ?: current.imageUri,
                categoria = category ?: current.categoria,
                successMessage = null,
                errorMessage = null
            )
        }
    }

    fun updateTitulo(titulo: String) {
        _uiState.update { it.copy(titulo = titulo, successMessage = null, errorMessage = null) }
    }

    fun updateUrl(url: String) {
        _uiState.update { it.copy(url = url, successMessage = null, errorMessage = null) }
    }

    fun updateDescripcion(desc: String) {
        _uiState.update { it.copy(descripcion = desc, successMessage = null, errorMessage = null) }
    }

    fun updateCategoria(cat: String) {
        _uiState.update { it.copy(categoria = cat) }
    }

    fun setImageUri(uri: Uri?) {
        _uiState.update { it.copy(imageUri = uri, successMessage = null, errorMessage = null) }
    }

    fun capture(onSuccessDone: (() -> Unit)? = null) {
        val current = _uiState.value
        val effectiveTitle = when {
            current.titulo.isNotBlank() -> current.titulo.trim()
            current.imageUri != null -> "Foto capturada (${current.categoria})"
            current.url.isNotBlank() -> "Enlace capturado"
            else -> return
        }

        _uiState.update { it.copy(isLoading = true, successMessage = null, errorMessage = null) }

        viewModelScope.launch {
            // If an image is attached, append metadata to description
            val finalDesc = buildString {
                if (current.descripcion.isNotBlank()) {
                    append(current.descripcion.trim())
                }
                if (current.imageUri != null) {
                    if (isNotEmpty()) append("\n\n")
                    append("📷 [Foto adjunta desde Android: ${current.imageUri.lastPathSegment ?: "imagen.jpg"}]")
                }
            }.ifBlank { null }

            val item = OsInboxItem(
                titulo = effectiveTitle,
                url = current.url.ifBlank { null },
                descripcion = finalDesc,
                categoria = current.categoria
            )

            when (val result = repository.captureToInbox(item)) {
                is OsResult.Success -> {
                    NotificationHelper.showInboxCapturedNotification(
                        context = getApplication(),
                        title = effectiveTitle,
                        category = current.categoria
                    )

                    _uiState.update {
                        it.copy(
                            titulo = "",
                            url = "",
                            descripcion = "",
                            imageUri = null,
                            isLoading = false,
                            successMessage = "¡Capturado en Pancho OS Inbox!"
                        )
                    }
                    onSuccessDone?.invoke()
                }
                is OsResult.Failure -> {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = result.error.userMessage()
                        )
                    }
                }
            }
        }
    }
}
