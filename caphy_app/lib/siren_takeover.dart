import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'api.dart';
import 'status_light.dart';
import 'theme.dart';

/// Full-screen takeover while the laptop's siren is sounding. Tier 1-2
/// still arrive as normal push banners; this is only for the moment that
/// needs a decision: silence it (hold, so a pocket tap can't), look at the
/// live feed, or dismiss the sheet and let it keep sounding.
class SirenTakeover extends StatefulWidget {
  final VoidCallback onOpenLive;
  const SirenTakeover({super.key, required this.onOpenLive});
  @override
  State<SirenTakeover> createState() => _SirenTakeoverState();
}

class _SirenTakeoverState extends State<SirenTakeover>
    with SingleTickerProviderStateMixin {
  late final AnimationController _shake = AnimationController(
      vsync: this, duration: const Duration(milliseconds: 420));
  bool _wasSounding = false;
  bool _dismissed = false;

  @override
  void initState() {
    super.initState();
    StatusLight.notifier.addListener(_onStatus);
  }

  @override
  void dispose() {
    StatusLight.notifier.removeListener(_onStatus);
    _shake.dispose();
    super.dispose();
  }

  void _onStatus() {
    final sounding = StatusLight.current.siren;
    if (sounding && !_wasSounding) {
      _dismissed = false; // a new incident always shows the sheet again
      HapticFeedback.heavyImpact();
      Future.delayed(const Duration(milliseconds: 450), () {
        if (mounted) _shake.forward(from: 0);
      });
    }
    _wasSounding = sounding;
    setState(() {});
  }

  Future<void> _silence() async {
    final ok = await Api.silenceSiren();
    await Api.state();
    if (!mounted || ok) return;
    ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Couldn't silence the siren. Try again.")));
  }

  @override
  Widget build(BuildContext context) {
    final st = StatusLight.current;
    final show = st.siren && !_dismissed;
    return IgnorePointer(
      ignoring: !show,
      child: AnimatedSlide(
        offset: show ? Offset.zero : const Offset(0, 1),
        duration: const Duration(milliseconds: 480),
        curve: Curves.easeOutCubic,
        child: AnimatedBuilder(
          animation: _shake,
          builder: (_, child) => Transform.translate(
            offset: Offset(math.sin(_shake.value * math.pi * 4) * 6 * (1 - _shake.value), 0),
            child: child,
          ),
          child: Material(
            color: const Color(0xFF140609),
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 28, 20, 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const CaphyLogo(size: 64),
                    const SizedBox(height: 22),
                    Text(st.label.toUpperCase(),
                        style: const TextStyle(
                            color: cRed,
                            fontFamily: fontMono,
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            letterSpacing: 1.6)),
                    const SizedBox(height: 8),
                    Text(st.sentence,
                        style: const TextStyle(
                            color: cText,
                            fontSize: 26,
                            fontWeight: FontWeight.w600,
                            height: 1.2)),
                    const SizedBox(height: 6),
                    Text(st.detail,
                        style: const TextStyle(
                            color: Color(0xFFD9A2A9),
                            fontFamily: fontMono,
                            fontSize: 13)),
                    const Spacer(),
                    HoldButton(
                        label: 'Hold to silence siren',
                        filled: true,
                        color: cRed,
                        onConfirmed: _silence),
                    const SizedBox(height: 10),
                    Row(children: [
                      Expanded(
                        child: _ghost('Open live view', () {
                          setState(() => _dismissed = true);
                          widget.onOpenLive();
                        }),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _ghost('Dismiss',
                            () => setState(() => _dismissed = true)),
                      ),
                    ]),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _ghost(String label, VoidCallback onTap) => OutlinedButton(
        onPressed: onTap,
        style: OutlinedButton.styleFrom(
          foregroundColor: const Color(0xFFF3C8CD),
          side: const BorderSide(color: Color(0xFF3A1218)),
          minimumSize: const Size.fromHeight(46),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
        child: Text(label),
      );
}
