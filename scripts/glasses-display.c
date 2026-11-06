// glasses-display: RayNeo display helper for the 0Gaze bench.
//
//   glasses-display info     dump every online display (id, bounds, mirror state, active index)
//   glasses-display origin   print "x,y" origin of the glasses display for --window-position
//                            (fails loudly if the glasses are still mirrored)
//   glasses-display mirror   restore the hardware mirror (glasses mirrors built-in)
//
// Build:
//   clang -O2 glasses-display.c -framework ApplicationServices -o glasses-display
#include <ApplicationServices/ApplicationServices.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_DISPLAYS 16

static int find_displays(CGDirectDisplayID *builtin, CGDirectDisplayID *glasses) {
  CGDirectDisplayID ids[MAX_DISPLAYS];
  uint32_t count = 0;
  if (CGGetOnlineDisplayList(MAX_DISPLAYS, ids, &count) != kCGErrorSuccess) {
    fprintf(stderr, "CGGetOnlineDisplayList failed\n");
    return 0;
  }
  *builtin = kCGNullDirectDisplay;
  *glasses = kCGNullDirectDisplay;
  for (uint32_t i = 0; i < count; i++) {
    CGRect b = CGDisplayBounds(ids[i]);
    if (b.size.width < 1 || b.size.height < 1) continue; // dormant endpoint
    if (CGDisplayIsBuiltin(ids[i])) {
      *builtin = ids[i];
    } else if (*glasses == kCGNullDirectDisplay) {
      *glasses = ids[i]; // mirrored slaves are inactive; bounds filter above already dropped dormant endpoints
    }
  }
  return count;
}

static int cmd_info(void) {
  CGDirectDisplayID ids[MAX_DISPLAYS];
  uint32_t count = 0;
  CGGetOnlineDisplayList(MAX_DISPLAYS, ids, &count);
  CGDirectDisplayID active[MAX_DISPLAYS];
  uint32_t acount = 0;
  CGGetActiveDisplayList(MAX_DISPLAYS, active, &acount);
  printf("online displays: %u (active: %u)\n", count, acount);
  for (uint32_t i = 0; i < count; i++) {
    CGRect b = CGDisplayBounds(ids[i]);
    int act = -1;
    for (uint32_t j = 0; j < acount; j++) if (active[j] == ids[i]) act = (int)j + 1;
    printf("  id=%u  %s %s %s bounds=(%.0f,%.0f %.0fx%.0f) mirrorOf=%u activeIndex=%d\n",
           ids[i],
           CGDisplayIsBuiltin(ids[i]) ? "builtin" : "external",
           CGDisplayIsMain(ids[i]) ? "main" : "",
           CGDisplayIsActive(ids[i]) ? "active" : "inactive",
           b.origin.x, b.origin.y, b.size.width, b.size.height,
           CGDisplayMirrorsDisplay(ids[i]), act);
  }
  return 0;
}

static int cmd_origin(void) {
  CGDirectDisplayID builtin, glasses;
  find_displays(&builtin, &glasses);
  if (glasses == kCGNullDirectDisplay) {
    fprintf(stderr, "no glasses display found (is the RayNeo attached?)\n");
    return 1;
  }
  if (CGDisplayMirrorsDisplay(glasses) != kCGNullDirectDisplay) {
    fprintf(stderr, "glasses display %u is still MIRRORED — run ~/bin/glasses-extended first\n", glasses);
    return 1;
  }
  CGRect b = CGDisplayBounds(glasses);
  printf("%.0f,%.0f\n", b.origin.x, b.origin.y);
  return 0;
}

