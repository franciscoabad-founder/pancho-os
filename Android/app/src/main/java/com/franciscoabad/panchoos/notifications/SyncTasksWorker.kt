package com.franciscoabad.panchoos.notifications

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.franciscoabad.panchoos.data.PanchoRepository
import com.franciscoabad.panchoos.data.model.onSuccess

class SyncTasksWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        val repo = PanchoRepository.getInstance(applicationContext)
        if (!repo.isConfigured()) {
            return Result.success()
        }

        val result = repo.fetchTasks("pendientes")
        result.onSuccess { tasks ->
            val pendingTasks = tasks.filter { !it.isCompleted }
            val urgentTasks = pendingTasks.filter { task ->
                val p = task.prioridad.lowercase()
                p == "critical" || p == "critica" || p == "high" || p == "alta"
            }

            // Show reminder for the most urgent task
            urgentTasks.firstOrNull()?.let { topUrgent ->
                NotificationHelper.showTaskReminder(
                    context = applicationContext,
                    notificationId = 100,
                    taskId = topUrgent.id,
                    taskTitle = topUrgent.titulo,
                    priority = topUrgent.prioridad,
                    deadline = topUrgent.deadline
                )
            }
        }

        return Result.success()
    }
}
