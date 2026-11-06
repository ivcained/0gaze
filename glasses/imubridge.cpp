// glasses/imubridge.cpp — stream real RayNeo Air IMU samples to the agent.
//
// Opens the glasses with the community C SDK, enables the IMU, and publishes
// one JSON line per sample:
//
//   {"t":<host_ms>,"tick":<device_tick>,"ax":..,"ay":..,"az":..,
//    "gx":..,"gy":..,"gz":..,"gxd":..,"gyd":..,"gzd":..,"ps":..,"valid":1}
//
// Usage:
//   ./imubridge                     # stdout stream only
//   ./imubridge --tcp 7605          # also stream to a TCP client on localhost
//   ./imubridge --seconds 30        # stop after 30s (default: run forever)
//   ./imubridge --record PATH       # also append NDJSON to PATH (default OFF —
//                                   #   during a demo take recording is pure load)
//   ./imubridge --health PATH       # rewrite a 1-line JSON health file ~2x/s
//   ./imubridge --nudge-ms 3000     # stall this long -> re-send IMU enable
//   ./imubridge --reinit-ms 10000   # stall this long -> teardown + reopen SDK
//   ./imubridge --selftest [hz]     # synthetic samples, no glasses needed.
//                                   # Exercises queues/TCP/health end-to-end
//                                   # so the demo wiring can be preflighted
//                                   # with the glasses unplugged.
//
// Why the plumbing looks like this (see README-bridge.md for the evidence):
//
//   The 2026-11-06 corpus recording shows the feed collapsing under demo load:
//   effective rate dropping from ~497Hz to ~19Hz for 28 straight minutes —
//   exactly one sample per 50ms SDK run-loop cycle, the signature of the SDK
//   callback blocking so each cycle processes one batch. The old emit() wrote
//   to stdout and send()ed to the TCP client inline on the SDK thread: a
//   full pipe or a slow client stalled USB frame processing directly.
//
//   So the SDK callback thread now ONLY formats the line and pushes it onto
//   bounded queues (drop-oldest when full — for live gestures the newest
//   sample matters more than the backlog). Two writer threads drain them:
//   one for stdout + optional --record file, one for the TCP client. A slow
//   disk or a stalled client can now cost ITS OWN sink samples, never the
//   SDK thread and never the other sink. The TCP socket gets a send timeout
//   so even the writer thread can't wedge on a half-dead client.
//
//   All SDK calls (EnableImu, teardown, re-init) happen on the main thread:
//   the SDK makes no thread-safety guarantees about calling commands from
//   inside its own event callback, and a synchronous RoundTrip from the
//   receive thread could deadlock.
#include <atomic>
#include <chrono>
#include <cmath>
#include <csignal>
#include <cstdio>
#include <cstring>
#include <condition_variable>
#include <deque>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

#include <arpa/inet.h>
#include <fcntl.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <sys/socket.h>
#include <unistd.h>

#include "rayneo_api.h"

static std::atomic<bool> g_run{true};
static std::atomic<bool> g_detached{false};
static std::atomic<bool> g_sleeping{false};        // glasses reported SLEEP
static std::atomic<bool> g_needImuReenable{false}; // set by callback, acted on in main loop
static std::atomic<uint64_t> g_count{0};
static std::atomic<uint32_t> g_lastTick{0};
static std::atomic<int64_t> g_lastSampleMs{0};
static std::atomic<uint64_t> g_dropsOut{0}; // stdout/record queue overflows
static std::atomic<uint64_t> g_dropsTcp{0}; // tcp queue overflows
static std::atomic<uint64_t> g_tcpTimeouts{0};

static int64_t nowMs() {
    return std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now().time_since_epoch()).count();
}

// ---- Bounded sample queues -------------------------------------------------
// ~8s of buffering at 497Hz. Full -> drop the OLDEST line and keep the new
// one: a live gesture feed values low latency over backlog completeness, and
// a recording with a hole is worth more than a blocked SDK thread.
constexpr size_t kQueueCap = 4096;

struct SampleQueue {
    std::mutex mtx;
    std::condition_variable cv;
    std::deque<std::string> q;
    std::atomic<uint64_t> *drops;