static int cmd_mirror(void) {
  CGDirectDisplayID builtin, glasses;
  find_displays(&builtin, &glasses);
  if (glasses == kCGNullDirectDisplay || builtin == kCGNullDirectDisplay) {
    fprintf(stderr, "need both builtin and glasses displays online\n");
    return 1;
  }
  CGDisplayConfigRef cfg;
  if (CGBeginDisplayConfiguration(&cfg) != kCGErrorSuccess) {
    fprintf(stderr, "CGBeginDisplayConfiguration failed\n");
    return 1;
  }
  CGConfigureDisplayMirrorOfDisplay(cfg, glasses, builtin);
  CGError err = CGCompleteDisplayConfiguration(cfg, kCGConfigureForSession);
  if (err != kCGErrorSuccess) {
    fprintf(stderr, "session mirror config failed: %d\n", err);
    return 1;
  }
  // Permanent pass; 1001 when the identical config is already active is harmless.
  if (CGBeginDisplayConfiguration(&cfg) == kCGErrorSuccess) {
    CGConfigureDisplayMirrorOfDisplay(cfg, glasses, builtin);
    CGCompleteDisplayConfiguration(cfg, kCGConfigurePermanently);
  }
  printf("glasses display %u now mirrors builtin %u\n", glasses, builtin);
  return 0;
}

static int cmd_extend(void) {
  CGDirectDisplayID builtin, glasses;
  find_displays(&builtin, &glasses);
  if (glasses == kCGNullDirectDisplay || builtin == kCGNullDirectDisplay) {
    fprintf(stderr, "need both builtin and glasses displays online\n");
    return 1;
  }
  if (CGDisplayMirrorsDisplay(glasses) == kCGNullDirectDisplay &&
      CGDisplayMirrorsDisplay(builtin) == kCGNullDirectDisplay) {
    printf("already extended\n");
    return 0;
  }
  CGFloat builtin_w = CGDisplayBounds(builtin).size.width;
  CGDisplayConfigRef cfg;
  if (CGBeginDisplayConfiguration(&cfg) != kCGErrorSuccess) {
    fprintf(stderr, "CGBeginDisplayConfiguration failed\n");
    return 1;
  }
  // Un-mirror both sides (covers builtin-master and the re-forced glasses-master
  // states), keep builtin main at (0,0), park the glasses to its right.
  CGConfigureDisplayMirrorOfDisplay(cfg, glasses, kCGNullDirectDisplay);
  CGConfigureDisplayMirrorOfDisplay(cfg, builtin, kCGNullDirectDisplay);
  CGConfigureDisplayOrigin(cfg, builtin, 0, 0);
  CGConfigureDisplayOrigin(cfg, glasses, (int)builtin_w, 0);
  CGError err = CGCompleteDisplayConfiguration(cfg, kCGConfigureForSession);
  if (err != kCGErrorSuccess) {
    fprintf(stderr, "session extend failed: %d\n", err);
    return 1;
  }
  if (CGDisplayMirrorsDisplay(glasses) != kCGNullDirectDisplay) {
    fprintf(stderr, "glasses still mirrored after session config\n");
    return 1;
  }
  // Permanent pass so replug-free persists; 1001 = identical config already active, harmless.
  if (CGBeginDisplayConfiguration(&cfg) == kCGErrorSuccess) {
    CGConfigureDisplayMirrorOfDisplay(cfg, glasses, kCGNullDirectDisplay);
    CGConfigureDisplayMirrorOfDisplay(cfg, builtin, kCGNullDirectDisplay);
    CGConfigureDisplayOrigin(cfg, builtin, 0, 0);
    CGConfigureDisplayOrigin(cfg, glasses, (int)builtin_w, 0);
    CGError perr = CGCompleteDisplayConfiguration(cfg, kCGConfigurePermanently);
    if (perr != kCGErrorSuccess && perr != 1001)
      fprintf(stderr, "note: permanent pass returned %d (session config applied)\n", perr);
  }
  printf("glasses display %u extended (un-mirrored from builtin %u)\n", glasses, builtin);
  return 0;
}

