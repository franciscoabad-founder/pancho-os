package com.franciscoabad.panchoos.data.storage

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class OsPreferences(context: Context) {
    private val prefs: SharedPreferences = try {
        val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
        EncryptedSharedPreferences.create(
            "pancho_os_secure_prefs",
            masterKeyAlias,
            context,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    } catch (e: Exception) {
        // Fallback a SharedPreferences estándar en caso de fallo en Keystore
        context.getSharedPreferences("pancho_os_prefs", Context.MODE_PRIVATE)
    }

    private val _serverUrlFlow = MutableStateFlow(getServerUrl())
    val serverUrlFlow: StateFlow<String> = _serverUrlFlow.asStateFlow()

    private val _apiTokenFlow = MutableStateFlow(getApiToken())
    val apiTokenFlow: StateFlow<String> = _apiTokenFlow.asStateFlow()

    fun getServerUrl(): String {
        return prefs.getString(KEY_SERVER_URL, DEFAULT_SERVER_URL) ?: DEFAULT_SERVER_URL
    }

    fun setServerUrl(url: String) {
        val cleanUrl = url.trim().removeSuffix("/")
        prefs.edit().putString(KEY_SERVER_URL, cleanUrl).apply()
        _serverUrlFlow.value = cleanUrl
    }

    fun getUserEmail(): String {
        return prefs.getString(KEY_USER_EMAIL, "") ?: ""
    }

    fun setUserEmail(email: String) {
        prefs.edit().putString(KEY_USER_EMAIL, email.trim()).apply()
    }

    fun getApiToken(): String {
        return prefs.getString(KEY_API_TOKEN, "") ?: ""
    }

    fun setApiToken(token: String) {
        val cleanToken = token.trim()
        prefs.edit().putString(KEY_API_TOKEN, cleanToken).apply()
        _apiTokenFlow.value = cleanToken
    }

    /**
     * Guarda el device_id de una solicitud de pairing activa. Si la app se
     * cierra mientras Pancho confirma, al volver a abrir puede seguir polleando.
     */
    fun getPairingDeviceId(): String? {
        return prefs.getString(KEY_PAIRING_DEVICE_ID, null)
    }

    fun setPairingDeviceId(deviceId: String?) {
        if (deviceId.isNullOrBlank()) {
            prefs.edit().remove(KEY_PAIRING_DEVICE_ID).apply()
        } else {
            prefs.edit().putString(KEY_PAIRING_DEVICE_ID, deviceId).apply()
        }
    }

    fun isConfigured(): Boolean {
        return getApiToken().isNotBlank() && getServerUrl().isNotBlank()
    }

    fun clear() {
        prefs.edit().clear().apply()
        _serverUrlFlow.value = DEFAULT_SERVER_URL
        _apiTokenFlow.value = ""
    }

    companion object {
        const val DEFAULT_SERVER_URL = "https://os.franciscoabad.com"
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_API_TOKEN = "api_token"
        private const val KEY_USER_EMAIL = "user_email"
        private const val KEY_PAIRING_DEVICE_ID = "pairing_device_id"

        @Volatile
        private var INSTANCE: OsPreferences? = null

        fun getInstance(context: Context): OsPreferences {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: OsPreferences(context.applicationContext).also { INSTANCE = it }
            }
        }
    }
}