    void push(std::string line) {
        {
            std::lock_guard<std::mutex> lock(mtx);
            if (q.size() >= kQueueCap) {
                q.pop_front();
                if (drops) drops->fetch_add(1, std::memory_order_relaxed);
            }
            q.push_back(std::move(line));
        }
        cv.notify_one();
    }
    bool pop(std::string &out) { // false => shutdown
        std::unique_lock<std::mutex> lock(mtx);
        cv.wait(lock, [&] { return !q.empty() || !g_run.load(); });
        if (q.empty()) return false;
        out = std::move(q.front());
        q.pop_front();
        return true;
    }
    void wake() { cv.notify_all(); }
};

static SampleQueue g_outQ{ .drops = &g_dropsOut };  // stdout + --record file
static SampleQueue g_tcpQ{ .drops = &g_dropsTcp };  // TCP client

// ---- TCP client (owned by the TCP writer thread) ----------------------------
static std::atomic<int> g_client{-1}; // newest connection wins

static void acceptLoop(int server) {
    while (g_run.load()) {
        const int c = ::accept(server, nullptr, nullptr);
        if (c < 0) break;
        int one = 1;
        ::setsockopt(c, IPPROTO_TCP, TCP_NODELAY, &one, sizeof one);
        // A send that can't complete within 200ms means the client is stalled;
        // error out and let the writer drop it rather than back up the queue.
        timeval tv{0, 200000};
        ::setsockopt(c, SOL_SOCKET, SO_SNDTIMEO, &tv, sizeof tv);
        const int old = g_client.exchange(c);
        if (old >= 0) ::close(old);
        std::fprintf(stderr, "tcp client connected\n");
    }
}

static void tcpWriterLoop() {
    std::string line;
    while (g_tcpQ.pop(line)) {
        const int c = g_client.load();
        if (c < 0) continue; // no client: drain and discard
        const ssize_t n = ::send(c, line.data(), line.size(), MSG_NOSIGNAL);
        if (n < 0 || (size_t)n < line.size()) {
            if (n < 0 && (errno == EAGAIN || errno == EWOULDBLOCK))
                g_tcpTimeouts.fetch_add(1, std::memory_order_relaxed);
            // Broken or stalled client: drop it; it can reconnect.
            int expected = c;
            if (g_client.compare_exchange_strong(expected, -1)) ::close(c);
            std::fprintf(stderr, "tcp client dropped (send failed)\n");
        }
    }
}

// ---- stdout / record writer -------------------------------------------------
static void outWriterLoop(FILE *rec) {
    std::string line;
    while (g_outQ.pop(line)) {
        std::fwrite(line.data(), 1, line.size(), stdout);
        std::fflush(stdout);
        if (rec) {
            // Disk write on OUR thread only. If it blocks, g_outQ fills and
            // drops — the SDK thread and the TCP feed never feel it.
            std::fwrite(line.data(), 1, line.size(), rec);
        }
    }
    if (rec) std::fflush(rec);
    std::fflush(stdout);
}

// ---- SDK event callback (SDK thread: format + enqueue ONLY) -----------------
static void emit(const RAYNEO_ImuSample &s) {
    // The SDK can deliver the same parsed sample on both the callback and the
    // poll queue. Keep exactly one record per device tick.
    uint32_t previous = g_lastTick.load(std::memory_order_relaxed);
    if (s.tick == previous) return;
    if (!g_lastTick.compare_exchange_weak(previous, s.tick)) return;

    const auto now = nowMs();
    g_lastSampleMs.store(now, std::memory_order_relaxed);
    char line[512];
    std::snprintf(line, sizeof line,
        "{\"t\":%lld,\"tick\":%u,\"ax\":%.6f,\"ay\":%.6f,\"az\":%.6f,"
        "\"gx\":%.6f,\"gy\":%.6f,\"gz\":%.6f,"
        "\"gxd\":%.6f,\"gyd\":%.6f,\"gzd\":%.6f,"
        "\"ps\":%.3f,\"valid\":%u}\n",
        (long long)now, s.tick, s.acc[0], s.acc[1], s.acc[2],
        s.gyroRad[0], s.gyroRad[1], s.gyroRad[2],
        s.gyroDps[0], s.gyroDps[1], s.gyroDps[2], s.psensor, (unsigned)s.valid);

    std::string str(line);
    g_outQ.push(std::string(str));
    g_tcpQ.push(std::move(str));
    g_count.fetch_add(1, std::memory_order_relaxed);
}

