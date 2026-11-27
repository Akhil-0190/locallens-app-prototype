// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/monetization.dart';
import '../providers/monetization_providers.dart';

/// Modal sheet for requesting 1-on-1 Local Guidance sessions via `Monetization-requestLocalGuidance`.
class GuidanceRequestSheet extends ConsumerStatefulWidget {
  final String guideUserId;
  final String guideName;
  final String neighborhood;

  const GuidanceRequestSheet({
    super.key,
    required this.guideUserId,
    required this.guideName,
    this.neighborhood = 'Malleshwaram',
  });

  @override
  ConsumerState<GuidanceRequestSheet> createState() => _GuidanceRequestSheetState();
}

class _GuidanceRequestSheetState extends ConsumerState<GuidanceRequestSheet> {
  DateTime _selectedDate = DateTime.now().add(const Duration(days: 2));
  String _selectedTimeOfDay = 'Morning (8:00 AM – 11:00 AM)';
  String _selectedCulturalFocus = 'Heritage Walk & Traditional Temples';
  final TextEditingController _notesController = TextEditingController();
  bool _saved = false;

  final List<String> _timeSlots = [
    'Morning (8:00 AM – 11:00 AM)',
    'Afternoon (1:00 PM – 4:00 PM)',
    'Sunset & Evening (5:00 PM – 8:00 PM)',
  ];

  final List<String> _culturalFoci = [
    'Heritage Walk & Traditional Temples',
    'Street Food Trail & Filter Coffee Roasters',
    'Traditional Artisan Crafts & Weaving',
    'Old Bangalore Photography & Architecture',
  ];

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  bool _isDispatching = false;
  String? _dispatchError;
  String? _confirmedBookingId;

  Future<void> _handleLiveBooking() async {
    setState(() {
      _isDispatching = true;
      _dispatchError = null;
    });

    final dateStr =
        '${_selectedDate.year}-${_selectedDate.month.toString().padLeft(2, '0')}-${_selectedDate.day.toString().padLeft(2, '0')}';
    final notes = _notesController.text.trim();

    try {
      final service = ref.read(monetizationServiceProvider);
      final result = await service.requestLocalGuidance(
        offeringId: 'offering_${widget.neighborhood.toLowerCase()}_01',
        scheduledDateTime: dateStr,
        specialNotes: notes.isNotEmpty ? notes : null,
      );

      final bookingId = result['bookingId']?.toString() ?? '';
      if (bookingId.isEmpty) {
        throw Exception('Missing booking ID from server.');
      }

      await service.confirmGuidancePayment(bookingId: bookingId);

      if (!mounted) return;
      setState(() {
        _isDispatching = false;
        _confirmedBookingId = bookingId;
        _saved = true;
      });
    } catch (e) {
      // Offline fallback: save as local draft
      _handleSaveDraft();
      if (!mounted) return;
      setState(() {
        _isDispatching = false;
        _dispatchError = 'Could not complete live booking ($e). Saved locally as draft.';
      });
    }
  }

  void _handleSaveDraft() {
    final draft = LocalGuidanceRequestDraft(
      guideUserId: widget.guideUserId,
      preferredDate:
          '${_selectedDate.year}-${_selectedDate.month.toString().padLeft(2, '0')}-${_selectedDate.day.toString().padLeft(2, '0')}',
      timeOfDay: _selectedTimeOfDay,
      neighborhood: widget.neighborhood,
      culturalFocus: _selectedCulturalFocus,
      notes: _notesController.text.trim(),
      createdAt: DateTime.now(),
    );

    ref.read(monetizationNotifierProvider.notifier).saveGuidanceRequestDraft(draft);

    setState(() {
      _saved = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
        left: 20,
        right: 20,
        top: 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    '1-on-1 Local Guidance',
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            Text(
              'Request guidance with ${widget.guideName} in ${widget.neighborhood}',
              style: TextStyle(color: Colors.grey.shade700, fontSize: 13),
            ),
            const SizedBox(height: 12),

            // Mandatory Honest Disclosure Banner
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.blue.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.blue.shade200),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline, color: Colors.blue.shade800, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Book a live 1-on-1 local cultural walkthrough with ${widget.guideName}. Funds are held in escrow until session completion.',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.blue.shade900,
                        height: 1.3,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            if (_saved) ...[
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.green.shade300),
                ),
                child: Row(
                  children: [
                    Icon(Icons.check_circle, color: Colors.green.shade700),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Text(
                        'Guidance request drafted locally! When booking dispatches open, you can send it directly to this contributor.',
                        style: TextStyle(fontSize: 13, color: Colors.green),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Close'),
                ),
              ),
            ] else ...[
              // Date picker
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.calendar_today, size: 18),
                      label: Text(
                        'Date: ${_selectedDate.day}/${_selectedDate.month}/${_selectedDate.year}',
                        style: const TextStyle(fontSize: 13),
                      ),
                      onPressed: () async {
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: _selectedDate,
                          firstDate: DateTime.now(),
                          lastDate: DateTime.now().add(const Duration(days: 90)),
                        );
                        if (picked != null) {
                          setState(() => _selectedDate = picked);
                        }
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              const Text(
                'Preferred Time Window',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
              ),
              const SizedBox(height: 6),
              DropdownButtonFormField<String>(
                initialValue: _selectedTimeOfDay,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.access_time),
                ),
                items: _timeSlots
                    .map((s) => DropdownMenuItem(value: s, child: Text(s, style: const TextStyle(fontSize: 13))))
                    .toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _selectedTimeOfDay = val);
                },
              ),
              const SizedBox(height: 12),

              const Text(
                'Cultural Discovery Focus',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
              ),
              const SizedBox(height: 6),
              DropdownButtonFormField<String>(
                initialValue: _selectedCulturalFocus,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.explore_outlined),
                ),
                items: _culturalFoci
                    .map((f) => DropdownMenuItem(value: f, child: Text(f, style: const TextStyle(fontSize: 13))))
                    .toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _selectedCulturalFocus = val);
                },
              ),
              const SizedBox(height: 12),

              const Text(
                'Personal Requests / Focus Notes',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
              ),
              const SizedBox(height: 6),
              TextField(
                controller: _notesController,
                maxLines: 2,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  hintText: 'e.g. Interested in finding antique brass shops and traditional silk weaving',
                ),
              ),
              const SizedBox(height: 20),

              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.teal.shade700,
                        foregroundColor: Colors.white,
                      ),
                      icon: _isDispatching
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Icon(Icons.send_outlined),
                      label: Text(_isDispatching ? 'Dispatching...' : 'Book 1-on-1 Guidance'),
                      onPressed: _isDispatching ? null : _handleLiveBooking,
                    ),
                  ),
                  const SizedBox(width: 10),
                  OutlinedButton(
                    onPressed: _handleSaveDraft,
                    child: const Text('Save Draft'),
                  ),
                ],
              ),
              if (_dispatchError != null) ...[
                const SizedBox(height: 10),
                Text(
                  _dispatchError!,
                  style: TextStyle(color: Colors.amber.shade900, fontSize: 12),
                ),
              ],
              if (_confirmedBookingId != null) ...[
                const SizedBox(height: 10),
                Text(
                  'Booking confirmed on backend: $_confirmedBookingId',
                  style: TextStyle(color: Colors.green.shade800, fontSize: 12, fontWeight: FontWeight.bold),
                ),
              ],
            ],
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}
