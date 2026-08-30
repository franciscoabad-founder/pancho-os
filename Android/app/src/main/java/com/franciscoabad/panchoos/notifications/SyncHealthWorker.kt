package com.franciscoabad.panchoos.notifications

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.franciscoabad.panchoos.data.PanchoRepository
import com.franciscoabad.panchoos.data.health.HealthConnectSync
import com.franciscoabad.panchoos.data.model.OsResult

/**
 * Refleja el snapshot diario de Health Connect en Pancho OS.
 * Si el usuario aún no concedió Health Connect o no configuró el OS, no falla
 * la cola de notificaciones: la siguiente ejecución volverá a intentarlo.
 */
class SyncHealthWorker(appContext: Context, workerParams: WorkerParameters) : CoroutineWorker(appContext, workerParams) {
    override suspend fun doWork(): Result {
        val repository = PanchoRepository.getInstance(applicationContext)
        if (!repository.isConfigured()) return Result.success()
        val health = HealthConnectSync(applicationContext)
        return try {
            if (!health.isAvailable() || !health.hasPermissions() || !health.hasBackgroundPermission()) return Result.success()
            val snapshot = health.readToday()
            if (!snapshot.hasMetrics()) return Result.success()
            when (repository.syncBiometrics(health.payload(snapshot))) {
                is OsResult.Success -> Result.success()
                is OsResult.Failure -> Result.retry()
            }
        } catch (_: SecurityException) {
            Result.success()
        } catch (_: Exception) {
            Result.retry()
        }
    }
}
