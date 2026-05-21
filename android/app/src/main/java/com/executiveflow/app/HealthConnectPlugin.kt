package com.executiveflow.app

import android.content.Intent
import android.util.Log
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.*
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.Instant
import java.time.temporal.ChronoUnit

private const val TAG = "HealthConnectPlugin"

@CapacitorPlugin(name = "HealthConnect", requestCodes = [HealthConnectPlugin.HC_REQUEST_CODE])
class HealthConnectPlugin : Plugin() {

    companion object {
        const val HC_REQUEST_CODE = 8923
    }

    private val exceptionHandler = CoroutineExceptionHandler { _, throwable ->
        Log.e(TAG, "Unhandled coroutine exception", throwable)
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob() + exceptionHandler)

    private var pendingPermissionCall: PluginCall? = null

    // Permissions required for sync to function
    private val SYNC_PERMISSIONS = setOf(
        HealthPermission.getReadPermission(WeightRecord::class),
        HealthPermission.getReadPermission(BodyFatRecord::class),
        HealthPermission.getReadPermission(BoneMassRecord::class),
        HealthPermission.getReadPermission(LeanBodyMassRecord::class),
        HealthPermission.getReadPermission(BasalMetabolicRateRecord::class),
        HealthPermission.getReadPermission(HeightRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
    )

    // Full set to request (includes optional data like calories, heart rate, steps)
    private val PERMISSIONS = SYNC_PERMISSIONS + setOf(
        HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(StepsRecord::class),
    )

    @PluginMethod
    fun checkAvailability(call: PluginCall) {
        try {
            val status = HealthConnectClient.getSdkStatus(context)
            val label = when (status) {
                HealthConnectClient.SDK_AVAILABLE -> "available"
                HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "update_required"
                else -> "unavailable"
            }
            Log.d(TAG, "HC availability: $label")
            call.resolve(JSObject().apply { put("status", label) })
        } catch (t: Throwable) {
            Log.e(TAG, "checkAvailability failed", t)
            call.resolve(JSObject().apply { put("status", "unavailable") })
        }
    }

    @PluginMethod
    fun checkHCPermissions(call: PluginCall) {
        scope.launch {
            try {
                val status = withContext(Dispatchers.Main) {
                    HealthConnectClient.getSdkStatus(context)
                }
                if (status != HealthConnectClient.SDK_AVAILABLE) {
                    call.resolve(JSObject().apply { put("granted", false) })
                    return@launch
                }
                val client = withContext(Dispatchers.Main) {
                    HealthConnectClient.getOrCreate(context)
                }
                val granted = client.permissionController.getGrantedPermissions()
                val allGranted = SYNC_PERMISSIONS.all { it in granted }
                Log.d(TAG, "checkHCPermissions: allGranted=$allGranted granted=${granted.size}/${PERMISSIONS.size}")
                call.resolve(JSObject().apply { put("granted", allGranted) })
            } catch (t: Throwable) {
                Log.e(TAG, "checkHCPermissions failed", t)
                call.resolve(JSObject().apply { put("granted", false) })
            }
        }
    }

    @PluginMethod
    fun requestHCPermissions(call: PluginCall) {
        try {
            val status = HealthConnectClient.getSdkStatus(context)
            Log.d(TAG, "requestHCPermissions: sdkStatus=$status")
            if (status != HealthConnectClient.SDK_AVAILABLE) {
                call.resolve(JSObject().apply { put("granted", false); put("needsSetup", true) })
                return
            }
            val contract = PermissionController.createRequestPermissionResultContract()
            val intent = contract.createIntent(activity, PERMISSIONS)
            pendingPermissionCall = call
            call.setKeepAlive(true)
            activity.runOnUiThread {
                try {
                    @Suppress("DEPRECATION")
                    activity.startActivityForResult(intent, HC_REQUEST_CODE)
                } catch (t: Throwable) {
                    Log.e(TAG, "startActivityForResult failed: ${t.message}", t)
                    pendingPermissionCall = null
                    call.resolve(JSObject().apply { put("granted", false); put("needsSetup", true) })
                }
            }
        } catch (t: Throwable) {
            Log.e(TAG, "requestHCPermissions failed: ${t.message}", t)
            pendingPermissionCall = null
            call.resolve(JSObject().apply { put("granted", false); put("needsSetup", true) })
        }
    }

    override fun handleOnActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.handleOnActivityResult(requestCode, resultCode, data)
        if (requestCode != HC_REQUEST_CODE) return
        val call = pendingPermissionCall ?: return
        pendingPermissionCall = null
        scope.launch {
            try {
                val client = withContext(Dispatchers.Main) { HealthConnectClient.getOrCreate(context) }
                val granted = client.permissionController.getGrantedPermissions()
                val allGranted = SYNC_PERMISSIONS.all { it in granted }
                Log.d(TAG, "handleOnActivityResult: allGranted=$allGranted")
                call.resolve(JSObject().apply { put("granted", allGranted) })
            } catch (t: Throwable) {
                Log.e(TAG, "handleOnActivityResult check failed", t)
                call.resolve(JSObject().apply { put("granted", false) })
            }
        }
    }

