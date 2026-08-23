package com.franciscoabad.panchoos.ui.tasks

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.franciscoabad.panchoos.data.model.OsTask
import com.franciscoabad.panchoos.theme.CardBackground
import com.franciscoabad.panchoos.theme.CardBorder
import com.franciscoabad.panchoos.theme.DarkSlate700
import com.franciscoabad.panchoos.theme.DarkSlate800
import com.franciscoabad.panchoos.theme.DarkSlate900
import com.franciscoabad.panchoos.theme.DarkSlate950
import com.franciscoabad.panchoos.theme.PanchoCyan
import com.franciscoabad.panchoos.theme.PanchoEmerald
import com.franciscoabad.panchoos.theme.PriorityCritical
import com.franciscoabad.panchoos.theme.PriorityHigh
import com.franciscoabad.panchoos.theme.PriorityLow
import com.franciscoabad.panchoos.theme.PriorityMedium
import com.franciscoabad.panchoos.theme.TextMuted
import com.franciscoabad.panchoos.theme.TextPrimary
import com.franciscoabad.panchoos.theme.TextSecondary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TasksScreen(
    onNavigateToSettings: () -> Unit,
    modifier: Modifier = Modifier,
    initialShowCreateDialog: Boolean = false,
    viewModel: TasksViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var showCreateDialog by remember(initialShowCreateDialog) { mutableStateOf(initialShowCreateDialog) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Pancho OS", fontWeight = FontWeight.Bold, color = PanchoCyan, fontSize = 20.sp)
                        Spacer(Modifier.width(8.dp))
                        Text("• Tareas", color = TextPrimary, fontSize = 16.sp)
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadTasks(isRefresh = true) }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Actualizar", tint = TextSecondary)
                    }
                    IconButton(onClick = onNavigateToSettings) {
                        Icon(Icons.Default.Settings, contentDescription = "Ajustes", tint = TextSecondary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = DarkSlate950)
            )
        },
        floatingActionButton = {
            if (uiState is TasksUiState.Success) {
                FloatingActionButton(
                    onClick = { showCreateDialog = true },
                    containerColor = PanchoCyan,
                    contentColor = Color.Black,
                    shape = CircleShape
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Nueva Tarea")
                }
            }
        },
        containerColor = DarkSlate950,
        modifier = modifier
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(DarkSlate950)
        ) {
            when (val state = uiState) {
                TasksUiState.Loading -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator(color = PanchoCyan)
                            Spacer(Modifier.height(12.dp))
                            Text("Consultando Pancho OS...", color = TextSecondary, fontSize = 14.sp)
                        }
                    }
                }
                TasksUiState.Unconfigured -> {
                    Box(modifier = Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Default.Settings, contentDescription = null, tint = PanchoCyan, modifier = Modifier.size(56.dp))
                            Spacer(Modifier.height(16.dp))
                            Text("Configuración Requerida", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = TextPrimary)
                            Spacer(Modifier.height(8.dp))
                            Text("Ingresa tu URL y el token de Pancho OS para sincronizar tus tareas.", color = TextSecondary, fontSize = 14.sp)
                            Spacer(Modifier.height(20.dp))
                            Button(
                                onClick = onNavigateToSettings,
                                colors = ButtonDefaults.buttonColors(containerColor = PanchoCyan, contentColor = Color.Black)
                            ) {
                                Text("Abrir Ajustes", fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
                is TasksUiState.Error -> {
                    Box(modifier = Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Default.ErrorOutline, contentDescription = null, tint = PriorityCritical, modifier = Modifier.size(52.dp))
                            Spacer(Modifier.height(16.dp))
                            Text("Error de Conexión", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = PriorityCritical)
                            Spacer(Modifier.height(8.dp))
                            Text(state.error.userMessage(), color = TextSecondary, fontSize = 14.sp)
                            Spacer(Modifier.height(20.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                OutlinedButton(
                                    onClick = onNavigateToSettings,
                                    colors = ButtonDefaults.outlinedButtonColors(contentColor = PanchoCyan)
                                ) {
                                    Text("Revisar Ajustes")
                                }
                                Button(
                                    onClick = { viewModel.loadTasks() },
                                    colors = ButtonDefaults.buttonColors(containerColor = PanchoCyan, contentColor = Color.Black)
                                ) {
                                    Text("Reintentar", fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
                is TasksUiState.Success -> {
                    val filteredTasks = when (state.filter) {
                        TaskFilter.PENDING -> state.tasks.filter { !it.isCompleted }
                        TaskFilter.COMPLETED -> state.tasks.filter { it.isCompleted }
                        TaskFilter.ALL -> state.tasks
                    }

                    Column(modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
                        // Chips de filtro
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            FilterChip(
                                selected = state.filter == TaskFilter.PENDING,
                                onClick = { viewModel.setFilter(TaskFilter.PENDING) },
                                label = { Text("Pendientes (${state.tasks.count { !it.isCompleted }})") },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = PanchoCyan.copy(alpha = 0.2f),
                                    selectedLabelColor = PanchoCyan,
                                    containerColor = DarkSlate900,
                                    labelColor = TextSecondary
                                )
                            )
                            FilterChip(
                                selected = state.filter == TaskFilter.ALL,
                                onClick = { viewModel.setFilter(TaskFilter.ALL) },
                                label = { Text("Todas (${state.tasks.size})") },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = PanchoCyan.copy(alpha = 0.2f),
                                    selectedLabelColor = PanchoCyan,
                                    containerColor = DarkSlate900,
                                    labelColor = TextSecondary
                                )
                            )
                            FilterChip(
                                selected = state.filter == TaskFilter.COMPLETED,
                                onClick = { viewModel.setFilter(TaskFilter.COMPLETED) },
                                label = { Text("Completadas (${state.tasks.count { it.isCompleted }})") },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = PanchoCyan.copy(alpha = 0.2f),
                                    selectedLabelColor = PanchoCyan,
                                    containerColor = DarkSlate900,
                                    labelColor = TextSecondary
                                )
                            )
                        }

                        if (filteredTasks.isEmpty()) {
                            Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Icon(Icons.Default.CheckCircle, contentDescription = null, tint = PanchoEmerald.copy(alpha = 0.6f), modifier = Modifier.size(48.dp))
                                    Spacer(Modifier.height(12.dp))
                                    Text("No hay tareas en esta vista", color = TextSecondary, fontSize = 14.sp)
                                }
                            }
                        } else {
                            LazyColumn(
                                modifier = Modifier.weight(1f).fillMaxWidth(),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                items(filteredTasks, key = { it.id }) { task ->
                                    TaskItemCard(
                                        task = task,
                                        onToggle = { viewModel.toggleTask(task) }
                                    )
                                }
                                item { Spacer(Modifier.height(80.dp)) }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showCreateDialog) {
        CreateTaskDialog(
            onDismiss = { showCreateDialog = false },
            onConfirm = { titulo, prioridad, deadline ->
                viewModel.createTask(titulo, prioridad, deadline)
                showCreateDialog = false
            }
        )
    }
}

@Composable
fun TaskItemCard(
    task: OsTask,
    onToggle: () -> Unit,
    modifier: Modifier = Modifier
) {
    val priorityColor = when (task.prioridad.lowercase()) {
        "critical", "critica" -> PriorityCritical
        "high", "alta" -> PriorityHigh
        "medium", "media" -> PriorityMedium
        else -> PriorityLow
    }

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = CardBackground),
        shape = RoundedCornerShape(10.dp),
        border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(CardBorder))
    ) {
        Row(
            modifier = Modifier.padding(12.dp).fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Checkbox(
                checked = task.isCompleted,
                onCheckedChange = { onToggle() },
                colors = CheckboxDefaults.colors(
                    checkedColor = PanchoEmerald,
                    uncheckedColor = DarkSlate700,
                    checkmarkColor = Color.Black
                )
            )

            Spacer(Modifier.width(8.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = task.titulo,
                    color = if (task.isCompleted) TextMuted else TextPrimary,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium,
                    textDecoration = if (task.isCompleted) TextDecoration.LineThrough else TextDecoration.None
                )

                Row(
                    modifier = Modifier.padding(top = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Badge de prioridad
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(4.dp))
                            .background(priorityColor.copy(alpha = 0.2f))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = task.displayPriority,
                            color = priorityColor,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    task.deadline?.let { deadline ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.DateRange, contentDescription = null, tint = TextMuted, modifier = Modifier.size(13.dp))
                            Spacer(Modifier.width(3.dp))
                            Text(deadline, color = TextMuted, fontSize = 12.sp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun CreateTaskDialog(
    onDismiss: () -> Unit,
    onConfirm: (titulo: String, prioridad: String, deadline: String?) -> Unit
) {
    var titulo by remember { mutableStateOf("") }
    var prioridad by remember { mutableStateOf("medium") }
    var deadline by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Nueva Tarea en Pancho OS", color = TextPrimary, fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = titulo,
                    onValueChange = { titulo = it },
                    label = { Text("Título", color = TextSecondary) },
                    placeholder = { Text("Ej. Revisar métricas", color = TextMuted) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary,
                        focusedBorderColor = PanchoCyan,
                        unfocusedBorderColor = CardBorder,
                        focusedContainerColor = DarkSlate800,
                        unfocusedContainerColor = DarkSlate800
                    ),
                    singleLine = true
                )

                Text("Prioridad", color = TextSecondary, fontSize = 12.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("low" to "Baja", "medium" to "Media", "high" to "Alta", "critical" to "Crítica").forEach { (key, label) ->
                        FilterChip(
                            selected = prioridad == key,
                            onClick = { prioridad = key },
                            label = { Text(label, fontSize = 11.sp) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = PanchoCyan.copy(alpha = 0.25f),
                                selectedLabelColor = PanchoCyan,
                                containerColor = DarkSlate800,
                                labelColor = TextSecondary
                            )
                        )
                    }
                }

                OutlinedTextField(
                    value = deadline,
                    onValueChange = { deadline = it },
                    label = { Text("Fecha Límite (YYYY-MM-DD)", color = TextSecondary) },
                    placeholder = { Text("Opcional", color = TextMuted) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary,
                        focusedBorderColor = PanchoCyan,
                        unfocusedBorderColor = CardBorder,
                        focusedContainerColor = DarkSlate800,
                        unfocusedContainerColor = DarkSlate800
                    ),
                    singleLine = true
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { if (titulo.isNotBlank()) onConfirm(titulo.trim(), prioridad, deadline.ifBlank { null }) },
                enabled = titulo.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = PanchoCyan, contentColor = Color.Black)
            ) {
                Text("Crear Tarea", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar", color = TextSecondary)
            }
        },
        containerColor = DarkSlate900,
        shape = RoundedCornerShape(14.dp)
    )
}