static int cmd_bounds(void) {
  CGDirectDisplayID builtin, glasses;
  find_displays(&builtin, &glasses);
  if (glasses == kCGNullDirectDisplay) {
    fprintf(stderr, "no glasses display found (is the RayNeo attached?)\n");
    return 1;
  }
  if (CGDisplayMirrorsDisplay(glasses) != kCGNullDirectDisplay) {
    fprintf(stderr, "glasses display %u is still MIRRORED — run: glasses-display extend\n", glasses);
    return 1;
  }
  CGRect b = CGDisplayBounds(glasses);
  printf("%.0f,%.0f,%.0f,%.0f\n", b.origin.x, b.origin.y, b.size.width, b.size.height);
  return 0;
}

// wincheck: list on-screen windows with their bounds and which display they sit on.
// Window metadata needs no Screen Recording permission, so this works where
// screencapture is blocked. Prints: owner  pid  bounds  display=(builtin|glasses|other)
static int cmd_wincheck(int argc, char **argv) {
  int all = (argc > 2 && !strcmp(argv[2], "all"));
  CGDirectDisplayID builtin, glasses;
  find_displays(&builtin, &glasses);
  CGRect gb = (glasses != kCGNullDirectDisplay) ? CGDisplayBounds(glasses) : CGRectZero;
  CGRect bb = (builtin != kCGNullDirectDisplay) ? CGDisplayBounds(builtin) : CGRectZero;
  CFArrayRef wins = CGWindowListCopyWindowInfo(all ? kCGWindowListOptionAll : (kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements), kCGNullWindowID);
  if (!wins) { fprintf(stderr, "CGWindowListCopyWindowInfo failed\n"); return 1; }
  CFIndex n = CFArrayGetCount(wins);
  int on_glasses = 0;
  for (CFIndex i = 0; i < n; i++) {
    CFDictionaryRef w = CFArrayGetValueAtIndex(wins, i);
    CFStringRef owner = CFDictionaryGetValue(w, kCGWindowOwnerName);
    CFNumberRef pidN = CFDictionaryGetValue(w, kCGWindowOwnerPID);
    CFDictionaryRef b = CFDictionaryGetValue(w, kCGWindowBounds);
    if (!owner || !b) continue;
    CGRect r;
    if (!CGRectMakeWithDictionaryRepresentation(b, &r)) continue;
    if (r.size.width < 50 || r.size.height < 50) continue; // skip menu bar/status items
    int pid = 0;
    if (pidN) CFNumberGetValue(pidN, kCFNumberIntType, &pid);
    // A window belongs to a display if its center is inside that display's rect.
    CGPoint c = { CGRectGetMidX(r), CGRectGetMidY(r) };
    const char *where = "other";
    if (glasses != kCGNullDirectDisplay && CGRectContainsPoint(gb, c)) { where = "GLASSES"; on_glasses++; }
    else if (builtin != kCGNullDirectDisplay && CGRectContainsPoint(bb, c)) where = "builtin";
    char name[128] = {0};
    CFStringGetCString(owner, name, sizeof(name) - 1, kCFStringEncodingUTF8);
    printf("  %-28s pid=%-6d (%.0f,%.0f %.0fx%.0f) %s\n", name, pid, r.origin.x, r.origin.y, r.size.width, r.size.height, where);
  }
  CFRelease(wins);
  printf("windows centered on glasses display: %d\n", on_glasses);
  return 0;
}

int main(int argc, char **argv) {
  if (argc < 2) { fprintf(stderr, "usage: glasses-display info|origin|bounds|extend|mirror|wincheck\n"); return 2; }
  if (!strcmp(argv[1], "info")) return cmd_info();
  if (!strcmp(argv[1], "origin")) return cmd_origin();
  if (!strcmp(argv[1], "bounds")) return cmd_bounds();
  if (!strcmp(argv[1], "extend")) return cmd_extend();
  if (!strcmp(argv[1], "mirror")) return cmd_mirror();
  if (!strcmp(argv[1], "wincheck")) return cmd_wincheck(argc, argv);
  fprintf(stderr, "unknown command: %s\n", argv[1]);
  return 2;
}
