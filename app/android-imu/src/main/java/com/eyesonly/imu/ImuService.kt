package com.eyesonly.imu

import android.app.Service
import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.SystemClock
import android.util.Log
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import okhttp3.Request
import okhttp3.WebSocket
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.CopyOnWriteArrayList

/**
 * ImuService — standalone Android service that streams raw IMU data from the
 * RayNeo Air 4 Pro glasses (via Android SensorManager) to local consumers
 * (the Unity app, the agent harness) over a WebSocket on localhost:7603.
 *
 * Frame format (one JSON object per 3-second window):
 *   {
 *     "type": "imu_window",
 *     "timestamp": <epoch ms>,
 *     "wearing": true|false,
 *     "samples": [{"ax":..,"ay":..,"az":..,"gx":..,"gy":..,"gz":..,
 *                  "mx":..,"my":..,"mz":..,"t":..}, ...]
 *   }
 *
 * HTTP endpoints (on the same port, plain HTTP since it's localhost-only):
 *   GET  /profile  -> {"profile_hash": "..."} or 404 if not enrolled
 *   POST /enroll   -> body: an imu_window frame; computes + stores profile hash
 *
 * Ffalcon SDK: if com.ffalcon... MobileState is present (manual .aar import,
 * v0.2.6+), isWearing() is polled every 500 ms. Otherwise we fall back to
 * SensorManager-only and `wearing` is reported as true (unknown → permissive).
 */
class ImuService : Service(), SensorEventListener {

    companion object {
        private const val TAG = "ImuService"
        const val PORT = 7603
        const val WINDOW_MS = 3_000L
        const val WEARING_POLL_MS = 500L

        @Volatile
        var isRunning = false
            private set
    }

    // ---- sensor plumbing ----------------------------------------------------

    data class ImuSample(
        var ax: Float = 0f, var ay: Float = 0f, var az: Float = 0f,
        var gx: Float = 0f, var gy: Float = 0f, var gz: Float = 0f,
        var mx: Float = 0f, var my: Float = 0f, var mz: Float = 0f,
        var t: Long = 0L, // SystemClock.elapsedRealtime() ms
    )

    private lateinit var sensorManager: SensorManager
    private lateinit var sensorThread: HandlerThread
    private lateinit var sensorHandler: Handler

    // Latest values per sensor; merged into ImuSample on each event.
    private val latestAccel = FloatArray(3)
    private val latestGyro = FloatArray(3)
    private val latestMag = FloatArray(3)

    // Samples collected into the current window.
    private val windowSamples = ConcurrentLinkedQueue<ImuSample>()
    private var windowStartMs = 0L

    // ---- wearing state ------------------------------------------------------

    @Volatile
    private var wearing = true // unknown → permissive default

    // Poll outcomes within the current window, for wearing_fraction.
    private var wearingPollsTotal = 0
    private var wearingPollsTrue = 0

    // ---- profile ------------------------------------------------------------

    @Volatile
    private var profileHash: String? = null

    // ---- websocket ----------------------------------------------------------

    private val gson = Gson()

    // Connected downstream consumers.
    private val sockets = CopyOnWriteArrayList<WebSocket>()

    // Minimal localhost HTTP/WebSocket server. OkHttp has no server, so we use
    // a tiny raw-socket acceptor: enough for WS upgrade + GET/POST on one port.
    private var serverThread: Thread? = null
    @Volatile
    private var serverSocket: java.net.ServerSocket? = null

    // ---- lifecycle ----------------------------------------------------------

    override fun onCreate() {
        super.onCreate()
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        sensorThread = HandlerThread("imu-sensors").also { it.start() }
        sensorHandler = Handler(sensorThread.looper)

        registerSensors()
        startWearingPoll()
        startWindowLoop()
        startServer()
        isRunning = true
        Log.i(TAG, "ImuService started on localhost:$PORT")
    }

