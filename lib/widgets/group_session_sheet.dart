// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/traveler_providers.dart';
import '../services/group_capacity_service.dart';

/// Real Multi-Traveler Group Mode Sheet (Domain 09 + Stage 2 Promise #8).
/// Allows creating a live Firestore group session (`Groups-createGroupSession`),
/// sharing the 6-character join code, joining an existing squad (`Groups-joinGroupSession`),
/// viewing live members, and triggering `Discovery-matchGroupSpots`.
class GroupSessionSheet extends ConsumerStatefulWidget {
  const GroupSessionSheet({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => const GroupSessionSheet(),
    );
  }

  @override
  ConsumerState<GroupSessionSheet> createState() => _GroupSessionSheetState();
}

class _GroupSessionSheetState extends ConsumerState<GroupSessionSheet> {
  final _codeController = TextEditingController();
  final _nameController = TextEditingController();
  bool _isBusy = false;
  String? _error;

  @override
  void dispose() {
    _codeController.dispose();
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _createSession() async {
    setState(() {
      _isBusy = true;
      _error = null;
    });
    try {
      final service = ref.read(groupCapacityServiceProvider);
      final prefs = ref.read(travelerPreferencesProvider);
      final hood = ref.read(selectedNeighborhoodFilterProvider) ??
          (prefs.preferredNeighborhoods.isNotEmpty
              ? prefs.preferredNeighborhoods.first
              : 'Malleshwaram');

      final session = await service.createGroupSession(
        neighborhood: hood,
        preferences: prefs,
        displayName: _nameController.text.trim().isNotEmpty
            ? _nameController.text.trim()
            : 'Host Explorer',
      );
      ref.read(activeGroupSessionProvider.notifier).state = session;
      ref.read(isGroupModeProvider.notifier).state = true;
      ref.invalidate(discoverySpotsProvider);
    } catch (e) {
      setState(() => _error = 'Could not create group session: $e');
    } finally {
      if (mounted) setState(() => _isBusy = false);
    }
  }

  Future<void> _joinSession() async {
    final code = _codeController.text.trim().toUpperCase();
    if (code.length != 6) {
      setState(() => _error = 'Please enter a valid 6-character group code.');
      return;
    }
    setState(() {
      _isBusy = true;
      _error = null;
    });
    try {
      final service = ref.read(groupCapacityServiceProvider);
      final prefs = ref.read(travelerPreferencesProvider);
      final session = await service.joinGroupSession(
        sessionCode: code,
        preferences: prefs,
        displayName: _nameController.text.trim().isNotEmpty
            ? _nameController.text.trim()
            : 'Squad Traveler',
      );
      ref.read(activeGroupSessionProvider.notifier).state = session;
      ref.read(isGroupModeProvider.notifier).state = true;
      ref.invalidate(discoverySpotsProvider);
    } catch (e) {
      setState(() => _error = 'Could not join group: $e');
    } finally {
      if (mounted) setState(() => _isBusy = false);
    }
  }

  Future<void> _leaveSession(GroupSessionModel session) async {
    setState(() {
      _isBusy = true;
      _error = null;
    });
    try {
      await ref.read(groupCapacityServiceProvider).leaveGroupSession(session.sessionId);
      ref.read(activeGroupSessionProvider.notifier).state = null;
      ref.read(groupBlendSummaryProvider.notifier).state = null;
      ref.read(isGroupModeProvider.notifier).state = false;
      ref.invalidate(discoverySpotsProvider);
    } catch (e) {
      setState(() => _error = 'Could not leave group: $e');
    } finally {
      if (mounted) setState(() => _isBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final activeSession = ref.watch(activeGroupSessionProvider);

    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 18,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.groups, color: Colors.indigo),
                const SizedBox(width: 8),
                const Expanded(
                  child: Text(
                    'Group Taste Matchmaking',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            Text(
              'Blend multiple travelers\' vibes, strict dietary needs, and budget limits into one live consensus feed via Gemini Embedding 2.',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
            ),
            const Divider(height: 20),
            if (_error != null) ...[
              Container(
                padding: const EdgeInsets.all(10),
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.red.shade200),
                ),
                child: Text(_error!, style: TextStyle(fontSize: 12, color: Colors.red.shade900)),
              ),
            ],
            if (activeSession != null) ...[
              StreamBuilder<GroupSessionModel?>(
                stream: ref.read(groupCapacityServiceProvider).watchGroupSession(activeSession.sessionId),
                initialData: activeSession,
                builder: (context, snapshot) {
                  final live = snapshot.data ?? activeSession;
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.indigo.shade50,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.indigo.shade200),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Share 6-Character Join Code',
                                  style: TextStyle(fontSize: 11, color: Colors.indigo.shade700),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  live.sessionCode,
                                  style: TextStyle(
                                    fontSize: 24,
                                    letterSpacing: 4,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.indigo.shade900,
                                  ),
                                ),
                              ],
                            ),
                            IconButton(
                              tooltip: 'Copy Code',
                              icon: const Icon(Icons.copy, color: Colors.indigo),
                              onPressed: () {
                                Clipboard.setData(ClipboardData(text: live.sessionCode));
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text('Copied group code ${live.sessionCode}')),
                                );
                              },
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Squad Members (${live.members.length}) • ${live.neighborhood}',
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 6),
                      ...live.members.map(
                        (m) => ListTile(
                          dense: true,
                          contentPadding: EdgeInsets.zero,
                          leading: const CircleAvatar(
                            radius: 14,
                            child: Icon(Icons.person, size: 15),
                          ),
                          title: Text(m.displayName, style: const TextStyle(fontSize: 13)),
                          subtitle: Text(
                            'Vibes: ${m.vibes.join(', ')} | Budget ≤ ₹${m.maxBudgetAmount}${m.dietaryRestrictions.isNotEmpty ? ' | Diet: ${m.dietaryRestrictions.join(', ')}' : ''}',
                            style: const TextStyle(fontSize: 11),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: FilledButton.icon(
                              onPressed: () {
                                ref.read(activeGroupSessionProvider.notifier).state = live;
                                ref.invalidate(discoverySpotsProvider);
                                Navigator.of(context).pop();
                              },
                              icon: const Icon(Icons.auto_awesome),
                              label: const Text('Match Blended Spots'),
                            ),
                          ),
                          const SizedBox(width: 8),
                          OutlinedButton(
                            onPressed: _isBusy ? null : () => _leaveSession(live),
                            child: const Text('Leave'),
                          ),
                        ],
                      ),
                    ],
                  );
                },
              ),
            ] else ...[
              TextField(
                controller: _nameController,
                decoration: const InputDecoration(
                  labelText: 'Your Display Name (optional)',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: _isBusy ? null : _createSession,
                  icon: const Icon(Icons.group_add),
                  label: Text(_isBusy ? 'Creating Group...' : 'Create New Group Session'),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Or Join a Friend\'s Group',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _codeController,
                      maxLength: 6,
                      textCapitalization: TextCapitalization.characters,
                      decoration: const InputDecoration(
                        labelText: '6-Char Join Code',
                        counterText: '',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilledButton.tonal(
                    onPressed: _isBusy ? null : _joinSession,
                    child: const Text('Join'),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
