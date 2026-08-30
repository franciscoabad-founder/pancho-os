package com.franciscoabad.panchoos.data.health

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectClient.Companion.SDK_AVAILABLE
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.time.TimeRangeFilter
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset

data class HealthSnapshot(val fecha: String, val pasos: Long?, val suenoMin: Long?, val pesoKg: Double?) {
    fun hasMetrics() = pasos != null || suenoMin != null || pesoKg != null
}

/** Lectura de Health Connect y snapshot diario para el OS. */
class HealthConnectSync(private val context: Context) {
    val permissions = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(WeightRecord::class),
    )

    /** Permisos que el selector de Health Connect debe mostrar al usuario. */
    val permissionsForGrant = permissions + HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND

    fun isAvailable(): Boolean = HealthConnectClient.getSdkStatus(context) == SDK_AVAILABLE

    suspend fun hasPermissions(): Boolean = isAvailable() && HealthConnectClient.getOrCreate(context)
        .permissionController.getGrantedPermissions().containsAll(permissions)

    suspend fun hasBackgroundPermission(): Boolean = isAvailable() && HealthConnectClient.getOrCreate(context)
        .permissionController.getGrantedPermissions().contains(HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND)

    suspend fun readToday(): HealthSnapshot {
        val zone = ZoneId.systemDefault()
        val today = LocalDate.now(zone)
        val filter = TimeRangeFilter.between(today.atStartOfDay(zone).toInstant(), Instant.now())
        val client = HealthConnectClient.getOrCreate(context)
        val totals = client.aggregate(AggregateRequest(setOf(StepsRecord.COUNT_TOTAL, SleepSessionRecord.SLEEP_DURATION_TOTAL), filter))
        val latestWeight = client.readRecords(ReadRecordsRequest(WeightRecord::class, filter)).records
            .maxByOrNull { it.time }?.weight?.inKilograms
        return HealthSnapshot(today.toString(), totals[StepsRecord.COUNT_TOTAL], totals[SleepSessionRecord.SLEEP_DURATION_TOTAL]?.toMinutes(), latestWeight)
    }

    fun payload(snapshot: HealthSnapshot) = buildJsonObject {
        put("fecha", snapshot.fecha)
        snapshot.pasos?.let { put("pasos", it) }
        snapshot.suenoMin?.let { put("sueno_min", it) }
        snapshot.pesoKg?.let { put("peso_kg", it) }
        put("fuente", "health_connect_android")
        put("raw", buildJsonObject { put("zona_horaria", ZoneOffset.systemDefault().id) })
    }
}
