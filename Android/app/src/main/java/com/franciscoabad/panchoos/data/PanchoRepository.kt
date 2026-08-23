package com.franciscoabad.panchoos.data

import android.content.Context
import com.franciscoabad.panchoos.data.model.OsInboxItem
import com.franciscoabad.panchoos.data.model.OsResult
import com.franciscoabad.panchoos.data.model.OsTask
import com.franciscoabad.panchoos.data.model.PairingStartResponse
import com.franciscoabad.panchoos.data.model.PairingStatusResponse
import com.franciscoabad.panchoos.data.network.PanchoApiClient
import com.franciscoabad.panchoos.data.storage.OsPreferences
import kotlinx.coroutines.flow.StateFlow

class PanchoRepository(
    val preferences: OsPreferences,
    val apiClient: PanchoApiClient
) {
    val serverUrlFlow: StateFlow<String> = preferences.serverUrlFlow
    val apiTokenFlow: StateFlow<String> = preferences.apiTokenFlow

    fun isConfigured(): Boolean = preferences.isConfigured()

    fun updateConfig(url: String, token: String) {
        preferences.setServerUrl(url)
        preferences.setApiToken(token)
    }

    suspend fun pingServer(): OsResult<String> {
        return apiClient.ping()
    }

    suspend fun fetchTasks(estado: String = "pendientes"): OsResult<List<OsTask>> {
        return apiClient.getTasks(estado)
    }

    suspend fun createTask(titulo: String, prioridad: String, deadline: String?): OsResult<OsTask> {
        return apiClient.createTask(titulo, prioridad, deadline)
    }

    suspend fun toggleTaskComplete(task: OsTask): OsResult<Boolean> {
        val nuevoEstado = if (task.isCompleted) "pendiente" else "hecho"
        return apiClient.updateTask(id = task.id, estado = nuevoEstado)
    }

    suspend fun toggleTaskById(taskId: String, completed: Boolean): OsResult<Boolean> {
        val nuevoEstado = if (completed) "hecho" else "pendiente"
        return apiClient.updateTask(id = taskId, estado = nuevoEstado)
    }

    suspend fun captureToInbox(item: OsInboxItem): OsResult<Boolean> {
        return apiClient.captureInbox(
            titulo = item.titulo,
            url = item.url,
            descripcion = item.descripcion,
            categoria = item.categoria
        )
    }

    suspend fun startPairing(label: String?): OsResult<PairingStartResponse> {
        return apiClient.startPairing(kind = "android", label = label)
    }

    suspend fun pollPairingStatus(deviceId: String): OsResult<PairingStatusResponse> {
        return apiClient.pollPairingStatus(deviceId)
    }

    companion object {
        @Volatile
        private var INSTANCE: PanchoRepository? = null

        fun getInstance(context: Context): PanchoRepository {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: run {
                    val prefs = OsPreferences.getInstance(context)
                    val api = PanchoApiClient(prefs)
                    PanchoRepository(prefs, api).also { INSTANCE = it }
                }
            }
        }
    }
}