static void onEvent(const RAYNEO_Event *evt, void *) {
    if (!evt) return;
    switch (evt->type) {
        case RAYNEO_EVENT_IMU_SAMPLE:
            emit(evt->data.imu);
            break;
        case RAYNEO_EVENT_DEVICE_DETACHED:
            // The glasses re-enumerate on USB (worn/adjusted, display
            // renegotiation). Flag it; the main loop tears down and reopens
            // instead of exiting, so a mid-demo detach is a blip, not a dead
            // capture.
            std::fprintf(stderr, "glasses detached; will reconnect\n");
            g_detached.store(true);
            break;
        case RAYNEO_EVENT_NOTIFY:
            // Codes from rayneo_api.h: 0x7 SLEEP, 0x8 WAKE, 0xd IMU_ON,
            // 0xe IMU_OFF. The observed "notify storm" (0xd then alternating
            // 0x7/0x8) is the glasses flapping sleep/wake. Handle it here
            // instead of dying: track sleep state and re-arm the IMU on wake.
            switch (evt->data.notify.code) {
                case RAYNEO_NOTIFY_SLEEP:
                    std::fprintf(stderr, "notify SLEEP: glasses asleep, IMU paused\n");
                    g_sleeping.store(true);
                    break;
                case RAYNEO_NOTIFY_WAKE:
                    std::fprintf(stderr, "notify WAKE: glasses awake, re-arming IMU\n");
                    g_sleeping.store(false);
                    // Firmware does not reliably resume IMU streaming after a
                    // sleep cycle; re-enable once we're back on the main loop.
                    g_needImuReenable.store(true);
                    break;
                case RAYNEO_NOTIFY_IMU_OFF:
                    std::fprintf(stderr, "notify IMU_OFF%s\n",
                        g_sleeping.load() ? " (asleep, expected)" : ": re-arming IMU");
                    if (!g_sleeping.load()) g_needImuReenable.store(true);
                    break;
                case RAYNEO_NOTIFY_IMU_ON:
                    std::fprintf(stderr, "notify IMU_ON\n");
                    break;
                default:
                    std::fprintf(stderr, "notify code=0x%x %s\n",
                        evt->data.notify.code, evt->data.notify.message);
                    break;
            }
            break;
        default:
            break;
    }
}

/** Open the SDK, find the glasses, start the IMU. False on any failure. */
static bool initContext(RAYNEO_Context &ctx) {
    if (Rayneo_Create(&ctx) != RAYNEO_OK) return false;

    RAYNEO_VidPid devices[RAYNEO_SUPPORTED_DEVICE_COUNT]{};
    size_t count = 0;
    if (Rayneo_Discovery(devices, RAYNEO_SUPPORTED_DEVICE_COUNT, &count) != RAYNEO_OK || count == 0) {
        Rayneo_Destroy(ctx);
        return false;
    }
    Rayneo_SetTargetVidPid(ctx, devices[0].vid, devices[0].pid);
    Rayneo_SetEventCallback(ctx, onEvent, nullptr);

    if (Rayneo_Start(ctx, 0) != RAYNEO_OK) {
        Rayneo_Destroy(ctx);
        return false;
    }
    Rayneo_EnableImu(ctx);
    // Fresh session: reset liveness bookkeeping so the watchdog gives the
    // device a full nudge window to deliver its first sample.
    g_lastTick.store(0);
    g_lastSampleMs.store(nowMs());
    g_sleeping.store(false);
    g_needImuReenable.store(false);
    return true;
}

static void teardownContext(RAYNEO_Context &ctx) {
    Rayneo_DisableImu(ctx);
    Rayneo_Stop(ctx);
    Rayneo_Destroy(ctx);
}

// ---- Health file ------------------------------------------------------------
// Rewritten ~2x/s from the main loop. One flat JSON line so the supervisor
// (and scripts/demo-video.sh preflight) can parse it with grep/sed, no jq.
// rate_hz is a ~5s trailing average computed from snapshots taken here.
static std::deque<std::pair<int64_t, uint64_t>> g_rateWindow;

static double currentRateHz(int64_t now) {
    const uint64_t count = g_count.load(std::memory_order_relaxed);
    g_rateWindow.emplace_back(now, count);
    while (!g_rateWindow.empty() && now - g_rateWindow.front().first > 5000)
        g_rateWindow.pop_front();
    if (g_rateWindow.size() < 2) return 0.0;
    const auto &[t0, c0] = g_rateWindow.front();
    const double dt = (now - t0) / 1000.0;
    return dt > 0 ? (double)(count - c0) / dt : 0.0;
}