    override fun onDestroy() {
        isRunning = false
        sensorManager.unregisterListener(this)
        serverSocket?.close()
        sensorThread.quitSafely()
        sockets.forEach { it.close(1001, "service stopped") }
        sockets.clear()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // ---- sensors ------------------------------------------------------------

    private fun registerSensors() {
        val delay = SensorManager.SENSOR_DELAY_GAME // ~20 ms
        listOf(
            Sensor.TYPE_ACCELEROMETER,
            Sensor.TYPE_GYROSCOPE,
            Sensor.TYPE_MAGNETIC_FIELD,
        ).forEach { type ->
            sensorManager.getDefaultSensor(type)?.let {
                sensorManager.registerListener(this, it, delay, sensorHandler)
            } ?: Log.w(TAG, "sensor type $type not available")
        }
    }

    override fun onSensorChanged(event: SensorEvent) {
        when (event.sensor.type) {
            Sensor.TYPE_ACCELEROMETER -> event.values.copyInto(latestAccel, 0, 0, 3)
            Sensor.TYPE_GYROSCOPE -> event.values.copyInto(latestGyro, 0, 0, 3)
            Sensor.TYPE_MAGNETIC_FIELD -> event.values.copyInto(latestMag, 0, 0, 3)
            else -> return
        }
        windowSamples.add(
            ImuSample(
                ax = latestAccel[0], ay = latestAccel[1], az = latestAccel[2],
                gx = latestGyro[0], gy = latestGyro[1], gz = latestGyro[2],
                mx = latestMag[0], my = latestMag[1], mz = latestMag[2],
                t = SystemClock.elapsedRealtime(),
            )
        )
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    // ---- wearing state (Ffalcon SDK with graceful fallback) -----------------

    private fun startWearingPoll() {
        val runnable = object : Runnable {
            override fun run() {
                wearing = pollIsWearing()
                wearingPollsTotal++
                if (wearing) wearingPollsTrue++
                sensorHandler.postDelayed(this, WEARING_POLL_MS)
            }
        }
        sensorHandler.post(runnable)
    }

    /**
     * Calls Ffalcon SDK MobileState.isWearing() reflectively so the library
     * compiles without the .aar. Falls back to `true` (unknown → permissive)
     * when the SDK isn't present.
     */
    private fun pollIsWearing(): Boolean {
        return try {
            val cls = Class.forName("com.ffalcon.sdk.state.MobileState")
            val method = cls.getMethod("isWearing")
            method.invoke(null) as? Boolean ?: true
        } catch (t: Throwable) {
            // Ffalcon SDK not on classpath — SensorManager-only mode.
            true
        }
    }

    // ---- windowing ----------------------------------------------------------

    private fun startWindowLoop() {
        windowStartMs = SystemClock.elapsedRealtime()
        val runnable = object : Runnable {
            override fun run() {
                flushWindow()
                sensorHandler.postDelayed(this, WINDOW_MS)
            }
        }
        sensorHandler.postDelayed(runnable, WINDOW_MS)
    }

    private fun flushWindow() {
        val samples = mutableListOf<ImuSample>()
        while (true) {
            samples.add(windowSamples.poll() ?: break)
        }
        if (samples.isEmpty()) return

        val wearingFraction =
            if (wearingPollsTotal > 0) wearingPollsTrue.toFloat() / wearingPollsTotal else 1f
        wearingPollsTotal = 0
        wearingPollsTrue = 0

        val frame = JsonObject().apply {
            addProperty("type", "imu_window")
            addProperty("timestamp", System.currentTimeMillis())
            addProperty("wearing", wearing)
            add("samples", gson.toJsonTree(samples.map { s ->
                JsonObject().apply {
                    addProperty("ax", s.ax); addProperty("ay", s.ay); addProperty("az", s.az)
                    addProperty("gx", s.gx); addProperty("gy", s.gy); addProperty("gz", s.gz)
                    addProperty("mx", s.mx); addProperty("my", s.my); addProperty("mz", s.mz)
                    addProperty("t", s.t)
                }
            }))
        }
        broadcast(frame.toString())
    }

    private fun broadcast(msg: String) {
        val dead = mutableListOf<WebSocket>()
        for (ws in sockets) {
            if (!ws.send(msg)) dead.add(ws)
        }
        sockets.removeAll(dead)
    }

    // ---- minimal HTTP + WebSocket server ------------------------------------

    private fun startServer() {
        serverThread = Thread {
            val server = java.net.ServerSocket(PORT, 50, java.net.InetAddress.getByName("127.0.0.1"))
            serverSocket = server
            while (!server.isClosed) {
                try {
                    val client = server.accept()
                    Thread { handleClient(client) }.start()
                } catch (e: Exception) {
                    if (!server.isClosed) Log.w(TAG, "accept failed: ${e.message}")
                }
            }
        }.also { it.isDaemon = true; it.start() }
    }

    private fun handleClient(socket: java.net.Socket) {
        socket.soTimeout = 10_000
        val reader = socket.getInputStream().bufferedReader()

        val requestLine = reader.readLine() ?: run { socket.close(); return }
        val headers = mutableMapOf<String, String>()
        while (true) {
            val line = reader.readLine() ?: break
            if (line.isEmpty()) break
            val idx = line.indexOf(':')
            if (idx > 0) headers[line.substring(0, idx).trim().lowercase()] =
                line.substring(idx + 1).trim()
        }

        val parts = requestLine.split(" ")
        val method = parts.getOrNull(0) ?: ""
        val path = parts.getOrNull(1) ?: ""

        when {
            headers["upgrade"]?.lowercase() == "websocket" ->
                handleWebSocket(socket, reader, headers)

            method == "GET" && path == "/profile" -> {
                val hash = profileHash
                if (hash != null) {
                    writeHttp(socket, 200, """{"profile_hash":"$hash"}""")
                } else {
                    writeHttp(socket, 404, """{"error":"no enrolled profile"}""")
                }
            }

            method == "POST" && path == "/enroll" -> {
                val length = headers["content-length"]?.toIntOrNull() ?: 0
                val body = CharArray(length)
                var read = 0
                while (read < length) {
                    val n = reader.read(body, read, length - read)
                    if (n < 0) break
                    read += n
                }
                handleEnroll(socket, String(body, 0, read))
            }

            else -> writeHttp(socket, 404, """{"error":"not found"}""")
        }
    }

    private fun handleEnroll(socket: java.net.Socket, body: String) {
        try {
            val json = JsonParser.parseString(body).asJsonObject
            val arr = json.getAsJsonArray("samples")
            val samples = arr.map { el ->
                val o = el.asJsonObject
                ImuSample(
                    ax = o.get("ax").asFloat, ay = o.get("ay").asFloat, az = o.get("az").asFloat,
                    gx = o.get("gx").asFloat, gy = o.get("gy").asFloat, gz = o.get("gz").asFloat,
                    mx = o.get("mx")?.asFloat ?: 0f, my = o.get("my")?.asFloat ?: 0f,
                    mz = o.get("mz")?.asFloat ?: 0f,
                    t = o.get("t")?.asLong ?: 0L,
                )
            }
            val wearingFraction = if (json.get("wearing")?.asBoolean == false) 0.5f else 1.0f
            val hash = MotionProfile.enrollHash(samples, wearingFraction)
            profileHash = hash
            writeHttp(socket, 200, """{"profile_hash":"$hash"}""")
        } catch (e: Exception) {
            writeHttp(socket, 400, """{"error":"bad enrollment payload: ${e.message}"}""")
        }
    }

    // OkHttp client-side WebSocket can't accept server connections, so the WS
    // endpoint is hand-rolled: do the upgrade handshake, then hold the socket
    // and push frames. Downstream frames from the client are ignored.
    private fun handleWebSocket(
        socket: java.net.Socket,
        reader: java.io.BufferedReader,
        headers: Map<String, String>,
    ) {
        // WS connections are idle on the client side (client only reads), so
        // clear the HTTP read timeout before entering the liveness loop.
        socket.soTimeout = 0
        val key = headers["sec-websocket-key"] ?: run { socket.close(); return }
        val accept = java.util.Base64.getEncoder().encodeToString(
            MessageDigestHolder.sha1((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").toByteArray())
        )
        val out = socket.getOutputStream()
        out.write(
            ("HTTP/1.1 101 Switching Protocols\r\n" +
                "Upgrade: websocket\r\n" +
                "Connection: Upgrade\r\n" +
                "Sec-WebSocket-Accept: $accept\r\n\r\n").toByteArray()
        )
        out.flush()

        val raw = RawWebSocket(socket)
        sockets.add(raw)
        Log.i(TAG, "ws client connected (${sockets.size} total)")

        // Keep the connection alive; detect close by reading (blocking).
        try {
            val buf = ByteArray(256)
            val input = socket.getInputStream()
            while (input.read(buf) != -1) { /* discard client frames */ }
        } catch (_: Exception) {
        } finally {
            sockets.remove(raw)
            try { socket.close() } catch (_: Exception) {}
        }
    }

    /** WebSocket impl backed by a raw socket (server side). */
    private class RawWebSocket(private val socket: java.net.Socket) : WebSocket {
        override fun send(text: String): Boolean {
            return try {
                val payload = text.toByteArray(Charsets.UTF_8)
                val out = socket.getOutputStream()
                val header = mutableListOf<Byte>()
                header.add(0x81.toByte()) // FIN + text frame
                when {
                    payload.size < 126 -> header.add(payload.size.toByte())
                    payload.size < 65536 -> {
                        header.add(126)
                        header.add((payload.size shr 8).toByte())
                        header.add(payload.size.toByte())
                    }
                    else -> {
                        header.add(127)
                        for (i in 7 downTo 0) header.add((payload.size.toLong() shr (i * 8)).toByte())
                    }
                }
                out.write(header.toByteArray())
                out.write(payload)
                out.flush()
                true
            } catch (e: Exception) {
                false
            }
        }

        override fun send(bytes: okio.ByteString): Boolean = false
        override fun close(code: Int, reason: String?): Boolean {
            return try { socket.close(); true } catch (e: Exception) { false }
        }
        override fun request(): Request = Request.Builder().url("http://localhost:$PORT").build()
        override fun queueSize(): Long = 0
        override fun cancel() {}
    }

    private object MessageDigestHolder {
        fun sha1(bytes: ByteArray): ByteArray =
            java.security.MessageDigest.getInstance("SHA-1").digest(bytes)
    }

    private fun writeHttp(socket: java.net.Socket, code: Int, body: String) {
        val status = when (code) {
            200 -> "200 OK"
            400 -> "400 Bad Request"
            else -> "404 Not Found"
        }
        val bytes = body.toByteArray(Charsets.UTF_8)
        val out = socket.getOutputStream()
        out.write(
            ("HTTP/1.1 $status\r\n" +
                "Content-Type: application/json\r\n" +
                "Content-Length: ${bytes.size}\r\n" +
                "Connection: close\r\n\r\n").toByteArray()
        )
        out.write(bytes)
        out.flush()
        socket.close()
    }
}
