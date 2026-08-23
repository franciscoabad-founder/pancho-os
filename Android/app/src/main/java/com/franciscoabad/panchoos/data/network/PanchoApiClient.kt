package com.franciscoabad.panchoos.data.network

import com.franciscoabad.panchoos.data.model.McpRpcError
import com.franciscoabad.panchoos.data.model.McpRpcRequest
import com.franciscoabad.panchoos.data.model.McpRpcResponse
import com.franciscoabad.panchoos.data.model.OsError
import com.franciscoabad.panchoos.data.model.OsInboxItem
import com.franciscoabad.panchoos.data.model.OsResult
import com.franciscoabad.panchoos.data.model.OsTask
import com.franciscoabad.panchoos.data.model.PairingStartResponse
import com.franciscoabad.panchoos.data.model.PairingStatusResponse
import com.franciscoabad.panchoos.data.model.map
import com.franciscoabad.panchoos.data.storage.OsPreferences
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.util.concurrent.TimeUnit

class PanchoApiClient(private val preferences: OsPreferences) {

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        encodeDefaults = true
    }

    private val okHttpClient = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    /**
     * Valida la conectividad y las credenciales contra Pancho OS
     */
    suspend fun ping(): OsResult<String> = withContext(Dispatchers.IO) {
        val baseUrl = preferences.getServerUrl()
        val token = preferences.getApiToken()

        if (baseUrl.isBlank()) {
            return@withContext OsResult.Failure(OsError.InvalidResponse("URL del servidor no configurada."))
        }
        if (token.isBlank()) {
            return@withContext OsResult.Failure(OsError.Unauthorized("Token de API no configurado."))
        }

        // Llamamos al handshake inicial de MCP
        val initPayload = buildJsonObject {
            put("jsonrpc", "2.0")
            put("id", 1)
            put("method", "initialize")
            put("params", buildJsonObject {
                put("protocolVersion", "2026-07-28")
                put("clientInfo", buildJsonObject {
                    put("name", "Pancho-OS-Android")
                    put("version", "1.0.0")
                })
            })
        }

        val request = Request.Builder()
            .url("$baseUrl/api/mcp")
            .header("X-OS-Token", token)
            .header("Authorization", "Bearer $token")
            .header("Mcp-Method", "initialize")
            .post(initPayload.toString().toRequestBody(jsonMediaType))
            .build()

        executeHttpRequest(request) { response ->
            val version = response.header("Mcp-Version") ?: "2026-07-28"
            "Conectado a Pancho OS (MCP v$version)"
        }
    }

    /**
     * Ejecuta una herramienta del catálogo MCP de Pancho OS (engine.ts)
     */
    suspend fun callMcpTool(name: String, args: JsonObject = JsonObject(emptyMap())): OsResult<JsonElement> = withContext(Dispatchers.IO) {
        val baseUrl = preferences.getServerUrl()
        val token = preferences.getApiToken()

        val rpcPayload = buildJsonObject {
            put("jsonrpc", "2.0")
            put("id", System.currentTimeMillis())
            put("method", "tools/call")
            put("params", buildJsonObject {
                put("name", name)
                put("arguments", args)
            })
        }

        val request = Request.Builder()
            .url("$baseUrl/api/mcp")
            .header("X-OS-Token", token)
            .header("Authorization", "Bearer $token")
            .header("Mcp-Method", "tools/call")
            .post(rpcPayload.toString().toRequestBody(jsonMediaType))
            .build()

        executeHttpRequest(request) { response ->
            val bodyString = response.body?.string() ?: ""
            val rpcResponse = json.decodeFromString<McpRpcResponse>(bodyString)
            if (rpcResponse.error != null) {
                throw McpExecutionException(rpcResponse.error.code, rpcResponse.error.message)
            }
            rpcResponse.result ?: JsonObject(emptyMap())
        }
    }

    /**
     * Obtiene el listado de tareas consumiendo el MCP (tareas_list) o fallback REST
     */
    suspend fun getTasks(estado: String = "pendientes"): OsResult<List<OsTask>> = withContext(Dispatchers.IO) {
        val baseUrl = preferences.getServerUrl()
        val token = preferences.getApiToken()

        val request = Request.Builder()
            .url("$baseUrl/api/tareas")
            .header("X-OS-Token", token)
            .header("Authorization", "Bearer $token")
            .get()
            .build()

        executeHttpRequest(request) { response ->
            val bodyString = response.body?.string() ?: "{}"
            val root = json.parseToJsonElement(bodyString).jsonObject
            val tareasJsonArray = root["tareas"]?.jsonArray ?: JsonArray(emptyList())
            json.decodeFromJsonElement<List<OsTask>>(tareasJsonArray)
        }
    }

    /**
     * Crea una nueva tarea en Pancho OS
     */
    suspend fun createTask(titulo: String, prioridad: String = "medium", deadline: String? = null): OsResult<OsTask> = withContext(Dispatchers.IO) {
        val baseUrl = preferences.getServerUrl()
        val token = preferences.getApiToken()

        val bodyJson = buildJsonObject {
            put("titulo", titulo)
            put("prioridad", prioridad)
            if (deadline != null && deadline.isNotBlank()) {
                put("deadline", deadline)
            }
        }

        val request = Request.Builder()
            .url("$baseUrl/api/tareas")
            .header("X-OS-Token", token)
            .header("Authorization", "Bearer $token")
            .post(bodyJson.toString().toRequestBody(jsonMediaType))
            .build()

        executeHttpRequest(request) { response ->
            val bodyString = response.body?.string() ?: "{}"
            val root = json.parseToJsonElement(bodyString).jsonObject
            val tareaObj = root["tarea"]?.jsonObject ?: root
            json.decodeFromJsonElement<OsTask>(tareaObj)
        }
    }

    /**
     * Actualiza el estado o propiedades de una tarea existente
     */
    suspend fun updateTask(
        id: String,
        estado: String? = null,
        prioridad: String? = null,
        deadline: String? = null,
        titulo: String? = null
    ): OsResult<Boolean> = withContext(Dispatchers.IO) {
        val baseUrl = preferences.getServerUrl()
        val token = preferences.getApiToken()

        val bodyJson = buildJsonObject {
            put("id", id)
            if (estado != null) put("estado", estado)
            if (prioridad != null) put("prioridad", prioridad)
            if (deadline != null) put("deadline", deadline)
            if (titulo != null) put("titulo", titulo)
        }

        val request = Request.Builder()
            .url("$baseUrl/api/tareas?id=$id")
            .header("X-OS-Token", token)
            .header("Authorization", "Bearer $token")
            .patch(bodyJson.toString().toRequestBody(jsonMediaType))
            .build()

        executeHttpRequest(request) { true }
    }

    /**
     * Captura una nota, link o elemento rápido en la bandeja canónica del OS (inbox_capturar)
     */
    suspend fun captureInbox(
        titulo: String,
        url: String? = null,
        descripcion: String? = null,
        categoria: String? = "general"
    ): OsResult<Boolean> = withContext(Dispatchers.IO) {
        val args = buildJsonObject {
            put("titulo", titulo)
            if (!url.isNullOrBlank()) put("url", url)
            if (!descripcion.isNullOrBlank()) put("descripcion", descripcion)
            if (!categoria.isNullOrBlank()) put("categoria", categoria)
        }

        callMcpTool("inbox_capturar", args).map { true }
    }

    /**
     * Inicia un emparejamiento por dispositivo (os_devices).
     * No requiere autenticacion: el dispositivo todavia no tiene credencial.
     */
    suspend fun startPairing(
        kind: String = "android",
        label: String? = null
    ): OsResult<PairingStartResponse> = withContext(Dispatchers.IO) {
        val baseUrl = preferences.getServerUrl()
        val bodyJson = buildJsonObject {
            put("kind", kind)
            if (!label.isNullOrBlank()) put("label", label)
        }

        val request = Request.Builder()
            .url("$baseUrl/api/os-auth/pair/start")
            .header("Content-Type", "application/json")
            .post(bodyJson.toString().toRequestBody(jsonMediaType))
            .build()

        executeHttpRequest(request) { response ->
            val bodyString = response.body?.string() ?: "{}"
            json.decodeFromString<PairingStartResponse>(bodyString)
        }
    }

    /**
     * Pollea el estado de un emparejamiento. Devuelve el token UNA sola vez
     * cuando Pancho confirma el codigo en /sistema.
     */
    suspend fun pollPairingStatus(deviceId: String): OsResult<PairingStatusResponse> = withContext(Dispatchers.IO) {
        val baseUrl = preferences.getServerUrl()

        val request = Request.Builder()
            .url("$baseUrl/api/os-auth/pair/status?device_id=$deviceId")
            .header("Accept", "application/json")
            .header("Cache-Control", "no-store")
            .get()
            .build()

        executeHttpRequest(request) { response ->
            val bodyString = response.body?.string() ?: "{}"
            json.decodeFromString<PairingStatusResponse>(bodyString)
        }
    }

    /**
     * Envoltorio seguro de ejecución HTTP que traduce todas las excepciones a OsError
     */
    private inline fun <T> executeHttpRequest(request: Request, parser: (Response) -> T): OsResult<T> {
        return try {
            val response = okHttpClient.newCall(request).execute()
            when (response.code) {
                200, 201 -> {
                    val parsed = parser(response)
                    OsResult.Success(parsed)
                }
                401, 403 -> {
                    OsResult.Failure(OsError.Unauthorized("Token inválido o credenciales insuficientes."))
                }
                in 400..499 -> {
                    val errorMsg = response.body?.string()?.take(300) ?: "Error del cliente (${response.code})"
                    OsResult.Failure(OsError.Server(response.code, errorMsg))
                }
                in 500..599 -> {
                    val errorMsg = response.body?.string()?.take(300) ?: "Error interno del servidor (${response.code})"
                    OsResult.Failure(OsError.Server(response.code, errorMsg))
                }
                else -> {
                    OsResult.Failure(OsError.Server(response.code, "Código HTTP inesperado: ${response.code}"))
                }
            }
        } catch (e: UnknownHostException) {
            OsResult.Failure(OsError.NoInternet("No se pudo resolver el host. Revisa la URL y tu conexión."))
        } catch (e: ConnectException) {
            OsResult.Failure(OsError.NoInternet("No se pudo conectar con el servidor en ${request.url.host}."))
        } catch (e: SocketTimeoutException) {
            OsResult.Failure(OsError.Timeout("La llamada a ${request.url.encodedPath} superó el límite de tiempo."))
        } catch (e: McpExecutionException) {
            OsResult.Failure(OsError.Server(e.code, "Fallo en herramienta MCP: ${e.message}"))
        } catch (e: IOException) {
            OsResult.Failure(OsError.NoInternet(e.message ?: "Error de E/S de red."))
        } catch (e: Exception) {
            OsResult.Failure(OsError.InvalidResponse(e.message ?: "Error procesando la respuesta."))
        }
    }

    private class McpExecutionException(val code: Int, override val message: String) : Exception(message)
}