    @PluginMethod
    fun openHealthConnect(call: PluginCall) {
        // Try the direct "manage permissions for this app" screen first
        val intentsToTry = listOf(
            Intent("android.health.connect.action.MANAGE_HEALTH_PERMISSIONS").apply {
                putExtra("android.intent.extra.PACKAGE_NAME", context.packageName)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            },
            Intent("androidx.health.ACTION_MANAGE_HEALTH_PERMISSIONS").apply {
                putExtra("android.intent.extra.PACKAGE_NAME", context.packageName)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            },
            Intent("android.health.connect.action.HEALTH_HOME_SETTINGS").apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            },
        )
        for (intent in intentsToTry) {
            try {
                activity.startActivity(intent)
                call.resolve()
                return
            } catch (_: Throwable) {}
        }
        call.reject("Could not open Health Connect")
    }

    @PluginMethod
    fun readBodyMeasurements(call: PluginCall) {
        scope.launch {
            try {
                val client = withContext(Dispatchers.Main) {
                    HealthConnectClient.getOrCreate(context)
                }
                val daysBack = call.getInt("daysBack", 90)!!
                val end = Instant.now()
                val start = end.minus(daysBack.toLong(), ChronoUnit.DAYS)
                val filter = TimeRangeFilter.between(start, end)
                val result = JSObject()

                val weightArr = readWeightRecords(client, filter)
                val bodyFatArr = readPercentageRecords(client, filter)
                val boneMassArr = readBoneMassRecords(client, filter)
                val muscleMassArr = readLeanMassRecords(client, filter)
                val bmrArr = readBmrRecords(client, filter)
                val heightArr = readHeightRecords(client, filter)

                Log.d(TAG, "HC read counts — weight:${weightArr.length()} bodyFat:${bodyFatArr.length()} boneMass:${boneMassArr.length()} muscle:${muscleMassArr.length()} bmr:${bmrArr.length()} height:${heightArr.length()}")

                result.put("weight", weightArr)
                result.put("bodyFat", bodyFatArr)
                result.put("boneMass", boneMassArr)
                result.put("muscleMass", muscleMassArr)
                result.put("bmr", bmrArr)
                result.put("height", heightArr)
                result.put("_counts", "w=${weightArr.length()} bf=${bodyFatArr.length()} h=${heightArr.length()}")

                call.resolve(result)
            } catch (t: Throwable) {
                Log.e(TAG, "readBodyMeasurements failed", t)
                call.reject("Failed to read body measurements: ${t.message}")
            }
        }
    }

    private suspend fun readPercentageRecords(client: HealthConnectClient, filter: TimeRangeFilter): JSArray {
        val arr = JSArray()
        val records = client.readRecords(ReadRecordsRequest(BodyFatRecord::class, filter))
        records.records.forEach { r ->
            arr.put(JSObject().apply { put("time", r.time.toString()); put("value", r.percentage.value) })
        }
        return arr
    }

    private suspend fun readBoneMassRecords(client: HealthConnectClient, filter: TimeRangeFilter): JSArray {
        val arr = JSArray()
        val records = client.readRecords(ReadRecordsRequest(BoneMassRecord::class, filter))
        records.records.forEach { r ->
            arr.put(JSObject().apply { put("time", r.time.toString()); put("value", r.mass.inKilograms) })
        }
        return arr
    }

    private suspend fun readLeanMassRecords(client: HealthConnectClient, filter: TimeRangeFilter): JSArray {
        val arr = JSArray()
        val records = client.readRecords(ReadRecordsRequest(LeanBodyMassRecord::class, filter))
        records.records.forEach { r ->
            arr.put(JSObject().apply { put("time", r.time.toString()); put("value", r.mass.inKilograms) })
        }
        return arr
    }

    private suspend fun readBmrRecords(client: HealthConnectClient, filter: TimeRangeFilter): JSArray {
        val arr = JSArray()
        val records = client.readRecords(ReadRecordsRequest(BasalMetabolicRateRecord::class, filter))
        records.records.forEach { r ->
            arr.put(JSObject().apply { put("time", r.time.toString()); put("value", r.basalMetabolicRate.inKilocaloriesPerDay) })
        }
        return arr
    }

    private suspend fun readHeightRecords(client: HealthConnectClient, filter: TimeRangeFilter): JSArray {
        val arr = JSArray()
        val records = client.readRecords(ReadRecordsRequest(HeightRecord::class, filter))
        records.records.forEach { r ->
            arr.put(JSObject().apply { put("time", r.time.toString()); put("value", r.height.inMeters * 100) })
        }
        return arr
    }

    private suspend fun readWeightRecords(client: HealthConnectClient, filter: TimeRangeFilter): JSArray {
        val arr = JSArray()
        val records = client.readRecords(ReadRecordsRequest(WeightRecord::class, filter))
        records.records.forEach { r ->
            arr.put(JSObject().apply { put("time", r.time.toString()); put("value", r.weight.inKilograms) })
        }
        return arr
    }

    @PluginMethod
    fun readSleepSessions(call: PluginCall) {
        scope.launch {
            try {
                val client = withContext(Dispatchers.Main) {
                    HealthConnectClient.getOrCreate(context)
                }
                val daysBack = call.getInt("daysBack", 30)!!
                val end = Instant.now()
                val start = end.minus(daysBack.toLong(), ChronoUnit.DAYS)
                val filter = TimeRangeFilter.between(start, end)

                val sessions = client.readRecords(ReadRecordsRequest(SleepSessionRecord::class, filter))
                val arr = JSArray()
                sessions.records.forEach { s ->
                    try {
                        val stagesArr = JSArray()
                        s.stages.forEach { stage ->
                            stagesArr.put(JSObject().apply {
                                put("start", stage.startTime.toString())
                                put("end", stage.endTime.toString())
                                put("stage", stage.stage)
                            })
                        }
                        arr.put(JSObject().apply {
                            put("id", s.metadata.id)
                            put("start", s.startTime.toString())
                            put("end", s.endTime.toString())
                            put("durationMinutes", ChronoUnit.MINUTES.between(s.startTime, s.endTime))
                            put("title", s.title ?: "")
                            put("stages", stagesArr)
                        })
                    } catch (t: Throwable) {
                        Log.w(TAG, "Skipping bad sleep record: ${t.message}")
                    }
                }
                call.resolve(JSObject().apply { put("sessions", arr) })
            } catch (t: Throwable) {
                Log.e(TAG, "readSleepSessions failed", t)
                call.reject("Failed to read sleep sessions: ${t.message}")
            }
        }
    }

    @PluginMethod
    fun readExerciseSessions(call: PluginCall) {
        scope.launch {
            try {
                val client = withContext(Dispatchers.Main) {
                    HealthConnectClient.getOrCreate(context)
                }
                val daysBack = call.getInt("daysBack", 90)!!
                val end = Instant.now()
                val start = end.minus(daysBack.toLong(), ChronoUnit.DAYS)
                val filter = TimeRangeFilter.between(start, end)

                val sessions = client.readRecords(ReadRecordsRequest(ExerciseSessionRecord::class, filter))
                val arr = JSArray()
                sessions.records.forEach { s ->
                    try {
                        var calories = 0.0
                        try {
                            val sessionFilter = TimeRangeFilter.between(s.startTime, s.endTime)
                            val calRecords = client.readRecords(
                                ReadRecordsRequest(ActiveCaloriesBurnedRecord::class, sessionFilter)
                            )
                            calories = calRecords.records.sumOf { it.energy.inKilocalories }
                        } catch (t: Throwable) {
                            Log.w(TAG, "Calories read failed for session: ${t.message}")
                        }

                        val segArr = JSArray()
                        s.segments.forEach { seg ->
                            segArr.put(JSObject().apply {
                                put("start", seg.startTime.toString())
                                put("end", seg.endTime.toString())
                                put("type", seg.segmentType)
                            })
                        }

                        arr.put(JSObject().apply {
                            put("id", s.metadata.id)
                            put("start", s.startTime.toString())
                            put("end", s.endTime.toString())
                            put("durationMinutes", ChronoUnit.MINUTES.between(s.startTime, s.endTime))
                            put("exerciseType", s.exerciseType)
                            put("title", s.title ?: "")
                            put("notes", s.notes ?: "")
                            put("calories", calories)
                            put("segments", segArr)
                        })
                    } catch (t: Throwable) {
                        Log.w(TAG, "Skipping bad exercise record: ${t.message}")
                    }
                }
                call.resolve(JSObject().apply { put("sessions", arr) })
            } catch (t: Throwable) {
                Log.e(TAG, "readExerciseSessions failed", t)
                call.reject("Failed to read exercise sessions: ${t.message}")
            }
        }
    }
}
