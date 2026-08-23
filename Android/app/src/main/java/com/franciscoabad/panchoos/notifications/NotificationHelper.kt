package com.franciscoabad.panchoos.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.franciscoabad.panchoos.MainActivity

object NotificationHelper {

    const val CHANNEL_TASKS = "pancho_tasks"
    const val CHANNEL_INBOX = "pancho_inbox"
    const val CHANNEL_SYNC = "pancho_sync"

    const val ACTION_COMPLETE_TASK = "com.franciscoabad.panchoos.ACTION_COMPLETE_TASK"
    const val EXTRA_TASK_ID = "extra_task_id"

    fun createChannels(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                ?: return

            val tasksChannel = NotificationChannel(
                CHANNEL_TASKS,
                "Tareas y Recordatorios",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notificaciones de tareas pendientes y alertas de Pancho OS"
                enableVibration(true)
            }

            val inboxChannel = NotificationChannel(
                CHANNEL_INBOX,
                "Capturas al Inbox",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Confirmaciones y procesamiento de notas capturadas"
            }

            val syncChannel = NotificationChannel(
                CHANNEL_SYNC,
                "Sincronización",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Estado de sincronización en segundo plano con Pancho OS"
            }

            manager.createNotificationChannel(tasksChannel)
            manager.createNotificationChannel(inboxChannel)
            manager.createNotificationChannel(syncChannel)
        }
    }

    fun showTaskReminder(
        context: Context,
        notificationId: Int,
        taskId: String,
        taskTitle: String,
        priority: String,
        deadline: String?
    ) {
        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(MainActivity.EXTRA_NAV_TAB, "tasks")
        }
        val openPendingIntent = PendingIntent.getActivity(
            context,
            notificationId * 10 + 1,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val completeIntent = Intent(context, TaskActionReceiver::class.java).apply {
            action = ACTION_COMPLETE_TASK
            putExtra(EXTRA_TASK_ID, taskId)
            putExtra("notification_id", notificationId)
        }
        val completePendingIntent = PendingIntent.getBroadcast(
            context,
            notificationId * 10 + 2,
            completeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val priorityText = when (priority.lowercase()) {
            "critical", "critica" -> "🚨 Crítica"
            "high", "alta" -> "🔴 Alta"
            "medium", "media" -> "🟡 Media"
            else -> "🟢 Normal"
        }

        val content = if (!deadline.isNullOrBlank()) {
            "Prioridad: $priorityText | Vence: $deadline"
        } else {
            "Prioridad: $priorityText"
        }

        val notification = NotificationCompat.Builder(context, CHANNEL_TASKS)
            .setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle(taskTitle)
            .setContentText(content)
            .setStyle(NotificationCompat.BigTextStyle().bigText("$taskTitle\n$content"))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(openPendingIntent)
            .setAutoCancel(true)
            .addAction(
                android.R.drawable.checkbox_on_background,
                "Completar Tarea",
                completePendingIntent
            )
            .build()

        try {
            NotificationManagerCompat.from(context).notify(notificationId, notification)
        } catch (_: SecurityException) {
            // Permission not granted on Android 13+
        }
    }

    fun showInboxCapturedNotification(
        context: Context,
        title: String,
        category: String?
    ) {
        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(MainActivity.EXTRA_NAV_TAB, "inbox")
        }
        val openPendingIntent = PendingIntent.getActivity(
            context,
            9999,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val catText = if (!category.isNullOrBlank()) " [$category]" else ""

        val notification = NotificationCompat.Builder(context, CHANNEL_INBOX)
            .setSmallIcon(android.R.drawable.ic_menu_send)
            .setContentTitle("Capturado en Pancho OS$catText")
            .setContentText(title)
            .setStyle(NotificationCompat.BigTextStyle().bigText(title))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(openPendingIntent)
            .setAutoCancel(true)
            .build()

        try {
            NotificationManagerCompat.from(context).notify(1001, notification)
        } catch (_: SecurityException) {
            // Permission not granted
        }
    }
}
