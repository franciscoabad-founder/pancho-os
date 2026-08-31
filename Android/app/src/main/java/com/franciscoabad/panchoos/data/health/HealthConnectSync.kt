package com.franciscoabad.panchoos.data.health

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectClient.Companion.SDK_AVAILABLE
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.BasalBodyTemperatureRecord
import androidx.health.connect.client.records.BasalMetabolicRateRecord
import androidx.health.connect.client.records.BloodGlucoseRecord
import androidx.health.connect.client.records.BloodPressureRecord
import androidx.health.connect.client.records.BodyFatRecord
import androidx.health.connect.client.records.BodyTemperatureRecord
import androidx.health.connect.client.records.BoneMassRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ElevationGainedRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.FloorsClimbedRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.HeightRecord
import androidx.health.connect.client.records.HydrationRecord
import androidx.health.connect.client.records.LeanBodyMassRecord
import androidx.health.connect.client.records.NutritionRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.PowerRecord
import androidx.health.connect.client.records.RespiratoryRateRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.SpeedRecord
import androidx.health.connect.client.records.StepsCadenceRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.records.Vo2MaxRecord
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

/**
 * Snapshot diario de Health Connect. Los totales del dia (pasos, sueno, calorias,
 * distancia, ejercicio, pisos, elevacion, hidratacion, nutricion, cadencia,
 * velocidad y potencia promedio) se agregan entre medianoche y ahora. Las
 * metricas puntuales (peso, composicion corporal, signos vitales, VO2 max) se
 * toman del ultimo registro disponible en ese mismo rango, porque no siempre se
 * miden todos los dias.
 */
data class HealthSnapshot(
    val fecha: String,
    val pasos: Long?,
    val suenoMin: Long?,
    val pesoKg: Double?,
    val fcPromedio: Long?,
    val fcReposo: Long?,
    val vfcMs: Double?,
    val caloriasActivasKcal: Double?,
    val caloriasTotalesKcal: Double?,
    val distanciaM: Double?,
    val ejercicioMin: Long?,
    val cadenciaPasosPromedio: Double?,
    val velocidadPromedioMs: Double?,
    val potenciaPromedioW: Double?,
    val pisosSubidos: Double?,
    val elevacionGanadaM: Double?,
    val saturacionO2Pct: Double?,
    val frecuenciaRespiratoria: Double?,
    val presionSistolicaMmHg: Double?,
    val presionDiastolicaMmHg: Double?,
    val glucosaMgDl: Double?,
    val temperaturaC: Double?,
    val temperaturaBasalC: Double?,
    val grasaCorporalPct: Double?,
    val masaOseaKg: Double?,
    val masaMagraKg: Double?,
    val alturaCm: Double?,
    val tmbKcalDia: Double?,
    val vo2Max: Double?,
    val hidratacionMl: Double?,
    val energiaConsumidaKcal: Double?,
) {
    fun hasMetrics() = pasos != null || suenoMin != null || pesoKg != null || fcPromedio != null ||
        fcReposo != null || vfcMs != null || caloriasActivasKcal != null || caloriasTotalesKcal != null ||
        distanciaM != null || ejercicioMin != null || cadenciaPasosPromedio != null || velocidadPromedioMs != null ||
        potenciaPromedioW != null || pisosSubidos != null || elevacionGanadaM != null || saturacionO2Pct != null ||
        frecuenciaRespiratoria != null || presionSistolicaMmHg != null || presionDiastolicaMmHg != null ||
        glucosaMgDl != null || temperaturaC != null || temperaturaBasalC != null || grasaCorporalPct != null ||
        masaOseaKg != null || masaMagraKg != null || alturaCm != null || tmbKcalDia != null || vo2Max != null ||
        hidratacionMl != null || energiaConsumidaKcal != null
}

