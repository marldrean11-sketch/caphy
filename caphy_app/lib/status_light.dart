import 'package:flutter/material.dart';

/// The CAPHY logo is the status light. One app-wide value, fed by every
/// Api.state() poll (LAN /api/state or the cloud heartbeat snapshot), so
/// every logo on every screen shows the same colour as the web console:
///
///   clear   violet  nobody detected, cameras up
///   watch   yellow  person at Tier 1-2, or a switched-on camera is down
///   threat  red     Tier 3, any person while armed, siren or emergency
///   offline gray    the phone can't reach the laptop at all
///
/// The laptop computes clear/watch/threat itself (server.py _status_light)
/// so the phone never has to guess; only "offline" is decided here.
enum Level { clear, watch, threat, offline }

class LevelPalette {
  final Color main; // shield gradient end + status text
  final Color light; // shield gradient start
  final Color iris; // pupil
  const LevelPalette(this.main, this.light, this.iris);

  static LevelPalette lerp(LevelPalette a, LevelPalette b, double t) =>
      LevelPalette(Color.lerp(a.main, b.main, t)!,
          Color.lerp(a.light, b.light, t)!, Color.lerp(a.iris, b.iris, t)!);
}

const _palettes = {
  Level.clear: LevelPalette(Color(0xFF8B6FFF), Color(0xFFC9BCFF), Color(0xFFDCD2FF)),
  Level.watch: LevelPalette(Color(0xFFF2C14E), Color(0xFFFFE7A8), Color(0xFFFFF2CC)),
  Level.threat: LevelPalette(Color(0xFFFF4D5E), Color(0xFFFFA2AB), Color(0xFFFFD6DA)),
  Level.offline: LevelPalette(Color(0xFF55525F), Color(0xFF7D7A88), Color(0xFF9C99A8)),
};

LevelPalette paletteFor(Level l) => _palettes[l]!;
Color levelColor(Level l) => _palettes[l]!.main;

class StatusLight {
  final Level level;
  final bool armed;
  final bool siren; // siren actually sounding right now
  final bool emergency;
  final int tier;
  final String? distance; // metres, as the laptop formats it
  final String? camera; // camera the status is about
  final int camsDown;
  final int camsOn;
  final int camsOnline;

  const StatusLight({
    this.level = Level.clear,
    this.armed = false,
    this.siren = false,
    this.emergency = false,
    this.tier = 0,
    this.distance,
    this.camera,
    this.camsDown = 0,
    this.camsOn = 0,
    this.camsOnline = 0,
  });

  static final ValueNotifier<StatusLight> notifier =
      ValueNotifier(const StatusLight());
  static StatusLight get current => notifier.value;

  static int _misses = 0;

  /// Called by Api.state() with its result (null = laptop unreachable).
  /// One miss is a blip; two in a row (~4 s of 2 s polls) means offline.
  static void update(Map<String, dynamic>? st) {
    if (st == null) {
      if (++_misses >= 2) {
        notifier.value = StatusLight(level: Level.offline, armed: current.armed);
      }
      return;
    }
    _misses = 0;
    final cams = (st['cameras'] is List) ? st['cameras'] as List : const [];
    final on = cams.where((c) => c is Map && c['on'] != false).length;
    final online =
        cams.where((c) => c is Map && c['on'] != false && c['online'] == true).length;
    final siren = st['siren_active'] == true || st['siren'] == true;
    final emergency = st['emergency'] == true;
    final tier = _int(st['tier']);
    final armed = st['armed'] == true;
    Level level;
    switch (st['level']) {
      case 'threat':
        level = Level.threat;
        break;
      case 'watch':
        level = Level.watch;
        break;
      case 'clear':
        level = Level.clear;
        break;
      default:
        // an older laptop build without `level`: derive what we can
        level = (siren || emergency || (tier > 0 && (armed || tier >= 3)))
            ? Level.threat
            : (tier > 0 ? Level.watch : Level.clear);
    }
    final d = st['distance'];
    notifier.value = StatusLight(
      level: level,
      armed: armed,
      siren: siren,
      emergency: emergency,
      tier: tier,
      distance: (d == null || d == '-') ? null : '$d',
      camera: st['camera']?.toString(),
      camsDown: _int(st['cams_down']),
      camsOn: on,
      camsOnline: online,
    );
  }

  static int _int(dynamic v) =>
      v is int ? v : (v is num ? v.toInt() : int.tryParse('${v ?? ''}') ?? 0);

  /// Short label shown above the sentence, e.g. "WATCHING · TIER 2".
  String get label {
    switch (level) {
      case Level.offline:
        return 'Offline';
      case Level.threat:
        if (tier >= 3) return 'Threat · Tier 3';
        if (tier > 0) return 'Threat · armed';
        return emergency ? 'Emergency' : 'Siren on';
      case Level.watch:
        return tier > 0 ? 'Watching · Tier $tier' : 'Watching';
      case Level.clear:
        return armed ? 'Clear · armed' : 'Clear';
    }
  }

  /// One plain sentence: what is going on, where.
  String get sentence {
    final where = camera ?? 'the camera';
    switch (level) {
      case Level.offline:
        return "Can't reach the laptop.";
      case Level.threat:
        if (tier >= 3) return 'Person close to $where.';
        if (tier > 0) return 'Person at $where while armed.';
        return emergency ? 'Emergency mode is on.' : 'Siren is sounding.';
      case Level.watch:
        return tier > 0 ? 'Someone at $where.' : '$where camera is offline.';
      case Level.clear:
        return armed ? 'Armed. All clear.' : 'All clear.';
    }
  }

  /// The facts under the sentence.
  String get detail {
    final dist = distance != null ? '$distance m · ' : '';
    switch (level) {
      case Level.offline:
        return 'Alerts can\'t reach this phone until the laptop is back.';
      case Level.threat:
        if (tier == 0) return 'Turned on manually';
        return '$dist${siren ? 'siren on' : 'siren silenced'} · recording';
      case Level.watch:
        if (tier > 0) {
          return '$dist${tier == 1 ? 'snapshot saved' : 'recording a short clip'}';
        }
        return '$camsOnline of $camsOn cameras watching';
      case Level.clear:
        return camsOn == 0
            ? 'No cameras switched on'
            : '$camsOnline of $camsOn cameras watching';
    }
  }
}
