// glasses/imubridge.cpp — stream real RayNeo Air IMU samples to the agent.
//
// Opens the glasses with the community C SDK, enables the IMU, and prints one
// JSON line per sample to stdout (and optionally to a TCP client):
//
//   {"t":<host_ms>,"tick":<device_tick>,"ax":..,"ay":..,"az":..,
//    "gx":..,"gy":..,"gz":..,"gxd":..,"gyd":..,"gzd":..,"ps":..,"valid":1}
//
// Usage:
//   ./imubridge                 # stdout only
//   ./imubridge --tcp 7605      # also stream to a TCP client on localhost
//   ./imubridge --seconds 30    # stop after 30s (default: run until detached)
#include <atomic>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>

#include "rayneo_api.h"

static std::atomic<bool> g_run{true};
static std::atomic<uint64_t> g_count{0};
static std::atomic<uint32_t> g_lastTick{0};
static int g_client = -1;
static std::mutex g_writeMutex;

static void emit(const RAYNEO_ImuSample &s) {
    // The SDK can deliver the same parsed sample on both the callback and the
    // poll queue. Keep exactly one record per device tick.
    uint32_t previous = g_lastTick.load(std::memory_order_relaxed);
    if (s.tick == previous) return;
    if (!g_lastTick.compare_exchange_weak(previous, s.tick)) return;

    const auto now = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now().time_since_epoch()).count();
    char line[512];
    std::snprintf(line, sizeof line,
        "{\"t\":%lld,\"tick\":%u,\"ax\":%.6f,\"ay\":%.6f,\"az\":%.6f,"
        "\"gx\":%.6f,\"gy\":%.6f,\"gz\":%.6f,"
        "\"gxd\":%.6f,\"gyd\":%.6f,\"gzd\":%.6f,"
        "\"ps\":%.3f,\"valid\":%u}\n",
        (long long)now, s.tick, s.acc[0], s.acc[1], s.acc[2],
        s.gyroRad[0], s.gyroRad[1], s.gyroRad[2],
        s.gyroDps[0], s.gyroDps[1], s.gyroDps[2], s.psensor, (unsigned)s.valid);

    std::lock_guard<std::mutex> lock(g_writeMutex);
    std::fputs(line, stdout);
    std::fflush(stdout);
    if (g_client >= 0) {
        const ssize_t n = ::send(g_client, line, std::strlen(line), MSG_NOSIGNAL);
        if (n < 0) { ::close(g_client); g_client = -1; }
    }
    g_count.fetch_add(1, std::memory_order_relaxed);
}

static void onEvent(const RAYNEO_Event *evt, void *) {
    if (!evt) return;
    switch (evt->type) {
        case RAYNEO_EVENT_IMU_SAMPLE:
            emit(evt->data.imu);
            break;
        case RAYNEO_EVENT_DEVICE_DETACHED:
            std::fprintf(stderr, "glasses detached\n");
            g_run.store(false);
            break;
        case RAYNEO_EVENT_NOTIFY:
            std::fprintf(stderr, "notify code=0x%x %s\n", evt->data.notify.code, evt->data.notify.message);
            break;
        default:
            break;
    }
}

int main(int argc, char **argv) {
    int port = 0;
    double seconds = 0;
    for (int i = 1; i < argc; ++i) {
        if (!std::strcmp(argv[i], "--tcp") && i + 1 < argc) port = std::atoi(argv[++i]);
        else if (!std::strcmp(argv[i], "--seconds") && i + 1 < argc) seconds = std::atof(argv[++i]);
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
        std::thread([server] {
            while (g_run.load()) {
                const int c = ::accept(server, nullptr, nullptr);
                if (c < 0) break;
                std::lock_guard<std::mutex> lock(g_writeMutex);
                if (g_client >= 0) ::close(g_client);
                g_client = c;
            }
        }).detach();
        std::fprintf(stderr, "imu tcp feed on 127.0.0.1:%d\n", port);
    }

    RAYNEO_Context ctx{};
    if (Rayneo_Create(&ctx) != RAYNEO_OK) { std::fprintf(stderr, "context failed\n"); return 1; }

    RAYNEO_VidPid devices[RAYNEO_SUPPORTED_DEVICE_COUNT]{};
    size_t count = 0;
    if (Rayneo_Discovery(devices, RAYNEO_SUPPORTED_DEVICE_COUNT, &count) != RAYNEO_OK || count == 0) {
        std::fprintf(stderr, "no RayNeo glasses found\n");
        Rayneo_Destroy(ctx);
        return 1;
    }
    Rayneo_SetTargetVidPid(ctx, devices[0].vid, devices[0].pid);
    Rayneo_SetEventCallback(ctx, onEvent, nullptr);

    if (Rayneo_Start(ctx, 0) != RAYNEO_OK) {
        std::fprintf(stderr, "Rayneo_Start failed\n");
        Rayneo_Destroy(ctx);
        return 1;
    }

    Rayneo_EnableImu(ctx);
    std::fprintf(stderr, "IMU enabled, streaming\n");

    const auto start = std::chrono::steady_clock::now();
    while (g_run.load()) {
        // Samples arrive on the SDK callback thread; this loop only paces and
        // enforces the optional duration.
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
        if (seconds > 0 &&
            std::chrono::duration<double>(std::chrono::steady_clock::now() - start).count() > seconds) {
            break;
        }
    }

    Rayneo_DisableImu(ctx);
    Rayneo_Stop(ctx);
    Rayneo_Destroy(ctx);
    if (g_client >= 0) ::close(g_client);
    if (server >= 0) ::close(server);
    std::fprintf(stderr, "samples emitted: %llu\n", (unsigned long long)g_count.load());
    return 0;
}
