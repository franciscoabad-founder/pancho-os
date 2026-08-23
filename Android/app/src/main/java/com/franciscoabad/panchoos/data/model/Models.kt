package com.franciscoabad.panchoos.data.model

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

/**
 * Representación de errores tipados de Pancho OS.
 * Sigue el mismo principio de hermes.rs y flow.rs: nunca panic/crash,
 * siempre un error estructurado y accionable para la UI.
 */
sealed interface OsError {
    data class NoInternet(val message: String = "No se pudo conectar con el servidor. Revisa tu conexión de red.") : OsError
    data class Timeout(val message: String = "El servidor tardó demasiado en responder. La operación puede seguir ejecutándose.") : OsError
    data class Unauthorized(val message: String = "Token de API no válido o expirado. Revisa tu configuración.") : OsError
    data class Server(val code: Int, val message: String) : OsError
    data class InvalidResponse(val message: String) : OsError
    data class Unknown(val message: String) : OsError

    fun userMessage(): String = when (this) {
        is NoInternet -> message
        is Timeout -> "Tiempo de espera agotado. $message"
        is Unauthorized -> "Acceso no autorizado (401). Verifica tu token en Ajustes."
        is Server -> when (code) {
            404 -> "Recurso no encontrado (404)."
            500 -> "Error interno en Pancho OS (500)."
            502, 503 -> "Pancho OS no está disponible temporalmente ($code)."
            else -> "Error del servidor ($code): $message"
        }
        is InvalidResponse -> "Respuesta inesperada del servidor: $message"
        is Unknown -> "Ocurrió un error inesperado: $message"
    }
}

/**
 * Envoltorio de resultado tipado Result<T, OsError>
 */
sealed interface OsResult<out T> {
    data class Success<out T>(val data: T) : OsResult<T>
    data class Failure(val error: OsError) : OsResult<Nothing>

    val isSuccess: Boolean get() = this is Success
    val isFailure: Boolean get() = this is Failure

    fun getOrNull(): T? = when (this) {
        is Success -> data
        is Failure -> null
    }
}

inline fun <T, R> OsResult<T>.map(transform: (T) -> R): OsResult<R> = when (this) {
    is OsResult.Success -> OsResult.Success(transform(data))
    is OsResult.Failure -> this
}

inline fun <T> OsResult<T>.onSuccess(action: (T) -> Unit): OsResult<T> {
    if (this is OsResult.Success) action(data)
    return this
}

inline fun <T> OsResult<T>.onFailure(action: (OsError) -> Unit): OsResult<T> {
    if (this is OsResult.Failure) action(error)
    return this
}

/**
 * Modelos MCP (Model Context Protocol JSON-RPC 2.0)
 */
@Serializable
data class McpRpcRequest(
    val jsonrpc: String = "2.0",
    val id: Long = 1,
    val method: String,
    val params: JsonObject? = null
)

@Serializable
data class McpRpcResponse(
    val jsonrpc: String = "2.0",
    val id: Long? = null,
    val result: JsonElement? = null,
    val error: McpRpcError? = null
)

@Serializable
data class McpRpcError(
    val code: Int,
    val message: String
)

/**
 * Modelo de Tarea de Pancho OS
 */
@Serializable
data class OsTask(
    val id: String,
    val titulo: String,
    val estado: String = "pendiente", // "pendiente", "en_progreso", "hecho"
    val prioridad: String = "medium", // "low", "medium", "high", "critical"
    val deadline: String? = null,
    val urgente: Boolean? = null,
    val created_at: String? = null
) {
    val isCompleted: Boolean get() = estado == "hecho" || estado == "completada"

    val displayPriority: String get() = when (prioridad.lowercase()) {
        "critical", "critica" -> "Crítica"
        "high", "alta" -> "Alta"
        "medium", "media" -> "Media"
        "low", "baja" -> "Baja"
        else -> prioridad
    }
}

/**
 * Modelo de Captura para la Bandeja / Inbox de Pancho OS
 */
@Serializable
data class OsInboxItem(
    val id: String? = null,
    val titulo: String,
    val url: String? = null,
    val descripcion: String? = null,
    val categoria: String? = null
)

/**
 * Respuesta de POST /api/os-auth/pair/start
 */
@Serializable
data class PairingStartResponse(
    val device_id: String,
    val code: String,
    val expires_at: String
)

/**
 * Respuesta de GET /api/os-auth/pair/status
 */
@Serializable
data class PairingStatusResponse(
    val status: String, // "pending" | "confirmed"
    val token: String? = null,
    val label: String? = null,
    val kind: String? = null
)
