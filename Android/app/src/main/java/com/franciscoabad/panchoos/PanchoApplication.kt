package com.franciscoabad.panchoos

import android.app.Application
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.franciscoabad.panchoos.notifications.NotificationHelper
import com.franciscoabad.panchoos.notifications.SyncTasksWorker
import com.franciscoabad.panchoos.notifications.SyncHealthWorker
import java.util.concurrent.TimeUnit

class PanchoApplication : Application() {

    override fun onCreate() {
        super.onCreate()

        // 1. Configurar canales de notificaciones de Pancho OS
        NotificationHelper.createChannels(this)

        // 2. Programar sincronización periódica en segundo plano
        setupBackgroundSync()
    }

    private fun setupBackgroundSync() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val syncRequest = PeriodicWorkRequestBuilder<SyncTasksWorker>(1, TimeUnit.HOURS)
            .setConstraints(constraints)
            .build()

        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "pancho_os_sync",
            ExistingPeriodicWorkPolicy.KEEP,
            syncRequest
        )

        val healthRequest = PeriodicWorkRequestBuilder<SyncHealthWorker>(6, TimeUnit.HOURS)
            .setConstraints(constraints)
            .build()
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "pancho_os_health_sync",
            ExistingPeriodicWorkPolicy.KEEP,
            healthRequest
        )
    }
}
