package expo.modules.totemkiosk

import android.app.Activity
import android.app.ActivityManager
import android.app.admin.DevicePolicyManager
import android.os.Build
import android.view.WindowManager
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class TotemKioskModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TotemKiosk")

    AsyncFunction("getStatus") { inspect(startManaged = false) }.runOnQueue(Queues.MAIN)
    AsyncFunction("startManaged") { inspect(startManaged = true) }.runOnQueue(Queues.MAIN)
  }

  private fun inspect(startManaged: Boolean): Map<String, Any> {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return mapOf("mode" to "unsupported")
    val activity = appContext.currentActivity ?: return mapOf("mode" to "native-error")
    return try {
      activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
      val manager = activity.getSystemService(ActivityManager::class.java)
        ?: return mapOf("mode" to "native-error")
      val policy = activity.getSystemService(DevicePolicyManager::class.java)
        ?: return mapOf("mode" to "native-error")

      if (startManaged && manager.lockTaskModeState != ActivityManager.LOCK_TASK_MODE_LOCKED) {
        if (!activity.hasWindowFocus() ||
          manager.lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE ||
          !policy.isLockTaskPermitted(activity.packageName)
        ) return mapOf("mode" to "policy-error")
        activity.startLockTask()
      }

      readStatus(activity, manager, policy)
    } catch (_: SecurityException) {
      mapOf("mode" to "policy-error")
    } catch (_: RuntimeException) {
      mapOf("mode" to "native-error")
    }
  }

  private fun readStatus(
    activity: Activity,
    manager: ActivityManager,
    policy: DevicePolicyManager
  ): Map<String, Any> {
    val permitted = policy.isLockTaskPermitted(activity.packageName)
    val mode = when (manager.lockTaskModeState) {
      ActivityManager.LOCK_TASK_MODE_NONE -> "ordinary"
      ActivityManager.LOCK_TASK_MODE_PINNED -> "pinned"
      ActivityManager.LOCK_TASK_MODE_LOCKED -> if (permitted) "managed" else "policy-error"
      else -> "native-error"
    }
    return mapOf("mode" to mode, "managedPermitted" to permitted)
  }
}
