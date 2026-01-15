import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useNotification } from '../useNotification'

describe('useNotification', () => {
  let timers

  beforeEach(() => {
    // Use fake timers to control setTimeout
    timers = vi.useFakeTimers()
  })

  afterEach(() => {
    // Clean up and restore real timers
    const { dismissAll } = useNotification()
    dismissAll()
    timers.clearAllTimers()
    vi.useRealTimers()
  })

  describe('notify', () => {
    it('should add notification with default type', () => {
      const { notify, notifications } = useNotification()

      const id = notify({ title: 'Test', message: 'Test message' })

      expect(id).toBeDefined()
      expect(notifications.value).toHaveLength(1)
      expect(notifications.value[0]).toEqual({
        id,
        type: 'info',
        title: 'Test',
        message: 'Test message'
      })
    })

    it('should add notification with custom type', () => {
      const { notify, notifications } = useNotification()

      notify({ type: 'success', title: 'Success!', message: 'Operation completed' })

      expect(notifications.value[0].type).toBe('success')
    })

    it('should generate unique IDs for each notification', () => {
      const { notify } = useNotification()

      const id1 = notify({ title: 'First', message: 'First message' })
      const id2 = notify({ title: 'Second', message: 'Second message' })
      const id3 = notify({ title: 'Third', message: 'Third message' })

      expect(id1).not.toBe(id2)
      expect(id2).not.toBe(id3)
      expect(id1).not.toBe(id3)
    })

    it('should auto-dismiss after default duration', () => {
      const { notify, notifications } = useNotification()

      notify({ title: 'Test', message: 'Auto-dismiss' })

      expect(notifications.value).toHaveLength(1)

      // Fast-forward 5000ms (default duration)
      timers.advanceTimersByTime(5000)

      expect(notifications.value).toHaveLength(0)
    })

    it('should auto-dismiss after custom duration', () => {
      const { notify, notifications } = useNotification()

      notify({ title: 'Test', message: 'Custom duration', duration: 3000 })

      expect(notifications.value).toHaveLength(1)

      // Fast-forward 2999ms - should still be there
      timers.advanceTimersByTime(2999)
      expect(notifications.value).toHaveLength(1)

      // Fast-forward 1 more ms - should be dismissed
      timers.advanceTimersByTime(1)
      expect(notifications.value).toHaveLength(0)
    })

    it('should not auto-dismiss when duration is 0', () => {
      const { notify, notifications } = useNotification()

      notify({ title: 'Permanent', message: 'No auto-dismiss', duration: 0 })

      expect(notifications.value).toHaveLength(1)

      // Fast-forward a long time
      timers.advanceTimersByTime(10000)

      // Should still be there
      expect(notifications.value).toHaveLength(1)
    })

    it('should not auto-dismiss when duration is negative', () => {
      const { notify, notifications } = useNotification()

      notify({ title: 'Permanent', message: 'Negative duration', duration: -1 })

      timers.advanceTimersByTime(10000)

      expect(notifications.value).toHaveLength(1)
    })

    it('should handle multiple notifications with different durations', () => {
      const { notify, notifications } = useNotification()

      notify({ title: 'Short', message: '1 second', duration: 1000 })
      notify({ title: 'Medium', message: '3 seconds', duration: 3000 })
      notify({ title: 'Long', message: '5 seconds', duration: 5000 })

      expect(notifications.value).toHaveLength(3)

      // After 1 second
      timers.advanceTimersByTime(1000)
      expect(notifications.value).toHaveLength(2)

      // After 3 seconds total
      timers.advanceTimersByTime(2000)
      expect(notifications.value).toHaveLength(1)

      // After 5 seconds total
      timers.advanceTimersByTime(2000)
      expect(notifications.value).toHaveLength(0)
    })
  })

  describe('success', () => {
    it('should create success notification', () => {
      const { success, notifications } = useNotification()

      success('Success!', 'Operation completed successfully')

      expect(notifications.value).toHaveLength(1)
      expect(notifications.value[0].type).toBe('success')
      expect(notifications.value[0].title).toBe('Success!')
      expect(notifications.value[0].message).toBe('Operation completed successfully')
    })

    it('should return notification ID', () => {
      const { success } = useNotification()

      const id = success('Success!', 'Message')

      expect(id).toBeDefined()
      expect(typeof id).toBe('number')
    })
  })

  describe('error', () => {
    it('should create error notification', () => {
      const { error, notifications } = useNotification()

      error('Error!', 'Something went wrong')

      expect(notifications.value).toHaveLength(1)
      expect(notifications.value[0].type).toBe('error')
      expect(notifications.value[0].title).toBe('Error!')
      expect(notifications.value[0].message).toBe('Something went wrong')
    })

    it('should return notification ID', () => {
      const { error } = useNotification()

      const id = error('Error!', 'Message')

      expect(id).toBeDefined()
      expect(typeof id).toBe('number')
    })
  })

  describe('warning', () => {
    it('should create warning notification', () => {
      const { warning, notifications } = useNotification()

      warning('Warning!', 'Please be careful')

      expect(notifications.value).toHaveLength(1)
      expect(notifications.value[0].type).toBe('warning')
      expect(notifications.value[0].title).toBe('Warning!')
      expect(notifications.value[0].message).toBe('Please be careful')
    })

    it('should return notification ID', () => {
      const { warning } = useNotification()

      const id = warning('Warning!', 'Message')

      expect(id).toBeDefined()
      expect(typeof id).toBe('number')
    })
  })

  describe('info', () => {
    it('should create info notification', () => {
      const { info, notifications } = useNotification()

      info('Info', 'Here is some information')

      expect(notifications.value).toHaveLength(1)
      expect(notifications.value[0].type).toBe('info')
      expect(notifications.value[0].title).toBe('Info')
      expect(notifications.value[0].message).toBe('Here is some information')
    })

    it('should return notification ID', () => {
      const { info } = useNotification()

      const id = info('Info', 'Message')

      expect(id).toBeDefined()
      expect(typeof id).toBe('number')
    })
  })

  describe('dismiss', () => {
    it('should remove notification by ID', () => {
      const { notify, dismiss, notifications } = useNotification()

      const id1 = notify({ title: 'First', message: 'Message 1', duration: 0 })
      const id2 = notify({ title: 'Second', message: 'Message 2', duration: 0 })
      const id3 = notify({ title: 'Third', message: 'Message 3', duration: 0 })

      expect(notifications.value).toHaveLength(3)

      dismiss(id2)

      expect(notifications.value).toHaveLength(2)
      expect(notifications.value.find(n => n.id === id1)).toBeDefined()
      expect(notifications.value.find(n => n.id === id2)).toBeUndefined()
      expect(notifications.value.find(n => n.id === id3)).toBeDefined()
    })

    it('should handle dismissing non-existent ID gracefully', () => {
      const { notify, dismiss, notifications } = useNotification()

      notify({ title: 'Test', message: 'Message', duration: 0 })

      expect(notifications.value).toHaveLength(1)

      // Try to dismiss non-existent ID
      dismiss(99999)

      expect(notifications.value).toHaveLength(1)
    })

    it('should handle dismissing already dismissed notification', () => {
      const { notify, dismiss, notifications } = useNotification()

      const id = notify({ title: 'Test', message: 'Message', duration: 0 })

      dismiss(id)
      expect(notifications.value).toHaveLength(0)

      // Dismiss again - should not throw error
      dismiss(id)
      expect(notifications.value).toHaveLength(0)
    })
  })

  describe('dismissAll', () => {
    it('should remove all notifications', () => {
      const { notify, dismissAll, notifications } = useNotification()

      notify({ title: 'First', message: 'Message 1', duration: 0 })
      notify({ title: 'Second', message: 'Message 2', duration: 0 })
      notify({ title: 'Third', message: 'Message 3', duration: 0 })

      expect(notifications.value).toHaveLength(3)

      dismissAll()

      expect(notifications.value).toHaveLength(0)
    })

    it('should work when no notifications exist', () => {
      const { dismissAll, notifications } = useNotification()

      expect(notifications.value).toHaveLength(0)

      dismissAll()

      expect(notifications.value).toHaveLength(0)
    })

    it('should clear pending auto-dismiss timers', () => {
      const { notify, dismissAll, notifications } = useNotification()

      // Create notifications with auto-dismiss
      notify({ title: 'First', message: 'Message 1', duration: 5000 })
      notify({ title: 'Second', message: 'Message 2', duration: 5000 })

      expect(notifications.value).toHaveLength(2)

      dismissAll()
      expect(notifications.value).toHaveLength(0)

      // Fast-forward timers - should not try to dismiss anything
      timers.advanceTimersByTime(5000)

      expect(notifications.value).toHaveLength(0)
    })
  })

  describe('Shared State', () => {
    it('should share notifications across multiple instances', () => {
      const instance1 = useNotification()
      const instance2 = useNotification()

      instance1.notify({ title: 'From Instance 1', message: 'Message', duration: 0 })

      expect(instance1.notifications.value).toHaveLength(1)
      expect(instance2.notifications.value).toHaveLength(1)
      expect(instance1.notifications.value).toBe(instance2.notifications.value)
    })

    it('should allow any instance to dismiss notifications', () => {
      const instance1 = useNotification()
      const instance2 = useNotification()

      const id = instance1.notify({ title: 'Test', message: 'Message', duration: 0 })

      expect(instance1.notifications.value).toHaveLength(1)

      instance2.dismiss(id)

      expect(instance1.notifications.value).toHaveLength(0)
      expect(instance2.notifications.value).toHaveLength(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty title and message', () => {
      const { notify, notifications } = useNotification()

      notify({ title: '', message: '', duration: 0 })

      expect(notifications.value).toHaveLength(1)
      expect(notifications.value[0].title).toBe('')
      expect(notifications.value[0].message).toBe('')
    })

    it('should handle undefined title and message', () => {
      const { notify, notifications } = useNotification()

      notify({ duration: 0 })

      expect(notifications.value).toHaveLength(1)
      expect(notifications.value[0].title).toBeUndefined()
      expect(notifications.value[0].message).toBeUndefined()
    })

    it('should handle very large number of notifications', () => {
      const { notify, notifications } = useNotification()

      // Add 1000 notifications
      for (let i = 0; i < 1000; i++) {
        notify({ title: `Notification ${i}`, message: 'Message', duration: 0 })
      }

      expect(notifications.value).toHaveLength(1000)
    })

    it('should maintain order of notifications', () => {
      const { notify, notifications } = useNotification()

      const id1 = notify({ title: 'First', message: '1', duration: 0 })
      const id2 = notify({ title: 'Second', message: '2', duration: 0 })
      const id3 = notify({ title: 'Third', message: '3', duration: 0 })

      expect(notifications.value[0].id).toBe(id1)
      expect(notifications.value[1].id).toBe(id2)
      expect(notifications.value[2].id).toBe(id3)
    })
  })
})
