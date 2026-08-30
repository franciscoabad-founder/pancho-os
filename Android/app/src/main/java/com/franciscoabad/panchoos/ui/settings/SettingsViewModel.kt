package com.franciscoabad.panchoos.ui.settings

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.franciscoabad.panchoos.data.PanchoRepository
import com.franciscoabad.panchoos.data.health.HealthConnectSync
import com.franciscoabad.panchoos.data.model.OsResult
import com.franciscoabad.panchoos.data.model.PairingStatusResponse
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

sealed interface TestConnectionResult {
    data class Success(val message: String) : TestConnectionResult
    data class Error(val message: String) : TestConnectionResult
}

sealed interface PairingState {
    data object Idle : PairingState
    data object Starting : PairingState
    data class Waiting(
        val deviceId: String,
        val code: String,
        val expiresAt: String
    ) : PairingState
    data class Success(val label: String) : PairingState
    data class Error(val message: String) : PairingState
}

sealed interface HealthSyncState {
    data object Checking : HealthSyncState
    data object Unavailable : HealthSyncState
    data object NeedsPermission : HealthSyncState
    data object Ready : HealthSyncState
    data object Syncing : HealthSyncState
    data class Success(val message: String) : HealthSyncState
    data class Error(val message: String) : HealthSyncState
}

data class SettingsUiState(
    val serverUrl: String = "",
    val apiToken: String = "",
    val deviceName: String = "",
    val pairingState: PairingState = PairingState.Idle,
    val isTesting: Boolean = false,
    val testResult: TestConnectionResult? = null,
    val isSaved: Boolean = false,
    val healthSyncState: HealthSyncState = HealthSyncState.Checking
)

class SettingsViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = PanchoRepository.getInstance(application)
    private val healthConnect = HealthConnectSync(application)

    private val _uiState = MutableStateFlow(
        SettingsUiState(
            serverUrl = repository.preferences.getServerUrl(),
            apiToken = repository.preferences.getApiToken()
        )
    )
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    private var pairingJob: Job? = null

    init {
        refreshHealthStatus()
        // Si la app se cerro durante un pairing, reanudamos el polling.
        repository.preferences.getPairingDeviceId()?.let { deviceId ->
            // No tenemos el codigo guardado, pero podemos seguir polleando.
            // El usuario vera "reanudando" y si el pairing ya fue confirmado,
            // recibira el token; si vencio, recibira un error.
            startPolling(deviceId, code = "")
        }
    }

    fun refreshHealthStatus() {
        if (!healthConnect.isAvailable()) {
            _uiState.update { it.copy(healthSyncState = HealthSyncState.Unavailable) }
            return
        }
        viewModelScope.launch {
            try {
                val state = if (healthConnect.hasPermissions()) HealthSyncState.Ready else HealthSyncState.NeedsPermission
                _uiState.update { it.copy(healthSyncState = state) }
            } catch (error: Exception) {
                _uiState.update { it.copy(healthSyncState = HealthSyncState.Error(error.message ?: "No se pudo comprobar Health Connect.")) }
            }
        }
    }

    fun healthPermissions() = healthConnect.permissionsForGrant

    fun onHealthPermissionsResult() = refreshHealthStatus()

    fun syncHealthToday() {
        _uiState.update { it.copy(healthSyncState = HealthSyncState.Syncing) }
        viewModelScope.launch {
            try {
                val snapshot = healthConnect.readToday()
                if (!snapshot.hasMetrics()) {
                    _uiState.update { it.copy(healthSyncState = HealthSyncState.Error("Health Connect no tiene pasos, sueño ni peso para hoy.")) }
                    return@launch
                }
                when (val result = repository.syncBiometrics(healthConnect.payload(snapshot))) {
                    is OsResult.Success -> _uiState.update { it.copy(healthSyncState = HealthSyncState.Success("Sincronizado: ${snapshot.pasos ?: 0} pasos${snapshot.suenoMin?.let { ", $it min de sueño" } ?: ""}${snapshot.pesoKg?.let { ", ${"%.1f".format(it)} kg" } ?: ""}.")) }
                    is OsResult.Failure -> _uiState.update { it.copy(healthSyncState = HealthSyncState.Error(result.error.userMessage())) }
                }
            } catch (error: Exception) {
                _uiState.update { it.copy(healthSyncState = HealthSyncState.Error(error.message ?: "No se pudo leer Health Connect.")) }
            }
        }
    }

    override fun onCleared() {
        pairingJob?.cancel()
    }

    fun updateServerUrl(url: String) {
        _uiState.update { it.copy(serverUrl = url, testResult = null, isSaved = false) }
    }

    fun updateApiToken(token: String) {
        _uiState.update { it.copy(apiToken = token, testResult = null, isSaved = false) }
    }

    fun updateDeviceName(name: String) {
        _uiState.update { it.copy(deviceName = name, testResult = null, isSaved = false) }
    }

    fun saveSettings() {
        val currentState = _uiState.value
        repository.updateConfig(currentState.serverUrl, currentState.apiToken)
        _uiState.update { it.copy(isSaved = true) }
    }

    fun testConnection() {
        val currentState = _uiState.value
        repository.updateConfig(currentState.serverUrl, currentState.apiToken)

        _uiState.update { it.copy(isTesting = true, testResult = null) }
        viewModelScope.launch {
            when (val result = repository.pingServer()) {
                is OsResult.Success -> {
                    _uiState.update {
                        it.copy(
                            isTesting = false,
                            testResult = TestConnectionResult.Success(result.data)
                        )
                    }
                }
                is OsResult.Failure -> {
                    _uiState.update {
                        it.copy(
                            isTesting = false,
                            testResult = TestConnectionResult.Error(result.error.userMessage())
                        )
                    }
                }
            }
        }
    }

    /**
     * Inicia el flujo de emparejamiento os_devices. La app pide un codigo de
     * 6 digitos; Pancho lo confirma en /sistema; la app pollea hasta recibir
     * el token, que se guarda en EncryptedSharedPreferences.
     */
    fun startPairing() {
        pairingJob?.cancel()
        _uiState.update { it.copy(pairingState = PairingState.Starting) }

        pairingJob = viewModelScope.launch {
            val label = _uiState.value.deviceName.trim().ifBlank { "Android de Pancho" }
            when (val result = repository.startPairing(label)) {
                is OsResult.Success -> {
                    val response = result.data
                    repository.preferences.setPairingDeviceId(response.device_id)
                    _uiState.update {
                        it.copy(
                            pairingState = PairingState.Waiting(
                                deviceId = response.device_id,
                                code = response.code,
                                expiresAt = response.expires_at
                            )
                        )
                    }
                    startPolling(response.device_id, response.code)
                }
                is OsResult.Failure -> {
                    _uiState.update {
                        it.copy(pairingState = PairingState.Error(result.error.userMessage()))
                    }
                }
            }
        }
    }

    fun cancelPairing() {
        pairingJob?.cancel()
        repository.preferences.setPairingDeviceId(null)
        _uiState.update { it.copy(pairingState = PairingState.Idle) }
    }

    private fun startPolling(deviceId: String, code: String) {
        pairingJob?.cancel()
        pairingJob = viewModelScope.launch {
            while (isActive) {
                when (val result = repository.pollPairingStatus(deviceId)) {
                    is OsResult.Success -> {
                        when (result.data.status) {
                            "confirmed" -> {
                                val token = result.data.token
                                if (!token.isNullOrBlank()) {
                                    repository.preferences.setPairingDeviceId(null)
                                    repository.updateConfig(
                                        _uiState.value.serverUrl,
                                        token
                                    )
                                    _uiState.update {
                                        it.copy(
                                            apiToken = token,
                                            pairingState = PairingState.Success(
                                                label = result.data.label ?: "Android"
                                            ),
                                            isSaved = true
                                        )
                                    }
                                } else {
                                    _uiState.update {
                                        it.copy(
                                            pairingState = PairingState.Error("El servidor no devolvio un token valido.")
                                        )
                                    }
                                }
                                return@launch
                            }
                            else -> {
                                // pending: seguir polleando
                                _uiState.update {
                                    it.copy(
                                        pairingState = PairingState.Waiting(
                                            deviceId = deviceId,
                                            code = code,
                                            expiresAt = (it.pairingState as? PairingState.Waiting)?.expiresAt ?: ""
                                        )
                                    )
                                }
                            }
                        }
                    }
                    is OsResult.Failure -> {
                        val msg = result.error.userMessage()
                        // 410 = vencio o ya se entrego. Cortamos.
                        if (msg.contains("410") || msg.contains("vencio", ignoreCase = true) || msg.contains("entregado", ignoreCase = true)) {
                            repository.preferences.setPairingDeviceId(null)
                            _uiState.update { it.copy(pairingState = PairingState.Error(msg)) }
                            return@launch
                        }
                        // Otros errores de red se tragan y se sigue polleando.
                    }
                }
                delay(2_500)
            }
        }
    }
}