/** Lectura de Health Connect y snapshot diario para el OS. */
class HealthConnectSync(private val context: Context) {
    val permissions = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(WeightRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(RestingHeartRateRecord::class),
        HealthPermission.getReadPermission(HeartRateVariabilityRmssdRecord::class),
        HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
        HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),
        HealthPermission.getReadPermission(DistanceRecord::class),
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
        HealthPermission.getReadPermission(StepsCadenceRecord::class),
        HealthPermission.getReadPermission(SpeedRecord::class),
        HealthPermission.getReadPermission(PowerRecord::class),
        HealthPermission.getReadPermission(FloorsClimbedRecord::class),
        HealthPermission.getReadPermission(ElevationGainedRecord::class),
        HealthPermission.getReadPermission(OxygenSaturationRecord::class),
        HealthPermission.getReadPermission(RespiratoryRateRecord::class),
        HealthPermission.getReadPermission(BloodPressureRecord::class),
        HealthPermission.getReadPermission(BloodGlucoseRecord::class),
        HealthPermission.getReadPermission(BodyTemperatureRecord::class),
        HealthPermission.getReadPermission(BasalBodyTemperatureRecord::class),
        HealthPermission.getReadPermission(BodyFatRecord::class),
        HealthPermission.getReadPermission(BoneMassRecord::class),
        HealthPermission.getReadPermission(LeanBodyMassRecord::class),
        HealthPermission.getReadPermission(HeightRecord::class),
        HealthPermission.getReadPermission(BasalMetabolicRateRecord::class),
        HealthPermission.getReadPermission(Vo2MaxRecord::class),
        HealthPermission.getReadPermission(HydrationRecord::class),
        HealthPermission.getReadPermission(NutritionRecord::class),
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

        val totals = client.aggregate(
            AggregateRequest(
                setOf(
                    StepsRecord.COUNT_TOTAL,
                    SleepSessionRecord.SLEEP_DURATION_TOTAL,
                    HeartRateRecord.BPM_AVG,
                    RestingHeartRateRecord.BPM_AVG,
                    ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL,
                    TotalCaloriesBurnedRecord.ENERGY_TOTAL,
                    DistanceRecord.DISTANCE_TOTAL,
                    ExerciseSessionRecord.EXERCISE_DURATION_TOTAL,
                    StepsCadenceRecord.RATE_AVG,
                    SpeedRecord.SPEED_AVG,
                    PowerRecord.POWER_AVG,
                    FloorsClimbedRecord.FLOORS_CLIMBED_TOTAL,
                    ElevationGainedRecord.ELEVATION_GAINED_TOTAL,
                    HydrationRecord.VOLUME_TOTAL,
                    NutritionRecord.ENERGY_TOTAL,
                ),
                filter,
            ),
        )

        val latestWeight = ultimoRegistro(client, WeightRecord::class, filter) { it.time }?.weight?.inKilograms
        val latestVfc = ultimoRegistro(client, HeartRateVariabilityRmssdRecord::class, filter) { it.time }?.heartRateVariabilityMillis
        val latestOxigeno = ultimoRegistro(client, OxygenSaturationRecord::class, filter) { it.time }?.percentage?.value
        val latestRespiracion = ultimoRegistro(client, RespiratoryRateRecord::class, filter) { it.time }?.rate
        val latestPresion = ultimoRegistro(client, BloodPressureRecord::class, filter) { it.time }
        val latestGlucosa = ultimoRegistro(client, BloodGlucoseRecord::class, filter) { it.time }?.level?.inMilligramsPerDeciliter
        val latestTemperatura = ultimoRegistro(client, BodyTemperatureRecord::class, filter) { it.time }?.temperature?.inCelsius
        val latestTemperaturaBasal = ultimoRegistro(client, BasalBodyTemperatureRecord::class, filter) { it.time }?.temperature?.inCelsius
        val latestGrasa = ultimoRegistro(client, BodyFatRecord::class, filter) { it.time }?.percentage?.value
        val latestMasaOsea = ultimoRegistro(client, BoneMassRecord::class, filter) { it.time }?.mass?.inKilograms
        val latestMasaMagra = ultimoRegistro(client, LeanBodyMassRecord::class, filter) { it.time }?.mass?.inKilograms
        val latestAltura = ultimoRegistro(client, HeightRecord::class, filter) { it.time }?.height?.inMeters?.times(100)
        val latestTmb = ultimoRegistro(client, BasalMetabolicRateRecord::class, filter) { it.time }?.basalMetabolicRate?.inKilocaloriesPerDay
        val latestVo2Max = ultimoRegistro(client, Vo2MaxRecord::class, filter) { it.time }?.vo2MillilitersPerMinuteKilogram

