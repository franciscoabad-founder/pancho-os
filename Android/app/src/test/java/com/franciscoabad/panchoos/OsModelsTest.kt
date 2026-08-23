package com.franciscoabad.panchoos

import com.franciscoabad.panchoos.data.model.McpRpcError
import com.franciscoabad.panchoos.data.model.McpRpcRequest
import com.franciscoabad.panchoos.data.model.McpRpcResponse
import com.franciscoabad.panchoos.data.model.OsError
import com.franciscoabad.panchoos.data.model.OsInboxItem
import com.franciscoabad.panchoos.data.model.OsResult
import com.franciscoabad.panchoos.data.model.OsTask
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OsModelsTest {

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        encodeDefaults = true
    }

    @Test
    fun testOsResultSuccessAndFailure() {
        val success: OsResult<String> = OsResult.Success("OK")
        assertTrue(success.isSuccess)
        assertFalse(success.isFailure)
        assertEquals("OK", success.getOrNull())

        val failure: OsResult<String> = OsResult.Failure(OsError.Unauthorized())
        assertFalse(failure.isSuccess)
        assertTrue(failure.isFailure)
        assertNull(failure.getOrNull())
    }

    @Test
    fun testOsErrorUserMessages() {
        val noNet = OsError.NoInternet()
        assertTrue(noNet.userMessage().contains("conexión"))

        val timeout = OsError.Timeout("Límite de 15s")
        assertTrue(timeout.userMessage().contains("Tiempo de espera agotado"))

        val unauth = OsError.Unauthorized()
        assertTrue(unauth.userMessage().contains("401"))

        val server500 = OsError.Server(500, "Crash en backend")
        assertTrue(server500.userMessage().contains("500"))
    }

    @Test
    fun testMcpRpcSerialization() {
        val req = McpRpcRequest(
            id = 42,
            method = "tools/call",
            params = buildJsonObject {
                put("name", "tareas_list")
            }
        )
        val encoded = json.encodeToString(req)
        assertTrue(encoded.contains("\"jsonrpc\":\"2.0\""))
        assertTrue(encoded.contains("\"method\":\"tools/call\""))
        assertTrue(encoded.contains("\"id\":42"))

        val responseStr = """{"jsonrpc":"2.0","id":42,"result":{"tareas":[]}}"""
        val decoded = json.decodeFromString<McpRpcResponse>(responseStr)
        assertEquals(42L, decoded.id)
        assertNotNull(decoded.result)
        assertNull(decoded.error)
    }

    @Test
    fun testMcpRpcErrorDecoding() {
        val errorStr = """{"jsonrpc":"2.0","id":1,"error":{"code":-32001,"message":"Unauthorized"}}"""
        val decoded = json.decodeFromString<McpRpcResponse>(errorStr)
        assertNotNull(decoded.error)
        assertEquals(-32001, decoded.error?.code)
        assertEquals("Unauthorized", decoded.error?.message)
    }

    @Test
    fun testOsTaskProperties() {
        val taskPending = OsTask(
            id = "t1",
            titulo = "Comprar insumos",
            estado = "pendiente",
            prioridad = "high",
            deadline = "2026-08-25"
        )
        assertFalse(taskPending.isCompleted)
        assertEquals("Alta", taskPending.displayPriority)

        val taskDone = OsTask(
            id = "t2",
            titulo = "Deploy a Hetzner",
            estado = "hecho",
            prioridad = "critical"
        )
        assertTrue(taskDone.isCompleted)
        assertEquals("Crítica", taskDone.displayPriority)
    }

    @Test
    fun testOsInboxItemSerialization() {
        val inboxItem = OsInboxItem(
            titulo = "Nueva idea de contenido",
            url = "https://pancho.dev",
            descripcion = "Nota rápida",
            categoria = "idea"
        )
        val encoded = json.encodeToString(inboxItem)
        val decoded = json.decodeFromString<OsInboxItem>(encoded)
        assertEquals(inboxItem.titulo, decoded.titulo)
        assertEquals(inboxItem.url, decoded.url)
        assertEquals(inboxItem.categoria, decoded.categoria)
    }

    @Test
    fun testShareSheetUrlExtraction() {
        val sharedText = "Revisar este repo https://github.com/franciscoabad/pancho-os para la arquitectura"
        val urlRegex = "(https?://[\\w\\d:#@%/;$()~_?\\+-=\\\\\\.&]+)".toRegex()
        val match = urlRegex.find(sharedText)
        assertNotNull(match)
        assertEquals("https://github.com/franciscoabad/pancho-os", match?.value)

        val cleanText = sharedText.replace(match!!.value, "").trim()
        assertEquals("Revisar este repo  para la arquitectura", cleanText)
    }

    @Test
    fun testPhotoAttachmentDescriptionFormatting() {
        val originalDesc = "Comida del mediodía: ensalada y pollo"
        val fileName = "foto_comida_2026.jpg"
        val finalDesc = buildString {
            append(originalDesc)
            append("\n\n")
            append("📷 [Foto adjunta desde Android: $fileName]")
        }

        assertTrue(finalDesc.contains("📷 [Foto adjunta desde Android: foto_comida_2026.jpg]"))
        assertTrue(finalDesc.startsWith("Comida del mediodía"))
    }
}
