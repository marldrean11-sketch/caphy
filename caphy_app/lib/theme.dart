import 'dart:math' as math;
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'status_light.dart';

// ---- palette (matches the CAPHY web console, web/static/style.css) ----
// Flat ink surfaces + 1px lines. The logo is the status light, so the
// status colours mean status ONLY: violet = clear, yellow = watching,
// red = threat, gray = offline (see status_light.dart). Primary actions
// are near-white with black text so they never look like an alert.
// Old names (cTeal, cTeal2, cOrange, cGreen ...) are kept as aliases so
// every screen picks up the new palette without touching each widget.
const cBg = Color(0xFF0B0A10); // ink
const cPanel = Color(0xFF121118); // surface
const cPanel2 = Color(0xFF18171F); // raised surface
const cLine = Color(0xFF26242F);
const cText = Color(0xFFECEAF2);
const cMuted = Color(0xFF8E8A9B);
const cDim = Color(0xFF625E6E);

const cViolet = Color(0xFF8B6FFF); // status: clear
const cYellow = Color(0xFFF2C14E); // status: watching
const cRed = Color(0xFFFF4D5E); // status: threat
const cGray = Color(0xFF55525F); // status: offline

const cTeal = cText; // primary action (buttons, spinners, focus)
const cTeal2 = cText; // active / highlighted text and icons
const cBlue = cViolet;
const cPurple = cViolet;
const cElectric = cText;
const cElectric2 = cText;
const cOrange = cYellow;
const cGreen = cViolet; // "online / ok" reads as the clear colour

/// Kept for the widgets that paint a primary-action fill with a gradient;
/// both stops are the same now, so it renders as a flat action colour.
const cGrad = LinearGradient(colors: [cText, cText]);

const fontSans = 'IBMPlexSans';
const fontMono = 'IBMPlexMono';

/// Tier 1-2 = watching (yellow), Tier 3 = threat (red).
Color tierColor(int t) => t >= 3 ? cRed : (t >= 1 ? cYellow : cViolet);

/// Safely coerce a JSON value (int, double, or string) to an int.
int asInt(dynamic v, [int fallback = 0]) {
  if (v is int) return v;
  if (v is num) return v.toInt();
  return int.tryParse('${v ?? ''}') ?? fallback;
}

/// The CAPHY logo - the shield+eye brand mark with a living eye that blinks
/// and glances - and the app's status light: its colour follows
/// StatusLight (violet / yellow / red / gray), crossfading over 600 ms.
/// An outline ring means armed, the eye closes when the laptop is
/// unreachable, and it pulses red while the siren is sounding.
/// Pass [level] to pin a fixed colour (e.g. on screens shown before the
/// phone is connected to a laptop).
class CaphyLogo extends StatefulWidget {
  final double size;
  final bool animate;
  final Level? level;
  const CaphyLogo({super.key, this.size = 48, this.animate = true, this.level});
  @override
  State<CaphyLogo> createState() => _CaphyLogoState();
}

class _CaphyLogoState extends State<CaphyLogo> with TickerProviderStateMixin {
  AnimationController? _c;
  late final AnimationController _morph = AnimationController(
      vsync: this, duration: const Duration(milliseconds: 600));
  late LevelPalette _from;
  late LevelPalette _to;
  late StatusLight _st;

  Level get _level => widget.level ?? _st.level;

  @override
  void initState() {
    super.initState();
    _st = StatusLight.current;
    _from = _to = paletteFor(_level);
    _morph.value = 1;
    if (widget.animate) {
      _c = AnimationController(
          vsync: this, duration: const Duration(milliseconds: 4200))
        ..repeat();
    }
    if (widget.level == null) StatusLight.notifier.addListener(_onStatus);
  }

  void _onStatus() {
    final before = _level;
    setState(() => _st = StatusLight.current);
    if (_level != before) _retarget();
  }

  @override
  void didUpdateWidget(covariant CaphyLogo old) {
    super.didUpdateWidget(old);
    if (old.level != widget.level) _retarget();
  }

  void _retarget() {
    _from = LevelPalette.lerp(_from, _to, _morph.value);
    _to = paletteFor(_level);
    _morph.forward(from: 0);
  }

