import { ref } from 'vue'

const notifications = ref([])
let idCounter = 0

export function useNotification() {
  function notify({ type = 'info', title, message, duration = 5000 }) {
    const id = ++idCounter
    
    notifications.value.push({
      id,
      type,
      title,
      message
    })
    
    if (duration > 0) {
      setTimeout(() => {
        dismiss(id)
      }, duration)
    }
    
    return id
  }
  
  function success(title, message) {
    return notify({ type: 'success', title, message })
  }
  
  function error(title, message) {
    return notify({ type: 'error', title, message })
  }
  
  function warning(title, message) {
    return notify({ type: 'warning', title, message })
  }
  
  function info(title, message) {
    return notify({ type: 'info', title, message })
  }
  
  function dismiss(id) {
    const index = notifications.value.findIndex(n => n.id === id)
    if (index !== -1) {
      notifications.value.splice(index, 1)
    }
  }
  
  function dismissAll() {
    notifications.value = []
  }
  
  return {
    notifications,
    notify,
    success,
    error,
    warning,
    info,
    dismiss,
    dismissAll
  }
}