static void writeHealth(const char *path, int64_t now) {
    if (!path) return;
    char tmp[512];
    std::snprintf(tmp, sizeof tmp, "%s.tmp", path);
    int fd = ::open(tmp, O_WRONLY | O_CREAT | O_TRUNC, 0644);
    if (fd < 0) return;
    const int64_t last = g_lastSampleMs.load(std::memory_order_relaxed);
    char body[384];
    const int n = std::snprintf(body, sizeof body,
        "{\"pid\":%d,\"t\":%lld,\"samples\":%llu,\"rate_hz\":%.1f,\"sleeping\":%d,"
        "\"last_sample_age_ms\":%lld,\"drops_out\":%llu,\"drops_tcp\":%llu,\"tcp_timeouts\":%llu}\n",
        (int)::getpid(), (long long)now, (unsigned long long)g_count.load(std::memory_order_relaxed),
        currentRateHz(now),
        g_sleeping.load() ? 1 : 0, (long long)(now - last),
        (unsigned long long)g_dropsOut.load(), (unsigned long long)g_dropsTcp.load(),
        (unsigned long long)g_tcpTimeouts.load());
    if (n > 0) (void)!::write(fd, body, (size_t)n);
    ::close(fd);
    ::rename(tmp, path); // atomic swap: readers never see a torn line
}

static void onSignal(int sig) {
    if (sig == SIGTERM || sig == SIGINT) g_run.store(false);
    // SIGHUP is ignored: we are meant to run detached under the supervisor.
}