  @override
  void dispose() {
    StatusLight.notifier.removeListener(_onStatus);
    _c?.dispose();
    _morph.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final pinned = widget.level != null;
    final armed = !pinned && _st.armed;
    final siren = !pinned && _st.siren;
    // eye closed: offline (gray, laptop unreachable) and idle (violet,
    // cameras switched off - resting, not a fault)
    final offline = _level == Level.offline || _level == Level.idle;
    return AnimatedBuilder(
      animation: Listenable.merge([_morph, if (_c != null) _c!]),
      builder: (_, _) {
        final pal = LevelPalette.lerp(
            _from, _to, Curves.easeOut.transform(_morph.value));
        double lid = 1.0, dx = 0.0, pulse = 0.0;
        if (_c != null) {
          // phase from the shared wall clock, so the eye continues seamlessly
          // across screens instead of restarting each time the logo mounts.
          final t = (DateTime.now().millisecondsSinceEpoch % 4200) / 4200.0;
          dx = math.sin(t * 2 * math.pi) * widget.size * 0.09; // glance
          final d = (t - 0.9).abs(); // one blink per loop
          if (d < 0.035) lid = 0.08 + (d / 0.035) * 0.92;
          if (siren) {
            pulse = (math.sin(
                        DateTime.now().millisecondsSinceEpoch / 1000 * 2 * math.pi) +
                    1) /
                2;
          }
        }
        if (offline) {
          lid = 0.06;
          dx = 0;
        }
        return CustomPaint(
          size: Size(widget.size, widget.size),
          painter: _ShieldPainter(
              lid: lid, dx: dx, pal: pal, armed: armed, pulse: pulse),
        );
      },
    );
  }
}

/// Draws the shield-with-eye brand mark to match the web logo's silhouette:
/// a pentagon shield (flat top corners, pointed bottom) filled with the
/// status colour, containing an almond eye whose pupil glances and blinks.
class _ShieldPainter extends CustomPainter {
  final double lid; // 1.0 = fully open, ~0.06 = fully closed
  final double dx; // pupil horizontal offset
  final LevelPalette pal;
  final bool armed;
  final double pulse; // 0..1 siren glow
  _ShieldPainter(
      {required this.lid,
      required this.dx,
      required this.pal,
      this.armed = false,
      this.pulse = 0});

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width, h = size.height;
    // Shield outline in a 96x96 design space, scaled to the actual size.
    final sx = w / 96.0, sy = h / 96.0;
    Offset p(double x, double y) => Offset(x * sx, y * sy);

    final path = Path()
      ..moveTo(p(48, 6).dx, p(48, 6).dy)
      ..lineTo(p(82, 18).dx, p(82, 18).dy)
      ..lineTo(p(82, 44).dx, p(82, 44).dy)
      ..cubicTo(p(82, 66).dx, p(82, 66).dy, p(66, 82).dx, p(66, 82).dy,
          p(48, 90).dx, p(48, 90).dy)
      ..cubicTo(p(30, 82).dx, p(30, 82).dy, p(14, 66).dx, p(14, 66).dy,
          p(14, 44).dx, p(14, 44).dy)
      ..lineTo(p(14, 18).dx, p(14, 18).dy)
      ..close();

    if (pulse > 0) {
      canvas.drawPath(
          path,
          Paint()
            ..color = cRed.withValues(alpha: 0.55 * pulse)
            ..maskFilter = MaskFilter.blur(BlurStyle.normal, 14 * sx * pulse + 1));
    }

    if (armed) {
      // outline ring = armed, so the colour itself keeps one meaning
      const k = 1.16; // scale about the shield's centre (48, 48)
      final cx = 48 * sx, cy = 48 * sy;
      final ring = path.transform(Float64List.fromList([
        k, 0, 0, 0, //
        0, k, 0, 0, //
        0, 0, 1, 0, //
        cx - k * cx, cy - k * cy, 0, 1,
      ]));
      canvas.drawPath(
          ring,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2.5 * sx
            ..color = pal.main.withValues(alpha: 0.6));
    }

    final shieldPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [pal.light, pal.main],
      ).createShader(Rect.fromLTWH(0, 0, w, h));
    canvas.drawPath(path, shieldPaint);

    canvas.save();
    canvas.clipPath(path);

    // almond eye (height shrinks to blink)
    final eyeW = 40.0 * sx, eyeH = 28.0 * sy * lid;
    final eyeCenter = p(48, 46);
    final eyeRect = Rect.fromCenter(center: eyeCenter, width: eyeW, height: eyeH);
    final eyePaint = Paint()..color = const Color(0xFF0E0C15);
    canvas.drawRRect(
        RRect.fromRectAndRadius(eyeRect, Radius.circular(eyeH / 2)), eyePaint);

    // round pupil (glances side to side, hides during a blink)
    if (lid > 0.4) {
      final pupilCenter = eyeCenter.translate(dx, 0);
      canvas.drawCircle(pupilCenter, 8.0 * sx, Paint()..color = pal.iris);
      canvas.drawCircle(pupilCenter.translate(-1.5 * sx, -1.5 * sy), 1.8 * sx,
          Paint()..color = Colors.white.withValues(alpha: 0.85));
    }

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _ShieldPainter old) =>
      old.lid != lid ||
      old.dx != dx ||
      old.pal.main != pal.main ||
      old.pal.iris != pal.iris ||
      old.armed != armed ||
      old.pulse != pulse;
}

