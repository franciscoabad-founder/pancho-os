package com.franciscoabad.panchoos.ui.tasks

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.franciscoabad.panchoos.data.PanchoRepository
import com.franciscoabad.panchoos.data.model.OsError
import com.franciscoabad.panchoos.data.model.OsResult
import com.franciscoabad.panchoos.data.model.OsTask
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

sealed interface TasksUiState {
    object Loading : TasksUiState
    data class Success(
        val tasks: List<OsTask>,
        val isRefreshing: Boolean = false,
        val filter: TaskFilter = TaskFilter.PENDING
    ) : TasksUiState
    data class Error(val error: OsError) : TasksUiState
    object Unconfigured : TasksUiState
}

enum class TaskFilter {
    PENDING, ALL, COMPLETED
}

class TasksViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = PanchoRepository.getInstance(application)

    private val _uiState = MutableStateFlow<TasksUiState>(TasksUiState.Loading)
    val uiState: StateFlow<TasksUiState> = _uiState.asStateFlow()

    private var currentFilter: TaskFilter = TaskFilter.PENDING

    init {
        loadTasks()
    }

    fun loadTasks(isRefresh: Boolean = false) {
        if (!repository.isConfigured()) {
            _uiState.value = TasksUiState.Unconfigured
            return
        }

        if (!isRefresh && _uiState.value !is TasksUiState.Success) {
            _uiState.value = TasksUiState.Loading
        } else if (_uiState.value is TasksUiState.Success) {
            val current = _uiState.value as TasksUiState.Success
            _uiState.value = current.copy(isRefreshing = true)
        }

        viewModelScope.launch {
            when (val result = repository.fetchTasks(estado = "todas")) {
                is OsResult.Success -> {
                    _uiState.update {
                        TasksUiState.Success(
                            tasks = result.data,
                            isRefreshing = false,
                            filter = currentFilter
                        )
                    }
                }
                is OsResult.Failure -> {
                    _uiState.update { TasksUiState.Error(result.error) }
                }
            }
        }
    }

    fun setFilter(filter: TaskFilter) {
        currentFilter = filter
        if (_uiState.value is TasksUiState.Success) {
            _uiState.update { (it as TasksUiState.Success).copy(filter = filter) }
        }
    }

    fun toggleTask(task: OsTask) {
        viewModelScope.launch {
            val result = repository.toggleTaskComplete(task)
            if (result.isSuccess) {
                loadTasks(isRefresh = true)
            }
        }
    }

    fun createTask(titulo: String, prioridad: String, deadline: String?) {
        viewModelScope.launch {
            val result = repository.createTask(titulo, prioridad, deadline)
            if (result.isSuccess) {
                loadTasks(isRefresh = true)
            }
        }
    }
}
