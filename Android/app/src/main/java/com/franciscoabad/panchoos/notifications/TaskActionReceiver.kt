package com.franciscoabad.panchoos.notifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.widget.Toast
import androidx.core.app.NotificationManagerCompat
import com.franciscoabad.panchoos.data.PanchoRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class TaskActionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == NotificationHelper.ACTION_COMPLETE_TASK) {
            val taskId = intent.getStringExtra(NotificationHelper.EXTRA_TASK_ID) ?: return
            val notificationId = intent.getIntExtra("notification_id", -1)

            val pendingResult = goAsync()

            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val repo = PanchoRepository.getInstance(context.applicationContext)
                    val result = repo.toggleTaskById(taskId, completed = true)
                    withContext(Dispatchers.Main) {
                        if (result.isSuccess) {
                            if (notificationId != -1) {
                                NotificationManagerCompat.from(context).cancel(notificationId)
                            }
                            Toast.makeText(context, "Tarea completada en Pancho OS ✓", Toast.LENGTH_SHORT).show()
                        } else {
                            Toast.makeText(context, "Error al completar tarea", Toast.LENGTH_SHORT).show()
                        }
                    }
                } catch (_: Exception) {
                    withContext(Dispatchers.Main) {
                        Toast.makeText(context, "Error de conexión", Toast.LENGTH_SHORT).show()
                    }
                } finally {
                    pendingResult.finish()
                }
            }
        }
    }
}