/// A larger, tappable CAPHY logo for the connect / sign-in screens - floats
/// gently and bounces when tapped. Shown before a laptop is paired, so it
/// is pinned to the brand violet rather than following the status light.
class InteractiveLogo extends StatefulWidget {
  const InteractiveLogo({super.key});
  @override
  State<InteractiveLogo> createState() => InteractiveLogoState();
}

class InteractiveLogoState extends State<InteractiveLogo>
    with TickerProviderStateMixin {
  late final AnimationController _float = AnimationController(
      vsync: this, duration: const Duration(seconds: 5))
    ..repeat(reverse: true);
  late final AnimationController _bounce = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 480),
      lowerBound: 0,
      upperBound: 1);

  @override
  void dispose() {
    _float.dispose();
    _bounce.dispose();
    super.dispose();
  }

  void _tap() {
    _bounce.forward(from: 0);
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _tap,
      child: AnimatedBuilder(
        animation: Listenable.merge([_float, _bounce]),
        builder: (_, child) {
          final floatY = math.sin(_float.value * math.pi) * -6;
          // quick scale up then settle
          final b = _bounce.value;
          final scale =
              b == 0 ? 1.0 : 1.0 + math.sin(b * math.pi) * 0.12 * (1 - b * 0.3);
          return Transform.translate(
            offset: Offset(0, floatY),
            child: Transform.scale(scale: scale, child: child),
          );
        },
        child: const CaphyLogo(size: 104, level: Level.clear),
      ),
    );
  }
}

/// Small rounded colored tier badge, e.g. "Tier 2".
Widget tierPill(int t) => Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: tierColor(t).withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: tierColor(t).withValues(alpha: 0.5)),
      ),
      child: Text('Tier $t',
          style: TextStyle(
              color: tierColor(t),
              fontSize: 12,
              fontFamily: fontMono,
              fontWeight: FontWeight.w600)),
    );

/// Flat surface card with a hairline border (no glass, no shadow).
Widget panel({required Widget child, EdgeInsets? padding}) => Container(
      width: double.infinity,
      padding: padding ?? const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: cPanel,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: cLine),
      ),
      child: child,
    );

/// Press-and-hold button for actions that must never be an accidental tap
/// (disarm, silence siren): fills over [hold] and fires [onConfirmed] only
/// if the finger stays down the whole time. Matches the web console's
/// .hold buttons. With [holdRequired] false it acts as a plain tap button
/// (used for Arm, which is never dangerous).
class HoldButton extends StatefulWidget {
  final String label;
  final VoidCallback onConfirmed;
  final bool holdRequired;
  final bool filled;
  final Color color;
  final Duration hold;
  const HoldButton({
    super.key,
    required this.label,
    required this.onConfirmed,
    this.holdRequired = true,
    this.filled = false,
    this.color = cText,
    this.hold = const Duration(milliseconds: 1200),
  });
  @override
  State<HoldButton> createState() => _HoldButtonState();
}

class _HoldButtonState extends State<HoldButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c =
      AnimationController(vsync: this, duration: widget.hold)
        ..addStatusListener((s) {
          if (s == AnimationStatus.completed) {
            _c.value = 0;
            widget.onConfirmed();
          }
        });

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  void _down(_) {
    if (!widget.holdRequired) return;
    _c.forward(from: 0);
  }

  void _up(_) {
    if (!widget.holdRequired) return;
    if (_c.isAnimating) _c.animateBack(0, duration: const Duration(milliseconds: 180));
  }

  @override
  Widget build(BuildContext context) {
    final fg = widget.filled ? cBg : widget.color;
    return GestureDetector(
      onTapDown: _down,
      onTapUp: _up,
      onTapCancel: () => _up(null),
      onTap: widget.holdRequired ? null : widget.onConfirmed,
      child: Container(
        height: 50,
        decoration: BoxDecoration(
          color: widget.filled ? widget.color : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: widget.filled ? widget.color : cLine),
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(children: [
          AnimatedBuilder(
            animation: _c,
            builder: (_, _) => FractionallySizedBox(
              alignment: Alignment.centerLeft,
              widthFactor: _c.value,
              heightFactor: 1,
              child: Container(color: fg.withValues(alpha: 0.2)),
            ),
          ),
          Center(
            child: Text(widget.label,
                style: TextStyle(
                    color: fg, fontSize: 14.5, fontWeight: FontWeight.w600)),
          ),
        ]),
      ),
    );
  }
}