        return HealthSnapshot(
            fecha = today.toString(),
            pasos = totals[StepsRecord.COUNT_TOTAL],
            suenoMin = totals[SleepSessionRecord.SLEEP_DURATION_TOTAL]?.toMinutes(),
            pesoKg = latestWeight,
            fcPromedio = totals[HeartRateRecord.BPM_AVG],
            fcReposo = totals[RestingHeartRateRecord.BPM_AVG],
            vfcMs = latestVfc,
            caloriasActivasKcal = totals[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.inKilocalories,
            caloriasTotalesKcal = totals[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.inKilocalories,
            distanciaM = totals[DistanceRecord.DISTANCE_TOTAL]?.inMeters,
            ejercicioMin = totals[ExerciseSessionRecord.EXERCISE_DURATION_TOTAL]?.toMinutes(),
            cadenciaPasosPromedio = totals[StepsCadenceRecord.RATE_AVG],
            velocidadPromedioMs = totals[SpeedRecord.SPEED_AVG]?.inMetersPerSecond,
            potenciaPromedioW = totals[PowerRecord.POWER_AVG]?.inWatts,
            pisosSubidos = totals[FloorsClimbedRecord.FLOORS_CLIMBED_TOTAL],
            elevacionGanadaM = totals[ElevationGainedRecord.ELEVATION_GAINED_TOTAL]?.inMeters,
            saturacionO2Pct = latestOxigeno,
            frecuenciaRespiratoria = latestRespiracion,
            presionSistolicaMmHg = latestPresion?.systolic?.inMillimetersOfMercury,
            presionDiastolicaMmHg = latestPresion?.diastolic?.inMillimetersOfMercury,
            glucosaMgDl = latestGlucosa,
            temperaturaC = latestTemperatura,
            temperaturaBasalC = latestTemperaturaBasal,
            grasaCorporalPct = latestGrasa,
            masaOseaKg = latestMasaOsea,
            masaMagraKg = latestMasaMagra,
            alturaCm = latestAltura,
            tmbKcalDia = latestTmb,
            vo2Max = latestVo2Max,
            hidratacionMl = totals[HydrationRecord.VOLUME_TOTAL]?.inMilliliters,
            energiaConsumidaKcal = totals[NutritionRecord.ENERGY_TOTAL]?.inKilocalories,
        )
    }

    private suspend fun <T : androidx.health.connect.client.records.Record> ultimoRegistro(
        client: HealthConnectClient,
        clase: kotlin.reflect.KClass<T>,
        filter: TimeRangeFilter,
        instante: (T) -> Instant,
    ): T? = client.readRecords(ReadRecordsRequest(clase, filter)).records.maxByOrNull { instante(it) }

    fun payload(snapshot: HealthSnapshot) = buildJsonObject {
        put("fecha", snapshot.fecha)
        snapshot.pasos?.let { put("pasos", it) }
        snapshot.suenoMin?.let { put("sueno_min", it) }
        snapshot.pesoKg?.let { put("peso_kg", it) }
        snapshot.fcPromedio?.let { put("fc_promedio", it) }
        snapshot.fcReposo?.let { put("fc_reposo", it) }
        snapshot.vfcMs?.let { put("vfc_ms", it) }
        snapshot.caloriasActivasKcal?.let { put("calorias_activas_kcal", it) }
        snapshot.caloriasTotalesKcal?.let { put("calorias_totales_kcal", it) }
        snapshot.distanciaM?.let { put("distancia_m", it) }
        snapshot.ejercicioMin?.let { put("ejercicio_min", it) }
        snapshot.cadenciaPasosPromedio?.let { put("cadencia_pasos_promedio", it) }
        snapshot.velocidadPromedioMs?.let { put("velocidad_promedio_ms", it) }
        snapshot.potenciaPromedioW?.let { put("potencia_promedio_w", it) }
        snapshot.pisosSubidos?.let { put("pisos_subidos", it) }
        snapshot.elevacionGanadaM?.let { put("elevacion_ganada_m", it) }
        snapshot.saturacionO2Pct?.let { put("saturacion_o2_pct", it) }
        snapshot.frecuenciaRespiratoria?.let { put("frecuencia_respiratoria", it) }
        snapshot.presionSistolicaMmHg?.let { put("presion_sistolica_mmhg", it) }
        snapshot.presionDiastolicaMmHg?.let { put("presion_diastolica_mmhg", it) }
        snapshot.glucosaMgDl?.let { put("glucosa_mg_dl", it) }
        snapshot.temperaturaC?.let { put("temperatura_c", it) }
        snapshot.temperaturaBasalC?.let { put("temperatura_basal_c", it) }
        snapshot.grasaCorporalPct?.let { put("grasa_corporal_pct", it) }
        snapshot.masaOseaKg?.let { put("masa_osea_kg", it) }
        snapshot.masaMagraKg?.let { put("masa_magra_kg", it) }
        snapshot.alturaCm?.let { put("altura_cm", it) }
        snapshot.tmbKcalDia?.let { put("tmb_kcal_dia", it) }
        snapshot.vo2Max?.let { put("vo2_max", it) }
        snapshot.hidratacionMl?.let { put("hidratacion_ml", it) }
        snapshot.energiaConsumidaKcal?.let { put("energia_consumida_kcal", it) }
        put("fuente", "health_connect_android")
        put("raw", buildJsonObject { put("zona_horaria", ZoneOffset.systemDefault().id) })
    }
}