int main(int argc, char **argv) {
    int port = 0;
    double seconds = 0;
    int nudgeMs = 3000;    // awake + silent this long -> re-send EnableImu
    int reinitMs = 10000;  // awake + silent this long -> teardown + reopen SDK
    double selftestHz = 0; // >0: synthetic samples, no SDK
    const char *healthPath = nullptr;
    const char *recordPath = nullptr;
    for (int i = 1; i < argc; ++i) {
        if (!std::strcmp(argv[i], "--tcp") && i + 1 < argc) port = std::atoi(argv[++i]);
        else if (!std::strcmp(argv[i], "--seconds") && i + 1 < argc) seconds = std::atof(argv[++i]);
        else if (!std::strcmp(argv[i], "--nudge-ms") && i + 1 < argc) nudgeMs = std::atoi(argv[++i]);
        else if (!std::strcmp(argv[i], "--reinit-ms") && i + 1 < argc) reinitMs = std::atoi(argv[++i]);
        else if (!std::strcmp(argv[i], "--health") && i + 1 < argc) healthPath = argv[++i];
        else if (!std::strcmp(argv[i], "--record") && i + 1 < argc) recordPath = argv[++i];
        else if (!std::strcmp(argv[i], "--selftest")) {
            selftestHz = 497; // nominal device rate
            if (i + 1 < argc && argv[i + 1][0] != '-') selftestHz = std::atof(argv[++i]);
        }
    }

    struct sigaction sa{};
    sa.sa_handler = onSignal;
    sigemptyset(&sa.sa_mask);
    sigaction(SIGTERM, &sa, nullptr);
    sigaction(SIGINT, &sa, nullptr);
    sa.sa_handler = SIG_IGN;
    sigaction(SIGHUP, &sa, nullptr);
    sigaction(SIGPIPE, &sa, nullptr);

    // Recording is OPT-IN: during a demo take it is pure load (~490MB per
    // 3h session) and was part of what starved the feed.
    FILE *rec = nullptr;
    if (recordPath) {
        rec = std::fopen(recordPath, "a");
        if (!rec) { std::fprintf(stderr, "cannot open record file %s\n", recordPath); return 1; }
        std::fprintf(stderr, "recording to %s\n", recordPath);
    }

    int server = -1;
    if (port > 0) {
        server = ::socket(AF_INET, SOCK_STREAM, 0);
        int one = 1;
        ::setsockopt(server, SOL_SOCKET, SO_REUSEADDR, &one, sizeof one);
        sockaddr_in addr{};
        addr.sin_family = AF_INET;
        addr.sin_port = htons((uint16_t)port);
        addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
        if (::bind(server, (sockaddr *)&addr, sizeof addr) != 0 || ::listen(server, 1) != 0) {
            std::fprintf(stderr, "cannot listen on 127.0.0.1:%d\n", port);
            return 1;
        }
        std::thread(acceptLoop, server).detach();
        std::fprintf(stderr, "imu tcp feed on 127.0.0.1:%d\n", port);
    }
    std::thread(outWriterLoop, rec).detach();
    std::thread(tcpWriterLoop).detach();

    RAYNEO_Context ctx{};
    bool haveCtx = false;
    if (selftestHz > 0) {
        // Synthetic generator through the SAME emit() path as real samples:
        // preflights queues, TCP, health and the supervisor without glasses.
        std::fprintf(stderr, "selftest: synthetic %.0fHz, no SDK\n", selftestHz);
        g_lastSampleMs.store(nowMs());
        std::thread([selftestHz] {
            RAYNEO_ImuSample s{};
            s.valid = 1;
            s.psensor = 1.0f;
            const auto period = std::chrono::duration<double>(1.0 / selftestHz);
            auto next = std::chrono::steady_clock::now();
            uint32_t tick = 0;
            while (g_run.load()) {
                next += std::chrono::duration_cast<std::chrono::steady_clock::duration>(period);
                s.tick = ++tick;
                s.acc[2] = 9.81f;
                s.gyroDps[0] = 42.0f;
                s.gyroRad[0] = 42.0f * 0.0174532925f;
                emit(s);
                std::this_thread::sleep_until(next);
            }
        }).detach();
    } else {
        if (!initContext(ctx)) { std::fprintf(stderr, "no RayNeo glasses found\n"); return 1; }
        haveCtx = true;
        std::fprintf(stderr, "IMU enabled, streaming\n");
    }

    const auto start = std::chrono::steady_clock::now();
    const auto elapsed = [&] {
        return std::chrono::duration<double>(std::chrono::steady_clock::now() - start).count();
    };
    int64_t lastNudgeMs = 0;
    int64_t lastHealthMs = 0;
    while (g_run.load()) {
        // Samples arrive on the SDK callback thread; this loop paces, enforces
        // the optional duration, runs the stall watchdog, and reconnects after
        // a USB re-enumeration.
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
        if (seconds > 0 && elapsed() > seconds) break;

        // Deferred IMU re-arm requested by the notify callback (wake / IMU_OFF).
        if (haveCtx && g_needImuReenable.exchange(false)) {
            if (Rayneo_EnableImu(ctx) == RAYNEO_OK)
                std::fprintf(stderr, "re-sent IMU enable\n");
            else
                std::fprintf(stderr, "IMU re-enable failed\n");
        }

        // Stall watchdog. Silence while asleep is expected; silence while
        // awake means the SDK wedged without dying.
        if (haveCtx && !g_sleeping.load()) {
            const int64_t silence = nowMs() - g_lastSampleMs.load(std::memory_order_relaxed);
            if (silence > reinitMs) {
                std::fprintf(stderr,
                    "watchdog: no samples for %lldms while awake; reinitializing SDK\n",
                    (long long)silence);
                g_detached.store(true); // reuse the teardown/reopen path below
            } else if (silence > nudgeMs && nowMs() - lastNudgeMs > nudgeMs) {
                lastNudgeMs = nowMs();
                std::fprintf(stderr, "watchdog: %lldms silent; nudging IMU enable\n",
                    (long long)silence);
                Rayneo_EnableImu(ctx);
            }
        }

        if (g_detached.exchange(false)) {
            teardownContext(ctx);
            haveCtx = false;
            // The device node takes a moment to come back; retry until it does
            // or the run deadline passes.
            while (g_run.load()) {
                std::this_thread::sleep_for(std::chrono::milliseconds(1000));
                if (initContext(ctx)) {
                    haveCtx = true;
                    lastNudgeMs = 0;
                    std::fprintf(stderr, "glasses reattached, streaming\n");
                    break;
                }
                if (seconds > 0 && elapsed() > seconds) break;
            }
            if (!haveCtx) break;
        }

        if (healthPath && nowMs() - lastHealthMs >= 500) {
            lastHealthMs = nowMs();
            writeHealth(healthPath, lastHealthMs);
        }
    }

    g_run.store(false);
    g_outQ.wake();
    g_tcpQ.wake();
    if (healthPath) writeHealth(healthPath, nowMs());
    if (haveCtx) teardownContext(ctx);
    if (g_client.load() >= 0) ::close(g_client.load());
    if (server >= 0) ::close(server);
    if (rec) std::fclose(rec);
    std::fprintf(stderr, "samples emitted: %llu (drops out=%llu tcp=%llu)\n",
        (unsigned long long)g_count.load(),
        (unsigned long long)g_dropsOut.load(), (unsigned long long)g_dropsTcp.load());
    return 0;
}
